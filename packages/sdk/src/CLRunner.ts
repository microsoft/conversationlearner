/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as util from 'util'
import * as BB from 'botbuilder'
import * as CLM from '@conversationlearner/models'
import * as Utils from './Utils'
import * as ModelOptions from './CLModelOptions'
import { CLState } from './Memory/CLState'
import { CLStateFactory } from './Memory/CLStateFactory'
import { CLDebug, DebugType } from './CLDebug'
import { CLClient } from './CLClient'
import { CLStrings } from './CLStrings'
import { TemplateProvider } from './TemplateProvider'
import { ReadOnlyClientMemoryManager, ClientMemoryManager } from './Memory/ClientMemoryManager'
import { CLRecognizerResult } from './CLRecognizeResult'
import { ConversationLearner } from './ConversationLearner'
import { InputQueue } from './Memory/InputQueue'
import { UIMode } from './Memory/BotState'
import { EntityState } from './Memory/EntityState'
import { ILogStorage } from './Memory/ILogStorage'
import { CLOptions } from './CLOptions'

interface RunnerLookup {
    [appId: string]: CLRunner
}

const delay = util.promisify(setTimeout)

export enum SessionStartFlags {
    NONE = 0,
    /* Start a teaching session */
    IN_TEACH = 1 << 0,
    /* Session is an edit and continue with existing turns */
    IS_EDIT_CONTINUE = 1 << 1,
    /* Session is an edit and continue with existing turns */
    IN_TEST = 1 << 2
}

export interface InternalCallback<T> extends CLM.Callback, ICallback<T> {
}

/**
 * Processes messages received from the user. Called by the dialog system.
 */
export type EntityDetectionCallback = (text: string, memoryManager: ClientMemoryManager) => Promise<void>

/**
 * Called at session start.
 * Allows bot to set initial entities before conversation begins
 */
export type OnSessionStartCallback = (context: BB.TurnContext, memoryManager: ClientMemoryManager) => Promise<void>

/**
 * Called when Session ends.
 * If not implemented all entity values will be cleared.
 * If implemented, developer may return a list of entities to preserve for the next session
 * as well as store them in the Bot State
 */
export type OnSessionEndCallback = (context: BB.TurnContext, memoryManager: ClientMemoryManager, sessionEndState: CLM.SessionEndState, data: string | undefined) => Promise<string[] | void>

/**
 * Called when the associated action in your bot is sent.
 * Common use cases are to call external APIs to gather data and save into entities for usage later.
 */
export type LogicCallback<T> = (memoryManager: ClientMemoryManager, ...args: string[]) => Promise<T | void>
// tslint:disable-next-line:no-empty
export const defaultLogicCallback = async () => { }
/**
 * Called when the associated action in your bot is sent AND during dialog replay.
 * Common use cases are to construct text or card messages based on current entity values.
 */
