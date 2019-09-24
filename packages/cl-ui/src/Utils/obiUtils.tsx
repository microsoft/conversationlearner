/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import * as BB from 'botbuilder'
import * as Util from './util'
import * as DialogEditing from './dialogEditing'
import * as DialogUtils from './dialogUtils'
import * as OBITypes from '../types/obiTypes'
import * as textgen from 'txtgen'
import Plain from 'slate-plain-serializer'
import { REPROMPT_SELF } from '../types/const'
import { ImportedAction } from '../types/models'
import { User } from '../types'

export async function toTranscripts(
    appDefinition: CLM.AppDefinition,
    appId: string,
    user: User,
    fetchActivitiesAsync: (appId: string, trainDialog: CLM.TrainDialog, userName: string, userId: string, useMarkdown: boolean) => Promise<CLM.TeachWithActivities>
): Promise<BB.Transcript[]> {

    const definitions = {
        entities: appDefinition.entities,
        actions: appDefinition.actions,
        trainDialogs: []
    }

    return Promise.all(appDefinition.trainDialogs.map(td => getActivities(appId, td, user, definitions, fetchActivitiesAsync)))
}

export interface OBIImportData {
    appId: string,
    files: File[],
    autoCreate: boolean,
    autoMerge: boolean,
    autoActionCreate: boolean
}

export interface ComposerDialog {
    dialogs: OBITypes.OBIDialog[]
    luMap: Map<string, string[]>
    lgMap: Map<string, CLM.LGItem>
}

async function getActivities(appId: string, trainDialog: CLM.TrainDialog, user: User, definitions: CLM.AppDefinition,
    fetchActivitiesAsync: (appId: string, trainDialog: CLM.TrainDialog, userName: string, userId: string, useMarkdown: boolean) => Promise<CLM.TeachWithActivities>
): Promise<BB.Transcript> {
    const newTrainDialog = Util.deepCopy(trainDialog)
    newTrainDialog.definitions = definitions

    const teachWithActivities = await fetchActivitiesAsync(appId, newTrainDialog, user.name, user.id, false)
    return { activities: teachWithActivities.activities }
}

interface TranscriptActionInput {
    entityName: string
}

export interface TranscriptActionCall {
    type: string
    actionName: string
    actionInput: TranscriptActionInput[]
    actionOutput: OBIActionOutput[]
}

export interface OBIActionOutput {
    entityName: string,
    value?: string
}

export function isSameActivity(activity1: BB.Activity, activity2: BB.Activity): boolean {
    if ((activity1 && !activity2)
        || (activity2 && !activity1)
        || (activity1.text !== activity2.text)) {
        return false
    }
    const attachments1 = activity1.attachments ? JSON.stringify(activity1.attachments) : null
    const attachments2 = activity2.attachments ? JSON.stringify(activity2.attachments) : null
    if (attachments1 !== attachments2) {
        return false
    }
    return true
}

export async function lgMapFromLGFiles(lgFiles: File[] | null): Promise<Map<string, CLM.LGItem>> {
    const lgMap: Map<string, CLM.LGItem> = new Map()
    if (lgFiles) {
        for (const lgFile of lgFiles) {
            if (lgFile.name.endsWith('.lg')) {
                const fileText = await Util.readFileAsync(lgFile)
                CLM.ObiUtils.addToLGMap(fileText, lgMap)
            }
            else {
                throw new Error(`Expecting .lg file.\n\n Given: ${lgFile.name}`)
            }
        }
    }
    return lgMap
}

// Given a transcript file, replace and LG references with actual LG content
export function substituteLG(transcript: BB.Activity[], lgMap: Map<string, CLM.LGItem>): void {

    for (let activity of transcript) {
        if (activity.type && activity.type === 'message' && activity.from.role === 'bot') {

            if (activity.text.startsWith('[') && activity.text.endsWith(']')) {

                const lgName = activity.text.substring(activity.text.indexOf("[") + 1, activity.text.lastIndexOf("]")).trim()
                let response = lgMap.get(lgName)
                if (!response) {
                    throw new Error(`LG name ${lgName} undefined`)
                }

                activity.text = (response.suggestions.length > 0) ? JSON.stringify(response) : response.text
            }
        }
    }
}

