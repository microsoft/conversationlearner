/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as express from 'express'
import * as url from 'url'
import * as BB from 'botbuilder'
import * as Utils from '../Utils'
import * as Request from 'request'
import * as XMLDom from 'xmldom'
import * as CLM from '@conversationlearner/models'
import * as crypto from 'crypto'
import * as proxy from 'http-proxy-middleware'
import * as HttpStatus from 'http-status-codes'
import * as constants from '../constants'
import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import getAppDefinitionChange from '../upgrade'
import { CLDebug } from '../CLDebug'
import { CLClient, ICLClientOptions } from '../CLClient'
import { CLRunner, SessionStartFlags, convertInternalCallbackToCallback } from '../CLRunner'
import { CLStateFactory } from '../Memory/CLStateFactory'
import { CLRecognizerResult } from '../CLRecognizeResult'
import { TemplateProvider } from '../TemplateProvider'
import { CLStrings } from '../CLStrings'
import { UIMode } from '../Memory/BotState'
import { ILogStorage } from '../Memory/ILogStorage'

// Extract error text from HTML error
export const HTML2Error = (htmlText: string): string => {
    try {
        // Parse html
        let parser = new XMLDom.DOMParser()
        let document = parser.parseFromString(htmlText)
        let errorTitle = document.getElementById('stackpage')
        if (errorTitle?.textContent) {
            return errorTitle.textContent.slice(0, 1500)
        }
        return htmlText
    } catch (err) {
        return htmlText
    }
}

// Parse error to return appropriate error message
export const HandleError = (response: express.Response, err: any): void => {
    // Generate error message
    let error = ''
    if (typeof err == 'string') {
        error = err
    }
    if (typeof err?.message == 'string') {
        error += `${err.message}\n`
    }
    if (typeof err?.stack == 'string') {
        error += `${err.stack}\n`
    }
    if (typeof err?.body == 'string') {
        // Handle HTML error
        if ((err.body as string).includes('!DOCTYPE html')) {
            error += HTML2Error(err.body)
        } else {
            error += `${err.body}\n`
        }
    }
    if (typeof err?.statusMessage == 'string') {
        error += `${err.statusMessage}\n`
    }
    if (err.body?.errorMessages && err.body.errorMessages.length > 0) {
        error += err.body.errorMessages.map((em: any) => JSON.stringify(em)).join()
    }
    let statusCode = err.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR

    response.status(statusCode)
    response.send(error)

    let log = `${error}\n${err.request ? 'BODY:' + err.request.body : null}`
    let showInChat = ShouldShowChatMessage(err)
    CLDebug.Error(log, "", showInChat)
}

// Certain errors we don't want to display in the chat window
const ShouldShowChatMessage = (error: any): boolean => {
    if (error.message === CLM.ErrorCode.INVALID_BOT_CHECKSUM) {
        return false
    }
    return true
}

const statusEndpoint = "https://blisstorage.blob.core.windows.net/status/status.json"
const versionEndpoint = "https://blisstorage.blob.core.windows.net/version/version.json"

const getBanner = (source: string): Promise<CLM.Banner | null> => {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            uri: source,
            json: true
        }

        // Never fail this request
        Request(options, (error, response, banner) => {
            if (error) {
                CLDebug.Error(error, `Unable to retrieve Banner message`)
                resolve(null)
            } else if (response.statusCode && response.statusCode >= 300) {
                CLDebug.Error(`Unable to retrieve Banner message.  Status Code: ${response.statusCode}`)
                resolve(null)
            } else {
                try {
                    if (banner.message === "") {
                        banner = null
                    }
                    resolve(banner)
                }
                catch (err) {
                    CLDebug.Error("Malformed Banner message")
                    resolve(null)
                }
            }
        })
    })
}

/**
 * Create Express.Router using given options (LUIS_AUTHORING_KEY, etc)
 * 
 * Requests that need to manipulate the Bot such as operations from UI on train dialogs must be intercepted, deconstructed, then forwarded using the ClClient
 * Requests that do NOT need to manipulate the Bot can flow through uninterrupted and go through HttpProxy middleware.
 * 
 * @param options Options for Conversation Learner client
 */