export type RenderCallback<T> = (logicResult: T, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => Promise<Partial<BB.Activity> | string>

export interface ICallbackInput<T> {
    name: string
    logic?: LogicCallback<T>
    render?: RenderCallback<T>
}

interface ICallback<T> {
    name: string
    logic: LogicCallback<T>
    render: RenderCallback<T> | undefined
}

enum ActionInputType {
    LOGIC_ONLY = "LOGIC_ONLY",
    RENDER_ONLY = "RENDER_ONLY",
    LOGIC_AND_RENDER = "LOGIC_AND_RENDER"
}

interface IActionInputLogic {
    type: ActionInputType.RENDER_ONLY
    logicResult: CLM.LogicResult | undefined
}
interface IActionInputRenderOnly {
    type: Exclude<ActionInputType, ActionInputType.RENDER_ONLY>
}

type IActionInput = IActionInputRenderOnly | IActionInputLogic

export interface IActionResult {
    logicResult: CLM.LogicResult | undefined
    response: Partial<BB.Activity> | string | null
    replayError?: CLM.ReplayError
}

export type CallbackMap = { [name: string]: InternalCallback<any> }

/**
 * Runs Conversation Learnern for a given CL Model
 */
export class CLRunner {

    /* Lookup table for CLRunners.  One CLRunner per CL Model */
    private static Runners: RunnerLookup = {}
    private static UIRunner: CLRunner

    private stateFactory: CLStateFactory
    private options: CLOptions
    private modelOptions: ModelOptions.CLModelOptions
    private logStorage: ILogStorage | undefined
    // Used to detect changes in API callbacks / Templates when bot reloaded and UI running
    private checksum: string | null = null

    public clClient: CLClient
    public adapter: BB.BotAdapter | undefined
    /* Model Id passed in from configuration.  Used when not running in Conversation Learner UI */
    public readonly modelId: string | undefined
    /* Mapping between user defined API names and functions */
    public callbacks: CallbackMap = {}

    public static Create(
        stateFactory: CLStateFactory,
        client: CLClient,
        option: CLOptions,
        modelId: string | undefined,
        logStorage: ILogStorage | undefined,
        newOptions?: Partial<ModelOptions.CLModelOptions>,
    ): CLRunner {
        const modelOptions = this.validiatedModelOptions(newOptions)

        // Ok to not provide modelId when just running in training UI.
        // If not, Use UI_RUNNER_APPID const as lookup value
        const newRunner = new CLRunner(stateFactory, client, option, modelId, modelOptions, logStorage)
        CLRunner.Runners[modelId ?? Utils.UI_RUNNER_APPID] = newRunner

        // Bot can define multiple CLs. Always run UI on first CL defined in the bot
        if (!CLRunner.UIRunner) {
            CLRunner.UIRunner = newRunner
        }

        return newRunner
    }

    private static validiatedModelOptions(modelOptions?: Partial<ModelOptions.CLModelOptions>): ModelOptions.CLModelOptions {
        const sessionTimeout = (typeof modelOptions?.sessionTimeout !== 'number')
            ? ModelOptions.DEFAULT_MAX_SESSION_LENGTH
            : modelOptions.sessionTimeout

        return {
            sessionTimeout
        }
    }

    // Get CLRunner for the UI
    public static GetRunnerForUI(appId?: string): CLRunner {

        // Runner with the appId may not exist if running training UI, if so use the UI Runner
        if (!appId || !CLRunner.Runners[appId]) {
            if (CLRunner.UIRunner) {
                return CLRunner.UIRunner
            } else {
                throw new Error(`Not in UI and requested CLRunner that doesn't exist: ${appId}`)
            }
        }
        return CLRunner.Runners[appId]
    }

    private constructor(
        stateFactory: CLStateFactory,
        client: CLClient,
        options: CLOptions,
        modelId: string | undefined,
        modelOptions: ModelOptions.CLModelOptions,
        logStorage: ILogStorage | undefined,
    ) {
        this.stateFactory = stateFactory
        this.clClient = client
        this.options = options
        this.modelId = modelId
        this.modelOptions = modelOptions
        this.logStorage = logStorage
    }

    public botChecksum(): string {
        // Create bot checksum is doesn't already exist
        if (!this.checksum) {
            const callbacks = Object.values(this.callbacks).map(this.convertInternalCallbackToCallback)
            const templates = TemplateProvider.GetTemplates()
            this.checksum = Utils.botChecksum(callbacks, templates)
        }
        return this.checksum
    }

    public convertInternalCallbackToCallback = <T>(c: InternalCallback<T>): CLM.Callback => {
        const { logic, render, ...callback } = c
        return callback
    }

    public async onTurn(turnContext: BB.TurnContext, next: (result: CLRecognizerResult | null) => Promise<void>): Promise<void> {
        const recognizerResult = await this.recognize(turnContext, true)
        return next(recognizerResult)
    }

    public async recognize(turnContext: BB.TurnContext, force?: boolean): Promise<CLRecognizerResult | null> {
        // Add input to queue
        const res = await this.AddInput(turnContext)
        return res
    }

    public async InTrainingUI(turnContext: BB.TurnContext): Promise<boolean> {
        if (turnContext.activity.from?.name === Utils.CL_DEVELOPER) {
            const state = this.stateFactory.getFromContext(turnContext, this.modelId)
            const app = await state.BotState.GetApp()
            // If no app selected in UI or no app set in config, or they don't match return true
            if (!app || !this.modelId || app.appId !== this.modelId) {
                return true
            }
        }
        return false
    }

    // Allows Bot developer to start a new Session with initial parameters (never in Teach)
    public async BotStartSession(turnContext: BB.TurnContext): Promise<void> {

        // Set adapter / conversation reference even if from field not set
        let conversationReference = BB.TurnContext.getConversationReference(turnContext.activity)
        this.SetAdapter(turnContext.adapter, conversationReference)

        const activity = turnContext.activity
        if (activity.from === undefined || activity.id == undefined) {
            return
        }

        try {
            const state = this.stateFactory.getFromContext(turnContext, this.modelId)
            const app = await this.GetRunningApp(state, false)

            if (app) {
                let packageId = (app.livePackageId ?? app.devPackageId)
                if (packageId) {
                    const sessionCreateParams: CLM.SessionCreateParams = {
                        saveToLog: app.metadata.isLoggingOn !== false,
                        packageId: packageId,
                        initialFilledEntities: []
                    }
                    await this.CreateSessionAsync(state, BB.TurnContext.getConversationReference(activity), app.appId, SessionStartFlags.NONE, sessionCreateParams)
                }
            }
        }
        catch (error) {
            CLDebug.Error(error)
        }
    }

    public SetAdapter(adapter: BB.BotAdapter, conversationReference: Partial<BB.ConversationReference>) {
        this.adapter = adapter
        CLDebug.InitLogger(adapter, conversationReference)
    }

    // Add input to queue.  Allows CL to handle out-of-order messages
    private async AddInput(turnContext: BB.TurnContext): Promise<CLRecognizerResult | null> {

        // Set adapter / conversation reference even if from field not set
        let conversationReference = BB.TurnContext.getConversationReference(turnContext.activity)
        this.SetAdapter(turnContext.adapter, conversationReference)

        // ConversationUpdate messages are not processed by ConversationLearner
        // They should be handled in the general bot code
        if (turnContext.activity.type == "conversationUpdate") {
            CLDebug.Verbose(`Ignoring Conversation update...  +${JSON.stringify(turnContext.activity.membersAdded)} -${JSON.stringify(turnContext.activity.membersRemoved)}`)
            return null
        }

        if (turnContext.activity.from === undefined || turnContext.activity.id == undefined) {
            return null
        }

        const state = this.stateFactory.getFromContext(turnContext, this.modelId)

        // If I'm in teach or edit mode, or testing process message right away
        let uiMode = await state.BotState.getUIMode()
        if (uiMode !== UIMode.NONE) {
            return await this.ProcessInput(turnContext)
        }

        // Otherwise I have to queue up messages as user may input them faster than bot responds
        else {
            let addInputPromise = util.promisify(InputQueue.AddInput)
            let isReady = await addInputPromise(state.MessageState, turnContext.activity)

            if (isReady) {
                let intents = await this.ProcessInput(turnContext)
                return intents
            }
            // Message has expired
            return null
        }
    }

    public async CreateSessionAsync(state: CLState, conversationRef: Partial<BB.ConversationReference> | null, appId: string, sessionStartFlags: SessionStartFlags, createParams: CLM.SessionCreateParams | CLM.CreateTeachParams): Promise<CLM.Teach | CLM.Session> {

        const inTeach = ((sessionStartFlags & SessionStartFlags.IN_TEACH) > 0)
        let entityList = await this.clClient.GetEntities(appId)

        // If not continuing an edited session, call endSession
        if (!(sessionStartFlags & SessionStartFlags.IS_EDIT_CONTINUE)) {
            // Default callback will clear the bot memory.
            // END_SESSION action was never triggered, so SessionEndState.OPEN
            await this.CheckSessionEndCallback(state, entityList.entities, CLM.SessionEndState.OPEN)
        }

        //  check that this works = should it be inside edit continue above
        // Check if StartSessionCallback is required
        await this.CheckSessionStartCallback(state, entityList.entities)
        let startSessionEntities = await state.EntityState.FilledEntitiesAsync()
        startSessionEntities = [...createParams.initialFilledEntities ?? [], ...startSessionEntities]

        const filledEntityMap = CLM.FilledEntityMap.FromFilledEntities(startSessionEntities, entityList.entities)
        await state.EntityState.RestoreFromMapAsync(filledEntityMap)

        // Start the new session
        let sessionId: string
        let logDialogId: string | null
        let startResponse: CLM.Teach | CLM.Session
        if (inTeach) {
            const teachResponse = await this.clClient.StartTeach(appId, createParams as CLM.CreateTeachParams)
            startResponse = CLM.ModelUtils.ToTeach(teachResponse)
            sessionId = teachResponse.teachId
            logDialogId = null
        }
        else {
            startResponse = await this.StartSession(appId, createParams as CLM.SessionCreateParams)
            sessionId = startResponse.sessionId
            logDialogId = startResponse.logDialogId
        }

        // Initialize Bot State
        await state.BotState.InitSessionAsync(sessionId, logDialogId, conversationRef, sessionStartFlags)

        CLDebug.Verbose(`Started Session: ${sessionId} - ${state.BotState.GetConversationId()}`)
        return startResponse
    }

    private async StartSession(appId: string, createParams: CLM.SessionCreateParams): Promise<CLM.Session> {

        const saveToLog = createParams.saveToLog

        // Don't save logs on server if custom storage was provided
        if (this.logStorage) {
            createParams.saveToLog = false
        }

        const session = await this.clClient.StartSession(appId, createParams as CLM.SessionCreateParams)

        // If using customer storage add to log storage
        if (this.logStorage && saveToLog) {
            // For self-hosted log storage logDialogId is sessionId
            session.logDialogId = session.sessionId
            const logDialog: CLM.LogDialog = {
                logDialogId: session.logDialogId,
                packageId: session.packageId,
                rounds: [],
                initialFilledEntities: [],
                targetTrainDialogIds: [],
                createdDateTime: new Date().toJSON(),
                // Start out the same.  End is updated when dialog is edited
                dialogBeginDatetime: new Date().toJSON(),
                dialogEndDatetime: new Date().toJSON(),
                lastModifiedDateTime: new Date().toJSON(),
                metrics: ""
            }
            await this.logStorage.Add(appId, logDialog)
        }
        return session
    }

    private async SessionExtract(appId: string, sessionId: string, userInput: CLM.UserInput): Promise<CLM.ExtractResponse> {
        const stepBeginDatetime = new Date().toJSON()
        const extractResponse = await this.clClient.SessionExtract(appId, sessionId, userInput)
        const stepEndDatetime = new Date().toJSON()

        // If dev provided log storage, save round in storage
        if (this.logStorage) {
            // For provided storage logDialogId = sessionId
            const logDialogId = sessionId

            // Append an extractor step to already existing log dialog
            const logDialog: CLM.LogDialog | undefined = await this.logStorage.Get(appId, logDialogId)
            if (!logDialog) {
                throw new Error(`Log Dialog does not exist App:${appId} Id:${logDialogId}`)
            }
            const newRound: CLM.LogRound = {
                extractorStep: { ...extractResponse, stepBeginDatetime, stepEndDatetime },
                scorerSteps: []
            }
            logDialog.rounds.push(newRound)
            logDialog.lastModifiedDateTime = new Date().toJSON()
            await this.logStorage.Replace(appId, logDialog)
        }

        return extractResponse
    }

    private async SessionScore(appId: string, sessionId: string, scoreInput: CLM.ScoreInput): Promise<CLM.ScoreResponse> {
        const stepBeginDatetime = new Date().toJSON()
        const scoreResponse = await this.clClient.SessionScore(appId, sessionId, scoreInput)

        // If log storage was provided save score there
        if (this.logStorage) {
            // For provided storage logDialogId is sessionId
            const logDialogId = sessionId
            const predictedAction = scoreResponse.scoredActions[0]?.actionId ?? ""

            // Keep only needed data (drop payload, etc)
            const scoredActions = scoreResponse.scoredActions.map(sa => {
                return {
                    score: sa.score,
                    actionId: sa.actionId
                }
            })
            const unscoredActions = scoreResponse.unscoredActions.map(sa => {
                return {
                    reason: sa.reason,
                    actionId: sa.actionId
                }
            })

            // Need to use recursive partial as scored and unscored have only partial data
            const logScorerStep: Utils.RecursivePartial<CLM.LogScorerStep> = {
                input: scoreInput,
                predictedAction,
                logicResult: undefined, // LARS what should this be
                predictionDetails: { scoredActions, unscoredActions },
                stepBeginDatetime,
                stepEndDatetime: new Date().toJSON(),
                metrics: scoreResponse.metrics,
            }

            const logDialog: CLM.LogDialog | undefined = await this.logStorage.Get(appId, logDialogId)
            if (!logDialog) {
                throw new Error(`Log Dialog does not exist App:${appId} Log:${logDialogId}`)
            }
            const lastRound = logDialog.rounds[logDialog.rounds.length - 1]
            if (!lastRound || !lastRound.extractorStep) {
                throw new Error(`Log Dialogs has no Extractor Step Id:${logDialogId}`)
            }
            lastRound.scorerSteps.push(logScorerStep as any)
            logDialog.lastModifiedDateTime = new Date().toJSON()
            await this.logStorage.Replace(appId, logDialog)
        }
        return scoreResponse
    }

    // Get the currently running app
    private async GetRunningApp(state: CLState, inEditingUI: boolean): Promise<CLM.AppBase | null> {
        let app = await state.BotState.GetApp()

        // If this instance is configured to use a specific model, check conditions to use that model.
        if (this.modelId
            // If current app is not set
            && (!app
                // If I'm not in the editing UI and config model id differs than the current app
                || (!inEditingUI && this.modelId != app.appId))
        ) {
            // Get app specified by options
            CLDebug.Log(`Switching to app specified in config: ${this.modelId}`)
            app = await this.clClient.GetApp(this.modelId)
            await state.SetAppAsync(app)
        }

        return app
    }

    // End a teach or log session
    public async EndSessionAsync(state: CLState, sessionEndState: CLM.SessionEndState, data?: string): Promise<void> {

        let app = await state.BotState.GetApp()

        if (app) {
            let entityList = await this.clClient.GetEntities(app.appId)

            // Default callback will clear the bot memory
            await this.CheckSessionEndCallback(state, entityList.entities, sessionEndState, data)

            await state.BotState.EndSessionAsync()
        }
    }

    // Process user input
    private async ProcessInput(turnContext: BB.TurnContext): Promise<CLRecognizerResult | null> {
        let errorContext = 'ProcessInput'
        const activity = turnContext.activity
        const conversationReference = BB.TurnContext.getConversationReference(activity)

        // Validate request
        if (activity.from?.id === undefined) {
            throw new Error(`Attempted to get current session for user, but user was not defined on bot request.`)
        }

        try {
            const inEditingUI = conversationReference.user?.name === Utils.CL_DEVELOPER

            // Validate setup
            if (!inEditingUI && !this.modelId) {
                const msg = 'Must specify modelId in ConversationLearner constructor when not running bot in Editing UI\n\n'
                CLDebug.Error(msg)
                return null
            }

            if (!this.options?.LUIS_AUTHORING_KEY) {
                const msg = 'Options must specify luisAuthoringKey.  Set the LUIS_AUTHORING_KEY.\n\n'
                CLDebug.Error(msg)
                return null
            }

            const state = this.stateFactory.getFromContext(turnContext, this.modelId)
            let app = await this.GetRunningApp(state, inEditingUI)
            const uiMode = await state.BotState.getUIMode()

            if (!app) {
                let error = "ERROR: AppId not specified.  When running in a channel (i.e. Skype) or the Bot Framework Emulator, CONVERSATION_LEARNER_MODEL_ID must be specified in your Bot's .env file or Application Settings on the server"
                await this.SendMessage(state, error, activity)
                return null
            }

            let sessionId = await state.BotState.GetSessionIdAndSetConversationId(conversationReference)

            // When UI is active inputs are handled via API calls from the Conversation Learner UI unless testing
            if (uiMode !== UIMode.NONE && uiMode !== UIMode.TEST) {
                return null
            }

            // Check for expired session
            if (sessionId) {
                const currentTicks = new Date().getTime()
                let lastActive = await state.BotState.GetLastActive()
                let passedTicks = currentTicks - lastActive
                if (passedTicks > this.modelOptions.sessionTimeout) {

                    // Parameters for new session
                    const sessionCreateParams: CLM.SessionCreateParams = {
                        saveToLog: app.metadata.isLoggingOn,
                        initialFilledEntities: []
                    }

                    // If I'm running in the editing UI I need to retrieve the packageId as
                    // may not be running live package
                    if (inEditingUI) {
                        const result = await this.clClient.GetSession(app.appId, sessionId)
                        sessionCreateParams.packageId = result.packageId
                    }

                    // End the current session
                    await Utils.EndSessionIfOpen(this.clClient, app.appId, sessionId)
                    await this.EndSessionAsync(state, CLM.SessionEndState.OPEN)

                    // If I'm not in the UI, reload the App to get any changes (live package version may have been updated)
                    if (!inEditingUI) {

                        if (!this.modelId) {
                            let error = "ERROR: ModelId not specified.  When running in a channel (i.e. Skype) or the Bot Framework Emulator, CONVERSATION_LEARNER_MODEL_ID must be specified in your Bot's .env file or Application Settings on the server"
                            await this.SendMessage(state, error, activity)
                            return null
                        }

                        app = await this.clClient.GetApp(this.modelId)
                        await state.SetAppAsync(app)

                        if (!app) {
                            let error = "ERROR: Failed to find Model specified by CONVERSATION_LEARNER_MODEL_ID"
                            await this.SendMessage(state, error, activity)
                            return null
                        }

                        // Update logging state
                        sessionCreateParams.saveToLog = app.metadata.isLoggingOn
                    }

                    // Start a new session
                    let session = await this.CreateSessionAsync(state, conversationReference, app.appId, SessionStartFlags.NONE, sessionCreateParams) as CLM.Session
                    sessionId = session.sessionId
                }
                // Otherwise update last access time
                else {
                    await state.BotState.SetLastActive(currentTicks)
                }
            }

            // Handle any other non-message input, filter out empty messages
            if (activity.type !== BB.ActivityTypes.Message || !activity.text || activity.text === "") {
                await InputQueue.MessageHandled(state.MessageState, activity.conversation.id, activity)
                return null
            }

            // PackageId: Use live package id if not in editing UI, default to devPackage if no active package set
            let packageId = (inEditingUI ? await state.BotState.GetEditingPackageForApp(app.appId) : app.livePackageId) || app.devPackageId
            if (!packageId) {
                await this.SendMessage(state, "ERROR: No PackageId has been set", activity)
                return null
            }

            // If no session for this conversation, create a new one
            if (!sessionId) {
                const sessionCreateParams: CLM.SessionCreateParams = {
                    saveToLog: app.metadata.isLoggingOn !== false,
                    packageId: packageId,
                    initialFilledEntities: []
                }
                let sessionStartFlags = uiMode === UIMode.TEST ? SessionStartFlags.IN_TEST : SessionStartFlags.NONE
                let session = await this.CreateSessionAsync(state, BB.TurnContext.getConversationReference(activity), app.appId, sessionStartFlags, sessionCreateParams) as CLM.Session
                sessionId = session.sessionId
            }

            // Process any form data
            let buttonResponse = await this.ProcessFormData(activity, state, app.appId)

            let entities: CLM.EntityBase[] = []

            // Generate result
            errorContext = 'Extract Entities'
            if (activity.text.length > Utils.CL_MAX_USER_UTTERANCE) {
                CLDebug.Verbose(`Trimming user input to ${Utils.CL_MAX_USER_UTTERANCE} chars`)
            }

            const userInput: CLM.UserInput = {
                text: buttonResponse || activity.text.substr(0, Utils.CL_MAX_USER_UTTERANCE) || '  '
            }

            const extractResponse = await this.SessionExtract(app.appId, sessionId, userInput)

            entities = extractResponse.definitions.entities
            errorContext = 'Score Actions'
            const scoredAction = await this.Score(
                app.appId,
                sessionId,
                state,
                extractResponse.text,
                extractResponse.predictedEntities,
                entities,
                false
            )

            return {
                scoredAction,
                clEntities: entities,
                state: state,
                inTeach: false,
                activity
            }
        } catch (error) {
            // Try to end the session, so use can potentially recover
            try {
                const state = this.stateFactory.getFromContext(turnContext, this.modelId)
                await this.EndSessionAsync(state, CLM.SessionEndState.OPEN)
            } catch {
                CLDebug.Log(`Failed to End Session`)
            }

            const errMessage = error.body ? JSON.stringify(error.body) : JSON.stringify(error)
            CLDebug.Error(errMessage, errorContext)
            return null
        }
    }

    private async ProcessFormData(request: BB.Activity, state: CLState, appId: string): Promise<string | null> {
        const data = request.value as FormData
        if (data) {
            // Get list of all entities
            let entityList = await this.clClient.GetEntities(appId)

            // For each form entry
            for (let entityName of Object.keys(data)) {
                // Reserved parameter
                if (entityName == 'submit') {
                    continue
                }

                // Find the entity
                let entity = entityList.entities.find((e: CLM.EntityBase) => e.entityName == entityName)

                // If it exists, set it
                if (entity) {
                    await state.EntityState.RememberEntity(entity.entityName, entity.entityId, data[entityName], entity.isMultivalue)
                }
            }

            // If submit type return as a response
            if (data['submit']) {
                return data['submit']
            }
        }
        return null
    }

    public async Score(
        appId: string,
        sessionId: string,
        state: CLState,
        text: string,
        predictedEntities: CLM.PredictedEntity[],
        allEntities: CLM.EntityBase[],
        inTeach: boolean,
        skipEntityDetectionCallBack: boolean = false
    ): Promise<CLM.ScoredAction> {
        // Call EnttityDetectionCallback
        let scoreInput: CLM.ScoreInput
        try {
            scoreInput = await this.CallEntityDetectionCallback(text, predictedEntities, state, allEntities, skipEntityDetectionCallBack)
        }
        catch (err) {
            // Hit exception in Bot's Entity Detection Callback
            // Use existing memory before callback
            const filledEntities = await state.EntityState.FilledEntitiesAsync()
            scoreInput = {
                filledEntities,
                context: {},
                maskedActions: []
            }

            CLDebug.Error(err, CLStrings.ENTITYCALLBACK_EXCEPTION)
        }

        // Call the scorer
        let scoreResponse = null
        if (inTeach) {
            scoreResponse = await this.clClient.TeachScore(appId, sessionId, scoreInput)
            // Return top scoring action
            return scoreResponse.scoredActions[0]
        } else {
            scoreResponse = await this.SessionScore(appId, sessionId, scoreInput)

            // Return top scoring action
            return scoreResponse.scoredActions[0]
        }
    }

    //-------------------------------------------
    // Optional callback than runs after LUIS but before Conversation Learner.  Allows Bot to substitute entities
    public entityDetectionCallback: EntityDetectionCallback | undefined

    // Optional callback than runs before a new chat session starts.  Allows Bot to set initial entities
    public onSessionStartCallback: OnSessionStartCallback | undefined

    // Optional callback than runs when a session ends.  Allows Bot set and/or preserve memories after session end
    public onSessionEndCallback: OnSessionEndCallback | undefined

    public AddCallback<T>(
        callbackInput: ICallbackInput<T>
    ) {
        if (typeof callbackInput.name !== "string" || callbackInput.name.trim().length === 0) {
            throw new Error(`You attempted to add callback but did not provide a valid name. Name must be non-empty string.`)
        }

        if (!callbackInput.logic && !callbackInput.render) {
            throw new Error(`You attempted to add callback by name: ${callbackInput.name} but did not provide a logic or render function. You must provide at least one of them.`)
        }

        const callback: InternalCallback<T> = {
            name: callbackInput.name,
            logic: defaultLogicCallback,
            logicArguments: [],
            isLogicFunctionProvided: false,
            render: undefined,
            renderArguments: [],
            isRenderFunctionProvided: false
        }

        if (callbackInput.logic) {
            callback.logic = callbackInput.logic
            callback.logicArguments = this.GetArguments(callbackInput.logic, 1)
            callback.isLogicFunctionProvided = true
        }

        if (callbackInput.render) {
            callback.render = callbackInput.render
            callback.renderArguments = this.GetArguments(callbackInput.render, 2)
            callback.isRenderFunctionProvided = true
        }

        this.callbacks[callbackInput.name] = callback
    }

    private GetArguments(func: Function, skip: number = 0): string[] {
        const STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/gm
        const ARGUMENT_NAMES = /([^\s,]+)/g

        const fnStr = func.toString().replace(STRIP_COMMENTS, '')
        const argumentNames = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES) || []
        return argumentNames.filter((_, i) => i >= skip)
    }

    private async ProcessPredictedEntities(text: string, memory: EntityState, predictedEntities: CLM.PredictedEntity[], allEntities: CLM.EntityBase[]): Promise<void> {

        const predictedEntitiesWithType = predictedEntities.map(pe => {
            let entity = allEntities.find(e => e.entityId == pe.entityId)
            if (entity) {
                return { entityType: entity.entityType, ...pe }
            } else {
                return { entityType: null, ...pe }
            }
        })

        // Update entities in my memory
        for (let predictedEntity of predictedEntities) {
            let entity = allEntities.find(e => e.entityId == predictedEntity.entityId)
            if (!entity) {
                CLDebug.Error(`Could not find entity by id: ${predictedEntity.entityId}`)
                return
            }

            // Update resolution for entities with resolver type
            const resolverType = entity.resolverType
            if (resolverType
                && (!predictedEntity.resolution || Object.keys(predictedEntity.resolution).length === 0)) {
                const builtInEntity = predictedEntitiesWithType.find(pe => pe.startCharIndex >= predictedEntity.startCharIndex
                    && pe.endCharIndex <= predictedEntity.endCharIndex
                    && pe.entityType === resolverType)
                if (builtInEntity) {
                    predictedEntity.resolution = builtInEntity.resolution
                    predictedEntity.builtinType = builtInEntity.builtinType
                }
            }

            // If negative entity will have a positive counter entity
            if (entity.positiveId) {
                await memory.ForgetEntity(entity.entityName, predictedEntity.entityText, entity.isMultivalue)
            } else if (!entity.doNotMemorize) {
                await memory.RememberEntity(
                    entity.entityName,
                    entity.entityId,
                    predictedEntity.entityText,
                    entity.isMultivalue,
                    predictedEntity.builtinType,
                    predictedEntity.resolution
                )
            }
        }
    }

    public async CallEntityDetectionCallback(text: string, predictedEntities: CLM.PredictedEntity[], state: CLState, allEntities: CLM.EntityBase[], skipEntityDetectionCallBack: boolean = false): Promise<CLM.ScoreInput> {

        // Entities before processing
        let prevMemories = new CLM.FilledEntityMap(await state.EntityState.FilledEntityMap())

        // Update memory with predicted entities
        await this.ProcessPredictedEntities(text, state.EntityState, predictedEntities, allEntities)

        // If bot has callback and callback should not be skipped, call it
        if (this.entityDetectionCallback && !skipEntityDetectionCallBack) {
            let memoryManager = await this.CreateMemoryManagerAsync(state, allEntities, prevMemories)

            await this.entityDetectionCallback(text, memoryManager)

            // Update Memory
            await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)
        }

        // Get entities from my memory
        const filledEntities = await state.EntityState.FilledEntitiesAsync()

        let scoreInput: CLM.ScoreInput = {
            filledEntities,
            context: {},
            maskedActions: []
        }
        return scoreInput
    }

    private async CreateMemoryManagerAsync(state: CLState, allEntities: CLM.EntityBase[], prevMemories?: CLM.FilledEntityMap): Promise<ClientMemoryManager> {
        let sessionInfo = await state.BotState.SessionInfoAsync()
        let curMemories = new CLM.FilledEntityMap(await state.EntityState.FilledEntityMap())
        if (!prevMemories) {
            prevMemories = curMemories
        }
        return new ClientMemoryManager(prevMemories, curMemories, allEntities, sessionInfo)
    }

    private async CreateReadOnlyMemoryManagerAsync(state: CLState, allEntities: CLM.EntityBase[], prevMemories?: CLM.FilledEntityMap): Promise<ReadOnlyClientMemoryManager> {
        let sessionInfo = await state.BotState.SessionInfoAsync()
        let curMemories = new CLM.FilledEntityMap(await state.EntityState.FilledEntityMap())
        if (!prevMemories) {
            prevMemories = curMemories
        }
        return new ReadOnlyClientMemoryManager(prevMemories, curMemories, allEntities, sessionInfo)
    }

    private getTurnContextForConversationReference = (conversationRef: Partial<BB.ConversationReference>): BB.TurnContext => {
        if (!this.adapter) {
            CLDebug.Error('Missing Adapter')
            throw new Error('Adapter is missing!')
        }

        const activity = <BB.Activity>{ type: BB.ActivityTypes.Message }
        const incomingActivity = BB.TurnContext.applyConversationReference(activity, conversationRef, true)
        CLDebug.Log(`Activity artificially created using conversation reference`)

        return new BB.TurnContext(this.adapter, incomingActivity)
    }

    private async GetTurnContext(state: CLState): Promise<BB.TurnContext> {
        let context = state.turnContext
        // If no context, construct artificial context
        if (!context) {
            // Get conversation ref, so I can generate context and send it back to bot dev
            const conversationReference = await state.BotState.GetConversationReference()
            if (!conversationReference) {
                throw new Error('Missing ConversationReference')
            }

            context = this.getTurnContextForConversationReference(conversationReference)
        }

        return context
    }

    // Call session start callback, set memory and return list of filled entities coming from callback
    protected async CheckSessionStartCallback(state: CLState, entities: CLM.EntityBase[]): Promise<void> {

        // If bot has callback, call it
        if (this.onSessionStartCallback && this.adapter) {
            let memoryManager = await this.CreateMemoryManagerAsync(state, entities)

            // Get conversation ref, so I can generate context and send it back to bot dev
            let conversationReference = await state.BotState.GetConversationReference()
            if (!conversationReference) {
                CLDebug.Error('Missing ConversationReference')
                return
            }

            const context = await this.GetTurnContext(state)
            if (this.onSessionStartCallback) {
                try {
                    await this.onSessionStartCallback(context, memoryManager)
                    await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)
                }
                catch (err) {
                    const message = BB.MessageFactory.text(CLStrings.EXCEPTION_ONSESSIONSTART_CALLBACK)
                    const replayError = new CLM.ReplayErrorAPIException()
                    message.channelData = { clData: { replayError } }

                    await this.SendMessage(state, message)
                    CLDebug.Log(err)
                }
            }
        }
    }

    protected async CheckSessionEndCallback(state: CLState, entities: CLM.EntityBase[], sessionEndState: CLM.SessionEndState, data?: string): Promise<void> {

        // If onEndSession hasn't been called yet, call it
        let needEndSession = await state.BotState.GetNeedSessionEndCall()

        if (needEndSession) {

            // If bot has callback, call it to determine which entities to clear / edit
            if (this.onSessionEndCallback && this.adapter) {

                let memoryManager = await this.CreateMemoryManagerAsync(state, entities)

                // Get conversation ref, so I can generate context and send it back to bot dev
                let conversationReference = await state.BotState.GetConversationReference()
                if (!conversationReference) {
                    CLDebug.Error('Missing ConversationReference')
                    return
                }

                const context = await this.GetTurnContext(state)
                try {
                    let saveEntities = this.onSessionEndCallback
                        ? await this.onSessionEndCallback(context, memoryManager, sessionEndState, data)
                        : undefined

                    await state.EntityState.ClearAsync(saveEntities)
                }
                catch (err) {
                    const message = BB.MessageFactory.text(CLStrings.EXCEPTION_ONSESSIONEND_CALLBACK)
                    const replayError = new CLM.ReplayErrorAPIException()
                    message.channelData = { clData: { replayError } }

                    await this.SendMessage(state, message)
                    CLDebug.Log(err)
                }
            }
            // Otherwise just clear the memory
            else {
                await state.EntityState.ClearAsync()
            }
            await state.BotState.SetNeedSessionEndCall(false)
        }
    }

    public async TakeActionAsync(conversationReference: Partial<BB.ConversationReference>, clRecognizeResult: CLRecognizerResult, uiTrainScorerStep: CLM.UITrainScorerStep | null, testAPIResults: CLM.FilledEntity[] = []): Promise<IActionResult> {
        // Get filled entities from memory
        let filledEntityMap = await clRecognizeResult.state.EntityState.FilledEntityMap()
        filledEntityMap = Utils.addEntitiesById(filledEntityMap)

        // If the action was terminal, free up the mutex allowing queued messages to be processed
        // Activity won't be present if running in training as messages aren't queued
        if (clRecognizeResult.scoredAction.isTerminal && clRecognizeResult.activity) {
            await InputQueue.MessageHandled(clRecognizeResult.state.MessageState, clRecognizeResult.activity.conversation.id, clRecognizeResult.activity)
        }

        if (!conversationReference.conversation) {
            throw new Error(`ConversationReference contains no conversation`)
        }

        let actionResult: IActionResult
        let app: CLM.AppBase | null = null
        let sessionId: string | null = null
        let replayError: CLM.ReplayError | null = null
        const inTeach = uiTrainScorerStep !== null
        let uiMode = await clRecognizeResult.state.BotState.getUIMode()

        if (CLM.ActionBase.isPlaceholderAPI(clRecognizeResult.scoredAction)) {

            // If running a test, used placeholder api results for the test
            // Otherwise retrieve from logicResult
            let placeHolderFilledEntities: CLM.FilledEntity[] = []
            if (uiMode === UIMode.TEST) {
                placeHolderFilledEntities = testAPIResults
            }
            else if (uiTrainScorerStep?.trainScorerStep.logicResult) {
                placeHolderFilledEntities = uiTrainScorerStep.trainScorerStep.logicResult.changedFilledEntities
            }

            const apiAction = new CLM.ApiAction(clRecognizeResult.scoredAction as any)
            actionResult = await this.TakeAPIPlaceholderAction(
                apiAction,
                placeHolderFilledEntities,
                clRecognizeResult.state,
                clRecognizeResult.clEntities)
            if (inTeach) {
                replayError = new CLM.ReplayErrorAPIPlaceholder()
            }
            else {
                this.SaveLogicResult(clRecognizeResult, actionResult, apiAction.actionId, conversationReference)
            }
        }
        else {
            switch (clRecognizeResult.scoredAction.actionType) {
                case CLM.ActionTypes.TEXT: {
                    // This is hack to allow ScoredAction to be accepted as ActionBase
                    // TODO: Remove extra properties from ScoredAction so it only had actionId and up service to return actions definitions of scored/unscored actions
                    // so UI can link the two together instead of having "partial" actions being incorrectly treated as full actions
                    const textAction = new CLM.TextAction(clRecognizeResult.scoredAction as any)
                    const response = await this.TakeTextAction(textAction, filledEntityMap)
                    actionResult = {
                        logicResult: undefined,
                        response
                    }
                    break
                }
                case CLM.ActionTypes.API_LOCAL: {
                    const apiAction = new CLM.ApiAction(clRecognizeResult.scoredAction as any)
                    actionResult = await this.TakeAPIAction(
                        apiAction,
                        filledEntityMap,
                        clRecognizeResult.state,
                        clRecognizeResult.clEntities,
                        inTeach,
                        {
                            type: ActionInputType.LOGIC_AND_RENDER
                        }
                    )

                    if (inTeach) {
                        if (actionResult.replayError) {
                            replayError = actionResult.replayError
                        }
                    }
                    else {
                        this.SaveLogicResult(clRecognizeResult, actionResult, apiAction.actionId, conversationReference)
                    }
                    break
                }
                case CLM.ActionTypes.CARD: {
                    const cardAction = new CLM.CardAction(clRecognizeResult.scoredAction as any)
                    const response = await this.TakeCardAction(cardAction, filledEntityMap)
                    actionResult = {
                        logicResult: undefined,
                        response
                    }
                    break
                }
                case CLM.ActionTypes.END_SESSION: {
                    app = await clRecognizeResult.state.BotState.GetApp()
                    const sessionAction = new CLM.SessionAction(clRecognizeResult.scoredAction as any)
                    sessionId = await clRecognizeResult.state.BotState.GetSessionIdAndSetConversationId(conversationReference)
                    const response = await this.TakeSessionAction(sessionAction, filledEntityMap, inTeach, clRecognizeResult.state, sessionId, app)
                    actionResult = {
                        logicResult: undefined,
                        response
                    }
                    break
                }
                case CLM.ActionTypes.SET_ENTITY: {
                    // TODO: Schema refactor
                    // scored actions aren't actions and only have payload instead of strongly typed values
                    const setEntityAction = new CLM.SetEntityAction(clRecognizeResult.scoredAction as any)
                    actionResult = await this.TakeSetEntityAction(
                        setEntityAction,
                        filledEntityMap,
                        clRecognizeResult.state,
                        clRecognizeResult.clEntities,
                        inTeach
                    )
                    break
                }
                case CLM.ActionTypes.DISPATCH: {
                    const dispatchAction = new CLM.DispatchAction(clRecognizeResult.scoredAction as any)
                    actionResult = await this.TakeDispatchAction(
                        dispatchAction,
                        inTeach,
                    )

                    if (!inTeach) {
                        CLDebug.Log(`Dispatch to Model: ${dispatchAction.modelId} ${dispatchAction.modelName}`, DebugType.Dispatch)
                        await this.forwardInputToModel(dispatchAction.modelId, clRecognizeResult.state)
                        // Force response to null to avoid sending message as message will come from next model.
                        actionResult.response = null
                    }

                    break
                }
                case CLM.ActionTypes.CHANGE_MODEL: {
                    const changeModelAction = new CLM.ChangeModelAction(clRecognizeResult.scoredAction as any)
                    sessionId = await clRecognizeResult.state.BotState.GetSessionIdAndSetConversationId(conversationReference)
                    actionResult = await this.TakeChangeModelAction(
                        changeModelAction,
                        inTeach,
                        clRecognizeResult.state,
                        sessionId,
                        app,
                    )

                    if (!inTeach) {
                        CLDebug.Log(`Change to Model: ${changeModelAction.modelId} ${changeModelAction.modelName}`, DebugType.Dispatch)
                        await this.forwardInputToModel(changeModelAction.modelId, clRecognizeResult.state, true)
                        // Force response to null to avoid sending message as message will come from next model.
                        actionResult.response = null
                    }
                    break
                }
                default:
                    throw new Error(`Could not find matching renderer for action type: ${clRecognizeResult.scoredAction.actionType}`)
            }
        }

        // Convert string actions to activities
        if (typeof actionResult.response === 'string') {
            actionResult.response = BB.MessageFactory.text(actionResult.response)
        }
        if (actionResult.response && typeof actionResult.response !== 'string' && uiTrainScorerStep) {
            actionResult.response.channelData = {
                ...actionResult.response.channelData, clData: { ...uiTrainScorerStep.clData, replayError: replayError || undefined }
            }
        }

        // If action wasn't terminal loop through Conversation Learner again after a short delay (unless I'm testing where it's handled by the tester)
        if (!clRecognizeResult.inTeach && !clRecognizeResult.scoredAction.isTerminal && uiMode !== UIMode.TEST) {
            if (app === null) {
                app = await clRecognizeResult.state.BotState.GetApp()
            }
            if (!app) {
                throw new Error(`Attempted to get current app before app was set.`)
            }

            if (!conversationReference.conversation) {
                throw new Error(`Attempted to get session by conversation id, but user was not defined on current conversation`)
            }

            if (sessionId == null) {
                sessionId = await clRecognizeResult.state.BotState.GetSessionIdAndSetConversationId(conversationReference)
            }
            if (!sessionId) {
                throw new Error(`Attempted to get session by conversation id: ${conversationReference.conversation.id} but session was not found`)
            }

            // send the current response to user before score for the next turn
            if (actionResult.response != null) {
                await this.SendMessage(clRecognizeResult.state, actionResult.response)
            }
            await delay(100)

            let bestAction = await this.Score(
                app.appId,
                sessionId,
                clRecognizeResult.state,
                '',
                [],
                clRecognizeResult.clEntities,
                clRecognizeResult.inTeach,
                true
            )

            clRecognizeResult.scoredAction = bestAction
            actionResult = await this.TakeActionAsync(conversationReference, clRecognizeResult, uiTrainScorerStep)
        }
        return actionResult
    }

    private async forwardInputToModel(modelId: string, state: CLState, changeActiveModel: boolean = false) {
        if (modelId === this.modelId) {
            throw new Error(`Cannot forward input to model with same ID as active model. This shouldn't be possible open an issue.`)
        }

        // Reuse model instance from cache or create it
        let model = ConversationLearner.models.find(m => m.clRunner.modelId === modelId)
        if (!model) {
            model = new ConversationLearner(
                this.stateFactory,
                this.clClient,
                this.options,
                modelId
            )
        }

        // Save the model id for the conversation so all future input is directed to it.
        if (changeActiveModel) {
            state.ConversationModelState.set(model.clRunner.modelId)
        }

        const turnContext = state.turnContext
        if (!turnContext) {
            throw new Error(`Cannot forward input (turnContext) to next model because turnContext is undefined.`)
        }

        const conversationReference = BB.TurnContext.getConversationReference(turnContext.activity)
        // Need to set adapter since we're going around this setup in recognize
        // and can't use recognize for dispatch since want to force which model processes input instead looking for match from conversation again
        model.clRunner.SetAdapter(turnContext.adapter, conversationReference)
        const recognizerResult = await model.clRunner.ProcessInput(turnContext)
        if (recognizerResult) {
            await model.SendResult(recognizerResult)
        }
    }

    public async SendResult(recognizerResult: CLRecognizerResult, uiTrainScorerStep: CLM.UITrainScorerStep | null = null): Promise<IActionResult | undefined> {
        const conversationReference = await recognizerResult.state.BotState.GetConversationReference()
        if (!conversationReference) {
            CLDebug.Error('Missing ConversationReference')
            return
        }
        if (!this.adapter) {
            CLDebug.Error('Missing Adapter')
            return
        }

        const actionResult = await this.TakeActionAsync(conversationReference, recognizerResult, uiTrainScorerStep)

        if (actionResult.response != null) {
            const context = await this.GetTurnContext(recognizerResult.state)
            await context.sendActivity(actionResult.response)
        }

        return actionResult
    }

    /**
     * 
     * @param state CLState
     * @param message Message to send to use
     * @param erroredActivity If message is in response to an error, the incoming activity that triggered it
     */
    private async SendMessage(state: CLState, message: string | Partial<BB.Activity>, erroredActivity?: BB.Activity): Promise<void> {

        // If there was an error, pop incoming activity from message queue, so can move on to next
        if (erroredActivity) {
            const conversationId = await state.BotState.GetConversationId()
            if (conversationId) {
                await InputQueue.MessageHandled(state.MessageState, conversationId, erroredActivity)
            }
            else {
                console.debug("Missing ConversationId in SendMessage")
            }
        }

        let conversationReference = await state.BotState.GetConversationReference()
        if (!conversationReference) {
            CLDebug.Error('Missing ConversationReference')
            return
        }

        if (!this.adapter) {
            CLDebug.Error(`Attempted to send message before adapter was assigned`)
            return
        }
        const context = await this.GetTurnContext(state)
        await context.sendActivity(message)
    }

    // TODO: This issue arises because we only save non-null non-empty argument values on the actions
    // which means callback may accept more arguments than is actually available on the action.arguments
    // To me, it seems it would make more sense to always have these be same length, but perhaps there is
    // dependency on action not being defined somewhere else in the application like ActionCreatorEditor
    private GetRenderedArguments(fnArgs: string[], actionArgs: CLM.ActionArgument[], filledEntityMap: CLM.FilledEntityMap): string[] {
        const missingEntityNames: string[] = []
        const renderedArgumentValues = fnArgs.map(param => {
            const argument = actionArgs.find(arg => arg.parameter === param)
            if (!argument) {
                return ''
            }

            try {
                return argument.renderValue(CLM.getEntityDisplayValueMap(filledEntityMap))
            }
            catch (error) {
                missingEntityNames.push(param)
                return ''
            }
        }, missingEntityNames)

        if (missingEntityNames.length > 0) {
            throw new Error(`Missing Entity value(s) for ${missingEntityNames.join(', ')}`)
        }

        return renderedArgumentValues
    }

    public async TakeAPIPlaceholderAction(placeholderAction: CLM.ApiAction, placeHolderFilledEntities: CLM.FilledEntity[], state: CLState, allEntities: CLM.EntityBase[]): Promise<IActionResult> {

        try {
            const memoryManager = await this.CreateMemoryManagerAsync(state, allEntities)

            // Update memory with placeholder API values
            memoryManager.curMemories.UpdateFilledEntities(placeHolderFilledEntities, allEntities)

            // Update memory with changes from logic callback
            await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)

            let feMap = CLM.FilledEntityMap.FromFilledEntities(placeHolderFilledEntities, allEntities)

            let body = Object.keys(feMap.map).map(feKey => {
                return {
                    type: "TextBlock",
                    text: `${feKey} = ${feMap.ValueAsString(feKey)}`
                }
            })

            // Render card for placeholder
            let card = {
                type: "AdaptiveCard",
                version: "1.0",
                body: body
            }
            const attachment = BB.CardFactory.adaptiveCard(card)
            const response = BB.MessageFactory.attachment(attachment)
            response.text = `API Placeholder: ${placeholderAction.name}`

            // Store placeholder entities in logic reult
            return {
                logicResult: { changedFilledEntities: placeHolderFilledEntities, logicValue: undefined },
                response,
                replayError: undefined
            }
        }
        catch (err) {
            return {
                logicResult: undefined,
                response: CLDebug.Error(err),
                replayError: undefined
            }
        }
    }

    public async TakeSetEntityAction(action: CLM.SetEntityAction, filledEntityMap: CLM.FilledEntityMap, state: CLState, allEntities: CLM.EntityBase[], inTeach: boolean): Promise<IActionResult> {
        try {
            let replayError: CLM.ReplayError | undefined
            let response: Partial<BB.Activity> | string | null = null

            const entity = allEntities.find(e => e.entityId === action.entityId)
            if (!entity) {
                throw new Error(`Set Entity Action: ${action.actionId} could not find the referenced entity with id: ${action.entityId}`)
            }

            if (entity.entityType !== CLM.EntityType.ENUM) {
                throw new Error(`Set Entity Action: ${action.actionId} referenced entity ${entity.entityName} but it is not an ENUM. Please update the action to reference the correct entity.`)
            }

            const enumValueObj = entity.enumValues?.find(ev => ev.enumValueId === action.enumValueId)
            if (!enumValueObj) {
                throw new Error(`Set Entity Action: ${action.actionId} which sets: ${entity.entityName} could not find the value with id: ${action.enumValueId}`)
            }

            // TODO: Is there more efficient way to do this, like editing memory directly?
            const memoryManager = await this.CreateMemoryManagerAsync(state, allEntities)
            memoryManager.Set(entity.entityName, enumValueObj.enumValue)
            await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)

            if (inTeach) {
                response = this.RenderSetEntityCard(entity.entityName, enumValueObj.enumValue)
            }

            return {
                logicResult: undefined,
                response,
                replayError: replayError ?? undefined
            }
        }
        catch (e) {
            const error: Error = e
            const title = error.message || `Exception hit when calling Set Entity Action: '${action.actionId}'`
            const message = this.RenderErrorCard(title, error.stack || error.message || "")
            const replayError = new CLM.ReplaySetEntityException()
            return {
                logicResult: undefined,
                response: message,
                replayError
            }
        }
    }

    public async TakeDispatchAction(action: CLM.DispatchAction, inTeach: boolean): Promise<IActionResult> {
        try {
            let response: Partial<BB.Activity> | string | null = null

            if (inTeach) {
                response = this.RenderDispatchCard(action.modelName)
            }

            return {
                logicResult: undefined,
                response,
                replayError: undefined,
            }
        }
        catch (e) {
            const error: Error = e
            const title = error.message || `Exception hit when calling ${CLM.ActionTypes.DISPATCH} Action: '${action.actionId}'`
            const message = this.RenderErrorCard(title, error.stack || error.message || "")
            const replayError = new CLM.ReplayDispatchException()
            return {
                logicResult: undefined,
                response: message,
                replayError,
            }
        }
    }

    public async TakeChangeModelAction(
        action: CLM.ChangeModelAction,
        inTeach: boolean,
        state: CLState,
        sessionId: string | null,
        app: CLM.AppBase | null,
    ): Promise<IActionResult> {
        try {
            let response: Partial<BB.Activity> | null = null

            if (inTeach) {
                response = this.RenderChangeModelCard(action.modelName)
            }
            else if (app && sessionId) {
                await Utils.EndSessionIfOpen(this.clClient, app.appId, sessionId)
                await this.EndSessionAsync(state, CLM.SessionEndState.COMPLETED, action.modelName)
            }

            return {
                logicResult: undefined,
                response,
                replayError: undefined,
            }
        }
        catch (e) {
            const error: Error = e
            const title = error.message || `Exception hit when calling ${CLM.ActionTypes.CHANGE_MODEL} Action: '${action.actionId}'`
            const message = this.RenderErrorCard(title, error.stack || error.message || "")
            const replayError = new CLM.ReplayChangeModelException()
            return {
                logicResult: undefined,
                response: message,
                replayError,
            }
        }
    }

    public async TakeAPIAction(apiAction: CLM.ApiAction, filledEntityMap: CLM.FilledEntityMap, state: CLState, allEntities: CLM.EntityBase[], showAPICard: boolean, actionInput: IActionInput): Promise<IActionResult> {
        // Extract API name and args
        const callback = this.callbacks[apiAction.name]
        if (!callback) {
            return {
                logicResult: undefined,
                response: `ERROR: API callback with name "${apiAction.name}" is not defined`
            }
        }

        try {
            // Invoke Logic part of callback
            const renderedLogicArgumentValues = this.GetRenderedArguments(callback.logicArguments, apiAction.logicArguments, filledEntityMap)
            const memoryManager = await this.CreateMemoryManagerAsync(state, allEntities)
            let replayError: CLM.ReplayError | null = null

            // If we're only doing the render part, used stored values
            // This happens when replaying dialog to recreated action outputs
            let logicResult: CLM.LogicResult = { logicValue: undefined, changedFilledEntities: [] }
            if (actionInput.type === ActionInputType.RENDER_ONLY) {
                logicResult = actionInput.logicResult ?? logicResult

                // Logic result holds delta from before after logic callback, use it to update memory
                memoryManager.curMemories.UpdateFilledEntities(logicResult.changedFilledEntities, allEntities)

                // Update memory with changes from logic callback
                await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)
            }
            else {
                try {
                    // create a copy of the map before calling into logic api
                    // the copy of map is created because the passed infilledEntityMap contains "filledEntities by Id" too
                    // and this causes issues when calculating changedFilledEntities.
                    const entityMapBeforeCall = new CLM.FilledEntityMap(await state.EntityState.FilledEntityMap())
                    // Store logic callback value
                    const logicObject = await callback.logic(memoryManager, ...renderedLogicArgumentValues)
                    logicResult.logicValue = JSON.stringify(logicObject)
                    // Update memory with changes from logic callback
                    await state.EntityState.RestoreFromMemoryManagerAsync(memoryManager)
                    // Store changes to filled entities
                    logicResult.changedFilledEntities = CLM.ModelUtils.changedFilledEntities(entityMapBeforeCall, memoryManager.curMemories)
                }
                catch (e) {
                    const error: Error = e
                    let botAPIError: CLM.LogicAPIError = { APIError: error.stack || error.message || JSON.stringify(error) }
                    logicResult.logicValue = JSON.stringify(botAPIError)
                    replayError = new CLM.ReplayErrorAPIException()
                }
            }

            // Render the action unless only doing logic part
            if (actionInput.type === ActionInputType.LOGIC_ONLY) {
                return {
                    logicResult,
                    response: null,
                    replayError: replayError || undefined
                }
            }
            else {
                let response: Partial<BB.Activity> | string | null = null
                let logicAPIError = Utils.GetLogicAPIError(logicResult)

                // If there was an api Error show card to user
                if (logicAPIError) {
                    const title = `${CLStrings.EXCEPTION_API_CALLBACK}'${apiAction.name}'`
                    response = this.RenderErrorCard(title, logicAPIError.APIError)
                }
                else if (logicResult.logicValue && !callback.render) {
                    const title = `${CLStrings.MALFORMED_API_CALLBACK}'${apiAction.name}'`
                    response = this.RenderErrorCard(title, "Logic portion of callback returns a value, but no Render portion defined")
                    replayError = new CLM.ReplayErrorAPIMalformed()
                }
                else {
                    // Invoke Render part of callback
                    const renderedRenderArgumentValues = this.GetRenderedArguments(callback.renderArguments, apiAction.renderArguments, filledEntityMap)

                    const readOnlyMemoryManager = await this.CreateReadOnlyMemoryManagerAsync(state, allEntities)

                    let logicObject = logicResult.logicValue ? JSON.parse(logicResult.logicValue) : undefined
                    if (callback.render) {
                        response = await callback.render(logicObject, readOnlyMemoryManager, ...renderedRenderArgumentValues)
                    }

                    if (response && !Utils.IsCardValid(response)) {
                        const title = `${CLStrings.MALFORMED_API_CALLBACK}'${apiAction.name}'`
                        const error = `Return value in Render function must be a string or BotBuilder Activity`
                        response = this.RenderErrorCard(title, error)
                        replayError = new CLM.ReplayErrorAPIBadCard()
                    }

                    // If response is empty, but we're in teach session return a placeholder card in WebChat so they can click it to edit
                    // Otherwise return the response as is.
                    if (!response && showAPICard) {
                        response = this.RenderAPICard(callback, renderedLogicArgumentValues)
                    }
                }
                return {
                    logicResult,
                    response,
                    replayError: replayError || undefined
                }
            }
        }
        catch (e) {
            const error: Error = e
            const title = `${CLStrings.EXCEPTION_API_CALLBACK}'${apiAction.name}'`
            const message = this.RenderErrorCard(title, error.stack || error.message || "")
            const replayError = new CLM.ReplayErrorAPIException()
            return {
                logicResult: undefined,
                response: message,
                replayError
            }
        }
    }

    public async TakeTextAction(textAction: CLM.TextAction, filledEntityMap: CLM.FilledEntityMap): Promise<Partial<BB.Activity> | string> {
        return Promise.resolve(textAction.renderValue(CLM.getEntityDisplayValueMap(filledEntityMap)))
    }

    public async TakeCardAction(cardAction: CLM.CardAction, filledEntityMap: CLM.FilledEntityMap): Promise<Partial<BB.Activity> | string> {
        try {
            const entityDisplayValues = CLM.getEntityDisplayValueMap(filledEntityMap)
            const renderedArguments = cardAction.renderArguments(entityDisplayValues)

            const missingEntities = renderedArguments.filter(ra => ra.value === null)
            if (missingEntities.length > 0) {
                return `ERROR: Missing Entity value(s) for ${missingEntities.map(me => me.parameter).join(', ')}`
            }

            const activity = await TemplateProvider.RenderTemplate(cardAction.templateName, renderedArguments, entityDisplayValues)

            if (activity == null) {
                return CLDebug.Error(`Missing Template: ${cardAction.templateName}`)
            }
            return activity
        } catch (error) {
            let msg = CLDebug.Error(error, 'Card Template or arguments are invalid. Unable to render template')
            return msg
        }
    }

    private async TakeSessionAction(sessionAction: CLM.SessionAction, filledEntityIdMap: CLM.FilledEntityMap, inTeach: boolean, state: CLState, sessionId: string | null, app: CLM.AppBase | null): Promise<Partial<BB.Activity> | null> {
        // Get any context from the action
        const content = sessionAction.renderValue(CLM.getEntityDisplayValueMap(filledEntityIdMap))

        // If inTeach, show something to user in WebChat so they can edit
        if (inTeach) {
            const card = {
                type: "AdaptiveCard",
                version: "1.0",
                body: [
                    {
                        type: "TextBlock",
                        text: `EndSession: *${content}*`
                    }
                ]
            }
            const attachment = BB.CardFactory.adaptiveCard(card)
            const message = BB.MessageFactory.attachment(attachment)
            return message
        }
        // If I'm not in Teach end session.
        // (In Teach EndSession is handled in ScoreFeedback to keep session alive for TeachScoreFeedback)
        else {
            // End the current session (if in replay will be no sessionId or app)
            if (app && sessionId) {
                await Utils.EndSessionIfOpen(this.clClient, app.appId, sessionId)
                await this.EndSessionAsync(state, CLM.SessionEndState.COMPLETED, content)
            }
        }
        return null
    }

    // Returns true if Action is available given Entities in Memory
    public isActionAvailable(action: CLM.ActionBase, filledEntities: CLM.FilledEntity[], entities: CLM.EntityBase[]): boolean {
        const areRequiredConditionsTrue = action.requiredConditions.every(condition => Utils.isConditionTrue(condition, filledEntities, entities))
        if (areRequiredConditionsTrue === false) {
            return false
        }

        const areNegativeConditionsTrue = action.negativeConditions.every(condition => !Utils.isConditionTrue(condition, filledEntities, entities))
        if (areNegativeConditionsTrue === false) {
            return false
        }

        for (const entityId of action.requiredEntities) {
            const found = filledEntities.find(e => e.entityId == entityId)
            if (!found || found.values.length === 0) {
                return false
            }
        }
        for (const entityId of action.negativeEntities) {
            const found = filledEntities.find(e => e.entityId == entityId)
            if (found && found.values.length > 0) {
                return false
            }
        }
        return true
    }

    // Convert list of filled entities into a filled entity map lookup table
    private CreateFilledEntityMap(filledEntities: CLM.FilledEntity[], entityList: CLM.EntityList): CLM.FilledEntityMap {
        let filledEntityMap = new CLM.FilledEntityMap()
        for (let filledEntity of filledEntities) {
            let entity = entityList.entities.find(e => e.entityId == filledEntity.entityId)
            if (entity) {
                filledEntityMap.map[entity.entityName] = filledEntity
                filledEntityMap.map[entity.entityId] = filledEntity
            }
        }
        return filledEntityMap
    }

    /**
     * Identify any validation issues
     * Missing Entities
     * Missing Actions
     * Unavailable Actions
     */
    public DialogValidationErrors(trainDialog: CLM.TrainDialog, entities: CLM.EntityBase[], actions: CLM.ActionBase[]): string[] {

        let validationErrors: string[] = []

        for (let round of trainDialog.rounds) {
            let userText = round.extractorStep.textVariations[0].text
            let filledEntities = round.scorerSteps[0]?.input?.filledEntities ?? []

            // Check that entities exist
            for (let filledEntity of filledEntities) {
                if (!entities.find(e => e.entityId == filledEntity.entityId)) {
                    validationErrors.push(`Missing Entity for "${CLM.filledEntityValueAsString(filledEntity)}"`)
                }
            }

            for (let scorerStep of round.scorerSteps) {
                let labelAction = scorerStep.labelAction

                // Check that action exists
                let selectedAction = actions.find(a => a.actionId == labelAction)
                if (!selectedAction) {
                    validationErrors.push(`Missing Action response for "${userText}"`)
                }
                else {
                    // Check action availability
                    if (!this.isActionAvailable(selectedAction, scorerStep.input.filledEntities, entities)) {
                        validationErrors.push(`Selected Action in unavailable in response to "${userText}"`)
                    }
                }
            }
        }
        // Make errors unique using Set operator
        validationErrors = [...new Set(validationErrors)]
        return validationErrors
    }

    /** Return a list of trainDialogs that are invalid for the given set of entities and actions */
    public validateTrainDialogs(appDefinition: CLM.AppDefinition): string[] {
        let invalidTrainDialogIds = []
        for (let trainDialog of appDefinition.trainDialogs) {
            // Ignore train dialogs that are already invalid
            if (trainDialog.validity !== CLM.Validity.INVALID) {
                let validationErrors = this.DialogValidationErrors(trainDialog, appDefinition.entities, appDefinition.actions)
                if (validationErrors.length > 0) {
                    invalidTrainDialogIds.push(trainDialog.trainDialogId)
                }
            }
        }
        return invalidTrainDialogIds
    }

    /** Populate prebuilt information in predicted entities given filled entity array */
    private PopulatePrebuilts(predictedEntities: CLM.PredictedEntity[], filledEntities: CLM.FilledEntity[]) {
        for (let pe of predictedEntities) {
            let filledEnt = filledEntities.find(fe => fe.entityId === pe.entityId)
            if (filledEnt) {
                let value = filledEnt.values.find(v => v.userText === pe.entityText)
                if (value) {
                    pe.resolution = value.resolution
                    if (value.builtinType) {
                        pe.builtinType = value.builtinType
                    }
                }
            }
        }
    }

    /**
     * Provide empty FilledEntity for any missing entities so they can still be rendered
     */
    private PopulateMissingFilledEntities(action: CLM.ActionBase, filledEntityMap: CLM.FilledEntityMap, allEntities: CLM.EntityBase[], bidirectional: boolean): string[] {
        // For backwards compatibiliity need to check requieredEntities too.  In new version all in requiredEntitiesFromPayload
        const allRequiredEntities = [...action.requiredEntities, ...action.requiredEntitiesFromPayload]
        let missingEntities: string[] = []

        allRequiredEntities.forEach((entityId: string) => {
            let entity = allEntities.find(e => e.entityId === entityId)
            if (entity) {
                if (!filledEntityMap.map[entity.entityName]) {
                    // Add an empty filledEntity if requried and has no values
                    let filledEntity = {
                        entityId: entityId,
                        values: []
                    } as CLM.FilledEntity
                    filledEntityMap.map[entity.entityId] = filledEntity
                    if (bidirectional) {
                        filledEntityMap.map[entity.entityName] = filledEntity
                    }
                    missingEntities.push(entity.entityName)
                }
                else {
                    const filledEntity = filledEntityMap.map[entity.entityName]
                    if (filledEntity?.values.length === 0) {
                        missingEntities.push(entity.entityName)
                    }
                }
            } else {
                throw new Error(`ENTITY ${entityId} DOES NOT EXIST`)
            }
        })
        return missingEntities
    }

    /**
     * Initialize memory for replay
     */
    private async InitReplayMemory(state: CLState, trainDialog: CLM.TrainDialog, allEntities: CLM.EntityBase[]) {

        // Reset the memory
        await state.EntityState.ClearAsync()

        // Call start sesssion for initial entities
        await this.CheckSessionStartCallback(state, allEntities)
        let startSessionEntities = await state.EntityState.FilledEntitiesAsync()
        startSessionEntities = [...trainDialog.initialFilledEntities ?? [], ...startSessionEntities]

        let map = CLM.FilledEntityMap.FromFilledEntities(startSessionEntities, allEntities)
        await state.EntityState.RestoreFromMapAsync(map)
    }

    /**
     * Replay a TrainDialog, calling EntityDetection callback and API Logic,
     * recalculating FilledEntities along the way
     */
    public async ReplayTrainDialogLogic(trainDialog: CLM.TrainDialog, state: CLState, cleanse: boolean): Promise<CLM.TrainDialog> {

        if (!trainDialog?.rounds) {
            return trainDialog
        }

        // Copy train dialog
        let newTrainDialog: CLM.TrainDialog = JSON.parse(JSON.stringify(trainDialog))

        let entities: CLM.EntityBase[] = trainDialog.definitions ? trainDialog.definitions.entities : []
        let actions: CLM.ActionBase[] = trainDialog.definitions ? trainDialog.definitions.actions : []
        let entityList: CLM.EntityList = { entities }

        await this.InitReplayMemory(state, newTrainDialog, entities)

        for (let round of newTrainDialog.rounds) {

            // Call entity detection callback with first text Variation
            let textVariation = round.extractorStep.textVariations[0]
            let predictedEntities = CLM.ModelUtils.ToPredictedEntities(textVariation.labelEntities)

            // Call EntityDetectionCallback and populate filledEntities with the result
            let scoreInput: CLM.ScoreInput
            let botAPIError: CLM.LogicAPIError | null = null
            try {
                scoreInput = await this.CallEntityDetectionCallback(textVariation.text, predictedEntities, state, entities)
            }
            catch (err) {
                // Hit exception in Bot's Entity Detection Callback
                // Use existing memory before callback
                const filledEntities = await state.EntityState.FilledEntitiesAsync()
                scoreInput = {
                    filledEntities,
                    context: {},
                    maskedActions: []
                }

                // Create error to show to user
                const errMessage = `${CLStrings.ENTITYCALLBACK_EXCEPTION} ${err.message}`
                botAPIError = { APIError: errMessage }
            }

            // Use scorer step to populate pre-built data (when)
            if (round.scorerSteps && round.scorerSteps.length > 0) {

                // Set filled entities
                this.PopulatePrebuilts(predictedEntities, scoreInput.filledEntities)
                round.scorerSteps[0].input.filledEntities = scoreInput.filledEntities

                // Go through each scorer step
                for (let [scoreIndex, scorerStep] of round.scorerSteps.entries()) {

                    const curAction = actions.filter((a: CLM.ActionBase) => a.actionId === scorerStep.labelAction)[0]

                    if (CLM.ActionBase.isPlaceholderAPI(curAction)) {
                        // Placeholder output is stored in LogicResult
                        let placeholderFilledEntities = scorerStep.logicResult ? scorerStep.logicResult.changedFilledEntities : []
                        const filledEntityMap = CLM.FilledEntityMap.FromFilledEntities(placeholderFilledEntities, entities)
                        await state.EntityState.RestoreFromMapAsync(filledEntityMap)
                    }
                    else {
                        const filledEntityMap = await state.EntityState.FilledEntityMap()

                        // Provide empty FilledEntity for missing entities
                        if (!cleanse && curAction) {
                            this.PopulateMissingFilledEntities(curAction, filledEntityMap, entities, false)
                        }

                        round.scorerSteps[scoreIndex].input.filledEntities = filledEntityMap.FilledEntities()

                        // CurAction may not exist if it's an imported action
                        if (curAction && scorerStep.labelAction !== CLM.CL_STUB_IMPORT_ACTION_ID) {
                            // Run logic part of APIAction to update the FilledEntities
                            if (curAction.actionType === CLM.ActionTypes.API_LOCAL) {
                                const apiAction = new CLM.ApiAction(curAction)
                                const actionInput: IActionInput = {
                                    type: ActionInputType.LOGIC_ONLY
                                }
                                // Calculate and store new logic result
                                const filledIdMap = filledEntityMap.EntityMapToIdMap()
                                const actionResult = await this.TakeAPIAction(apiAction, filledIdMap, state, entityList.entities, true, actionInput)
                                round.scorerSteps[scoreIndex].logicResult = actionResult.logicResult
                            } else if (curAction.actionType === CLM.ActionTypes.END_SESSION) {
                                const sessionAction = new CLM.SessionAction(curAction)
                                const filledIdMap = filledEntityMap.EntityMapToIdMap()
                                await this.TakeSessionAction(sessionAction, filledIdMap, true, state, null, null)
                            } else if (curAction.actionType === CLM.ActionTypes.SET_ENTITY) {
                                const setEntityAction = new CLM.SetEntityAction(curAction)
                                await this.TakeSetEntityAction(setEntityAction, filledEntityMap, state, entityList.entities, true)
                            } else if (curAction.actionType === CLM.ActionTypes.CHANGE_MODEL) {
                                const changeModelAction = new CLM.ChangeModelAction(curAction)
                                await this.TakeChangeModelAction(changeModelAction, true, state, null, null)
                            }
                        }
                    }

                    // If ran into API error inject into first scorer step so it gets displayed to the user
                    if (botAPIError && scoreIndex === 0) {
                        round.scorerSteps[scoreIndex].logicResult = { logicValue: JSON.stringify(botAPIError), changedFilledEntities: [] }
                    }
                }
            }
            else {
                // Otherwise create a dummy scorer step with the filled entities
                const scorerStep: CLM.TrainScorerStep = {
                    input: {
                        filledEntities: await state.EntityState.FilledEntitiesAsync(),
                        context: {},
                        maskedActions: []
                    },
                    labelAction: undefined,
                    logicResult: undefined,
                    scoredAction: undefined
                }
                if (!round.scorerSteps) {
                    round.scorerSteps = []
                }
                round.scorerSteps.push(scorerStep)
            }
        }

        // When editing, may need to run Scorer or Extrator on TrainDialog with invalid rounds
        //This cleans up the TrainDialog removing bad data so the extractor can run
        if (cleanse) {
            // Remove rounds with two user inputs in a row (they'll have a dummy scorer round)
            newTrainDialog.rounds = newTrainDialog.rounds.filter(r => {
                return !r.scorerSteps[0] || r.scorerSteps[0].labelAction != undefined
            })

        }
        return newTrainDialog
    }

    private GetTrainDialogRoundErrors(
        round: CLM.TrainRound,
        roundIndex: number,
        curAction: CLM.ActionBase | null,
        trainDialog: CLM.TrainDialog,
        allEntities: CLM.EntityBase[],
        filledEntities: CLM.FilledEntity[],
        replayErrors: CLM.ReplayError[]): CLM.ReplayError | null {

        let replayError: CLM.ReplayError | null = null

        // Check that non-multivalue isn't labelled twice
        for (let tv of round.extractorStep.textVariations) {
            let usedEntities: string[] = []
            for (let labelEntity of tv.labelEntities) {
                // If already used, make sure it's multi-value
                if (usedEntities.find(e => e === labelEntity.entityId)) {
                    let entity = allEntities.find(e => e.entityId == labelEntity.entityId)
                    if (entity && !entity.isMultivalue
                        && (entity.entityType === CLM.EntityType.LUIS || entity.entityType === CLM.EntityType.LOCAL)) {
                        replayError = replayError ?? new CLM.EntityUnexpectedMultivalue(entity.entityName)
                        replayErrors.push(replayError)
                    }
                }
                // Otherwise add to list of used entities
                else {
                    usedEntities.push(labelEntity.entityId)
                }
            }
        }

        // Check that entities exist in text variations
        for (let tv of round.extractorStep.textVariations) {
            for (let labelEntity of tv.labelEntities) {
                if (!allEntities.find(e => e.entityId == labelEntity.entityId)) {
                    replayError = new CLM.ReplayErrorEntityUndefined(labelEntity.entityId)
                    replayErrors.push()
                }
            }
        }

        // Check that entities exist in filled entities
        for (let filledEntity of filledEntities) {
            if (!allEntities.find(e => e.entityId == filledEntity.entityId)) {
                replayError = new CLM.ReplayErrorEntityUndefined(CLM.filledEntityValueAsString(filledEntity))
                replayErrors.push()
            }
        }

        // Check for double user inputs
        if (roundIndex != trainDialog.rounds.length - 1 &&
            (round.scorerSteps.length === 0 || !round.scorerSteps[0].labelAction)) {
            replayError = new CLM.ReplayErrorTwoUserInputs()
            replayErrors.push(replayError)
        }

        // Check for user input when previous action wasn't wait
        if (curAction && !curAction.isTerminal) {
            replayError = new CLM.ReplayErrorInputAfterNonWait()
            replayErrors.push(replayError)
        }

        return replayError
    }

    private GetTrainDialogScoreErrors(
        round: CLM.TrainRound,
        scoreIndex: number,
        scoreFilledEntities: CLM.FilledEntity[],
        curAction: CLM.ActionBase | null,
        actions: CLM.ActionBase[],
        entities: CLM.EntityBase[],
        userText: string,
        replayErrors: CLM.ReplayError[]): CLM.ReplayError | null {

        let replayError: CLM.ReplayError | null = null

        // Check that action exists
        if (!curAction) {
            replayError = new CLM.ReplayErrorActionUndefined(userText)
            replayErrors.push(replayError)
        }
        else {
            // Check action availability
            if (!this.isActionAvailable(curAction, scoreFilledEntities, entities)) {
                replayError = new CLM.ReplayErrorActionUnavailable(userText)
                replayErrors.push(replayError)
            }
        }

        // Check that action (if not first) is after a wait action
        if (scoreIndex > 0) {
            const lastScoredAction = round.scorerSteps[scoreIndex - 1].labelAction
            let lastAction = actions.find(a => a.actionId == lastScoredAction)
            if (lastAction?.isTerminal) {
                replayError = new CLM.ReplayErrorActionAfterWait()
                replayErrors.push(replayError)
            }
        }

        return replayError
    }

    /**
     * Get Activities generated by trainDialog.
     * Return any errors in TrainDialog
     * NOTE: Will set bot memory to state at end of activities
     */
    public async GetActivities(trainDialog: CLM.TrainDialog, userName: string, userId: string, state: CLState, useMarkdown: boolean = true): Promise<CLM.TeachWithActivities | null> {

        let entities: CLM.EntityBase[] = trainDialog.definitions ? trainDialog.definitions.entities : []
        let actions: CLM.ActionBase[] = trainDialog.definitions ? trainDialog.definitions.actions : []
        let entityList: CLM.EntityList = { entities }
        let prevMemories: CLM.Memory[] = []

        if (!trainDialog?.rounds) {
            return null
        }

        await this.InitReplayMemory(state, trainDialog, entities)

        let excludedEntities = entities.filter(e => e.doNotMemorize).map(e => e.entityId)
        let activities: Partial<BB.Activity>[] = []
        let replayError: CLM.ReplayError | null = null
        let replayErrors: CLM.ReplayError[] = []
        let curAction: CLM.ActionBase | null = null
        const userAccount: BB.ChannelAccount = { id: userId, name: userName, role: BB.RoleTypes.User, aadObjectId: '' }
        const botAccount: BB.ChannelAccount = { id: `BOT-${userId}`, name: CLM.CL_USER_NAME_ID, role: BB.RoleTypes.Bot, aadObjectId: '' }


        for (let [roundIndex, round] of trainDialog.rounds.entries()) {

            // Use entities from first scorer step
            const filledEntities = round.scorerSteps[0]?.input?.filledEntities ?? []

            // Validate scorer step
            replayError = this.GetTrainDialogRoundErrors(round, roundIndex, curAction, trainDialog, entities, filledEntities, replayErrors)

            // Generate activity.  Add markdown to highlight labelled entities
            let userText = useMarkdown
                ? CLM.ModelUtils.textVariationToMarkdown(round.extractorStep.textVariations[0], excludedEntities)
                : round.extractorStep.textVariations[0].text

            let userActivity: Partial<BB.Activity> = Utils.InputToActivity(userText, roundIndex)

            let clUserData: CLM.CLChannelData = {
                senderType: CLM.SenderType.User,
                roundIndex: roundIndex,
                scoreIndex: null,
                replayError,
                activityIndex: activities.length,
            }

            userActivity.channelData.clData = clUserData
            userActivity.from = userAccount
            userActivity.recipient = botAccount
            userActivity.textFormat = 'markdown'

            activities.push(userActivity)

            // Save memory before this step (used to show changes in UI)
            prevMemories = await state.EntityState.DumpMemory()

            let textVariation = round.extractorStep.textVariations[0]
            let predictedEntities = CLM.ModelUtils.ToPredictedEntities(textVariation.labelEntities)

            // Use scorer step to populate pre-built data (when)
            if (round.scorerSteps.length > 0) {
                this.PopulatePrebuilts(predictedEntities, round.scorerSteps[0].input.filledEntities)
            }

            for (let [scoreIndex, scorerStep] of round.scorerSteps.entries()) {

                let labelAction = scorerStep.labelAction

                // Scorer rounds w/o labelActions may exist to store extraction result for rendering
                if (labelAction) {

                    let botResponse: IActionResult | null = null
                    let validWaitAction
                    // If scorer step a stub action from an import?
                    if (scorerStep.importText) {
                        curAction = null
                        botResponse = {
                            logicResult: undefined,
                            response: scorerStep.importText
                        }
                        replayError = new CLM.ReplayErrorActionStub(userText)
                        replayErrors.push(replayError)
                    }
                    else {
                        let scoreFilledEntities = scorerStep.input.filledEntities

                        replayError = null

                        curAction = actions.find(a => a.actionId == labelAction) ?? null

                        // Validate Score Step
                        replayError = this.GetTrainDialogScoreErrors(round, scoreIndex, scoreFilledEntities, curAction, actions, entities, userText, replayErrors)

                        // Check for exceptions on API call (specifically EntityDetectionCallback)
                        const logicAPIError = Utils.GetLogicAPIError(scorerStep.logicResult)
                        if (logicAPIError) {
                            replayError = new CLM.ReplayErrorAPIException()
                            replayErrors.push(replayError)

                            let actionName = ""
                            if (curAction && curAction.actionType === CLM.ActionTypes.API_LOCAL) {
                                const apiAction = new CLM.ApiAction(curAction)
                                actionName = `${apiAction.name}`
                            }
                            const title = `${CLStrings.EXCEPTION_API_CALLBACK}'${actionName}'`
                            const response = this.RenderErrorCard(title, logicAPIError.APIError)

                            botResponse = {
                                logicResult: undefined,
                                response
                            }
                        }
                        else if (!curAction) {
                            botResponse = {
                                logicResult: undefined,
                                response: CLDebug.Error(`Can't find Action Id ${labelAction}`)
                            }
                        }
                        else {

                            // Create map with names and ids
                            const filledEntityMap = this.CreateFilledEntityMap(scoreFilledEntities, entityList)

                            // Fill in missing entities with a warning
                            const missingEntities = this.PopulateMissingFilledEntities(curAction, filledEntityMap, entities, true)

                            // Entity required for Action isn't filled in
                            if (missingEntities.length > 0) {
                                replayError = replayError ?? new CLM.ReplayErrorEntityEmpty(missingEntities)
                                replayErrors.push(replayError)
                            }

                            // Set memory from map with names only (since not calling APIs)
                            const memoryMap = CLM.FilledEntityMap.FromFilledEntities(scoreFilledEntities, entities)
                            await state.EntityState.RestoreFromMapAsync(memoryMap)

                            if (curAction.actionType === CLM.ActionTypes.CARD) {
                                const cardAction = new CLM.CardAction(curAction)
                                botResponse = {
                                    logicResult: undefined,
                                    response: await this.TakeCardAction(cardAction, filledEntityMap)
                                }
                            }
                            else if (CLM.ActionBase.isPlaceholderAPI(curAction)) {
                                const apiAction = new CLM.ApiAction(curAction)

                                // Placeholder api results are stored in the logic result
                                const placedholderFilledEntities = scorerStep.logicResult ? scorerStep.logicResult.changedFilledEntities : []
                                botResponse = await this.TakeAPIPlaceholderAction(apiAction, placedholderFilledEntities, state, entities)
                                replayError = replayError ?? new CLM.ReplayErrorAPIPlaceholder()
                                replayErrors.push(replayError)
                            }
                            else if (curAction.actionType === CLM.ActionTypes.API_LOCAL) {
                                const apiAction = new CLM.ApiAction(curAction)
                                const actionInput: IActionInput = {
                                    type: ActionInputType.RENDER_ONLY,
                                    logicResult: scorerStep.logicResult
                                }

                                botResponse = await this.TakeAPIAction(apiAction, filledEntityMap, state, entityList.entities, true, actionInput)

                                if (!this.callbacks[apiAction.name]) {
                                    replayError = new CLM.ReplayErrorAPIUndefined(apiAction.name)
                                    replayErrors.push(replayError)
                                }
                                else if (botResponse.replayError) {
                                    replayError = botResponse.replayError
                                    replayErrors.push(botResponse.replayError)
                                }
                            } else if (curAction.actionType === CLM.ActionTypes.TEXT) {
                                const textAction = new CLM.TextAction(curAction)
                                try {
                                    botResponse = {
                                        logicResult: undefined,
                                        response: await this.TakeTextAction(textAction, filledEntityMap)
                                    }
                                }
                                catch (error) {
                                    // Payload is invalid
                                    replayError = new CLM.ReplayErrorEntityUndefined("")
                                    replayErrors.push(replayError)
                                    botResponse = {
                                        logicResult: undefined,
                                        response: JSON.parse(textAction.payload).text // Show raw text
                                    }
                                }
                            } else if (curAction.actionType === CLM.ActionTypes.END_SESSION) {
                                const sessionAction = new CLM.SessionAction(curAction)
                                botResponse = {
                                    logicResult: undefined,
                                    response: await this.TakeSessionAction(sessionAction, filledEntityMap, true, state, null, null)
                                }
                            } else if (curAction.actionType === CLM.ActionTypes.SET_ENTITY) {
                                const setEntityAction = new CLM.SetEntityAction(curAction)
                                botResponse = await this.TakeSetEntityAction(setEntityAction, filledEntityMap, state, entityList.entities, true)
                            } else if (curAction.actionType === CLM.ActionTypes.DISPATCH) {
                                const dispatchAction = new CLM.DispatchAction(curAction)
                                botResponse = await this.TakeDispatchAction(dispatchAction, true)
                            } else if (curAction.actionType === CLM.ActionTypes.CHANGE_MODEL) {
                                const changeModelAction = new CLM.ChangeModelAction(curAction)
                                botResponse = await this.TakeChangeModelAction(changeModelAction, true, state, null, null)
                            }
                            else {
                                throw new Error(`Cannot construct bot response for unknown action type: ${curAction.actionType}`)
                            }
                        }

                        if (curAction && !curAction.isTerminal) {
                            if (round.scorerSteps.length === scoreIndex + 1) {
                                validWaitAction = false
                            }
                            else {
                                validWaitAction = true
                            }
                        }
                    }

                    const clBotData: CLM.CLChannelData = {
                        senderType: CLM.SenderType.Bot,
                        roundIndex: roundIndex,
                        scoreIndex,
                        validWaitAction: validWaitAction,
                        replayError,
                        activityIndex: activities.length,
                        actionId: curAction ? curAction.actionId : undefined
                    }

                    let botActivity: Partial<BB.Activity> | null = null
                    if (botResponse && typeof botResponse.response == 'string') {
                        botActivity = {
                            id: CLM.ModelUtils.generateGUID(),
                            from: botAccount,
                            recipient: userAccount,
                            type: 'message',
                            text: botResponse.response,
                            channelData: { clData: clBotData }
                        }
                    } else if (botResponse) {
                        botActivity = botResponse.response as BB.Activity
                        botActivity.id = CLM.ModelUtils.generateGUID()
                        botActivity.from = botAccount
                        botActivity.recipient = userAccount
                        botActivity.channelData = { clData: clBotData }
                    }

                    if (botActivity) {
                        activities.push(botActivity)
                    }
                }
            }
        }

        let memories = await state.EntityState.DumpMemory()

        let hasRounds = trainDialog.rounds.length > 0
        let hasScorerRound = (hasRounds && trainDialog.rounds[trainDialog.rounds.length - 1].scorerSteps.length > 0)
        let dialogMode = CLM.DialogMode.Scorer

        // If I have no rounds, I'm waiting for input
        if (!hasRounds) {
            dialogMode = CLM.DialogMode.Wait
        }
        else if (curAction) {
            // If last action is session end
            if (curAction.actionType === CLM.ActionTypes.END_SESSION) {
                dialogMode = CLM.DialogMode.EndSession
            }
            // If I have a scorer round, wait
            else if (curAction.isTerminal && hasScorerRound) {
                dialogMode = CLM.DialogMode.Wait
            }
        }

        // Calculate last extract response from text variations
        let uiScoreInput: CLM.UIScoreInput | undefined

        if (hasRounds) {
            // Note: Could potentially just send back extractorStep and calculate extractResponse on other end
            let textVariations = trainDialog.rounds[trainDialog.rounds.length - 1].extractorStep.textVariations
            let extractResponses = CLM.ModelUtils.ToExtractResponses(textVariations)
            let trainExtractorStep = trainDialog.rounds[trainDialog.rounds.length - 1].extractorStep

            uiScoreInput = {
                trainExtractorStep: trainExtractorStep,
                extractResponse: extractResponses[0]
            } as CLM.UIScoreInput
        }

        // Make errors unique using Set operator
        replayErrors = [...new Set(replayErrors)]

        let teachWithActivities: CLM.TeachWithActivities = {
            teach: undefined,
            scoreInput: undefined,
            scoreResponse: undefined,
            uiScoreInput: uiScoreInput,
            extractResponse: undefined,
            lastAction: curAction,
            activities: activities,
            memories: memories,
            prevMemories: prevMemories,
            dialogMode: dialogMode,
            replayErrors: replayErrors
        }

        return teachWithActivities
    }

    private async SaveLogicResult(clRecognizeResult: CLRecognizerResult, actionResult: IActionResult, actionId: string, conversationReference: Partial<BB.ConversationReference>): Promise<void> {
        const app = await clRecognizeResult.state.BotState.GetApp()
        if (!app) {
            throw new Error(`Attempted to get current app before app was set.`)
        }
        if (app.metadata.isLoggingOn !== false && actionResult && actionResult.logicResult !== undefined) {
            if (!conversationReference.conversation) {
                throw new Error(`Attempted to get session by conversation id, but user was not defined on current conversation`)
            }

            const sessionId = await clRecognizeResult.state.BotState.GetSessionIdAndSetConversationId(conversationReference)
            if (!sessionId) {
                throw new Error(`Attempted to get session by conversation id: ${conversationReference.conversation.id} but session was not found`)
            }
            await this.clClient.SessionLogicResult(app.appId, sessionId, actionId, actionResult)
        }
    }

    private renderPlaceholderCard(title: string, text: string): Partial<BB.Activity> {
        const card = {
            type: "AdaptiveCard",
            version: "1.0",
            body: [
                {
                    type: "Container",
                    items: [
                        {
                            type: "TextBlock",
                            text,
                            wrap: true
                        }
                    ]
                }
            ]
        }

        const attachment = BB.CardFactory.adaptiveCard(card)
        const message = BB.MessageFactory.attachment(attachment)
        message.text = title

        return message
    }

    private RenderSetEntityCard(name: string, value: string): Partial<BB.Activity> {
        return this.renderPlaceholderCard("Set Entity:", `memory.Set(${name}, ${value})`)
    }

    private RenderDispatchCard(modelName: string): Partial<BB.Activity> {
        return this.renderPlaceholderCard("DISPATCH:", modelName)
    }

    private RenderChangeModelCard(modelName: string): Partial<BB.Activity> {
        return this.renderPlaceholderCard("Change Model:", modelName)
    }

    // Generate a card to show for an API action w/o output
    private RenderAPICard(callback: CLM.Callback, args: string[]): Partial<BB.Activity> {
        return this.renderPlaceholderCard("API Call:", `${callback.name}(${args.join(', ')})`)
    }

    // Generate a card to show for an API action w/o output
    private RenderErrorCard(title: string, error: string): Partial<BB.Activity> {
        CLDebug.Error(title, error)
        return this.renderPlaceholderCard(title, error)
    }
}