export async function addRepromptExamples(
    appId: string,
    trainDialog: CLM.TrainDialog,
    actions: CLM.ActionBase[],
    createTrainDialogThunkAsync: (appId: string, newTrainDialog: CLM.TrainDialog) => Promise<CLM.TrainDialog>): Promise<void> {

    const repromptDialogs: CLM.TrainDialog[] = []

    trainDialog.rounds.forEach((round, roundIndex) => {
        round.scorerSteps.forEach((ss, ssIndex) => {
            const action = actions.find(a => a.actionId === ss.labelAction)
            if (!action) {
                throw new Error("Undefined action")
            }
            if (action.repromptActionId) {
                const repromptAction = actions.find(a => a.actionId === ss.labelAction)
                if (!repromptAction) {
                    throw new Error("Undefined action")
                }

                const newTrainDialog = Util.deepCopy(trainDialog)
                const newExtractorStep: CLM.TrainExtractorStep = {
                    textVariations: makeOutOfDomainTextVariations()
                }
                const newScorerStep: CLM.TrainScorerStep = {
                    input: ss.input,
                    labelAction: action.repromptActionId === REPROMPT_SELF ? action.actionId : action.repromptActionId,
                    logicResult: undefined,
                    scoredAction: {
                        actionId: repromptAction.actionId,
                        payload: repromptAction.payload,
                        isTerminal: repromptAction.isTerminal,
                        actionType: repromptAction.actionType,
                        score: 100
                    }
                }
                const newRound: CLM.TrainRound = {
                    extractorStep: newExtractorStep,
                    scorerSteps: [newScorerStep]
                }

                newTrainDialog.rounds.splice(roundIndex + 1, 0, newRound)
                repromptDialogs.push(newTrainDialog)
            }
        })
    })
    // Add reprompt train dialogs
    for (const td of repromptDialogs) {
        await createTrainDialogThunkAsync(appId, td)
    }

    for (let i = 0; i < 1000; i = i + 1 ) {
        console.log(`"${textgen.sentence()}",`)
    }
}

function makeOutOfDomainTextVariations(): CLM.TextVariation[] {
    const textVariations: CLM.TextVariation[] = []
    while (textVariations.length < CLM.MAX_TEXT_VARIATIONS) {
        textVariations.push({
            text: textgen.sentence(),
            labelEntities: []
        })
    }
    return textVariations
}