export const getRouter = (
    client: CLClient,
    stateFactory: CLStateFactory,
    options: ICLClientOptions,
    logStorage: ILogStorage | undefined,
): express.Router => {
    const router = express.Router({ caseSensitive: false })
    router.use(cors())
    router.use(bodyParser.json({
        limit: '10mb'
    }))

    router.get('/', (req, res, next) => {
        res.status(HttpStatus.OK).send({
            message: `Conversation Learner SDK: ${new Date().toJSON()}`
        })
    })

    //========================================================
    // State
    //=======================================================
    /** Sets the current active application */
    router.put('/state/app', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const app: CLM.AppBase = req.body

            const state = stateFactory.get(key)
            await state.SetAppAsync(app)
            res.sendStatus(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Sets the current conversationId so bot can send initial pro-active message */
    router.put('/state/conversationId', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { conversationId, userName } = getQuery(req)
            const state = stateFactory.get(key)
            await state.BotState.CreateConversationReference(userName, key, conversationId)
            res.sendStatus(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Bot
    //========================================================
    /** Retrieves information about the running bot */
    router.get('/bot', async (req, res, next) => {
        try {
            const { browserId, appId } = getQuery(req)
            const clRunner = CLRunner.GetRunnerForUI(appId)
            const validationError = clRunner.clClient.ValidationError()

            // TODO: This is code smell, this is using internal knowledge that BrowserState full key is static and will be the same regardless of key
            // It makes BrowserState accessed in consistent way other states. Would be more natural as static object but need to share underlying storage.
            const state = stateFactory.get('')
            // Generate id
            const browserSlotId = await state.BrowserSlotState.get(browserId)
            const key = options.LUIS_AUTHORING_KEY
            const hashedKey = key ? crypto.createHash('sha256').update(key).digest('hex') : ""
            const id = `${browserSlotId}-${hashedKey}`

            // Retrieve any status message
            let banner = await getBanner(statusEndpoint)

            // If no status message, check if version update message is needed
            if (!banner) {
                // Display version banner if SDK is obsolete
                let versionBanner = await getBanner(versionEndpoint)
                if (versionBanner?.sdkversion) {
                    const isOld = await Utils.isSDKOld(versionBanner.sdkversion)
                    if (isOld) {
                        banner = versionBanner
                    }
                }
            }

            const callbacks = Object.values(clRunner.callbacks).map(convertInternalCallbackToCallback)
            const templates = TemplateProvider.GetTemplates()

            const botInfo: CLM.BotInfo = {
                user: {
                    // We keep track that the editing UI is running by putting this as the name of the user
                    // Can't check localhost as can be running localhost and not UI
                    name: Utils.CL_DEVELOPER,
                    id: id
                },
                callbacks,
                templates,
                checksum: clRunner.botChecksum(),
                validationError: validationError,
                banner: banner
            }
            res.send(botInfo)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // App
    //========================================================
    /** Create a new application */
    router.post('/app', async (req, res, next) => {
        try {
            const query = url.parse(req.url).query ?? ''
            const key = getMemoryKey(req)
            const newApp: CLM.AppBase = req.body
            const appId = await client.AddApp(newApp, query)
            const app = await client.GetApp(appId)
            res.send(app)

            // Initialize memory
            stateFactory.get(key).SetAppAsync(app)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Archives an existing application */
    router.delete('/app/:appId', async (req, res, next) => {
        const { appId } = req.params

        try {
            const key = getMemoryKey(req)
            await client.ArchiveApp(appId)

            // Did I delete my loaded app, if so clear my state
            const state = stateFactory.get(key)
            const app = await state.BotState.GetApp()
            if (app?.appId === appId) {
                await state.SetAppAsync(null)

                const clRunner = CLRunner.GetRunnerForUI(appId)
                await clRunner.EndSessionAsync(state, CLM.SessionEndState.OPEN)
            }
            res.sendStatus(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Retrieves a list of (active) applications */
    router.get('/apps', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const query = url.parse(req.url).query ?? ''
            const apps = await client.GetApps(query)

            // Get lookup table for which apps packages are being edited
            const state = stateFactory.get(key)
            const activeApps = await state.BotState.GetEditingPackages()

            const uiAppList = { appList: apps, activeApps: activeApps } as CLM.UIAppList
            res.send(uiAppList)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Copy applications between accounts */
    router.post('/apps/copy', async (req, res, next) => {
        const { srcUserId, destUserId, appId } = getQuery(req)
        const clRunner = CLRunner.GetRunnerForUI(appId)
        const luisSubscriptionKey = clRunner.clClient.LuisAuthoringKey()

        if (luisSubscriptionKey == undefined) {
            throw new Error(`LUIS_AUTHORING_KEY undefined`)
        }

        try {
            const appIds = await client.CopyApps(srcUserId, destUserId, appId, luisSubscriptionKey)
            res.send(appIds)
        } catch (error) {
            HandleError(res, error)
        }
    })

    router.get('/app/:appId/source', async (req, res, next) => {
        const { appId } = req.params
        const { packageId } = getQuery(req)
        try {
            const clRunner = CLRunner.GetRunnerForUI(appId)
            const appDetails = await client.GetApp(appId)
            const appDefinition = await client.GetAppSource(appId, packageId)

            let appDefinitionChange = getAppDefinitionChange(appDefinition, clRunner.callbacks)
            if (appDefinitionChange.isChanged) {
                console.warn(`⚠ Local package upgraded to enable viewing.`)
                if (packageId === appDetails.devPackageId) {
                    console.log(`⚪ Requested package id is the same the latest package id. This package is a candidate for saving.`)
                    if (packageId !== appDetails.livePackageId) {
                        console.log(`⚪ Request package id is not the live package id. Qualifies for auto upgrade.`)
                        await client.PostAppSource(appId, appDefinitionChange.updatedAppDefinition)
                        console.log(`✔ Saved updated package successfully!`)

                        // Save the updated source and return with no change.
                        // TODO: Allow user to see that application was auto updated?
                        // The current solution hides the fact that package was updated as there isn't any useful intervention the user can do
                        // other than acknowledge and continue, but perhaps they would wish to know.
                        appDefinitionChange = {
                            isChanged: false,
                            currentAppDefinition: appDefinitionChange.updatedAppDefinition
                        }
                    }
                    else {
                        console.log(`⚠ Requested package id is also the live package id. Cannot safely auto upgrade. User must confirm in UI to save.`)
                    }
                }
            }

            res.send(appDefinitionChange)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Creates a new package tag for an app */
    router.put('/app/:appId/publish', async (req, res, next) => {
        const { appId } = req.params

        try {
            const { version: tagName, makeLive } = getQuery(req)
            const setLive = makeLive === "true"

            // Create tag, then load updated app
            const packageReference = await client.PublishApp(appId, tagName)

            // Make live app if requested
            if (setLive) {
                await client.PublishProdPackage(appId, packageReference.packageId)
            }
            const app = await client.GetApp(appId)

            res.send(app)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Sets which app package is being edited */
    router.post('/app/:appId/edit/:packageId', async (req, res, next) => {
        const { appId, packageId } = req.params

        try {
            const key = getMemoryKey(req)
            const app = await client.GetApp(appId)
            if (packageId != app.devPackageId) {
                if (!app.packageVersions || !app.packageVersions.find(pv => pv.packageId == packageId)) {
                    throw new Error(`Attempted to edit package that doesn't exist: ${packageId}`)
                }
            }

            const state = stateFactory.get(key)
            const updatedPackageVersions = await state.BotState.SetEditingPackage(appId, packageId)
            res.send(updatedPackageVersions)

        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Action
    //========================================================
    /** Returns list of trainingDialogIds that are invalidated by the given changed action */
    router.post('/app/:appId/action/:actionId/editValidation', async (req, res, next) => {
        const { appId, actionId } = req.params

        try {
            const action: CLM.ActionBase = req.body
            const { packageId } = getQuery(req)
            if (!packageId) {
                res.status(HttpStatus.BAD_REQUEST)
                res.send({ error: 'packageId query parameter must be provided' })
                return
            }

            if (actionId !== action.actionId) {
                res.status(HttpStatus.BAD_REQUEST)
                res.send(new Error(`ActionId in body: ${action.actionId} does not match id from URI: ${actionId}`))
                return
            }

            const appDefinition = await client.GetAppSource(appId, packageId)

            // Replace the action with new one
            appDefinition.actions = Utils.replace(appDefinition.actions, action, a => a.actionId)

            const clRunner = CLRunner.GetRunnerForUI(appId)
            const invalidTrainDialogIds = clRunner.validateTrainDialogs(appDefinition)

            res.send(invalidTrainDialogIds)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Returns list of trainDialogs invalidated by deleting the given action */
    router.get('/app/:appId/action/:actionId/deleteValidation', async (req, res, next) => {
        const { appId, actionId } = req.params

        try {
            const { packageId } = getQuery(req)
            const appDefinition = await client.GetAppSource(appId, packageId)

            // Remove the action
            appDefinition.actions = appDefinition.actions.filter(a => a.actionId != actionId)

            const clRunner = CLRunner.GetRunnerForUI(appId)
            const invalidTrainDialogIds = clRunner.validateTrainDialogs(appDefinition)
            res.send(invalidTrainDialogIds)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Entities
    //========================================================
    /** Returns list of trainingDialogIds that are invalidated by the given changed entity */
    router.post('/app/:appId/entity/:entityId/editValidation', async (req, res, next) => {
        const { appId } = req.params

        try {
            const entity: CLM.EntityBase = req.body
            const { packageId } = getQuery(req)
            const appDefinition = await client.GetAppSource(appId, packageId)

            // Replace the entity with new one
            appDefinition.entities = Utils.replace(appDefinition.entities, entity, e => e.entityId)

            const clRunner = CLRunner.GetRunnerForUI(appId)
            const invalidTrainDialogIds = clRunner.validateTrainDialogs(appDefinition)
            res.send(invalidTrainDialogIds)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Returns list of trainDialogs invalidated by deleting the given entity */
    router.get('/app/:appId/entity/:entityId/deleteValidation', async (req, res, next) => {
        const { appId, entityId } = req.params

        try {
            const { packageId } = getQuery(req)
            const appDefinition = await client.GetAppSource(appId, packageId)

            // Remove the entity
            appDefinition.entities = appDefinition.entities.filter(e => e.entityId != entityId)

            const clRunner = CLRunner.GetRunnerForUI(appId)
            const invalidTrainDialogIds = clRunner.validateTrainDialogs(appDefinition)
            res.send(invalidTrainDialogIds)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // LogDialogs
    //========================================================
    /**
     * RUN EXTRACTOR: Runs entity extraction on an existing log dialog for the specified turn
     */
    router.put('/app/:appId/logdialog/:logDialogId/extractor/:turnIndex', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, logDialogId, turnIndex } = req.params
            const userInput: CLM.UserInput = req.body
            const extractResponse = await client.LogDialogExtract(appId, logDialogId, turnIndex, userInput)
            const state = stateFactory.get(key)

            const memories = await state.EntityState.DumpMemory()
            const uiExtractResponse: CLM.UIExtractResponse = { extractResponse, memories }
            res.send(uiExtractResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    router.get('/app/:appId/logdialog/:logDialogId', async (req, res, next) => {
        const { appId, logDialogId } = req.params

        try {
            let logDialog
            if (logStorage) {
                logDialog = await logStorage.Get(appId, logDialogId)
            }
            else {
                logDialog = await client.GetLogDialog(appId, logDialogId)
            }
            res.send(logDialog)
        } catch (error) {
            HandleError(res, error)
        }
    })

    // Get log dialogs
    router.get('/app/:appId/logdialogs', async (req, res, next) => {
        const { appId } = req.params

        try {
            let { package: packageIds, continuationToken, maxPageSize } = getQuery(req)
            if (typeof packageIds === "string") {
                packageIds = [packageIds]
            }

            let logQueryResult: CLM.LogQueryResult
            if (logStorage) {
                logQueryResult = await logStorage.GetMany(appId, packageIds, continuationToken, maxPageSize)
            }
            else {
                logQueryResult = await client.GetLogDialogs(appId, packageIds, continuationToken, maxPageSize)
            }

            res.send(logQueryResult)
        } catch (error) {
            HandleError(res, error)
        }
    })

    // Delete one log dialog
    router.delete('/app/:appId/logdialog/:logDialogId', async (req, res, next) => {
        const { appId, logDialogId } = req.params

        try {
            if (logStorage) {
                await logStorage.Delete(appId, logDialogId)
            }
            else {
                await client.DeleteLogDialog(appId, logDialogId)
            }
            res.send(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    // Delete a list of log dialogs
    router.delete('/app/:appId/logdialog', async (req, res, next) => {
        const { appId } = req.params
        let { id: logDialogIds } = getQuery(req)
        if (typeof logDialogIds === "string") {
            logDialogIds = [logDialogIds]
        }
        try {
            if (logStorage) {
                logStorage.DeleteMany(appId, logDialogIds)
            }
            else {
                await client.DeleteLogDialogs(appId, logDialogIds)
            }
            res.send(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // TrainDialogs
    //========================================================
    /**
     * RUN EXTRACTOR: Runs entity extraction on a train dialog
     */
    router.put('/app/:appId/traindialog/:trainDialogId/extractor/:turnIndex', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, trainDialogId, turnIndex } = req.params
            const userInput: CLM.UserInput = req.body
            const extractResponse = await client.TrainDialogExtract(appId, trainDialogId, turnIndex, userInput)

            const state = stateFactory.get(key)
            const memories = await state.EntityState.DumpMemory()
            const uiExtractResponse: CLM.UIExtractResponse = { extractResponse, memories }
            res.send(uiExtractResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Create a new teach session based on the current train dialog starting at round turnIndex */
    router.post('/app/:appId/traindialog/:trainDialogId/branch/:turnIndex', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { username: userName, userid: userId } = getQuery(req)
            const { appId, trainDialogId, turnIndex } = req.params
            const trainDialog = await client.GetTrainDialog(appId, trainDialogId, true)

            // Slice to length requested by user
            trainDialog.rounds = trainDialog.rounds.slice(0, turnIndex)

            // Get activities and replay to put bot into last round
            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)
            const teachWithActivities = await clRunner.GetActivities(trainDialog, userName, userId, state)
            if (!teachWithActivities) {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                res.send(new Error(`Could not find teach session activities for given train dialog`))
                return
            }

            // Start new teach session from the old train dialog
            const createTeachParams = CLM.ModelUtils.ToCreateTeachParams(trainDialog)
            teachWithActivities.teach = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEACH | SessionStartFlags.IS_EDIT_CONTINUE, createTeachParams) as CLM.Teach

            res.send(teachWithActivities)
        } catch (error) {
            HandleError(res, error)
        }
    })

    // Passthrough routes
    // GET /app/:appId/traindialog/:trainDialogId

    //========================================================
    // Session
    //========================================================

    /** START SESSION : Creates a new session and a corresponding logDialog */
    router.post('/app/:appId/session', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId } = req.params
            const sessionCreateParams: CLM.SessionCreateParams = req.body

            const clRunner = CLRunner.GetRunnerForUI(appId)
            validateBot(req, clRunner.botChecksum())

            const state = stateFactory.get(key)

            // Clear memory when running Log from UI
            state.EntityState.ClearAsync()

            const session = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.NONE, sessionCreateParams) as CLM.Session

            res.send(session)

        } catch (error) {
            HandleError(res, error)
        }
    })

    /** EXPIRE SESSION : Expires the current session (timeout) */
    router.put('/app/:appId/session', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const state = stateFactory.get(key)
            const conversationId = await state.BotState.GetConversationId()
            // If conversation is empty
            if (!conversationId) {
                return
            }

            // Look up what the current sessionId
            const currentSessionId = await state.BotState.GetSessionIdAsync()

            // May have already been closed
            if (!currentSessionId) {
                res.sendStatus(200)
                return
            }

            // Force session to expire
            await state.BotState.SetLastActive(0)
            res.sendStatus(200)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** END SESSION : End current session. */
    router.delete('/app/:appId/session', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId } = req.params

            // Session may be a replacement for an expired one
            const state = stateFactory.get(key)

            const sessionId = await state.BotState.GetSessionIdAsync()
            // May have already been closed
            if (!sessionId) {
                res.sendStatus(200)
                return
            }

            await Utils.EndSessionIfOpen(client, appId, sessionId)
            res.sendStatus(200)

            const clRunner = CLRunner.GetRunnerForUI(appId)
            clRunner.EndSessionAsync(state, CLM.SessionEndState.OPEN)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Teach
    //========================================================

    /** START TEACH SESSION: Creates a new teaching session and a corresponding trainDialog */
    router.post('/app/:appId/teach', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId } = req.params
            const initialFilledEntities = req.body as CLM.FilledEntity[] ?? []

            const clRunner = CLRunner.GetRunnerForUI(appId)

            validateBot(req, clRunner.botChecksum())

            const state = stateFactory.get(key)

            const createTeachParams: CLM.CreateTeachParams = {
                contextDialog: [],
                initialFilledEntities
            }

            // TeachSession always starts with a clear the memory (no saved entities)
            await state.EntityState.ClearAsync()

            const teachResponse = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEACH, createTeachParams) as CLM.TeachResponse

            res.send(teachResponse)

        } catch (error) {
            HandleError(res, error)
        }
    })

    /** Clear the bot's memory */
    router.delete('/app/:appId/botmemory', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            // Update Memory
            const state = stateFactory.get(key)
            await state.EntityState.ClearAsync()
            res.sendStatus(200)

        } catch (error) {
            HandleError(res, error)
        }
    })

    /** START TEACH SESSION: Creates a new teaching session from existing train dialog */
    router.post('/app/:appId/teachwithactivities', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const appId = req.params.appId
            const {
                username: userName,
                userid: userId,
                filteredDialog } = getQuery(req)


            const trainDialog: CLM.TrainDialog = req.body.trainDialog
            const userInput: CLM.UserInput = req.body.userInput

            // Get activities and replay to put bot into last round
            const state = stateFactory.get(key)

            const clRunner = CLRunner.GetRunnerForUI(appId)

            validateBot(req, clRunner.botChecksum())

            // Replay the TrainDialog logic (API calls and EntityDetectionCallback)
            let cleanTrainDialog = await clRunner.ReplayTrainDialogLogic(trainDialog, state, true)

            const teachWithActivities = await clRunner.GetActivities(cleanTrainDialog, userName, userId, state)
            if (!teachWithActivities) {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                res.send(new Error(`Could not find teach session activities for given train dialog`))
                return
            }

            // Start new teach session from the old train dialog
            const createTeachParams = CLM.ModelUtils.ToCreateTeachParams(cleanTrainDialog)

            // NOTE: Todo - pass in filteredDialogId so start sesssion doesn't find conflicts with existing dialog being edited
            teachWithActivities.teach = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEACH | SessionStartFlags.IS_EDIT_CONTINUE, createTeachParams) as CLM.Teach

            // If last action wasn't terminal then score
            if (teachWithActivities.dialogMode === CLM.DialogMode.Scorer) {

                // Get entities from my memory
                const filledEntities = await state.EntityState.FilledEntitiesAsync()
                const scoreInput: CLM.ScoreInput = {
                    filledEntities,
                    context: {},
                    maskedActions: []
                }
                teachWithActivities.scoreInput = scoreInput
                teachWithActivities.scoreResponse = await client.TeachScore(
                    appId,
                    teachWithActivities.teach.teachId,
                    teachWithActivities.scoreInput
                )
            }
            else if (userInput) {
                // Add new input to activities
                const userAccount: BB.ChannelAccount = { id: userId, name: userName, role: BB.RoleTypes.User, aadObjectId: '' }
                const botAccount: BB.ChannelAccount = { id: `BOT-${userId}`, name: CLM.CL_USER_NAME_ID, role: BB.RoleTypes.Bot, aadObjectId: '' }
                let userActivity = Utils.InputToActivity(userInput.text, trainDialog.rounds.length)
                userActivity.from = userAccount
                userActivity.recipient = botAccount

                teachWithActivities.activities.push(userActivity)

                // Extract responses
                teachWithActivities.extractResponse = await client.TeachExtract(appId, teachWithActivities.teach.teachId, userInput, filteredDialog)
                teachWithActivities.dialogMode = CLM.DialogMode.Extractor
            }
            res.send(teachWithActivities)
        } catch (error) {
            if (error.statusCode === HttpStatus.CONFLICT) {
                res.status(error.statusCode)
                res.send(error.body)
                return
            }

            HandleError(res, error)
        }
    })

    /** Given a train dialog return a score for the last round */
    router.post('/app/:appId/scorefromtraindialog', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const appId = req.params.appId
            const trainDialog: CLM.TrainDialog = req.body
            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)

            // Replay the TrainDialog logic (API calls and EntityDetectionCallback)
            // and set storage entities for the train dialog
            let newTrainDialog = await clRunner.ReplayTrainDialogLogic(trainDialog, state, true)

            // Start new teach session from the old train dialog
            const createTeachParams = CLM.ModelUtils.ToCreateTeachParams(newTrainDialog)
            const teach = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEACH | SessionStartFlags.IS_EDIT_CONTINUE, createTeachParams) as CLM.Teach

            // Get entities from my memory
            const filledEntities = await state.EntityState.FilledEntitiesAsync()
            const scoreInput: CLM.ScoreInput = {
                filledEntities,
                context: {},
                maskedActions: []
            }

            const scoreResponse = await client.TeachScore(
                appId,
                teach.teachId,
                scoreInput
            )

            // Delete the teach session w/o save
            await client.EndTeach(appId, teach.teachId, false)

            const uiScoreResponse = {
                scoreResponse,
                scoreInput
            }
            res.send(uiScoreResponse)
        } catch (error) {
            if (error.statusCode === HttpStatus.CONFLICT) {
                res.status(error.statusCode)
                res.send(error.body)
                return
            }

            HandleError(res, error)
        }
    })

    /** Given a train dialog return extraction for the last round */
    router.post('/app/:appId/extractfromtraindialog', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const appId = req.params.appId
            const trainDialog: CLM.TrainDialog = req.body.trainDialog
            const userInput: CLM.UserInput = req.body.userInput
            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)

            // Replay the TrainDialog logic (API calls and EntityDetectionCallback)
            // and set storage entities for the train dialog
            let newTrainDialog = await clRunner.ReplayTrainDialogLogic(trainDialog, state, true)

            // Start new teach session from the old train dialog
            const createTeachParams = CLM.ModelUtils.ToCreateTeachParams(newTrainDialog)
            const teach = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEACH | SessionStartFlags.IS_EDIT_CONTINUE, createTeachParams) as CLM.Teach

            // Do extraction
            const extractResponse = await client.TeachExtract(appId, teach.teachId, userInput, null)

            // Delete the teach session w/o save
            await client.EndTeach(appId, teach.teachId, false)

            res.send(extractResponse)
        } catch (error) {
            if (error.statusCode === HttpStatus.CONFLICT) {
                res.status(error.statusCode)
                res.send(error.body)
                return
            }

            HandleError(res, error)
        }
    })

    /** Replay a train dialog */
    router.post('/app/:appId/traindialogreplay', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const appId = req.params.appId
            const trainDialog: CLM.TrainDialog = req.body
            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)
            validateBot(req, clRunner.botChecksum())

            // Replay the TrainDialog logic (API calls and EntityDetectionCallback)
            // and set storage entities for the train dialog
            let newTrainDialog = await clRunner.ReplayTrainDialogLogic(trainDialog, state, false)

            res.send(newTrainDialog)

        } catch (error) {
            HandleError(res, error)
        }
    })

    /** RUN EXTRACTOR: Runs entity extraction (prediction).
     * If a more recent version of the package is available on
     * the server, the session will first migrate to that newer version.  This
     * doesn't affect the trainDialog maintained.
     */
    router.put('/app/:appId/teach/:teachId/extractor', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, teachId } = req.params
            // Dialog to ignore when checking for conflicting labels
            const { excludeConflictCheckId } = getQuery(req)
            const userInput: CLM.UserInput = req.body

            // If a form text could be null
            if (!userInput.text) {
                userInput.text = '  '
            }
            const extractResponse = await client.TeachExtract(appId, teachId, userInput, excludeConflictCheckId)

            const state = stateFactory.get(key)
            const memories = await state.EntityState.DumpMemory()
            const uiExtractResponse: CLM.UIExtractResponse = { extractResponse, memories }
            res.send(uiExtractResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** EXTRACT FEEDBACK & RUN SCORER:
     * 1) Uploads a labeled entity extraction instance
     * ie "commits" an entity extraction label, appending it to the teach session's
     * trainDialog, and advancing the dialog. This may yield produce a new package.
     * 2) Takes a turn and return distribution over actions.
     * If a more recent version of the package is
     * available on the server, the session will first migrate to that newer version.
     * This doesn't affect the trainDialog maintained by the teaching session.
     */
    router.put('/app/:appId/teach/:teachId/scorer', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, teachId } = req.params
            const uiScoreInput: CLM.UIScoreInput = req.body
            const state = stateFactory.get(key)

            // There will be no extraction step if performing a 2nd scorer round after a non-terminal action
            if (uiScoreInput.trainExtractorStep) {
                try {
                    // Send teach feedback
                    await client.TeachExtractFeedback(appId, teachId, uiScoreInput.trainExtractorStep)
                }
                catch (error) {
                    if (error.statusCode === HttpStatus.CONFLICT) {
                        const textVariation: CLM.TextVariation = error.body.reason
                        const extractConflict = CLM.ModelUtils.ToExtractResponse(textVariation)
                        const uiConflictResponse: CLM.UIScoreResponse = { extractConflict }
                        res.send(uiConflictResponse)
                        return
                    }
                    else {
                        throw error
                    }
                }
            }

            // Call LUIS callback to get scoreInput
            const extractResponse = uiScoreInput.extractResponse
            const clRunner = CLRunner.GetRunnerForUI(appId)
            validateBot(req, clRunner.botChecksum())

            let scoreInput: CLM.ScoreInput
            let botAPIError: CLM.LogicAPIError | null = null
            try {
                scoreInput = await clRunner.CallEntityDetectionCallback(
                    extractResponse.text,
                    extractResponse.predictedEntities,
                    state,
                    extractResponse.definitions.entities,
                    // If the previous action is a non-terminal action, the trainExtractorStep is null and the entity detection callback should be skipped.
                    uiScoreInput.trainExtractorStep == null
                )
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
                let errMessage = `${CLStrings.ENTITYCALLBACK_EXCEPTION} ${err.message}`
                botAPIError = { APIError: errMessage }
            }

            // Get score response
            const scoreResponse = await client.TeachScore(appId, teachId, scoreInput)
            const memories = await state.EntityState.DumpMemory()
            const uiScoreResponse: CLM.UIScoreResponse = { scoreInput, scoreResponse, memories, botAPIError }
            res.send(uiScoreResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    router.post('/app/:appId/traindialog/:trainDialogId/extractor/textvariation', async (req, res, next) => {
        try {
            const { appId, trainDialogId } = req.params
            const textVariation: CLM.TextVariation = req.body
            // Dialog to ignore when checking for conflicting labels
            const { excludeConflictCheckId } = getQuery(req)

            try {
                // Send teach feedback;
                await client.TrainDialogValidateTextVariation(appId, trainDialogId, textVariation, excludeConflictCheckId)
            }
            catch (error) {
                if (error.statusCode === HttpStatus.CONFLICT) {
                    const variationConflict: CLM.TextVariation = error.body.reason
                    const extractConflict = CLM.ModelUtils.ToExtractResponse(variationConflict)
                    res.send(extractConflict)
                    return
                }
                else {
                    throw error
                }
            }
            res.send(null)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /**
     * Re-run scorer given previous score input
     */
    router.put('/app/:appId/teach/:teachId/rescore', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, teachId } = req.params
            const scoreInput: CLM.ScoreInput = req.body
            const state = stateFactory.get(key)

            // Get new score response re-using scoreInput from previous score request
            const scoreResponse = await client.TeachScore(appId, teachId, scoreInput)
            const memories = await state.EntityState.DumpMemory()
            const uiScoreResponse: CLM.UIScoreResponse = {
                scoreInput,
                scoreResponse,
                memories
            }

            res.send(uiScoreResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /** SCORE FEEDBACK: Uploads a labeled scorer step instance
     * – ie "commits" a scorer label, appending it to the teach session's
     * trainDialog, and advancing the dialog. This may yield produce a new package.
     */
    router.post('/app/:appId/teach/:teachId/scorer', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, teachId } = req.params
            const uiTrainScorerStep: CLM.UITrainScorerStep = req.body

            // Save scored action and remove from service call
            const scoredAction = uiTrainScorerStep.trainScorerStep.scoredAction
            if (!scoredAction) {
                throw new Error(`trainScorerStep.scoredAction must be defined.`)
            }
            delete uiTrainScorerStep.trainScorerStep.scoredAction

            const state = stateFactory.get(key)

            // Now send the trained intent
            const intent = {
                scoredAction: scoredAction,
                clEntities: uiTrainScorerStep.entities,
                state: state,
                inTeach: true
            } as CLRecognizerResult

            const clRunner = CLRunner.GetRunnerForUI(appId)
            const actionResult = await clRunner.SendResult(intent, uiTrainScorerStep)

            // Set logicResult on scorer step
            if (actionResult) {
                uiTrainScorerStep.trainScorerStep.logicResult = actionResult.logicResult
            }

            const teachResponse = await client.TeachScoreFeedback(appId, teachId, uiTrainScorerStep.trainScorerStep)

            const memories = await state.EntityState.DumpMemory()
            const isEndTask = scoredAction.actionType === CLM.ActionTypes.END_SESSION

            // End Session call delayed in SendIntent during teach so ScoreFeedback still has a session
            // so need to end the session now if an EndSession action
            if (isEndTask) {
                let sessionId = await state.BotState.GetSessionIdAsync()
                if (sessionId) {
                    // Get filled entities from memory, and generate content for end session callback
                    let filledEntityMap = await state.EntityState.FilledEntityMap()
                    filledEntityMap = Utils.addEntitiesById(filledEntityMap)
                    const sessionAction = new CLM.SessionAction(scoredAction as any)
                    let content = sessionAction.renderValue(CLM.getEntityDisplayValueMap(filledEntityMap))

                    // End SDK session, but let client delete the Teach Session
                    await clRunner.EndSessionAsync(state, CLM.SessionEndState.COMPLETED, content)
                }
            }

            const uiPostScoreResponse: CLM.UIPostScoreResponse = { teachResponse, memories, isEndTask }
            res.send(uiPostScoreResponse)
        } catch (error) {
            HandleError(res, error)
        }
    })

    /**
     * END TEACH: Ends a teach.
     * For Teach sessions, does NOT delete the associated trainDialog.
     * To delete the associated trainDialog, call DELETE on the trainDialog.
     */
    router.delete('/app/:appId/teach/:teachId', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const { appId, teachId } = req.params
            const { save } = getQuery(req)
            const response = await client.EndTeach(appId, teachId, save)
            res.send(response)

            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)
            clRunner.EndSessionAsync(state, CLM.SessionEndState.OPEN)
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Replay
    //========================================================

    router.post('/app/:appId/activities', async (req, res, next) => {
        try {
            const key = getMemoryKey(req)
            const appId = req.params.appId
            const { username: userName, userid: userId, useMarkdown: useMarkdownString } = getQuery(req)
            const useMarkdown = useMarkdownString === "true"
            const trainDialog: CLM.TrainDialog = req.body

            const state = stateFactory.get(key)
            const clRunner = CLRunner.GetRunnerForUI(appId)
            validateBot(req, clRunner.botChecksum())

            const teachWithActivities = await clRunner.GetActivities(trainDialog, userName, userId, state, useMarkdown)

            // Clear bot memory generated with this
            await state.EntityState.ClearAsync()

            // Note the UI is now in edit mode
            await state.BotState.SetUIMode(UIMode.EDIT)

            if (teachWithActivities) {
                res.send(teachWithActivities)
            }
            else {
                res.sendStatus(204)
            }
        } catch (error) {
            HandleError(res, error)
        }
    })

    //========================================================
    // Transcript Validation
    //========================================================
    /** Replays a transcript and test whether responses match expected values */
    router.post('/app/:appId/validatetranscript', async (req, res, next) => {
        try {
            const { appId } = req.params
            const { packageId, testId } = getQuery(req)
            const turnValidations: CLM.TranscriptValidationTurn[] = req.body
            const clRunner = CLRunner.GetRunnerForUI(appId)
            const app = await client.GetApp(appId)

            // TestId allows us to run multiple validations in parallel
            const state = stateFactory.get(testId)

            // Need to set app as not using default key
            await state.SetAppAsync(app)

            if (!packageId) {
                res.status(HttpStatus.BAD_REQUEST)
                res.send({ error: 'packageId query parameter must be provided' })
                return
            }

            // Start new session
            const sessionCreateParams: CLM.SessionCreateParams = {
                saveToLog: true,
                packageId,
                initialFilledEntities: []
            }
            const session = await clRunner.CreateSessionAsync(state, null, appId, SessionStartFlags.IN_TEST, sessionCreateParams) as CLM.Session
            const logDialogId = session.logDialogId

            const conversation: BB.ConversationAccount = {
                id: CLM.ModelUtils.generateGUID(),
                isGroup: false,
                name: "",
                tenantId: "",
                aadObjectId: "",
                role: BB.RoleTypes.User,
                conversationType: ""
            }
            const from: BB.ChannelAccount = {
                name: Utils.CL_DEVELOPER,
                id: testId,
                role: BB.RoleTypes.User,
                aadObjectId: ''
            }

            for (const turnValidation of turnValidations) {
                const activity = {
                    id: CLM.ModelUtils.generateGUID(),
                    conversation,
                    type: BB.ActivityTypes.Message,
                    text: turnValidation.inputText,
                    from,
                    channelData: { clData: { isValidationTest: true } }
                }

                const turnContext = new BB.TurnContext(clRunner.adapter!, activity)

                try {
                    const result = await clRunner.recognize(turnContext)

                    if (result) {

                        // Get conversation reference
                        const conversationReference = BB.TurnContext.getConversationReference(activity)
                        if (!conversationReference) {
                            throw new Error("Missing Conversation Reference")
                        }

                        // Get session Id
                        const sessionId = await result.state.BotState.GetSessionIdAsync()
                        if (!sessionId) {
                            throw new Error("Can't find sessionId")
                        }

                        // Include apiResults when taking action so result will be the same when testing
                        await clRunner.TakeActionAsync(conversationReference, result, null, turnValidation.apiResults[0])

                        // Trigger next action if non-terminal
                        let bestAction = result.scoredAction
                        let curHashIndex = 0

                        // Server enforces max number of non-terminal actions, so no endless loop here
                        while (!bestAction.isTerminal) {
                            curHashIndex = curHashIndex + 1
                            bestAction = await clRunner.Score(appId, sessionId, result.state, '', [], result.clEntities, false, true)
                            result.scoredAction = bestAction

                            // Include apiResults when taking action so result will be the same when testing
                            await clRunner.TakeActionAsync(conversationReference, result, null, turnValidation.apiResults[curHashIndex])
                        }
                    }
                    else {
                        throw new Error("No recognize result")
                    }
                }
                catch (e) {
                    const error: Error = e
                    CLDebug.Error(error.message)

                    // Delete log dialog
                    if (logStorage) {
                        await logStorage.Delete(appId, logDialogId)
                    }
                    else {
                        await client.DeleteLogDialog(appId, logDialogId)
                    }
                    res.send(null)
                    return
                }
            }
            res.send(logDialogId)
        } catch (error) {
            HandleError(res, error)
        }
    })

    const httpProxy = proxy({
        target: options.CONVERSATION_LEARNER_SERVICE_URI,
        changeOrigin: true,
        logLevel: 'info',
        pathRewrite: {
            '^/sdk': '/'
        },
        onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader(constants.luisAuthoringKeyHeader, options.LUIS_AUTHORING_KEY ?? '')
            proxyReq.setHeader(constants.luisSubscriptionKeyHeader, options.LUIS_SUBSCRIPTION_KEY ?? '')
            proxyReq.setHeader(constants.apimSubscriptionIdHeader, options.LUIS_AUTHORING_KEY ?? '')
            proxyReq.setHeader(constants.apimSubscriptionKeyHeader, options.APIM_SUBSCRIPTION_KEY ?? '')

            /**
             * TODO: Find more elegant solution with middleware ordering.
             * Currently there is conflict of interest.  For the custom routes we define, we want the body parsed
             * so we need bodyParser.json() middleware above it in the pipeline; however, when bodyParser is above/before
             * the http-proxy-middleware then it can't properly stream the body through.
             *
             * This code explicitly re-streams the data by calling .write()
             *
             * Ideally we could find a way to only use bodyParser.json() on our custom routes so it's no in the pipeline above
             * the proxy
             */
            const anyReq: any = req
            if (anyReq.body) {
                let bodyData = JSON.stringify(anyReq.body)
                // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
                proxyReq.setHeader('Content-Type', 'application/json')
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
                // stream the content
                proxyReq.write(bodyData)
            }
        }
    })

    router.use(httpProxy)

    return router
}

function getMemoryKey(req: express.Request): string {
    const key = req.header(CLM.MEMORY_KEY_HEADER_NAME)
    if (!key) {
        throw new Error(`Header ${CLM.MEMORY_KEY_HEADER_NAME} must be provided. Url: ${req.url}`)
    }

    return key
}

function validateBot(req: express.Request, botChecksum: string): void {
    const checksum = req.header(CLM.BOT_CHECKSUM_HEADER_NAME)
    if (!checksum) {
        throw new Error(`Header ${CLM.BOT_CHECKSUM_HEADER_NAME} must be provided. Url: ${req.url}`)
    }
    if (checksum != botChecksum) {
        throw new Error(CLM.ErrorCode.INVALID_BOT_CHECKSUM)
    }
}

function getQuery(req: express.Request): any {
    return url.parse(req.url, true).query ?? {}
}

export default getRouter