// Convert .transcript file into a TrainDialog
export async function trainDialogFromTranscriptImport(
    transcript: BB.Activity[],
    lgMap: Map<string, CLM.LGItem> | null,
    entities: CLM.EntityBase[],
    actions: CLM.ActionBase[],
    app: CLM.AppBase,

    createActionThunkAsync?: (appId: string, action: CLM.ActionBase) => Promise<CLM.ActionBase | null>,
    createEntityThunkAsync?: (appId: string, entity: CLM.EntityBase) => Promise<CLM.EntityBase | null>
): Promise<CLM.TrainDialog> {
    const transcriptHash = Util.hashText(JSON.stringify(transcript))

    let trainDialog: CLM.TrainDialog = {
        trainDialogId: undefined!,
        version: undefined!,
        packageCreationId: undefined!,
        packageDeletionId: undefined!,
        sourceLogDialogId: undefined!,
        initialFilledEntities: [],
        rounds: [],
        tags: [],
        description: '',
        createdDateTime: new Date().toJSON(),
        lastModifiedDateTime: new Date().toJSON(),
        // It's initially invalid
        validity: CLM.Validity.INVALID,
        clientData: { importHashes: [transcriptHash] }
    }

    // If I have an LG map, substitute in LG values
    if (lgMap) {
        substituteLG(transcript, lgMap)
    }

    let curRound: CLM.TrainRound | null = null
    let nextFilledEntities: CLM.FilledEntity[] = []
    for (let index = 0; index < transcript.length; index = index + 1) {
        const activity = transcript[index]
        const nextActivity = transcript[index + 1]

        // TODO: Handle conversation updates
        if (activity.text === "END_SESSION") {
            return trainDialog
        }
        else if (!activity.type || activity.type === "message") {
            if (activity.from.role === "user") {
                const textVariations: CLM.TextVariation[] = [{
                    text: activity.text,
                    labelEntities: []
                }]
                if (activity.channelData && activity.channelData.textVariations) {
                    activity.channelData.textVariations.forEach((tv: any) => {
                        // Currently system is limited to 20 text variations
                        if (textVariations.length < CLM.MAX_TEXT_VARIATIONS && activity.text !== tv.text) {

                            let altTextVariation: CLM.TextVariation = {
                                text: tv.text,
                                labelEntities: []
                            }
                            textVariations.push(altTextVariation)
                        }
                    })
                }
                let extractorStep: CLM.TrainExtractorStep = {
                    textVariations: textVariations
                }
                curRound = {
                    extractorStep,
                    scorerSteps: []
                }
                trainDialog.rounds.push(curRound)
            }
            else if (activity.from.role === "bot") {
                const hashText = hashTextFromActivity(activity, entities, nextFilledEntities)
                let action: CLM.ActionBase | undefined | null = findActionFromHashText(hashText, actions)
                let logicResult: CLM.LogicResult | undefined
                let scoredAction: CLM.ScoredAction | undefined
                let filledEntities = Util.deepCopy(nextFilledEntities)

                // If I didn't find an action and is API, create API placeholder
                if (activity.channelData && activity.channelData.type === "ActionCall") {
                    const actionCall = activity.channelData as TranscriptActionCall
                    const isTerminal = !nextActivity || nextActivity.from.role === "user"

                    if (!action) {
                        action = await DialogEditing.getPlaceholderAPIAction(app.appId, actionCall.actionName, isTerminal, actions, createActionThunkAsync as any)
                    }
                    // Throw error if I was supposed to create actions
                    if (!action && createActionThunkAsync) {
                        throw new Error("Unable to create API placeholder Action")
                    }
                    // Otherwise pick action if created (may not exist when testing)
                    if (action) {
                        scoredAction = {
                            actionId: action.actionId,
                            payload: action.payload,
                            isTerminal: action.isTerminal,
                            actionType: CLM.ActionTypes.API_LOCAL,
                            score: 1
                        }

                        const actionFilledEntities = await importActionOutput(actionCall.actionOutput, entities, app, createEntityThunkAsync)
                        // Store placeholder output in LogicResult
                        logicResult = {
                            logicValue: undefined,
                            changedFilledEntities: actionFilledEntities,
                        }

                        // Store filled entities for subsequent turns
                        nextFilledEntities = actionFilledEntities
                    }
                }

                let scoreInput: CLM.ScoreInput = {
                    filledEntities: filledEntities,
                    context: {},
                    maskedActions: []
                }
                // As a first pass, try to match by exact text
                let scorerStep: CLM.TrainScorerStep = {
                    importText: action ? undefined : activity.text,
                    input: scoreInput,
                    labelAction: action ? action.actionId : CLM.CL_STUB_IMPORT_ACTION_ID,
                    logicResult,
                    scoredAction
                }

                if (curRound) {
                    curRound.scorerSteps.push(scorerStep)
                }
                else {
                    throw new Error("Dialogs must start with User turn (role='user')")
                }
            }
        }
    }
    return trainDialog
}

// Generate entity map for an action, filling in any missing entities with a blank value
export function generateEntityMapForAction(action: CLM.ActionBase, filledEntityMap: Map<string, string> = new Map<string, string>()): Map<string, string> {
    const map = new Map<string, string>()
    action.requiredEntities.forEach(e => {
        let value = filledEntityMap.get(e)
        if (value) {
            map.set(e, value)
        }
        else {
            map.set(e, "")
        }
    })
    return map
}

// Return hash text for the given activity
export function hashTextFromActivity(activity: BB.Activity, entities: CLM.EntityBase[], filledEntities: CLM.FilledEntity[] | undefined): string {

    // If an API placeholder user the action name
    if (activity.channelData && activity.channelData.type === "ActionCall") {
        const actionCall = activity.channelData as TranscriptActionCall
        return actionCall.actionName
    }
    // If entites have been set, substitute entityIDs in before hashing
    else if (filledEntities && filledEntities.length > 0) {
        const filledEntityMap = DialogUtils.filledEntityIdMap(filledEntities, entities)
        return importTextWithEntityIds(activity.text, filledEntityMap)
    }
    // Default to raw text
    return activity.text
}

// Substibute entityIds into imported text when text matches entity value
export function importTextWithEntityIds(importText: string, valueMap: Map<string, string>) {

    let outText = importText.slice()
    valueMap.forEach((value: string, entityId: string) => {
        outText = outText.replace(value, entityId)
    })
    return outText
}

// Look for imported actions in TrainDialog and attempt to replace them
// with existing actions.  Return true if any replacement occurred
export function replaceImportActions(trainDialog: CLM.TrainDialog, actions: CLM.ActionBase[], entities: CLM.EntityBase[]): boolean {

    // Filter out actions that have no hash lookups. If there are none, terminate early
    const actionsWithHash = actions.filter(a => a.clientData != null && a.clientData.importHashes && a.clientData.importHashes.length > 0)
    if (actionsWithHash.length === 0) {
        return false
    }

    // Now swap any actions that match
    let match = false
    trainDialog.rounds.forEach(round => {
        round.scorerSteps.forEach(scorerStep => {

            let foundAction = findActionFromScorerStepHash(scorerStep, actionsWithHash, entities)

            // If action found replace labelled action with match
            if (foundAction) {
                scorerStep.labelAction = foundAction.actionId
                delete scorerStep.importText
                match = true
            }
        })
    })
    return match
}

// Attempt to find action for the given scorer step
function findActionFromScorerStepHash(scorerStep: CLM.TrainScorerStep, actions: CLM.ActionBase[], entities: CLM.EntityBase[]): CLM.ActionBase | undefined {

    let hashText: string | null = null

    // If replacing imported action
    if (scorerStep.importText) {
        // Substitue entityIds back into import text to build import hash lookup
        const filledEntityMap = DialogUtils.filledEntityIdMap(scorerStep.input.filledEntities, entities)
        hashText = importTextWithEntityIds(scorerStep.importText, filledEntityMap)
    }
    // If replacing placeholder action
    else if (scorerStep.labelAction && CLM.ActionBase.isPlaceholderAPI(scorerStep.scoredAction)) {
        const apiAction = new CLM.ApiAction(scorerStep.scoredAction as any)
        hashText = apiAction.name
    }

    if (hashText) {
        return findActionFromHashText(hashText, actions)
    }

    return undefined
}

// Replace imported actions in TrainDialog with real Actions
export async function createImportedActions(
    appId: string,
    trainDialog: CLM.TrainDialog,
    templates: CLM.Template[],
    createActionThunkAsync: (appId: string, action: CLM.ActionBase) => Promise<CLM.ActionBase | null>,
): Promise<void> {

    const newActions: CLM.ActionBase[] = []
    for (const round of trainDialog.rounds) {
        for (let scoreIndex = 0; scoreIndex < round.scorerSteps.length; scoreIndex = scoreIndex + 1) {
            const scorerStep = round.scorerSteps[scoreIndex]

            if (scorerStep.importText) {
                let action: CLM.ActionBase | undefined

                // First check to see if matching action already exists
                // TODO: Support for entities / entity substitution
                action = findActionFromScorerStepHash(scorerStep, newActions, [])

                // Otherwise create a new one
                if (!action) {
                    const isTerminal = round.scorerSteps.length === scoreIndex + 1
                    const importedAction = importedActionFromImportText(scorerStep.importText, isTerminal)
                    action = await createActionFromImport(appId, importedAction, scorerStep.importText, templates, createActionThunkAsync)
                    newActions.push(action)
                }

                // Update scorer step
                scorerStep.labelAction = action.actionId
                delete scorerStep.importText
            }
        }
    }
}

// Greated an real action for an imported one, looking for a matching template
async function createActionFromImport(
    appId: string,
    importedAction: ImportedAction,
    importText: string,
    templates: CLM.Template[],
    createActionThunkAsync: (appId: string, action: CLM.ActionBase) => Promise<CLM.ActionBase | null>,
): Promise<CLM.ActionBase> {
    const template = DialogUtils.bestTemplateMatch(importedAction, templates)
    const actionType = template ? CLM.ActionTypes.CARD : CLM.ActionTypes.TEXT
    const repromptActionId = template && importedAction.buttons.length > 0 ? REPROMPT_SELF : undefined
    const textValue = Plain.deserialize(`${importedAction.text}`)
    let payload: string | null = null

    // If a template was found, create a CARD action
    if (template) {
        const actionArguments: CLM.IActionArgument[] = []

        // Put text on first TextBody or TextBlock variable
        const textBody = template.variables.find(v => v.type === "TextBody" || v.type === "TextBlock")
        if (textBody) {
            const title = Plain.deserialize(importedAction.text)
            actionArguments.push({ parameter: textBody.key, value: { json: title.toJSON() } })
        }

        // Map additional variables to buttons
        if (importedAction.buttons.length > 0) {
            const buttons = importedAction.buttons.map(t => Plain.deserialize(t))
            buttons.forEach((button, index) => {
                if ((index + 1) < template.variables.length) {
                    actionArguments.push({ parameter: template.variables[index + 1].key, value: { json: button.toJSON() } })
                }
            })
        }
        const cp: CLM.CardPayload = {
            payload: template.name,
            arguments: actionArguments
        }
        payload = JSON.stringify(cp)
    }
    // Otherwise create ordinary text action
    else {
        const tp: CLM.TextPayload = {
            json: textValue.toJSON()
        }
        payload = JSON.stringify(tp)
    }

    const action = new CLM.ActionBase({
        actionId: null!,
        payload,
        createdDateTime: new Date().toJSON(),
        isTerminal: importedAction.isTerminal,
        repromptActionId,
        requiredEntitiesFromPayload: [],
        requiredEntities: [],
        negativeEntities: [],
        requiredConditions: [],
        negativeConditions: [],
        suggestedEntity: undefined,
        version: 0,
        packageCreationId: 0,
        packageDeletionId: 0,
        actionType,
        entityId: undefined,
        enumValueId: undefined,
        clientData: { importHashes: [Util.hashText(importText)] }
    })

    const newAction = await createActionThunkAsync(appId, action)
    if (!newAction) {
        throw new Error("Unable to create action")
    }
    return newAction
}

// NOTE: eventually LGItems could be adaptive cards
export function importedActionFromImportText(importText: string, isTerminal: boolean): ImportedAction {
    // Could be JSON object or just string
    try {
        const lgItem: CLM.LGItem = JSON.parse(importText)
        // Assume reprompt if item has buttons
        return { text: lgItem.text, buttons: lgItem.suggestions, isTerminal, reprompt: lgItem.suggestions.length > 0 }
    }
    catch (e) {
        // Assume no repropmt for plain text
        return { text: importText, buttons: [], isTerminal, reprompt: false }
    }
}

// Search for an action by hash
export function findActionFromHashText(hashText: string, actions: CLM.ActionBase[]): CLM.ActionBase | undefined {
    const importHash = Util.hashText(hashText)

    // Try to find matching action with same hash
    let matchedActions = actions.filter(a => {
        return a.clientData && a.clientData.importHashes && a.clientData.importHashes.indexOf(importHash) > -1
    })

    // If more than one, prefer the one that isn't a placeholder
    if (matchedActions.length > 1) {
        matchedActions = matchedActions.filter(ma => !CLM.ActionBase.isPlaceholderAPI(ma))
    }

    return matchedActions[0]
}

/**
 * Given the {entityName, entityValue} results from some action being imported, returns
 * an array of FilledEntity instances representing those results.
 * Entities that do not yet exist will be created once.
 */
export async function importActionOutput(
    actionResults: OBIActionOutput[],
    entities: CLM.EntityBase[],
    app: CLM.AppBase,
    createEntityThunkAsync?: ((appId: string, entity: CLM.EntityBase) => Promise<CLM.EntityBase | null>)
): Promise<CLM.FilledEntity[]> {

    const filledEntities: CLM.FilledEntity[] = []

    for (const actionResult of actionResults) {
        // Check if entity already exists
        const foundEntity = entities.find(e => e.entityName === actionResult.entityName)
        let entityId: string = ""
        if (foundEntity) {
            entityId = foundEntity.entityId
        }
        // If create function provided, create a new enity for the missing entity
        else if (createEntityThunkAsync) {
            // If it doesn't exist create a new one
            const newEntity: CLM.EntityBase = {
                entityId: undefined!,
                entityName: actionResult.entityName,
                resolverType: "none",
                createdDateTime: new Date().toJSON(),
                lastModifiedDateTime: new Date().toJSON(),
                isResolutionRequired: false,
                isMultivalue: false,
                isNegatible: false,
                negativeId: null,
                positiveId: null,
                entityType: CLM.EntityType.LOCAL,
                version: null,
                packageCreationId: null,
                packageDeletionId: null,
                doNotMemorize: false
            }

            entityId = await ((createEntityThunkAsync(app.appId, newEntity) as any) as Promise<string>)
            if (!entityId) {
                throw new Error("Invalid Entity Definition")
            }
        }
        else {
            entityId = "UNKNOWN ENTITY"
        }
        const memoryValue: CLM.MemoryValue = {
            userText: actionResult.value ? actionResult.value : null,
            displayText: null,
            builtinType: null,
            resolution: {}
        }
        const filledEntity: CLM.FilledEntity = {
            entityId,
            values: [memoryValue]
        }
        filledEntities.push(filledEntity)
    }
    return filledEntities
}

const nouns = [
    "conclusion",
    "nature",
    "wood",
    "ratio",
    "family",
    "actor",
    "poet",
    "anxiety",
    "nation",
    "death",
    "writer",
    "poetry",
    "concept",
    "discussion",
    "impression",
    "population",
    "negotiation",
    "complaint",
    "mud",
    "promotion",
    "currency",
    "ambition",
    "dinner",
    "problem",
    "hall",
    "length",
    "enthusiasm",
    "profession",
    "driver",
    "supermarket",
    "conversation",
    "election",
    "application",
    "tennis",
    "alcohol",
    "responsibility",
    "understanding",
    "loss",
    "data",
    "ad",
    "menu",
    "beer",
    "percentage",
    "salad",
    "efficiency",
    "housing",
    "awareness",
    "association",
    "ladder",
    "office",
    "competition",
    "priority",
    "union",
    "phone",
    "road",
    "oven",
    "buyer",
    "topic",
    "contract",
    "police",
    "childhood",
    "flight",
    "activity",
    "reality",
    "obligation",
    "power",
    "cigarette",
    "student",
    "storage",
    "volume",
    "communication",
    "estate",
    "introduction",
    "story",
    "user",
    "technology",
    "writing",
    "context",
    "feedback",
    "argument",
    "night",
    "collection",
    "database",
    "dad",
    "signature",
    "recording",
    "sister",
    "confusion",
    "reputation",
    "steak",
    "tooth",
    "exam",
    "grocery",
    "ear",
    "breath",
    "orange",
    "thing",
    "description",
    "indication",
    "economics",
    "birthday",
    "opinion",
    "funeral",
    "king",
    "law",
    "audience",
    "wealth",
    "version",
    "lady",
    "president",
    "lake",
    "shopping",
    "difference",
    "gate",
    "honey",
    "hair",
    "affair",
    "explanation",
    "solution",
    "debt",
    "atmosphere",
    "friendship",
    "employer",
    "emotion",
    "operation",
    "disaster",
    "teaching",
    "wedding",
    "video",
    "safety",
    "development",
    "throat",
    "theory",
    "airport",
    "music",
    "memory",
    "meaning",
    "tongue",
    "administration",
    "foundation",
    "policy",
    "marketing",
    "protection",
    "guest",
    "industry",
    "historian",
    "cookie",
    "initiative",
    "fishing",
    "chest",
    "truth",
    "agency",
    "government",
    "penalty",
    "army",
    "extent",
    "importance",
    "employee",
    "candidate",
    "organization",
    "chemistry",
    "error",
    "village",
    "agreement",
    "opportunity",
    "unit",
    "maintenance",
    "attitude",
    "patience",
    "role",
    "control",
    "security",
    "method",
    "hat",
    "engine",
    "outcome",
    "country",
    "cancer",
    "disease",
    "republic",
    "basis",
    "permission",
    "manufacturer",
    "entry",
    "response",
    "investment",
    "passion",
    "system",
    "vehicle",
    "satisfaction",
    "week",
    "politics",
    "song",
    "recipe",
    "county",
    "preparation",
    "skill",
    "situation",
    "celebration",
    "intention"
]

const adjectives = [
"inner",
"suitable",
"exciting",
"aware",
"electrical",
"boring",
"accurate",
"practical",
"mental",
"asleep",
"large",
"additional",
"obvious",
"cultural",
"similar",
"wooden",
"suspicious",
"unfair",
"careful",
"entire",
"logical",
"conscious",
"significant",
"nice",
"civil",
"psychological",
"medical",
"legal",
"strong",
"southern",
"informal",
"hungry",
"dangerous",
"realistic",
"guilty",
"mad",
"impossible",
"visible",
"former",
"healthy",
"remarkable",
"anxious",
"sorry",
"poor",
"difficult",
"cute",
"tiny",
"distinct",
"desperate",
"successfully",
"federal",
"unlikely",
"traditional",
"ugly",
"successful",
"aggressive",
"dramatic",
"rare",
"responsible",
"several",
"afraid",
"latter",
"unusual",
"lucky",
"terrible",
"recent",
"curious",
"available",
"automatic",
"serious",
"numerous",
"decent",
"angry",
"electronic",
"tall",
"used",
"various",
"able",
"basic",
"relevant",
"eastern",
"happy",
"willing",
"intelligent",
"weak",
"foreign",
"actual",
"immediate",
"interesting",
"administrative",
"reasonable",
"impressive",
"existing",
"hot",
"expensive",
"obviously",
"nervous",
"educational",
"comprehensive",
"acceptable",
"competitive",
"pregnant",
"pure",
"consistent",
"historical",
"confident",
"technical",
"huge",
"substantial",
"global",
"united",
"emotional",
"massive",
"efficient",
"strict",
"typical",
"powerful",
"known",
"unhappy",
"unable",
"severe",
"financial",
"every",
"political",
"embarrassed",
"pleasant",
"scared",
"wonderful",
"useful",
"friendly",
"environmental",
"odd",
"helpful",
"important",
"capable",
"critical",
"different",
"popular",
"famous",
"old",
"sufficient",
"alive",
"lonely",
"sudden"
]

textgen.addNouns(nouns)
textgen.addAdjectives(adjectives)