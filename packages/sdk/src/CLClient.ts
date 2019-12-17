/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import { CLDebug } from './CLDebug'
import * as Request from 'request'
import * as constants from './constants'
import { IActionResult } from './CLRunner'
import * as querystring from 'querystring'

type QueryObject = { [key: string]: string | number | boolean | string[] | number[] }
type HTTP_METHOD = 'GET' | 'PUT' | 'POST' | 'DELETE'
const requestMethodMap = new Map<HTTP_METHOD, typeof Request.get | typeof Request.post>([
    ['GET', Request.get],
    ['PUT', Request.put],
    ['POST', Request.post],
    ['DELETE', Request.delete]
])

export interface ICLClientOptions {
    CONVERSATION_LEARNER_SERVICE_URI: string
    // This should only set when directly targeting cognitive services ppe environment.
    APIM_SUBSCRIPTION_KEY: string | undefined
    LUIS_AUTHORING_KEY: string | undefined
    LUIS_SUBSCRIPTION_KEY?: string
}

/**
 * Manages calls to Conversation Learner Service
 */
export class CLClient {
    private options: ICLClientOptions

    constructor(options: ICLClientOptions) {
        this.options = options

        if (options.APIM_SUBSCRIPTION_KEY === undefined) {
            options.APIM_SUBSCRIPTION_KEY = options.LUIS_AUTHORING_KEY
        }
    }

    public ValidationError(): string | null {
        if (typeof this.options.CONVERSATION_LEARNER_SERVICE_URI !== 'string' || this.options.CONVERSATION_LEARNER_SERVICE_URI.length === 0) {
            return `CONVERSATION_LEARNER_SERVICE_URI must be a non-empty string. You passed: ${this.options.CONVERSATION_LEARNER_SERVICE_URI}`
        }

        if (typeof this.options.LUIS_AUTHORING_KEY !== 'string' || this.options.LUIS_AUTHORING_KEY.length === 0) {
            return `LUIS_AUTHORING_KEY must be a non-empty string. You passed: ${this.options.LUIS_AUTHORING_KEY}`
        }
        return null
    }

    public LuisAuthoringKey(): string | undefined {
        return this.options.LUIS_AUTHORING_KEY
    }

    private BuildURL(baseUri: string, apiPath: string, query?: string) {
        let uri = baseUri + (!baseUri.endsWith('/') ? '/' : '') + apiPath
        if (query) {
            if (apiPath.includes('?')) {
                throw new Error(`You attempted to add query parameters to path which already had query parameters. Consolidate all parameters to single objects`)
            }

            uri += `?${query}`
        }
        return uri
    }

    private MakeURL(apiPath: string, query: object | string = '') {
        const queryString = typeof query === 'string'
            ? query
            : querystring.stringify(query as querystring.ParsedUrlQueryInput)
        return this.BuildURL(this.options.CONVERSATION_LEARNER_SERVICE_URI, apiPath, queryString)
    }

    private MakeSessionURL(apiPath: string, query: object | string = '') {
        // check if request is bypassing cognitive services APIM
        if (!this.options.CONVERSATION_LEARNER_SERVICE_URI.includes('api.cognitive.microsoft.com')) {
            // In this case we are not changing the serviceUrl and it stays the same,
            // for example: https://localhost:37936/api/v1/ -> https://localhost:37936/api/v1/
            return this.MakeURL(apiPath, query)
        }

        // The base uri for session API in cognitive services APIM is in the form of '<service url>/conversationlearner/session/v1.0/'
        // Session API are the following api:
        //  1) POST /app/<appId>/session
        //  2) PUT /app/<appId>/session/extract
        //  3) PUT /app/<appId>/session/score
        //  4) DELETE /app/<appId>/session
        let baseUri = this.options.CONVERSATION_LEARNER_SERVICE_URI.endsWith('/') ?
            this.options.CONVERSATION_LEARNER_SERVICE_URI :
            `${this.options.CONVERSATION_LEARNER_SERVICE_URI}/`
        const apimVersionSuffix = '/v1.0/'
        if (baseUri.endsWith(apimVersionSuffix)) {
            // In this case, serviceurl has api version information in it; "session" will be inserted before /v1.0
            // this means that https://westus.api.cognitive.microsoft.com/conversationlearner/v1.0/ becomes
            // https://westus.api.cognitive.microsoft.com/conversationlearner/session/v1.0/
            baseUri = `${baseUri.substring(0, baseUri.lastIndexOf(apimVersionSuffix))}/session${apimVersionSuffix}`
        }
        else {
            // When api version information is not part of the serviceUrl, we simply add /session/ to end of the api
            // example: https://westus.api.cognitive.microsoft.com/conversationlearner/ -> https://westus.api.cognitive.microsoft.com/conversationlearner/session/
            baseUri += 'session/'
        }

        const queryString = typeof query === 'string'
            ? query
            : querystring.stringify(query as querystring.ParsedUrlQueryInput)

        return this.BuildURL(baseUri, apiPath, queryString)
    }

    private send<T>(method: HTTP_METHOD, url: string, body?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            const requestData = {
                url,
                headers: {
                    [constants.luisAuthoringKeyHeader]: this.options.LUIS_AUTHORING_KEY,
                    [constants.luisSubscriptionKeyHeader]: this.options.LUIS_SUBSCRIPTION_KEY,
                    // This is only used when directly targeting service.  In future APIM will provide user/subscription id associated from LUIS key
                    [constants.apimSubscriptionIdHeader]: this.options.LUIS_AUTHORING_KEY,
                    [constants.apimSubscriptionKeyHeader]: this.options.APIM_SUBSCRIPTION_KEY
                },
                json: true,
                body
            }

            CLDebug.LogRequest(method, url, requestData)
            const requestMethod = requestMethodMap.get(method)
            if (!requestMethod) {
                throw new Error(`Request method not found for http verb: ${method}`)
            }

            requestMethod(requestData, (error, response, responseBody) => {
                if (error) {
                    reject(error)
                } else if (response.statusCode && response.statusCode >= 300) {
                    reject(response)
                } else {
                    resolve(responseBody)
                }
            })
        })
    }

    //==============================================================================
    // App
    //=============================================================================
    /**
     * Retrieve information about a specific application
     * If the app ID isn't found in the set of (non-archived) apps,
     * returns 404 error ("not found")
     */
    public GetApp(appId: string): Promise<CLM.AppBase> {
        let apiPath = `app/${appId}`
        return this.send('GET', this.MakeURL(apiPath))
    }

    public GetAppSource(appId: string, packageId: string): Promise<CLM.AppDefinition> {
        let apiPath = `app/${appId}/source`
        const query = { package: packageId }
        return this.send('GET', this.MakeURL(apiPath, query))
    }

    public async PostAppSource(appId: string, appDefinition: CLM.AppDefinition): Promise<void> {
        let apiPath = `app/${appId}/source`
        await this.send('POST', this.MakeURL(apiPath), appDefinition)
    }

    /** Retrieve a list of (active) applications */
    public GetApps(query: string): Promise<CLM.AppList> {
        let apiPath = `apps`
        return this.send('GET', this.MakeURL(apiPath, query))
    }

    /** Create a new application */
    public CopyApps(srcUserId: string, destUserId: string, appId: string, luisSubscriptionKey: string): Promise<string> {
        const apiPath = `apps/copy`
        const query = {
            srcUserId,
            destUserId,
            appId,
            luisSubscriptionKey
        }

        return this.send('POST', this.MakeURL(apiPath, query))
    }

    /**
     * Archive an existing application
     * Note: "deleting" an application doesn't destroy it, but rather archives
     * it for a period (eg 30 days).  During the archive period, the application
     * can be restored with the next API call.  At the end of the archive period,
     * the application is destroyed.
     */
    public ArchiveApp(appId: string): Promise<string> {
        let apiPath = `app/${appId}`
        return this.send('DELETE', this.MakeURL(apiPath))
    }

    /**
     * Create a new application
     */
    // TODO: Fix API to return full object
    public async AddApp(app: CLM.AppBase, query: string): Promise<string> {
        const apiPath = `app`
        // Note: This isn't an actual AppBase, but just { appId, packageId }
        const appResponse = await this.send<CLM.AppBase>('POST', this.MakeURL(apiPath, query), app)
        return appResponse.appId
    }

    /** Creates a new package tag */
    public PublishApp(appId: string, tagName: string): Promise<CLM.PackageReference> {
        let apiPath = `app/${appId}/publish`
        const query = `version=${tagName}`
        return this.send('PUT', this.MakeURL(apiPath, query))
    }

    /** Sets a package tags as the live version */
    public PublishProdPackage(appId: string, packageId: string): Promise<string> {
        let apiPath = `app/${appId}/publish/${packageId}`
        return this.send('POST', this.MakeURL(apiPath))
    }

    //==============================================================================
    // Entity
    //=============================================================================
    /**
     * Retrieves definitions of ALL entities in the latest package
     * (or the specified package, if provided).  To retrieve just the IDs
     * of all entities, see the GetEntityIds method
     */
    public GetEntities(appId: string, query?: string): Promise<CLM.EntityList> {
        let apiPath = `app/${appId}/entities`
        return this.send('GET', this.MakeURL(apiPath, query))
    }

    //=============================================================================
    // Log Dialogs
    //=============================================================================

    public DeleteLogDialog(appId: string, logDialogId: string): Promise<void> {
        let apiPath = `app/${appId}/logdialog/${logDialogId}`
        return this.send('DELETE', this.MakeURL(apiPath))
    }

    public DeleteLogDialogs(appId: string, logDialogIds: string[]): Promise<void> {
        const ids = logDialogIds.map(p => `id=${p}`).join("&")
        let apiPath = `app/${appId}/logdialog&${ids}`
        return this.send('DELETE', this.MakeURL(apiPath))
    }

    public GetLogDialog(appId: string, logDialogId: string): Promise<CLM.LogDialogList> {
        const apiPath = `app/${appId}/logdialog/${logDialogId}`
        return this.send('GET', this.MakeURL(apiPath))
    }

    public GetLogDialogs(appId: string, packageIds: string[], continuationToken?: string, maxPageSize?: string): Promise<CLM.LogQueryResult> {
        const packages = packageIds.map(p => `package=${p}`).join("&")
        let apiPath = `app/${appId}/logdialogs?includeDefinitions=false&${packages}`
        if (continuationToken) {
            apiPath = apiPath.concat(`&continuationToken=${encodeURIComponent(continuationToken)}`)
        }
        if (maxPageSize) {
            apiPath = apiPath.concat(`&maxPageSize=${maxPageSize}`)
        }
        return this.send('GET', this.MakeURL(apiPath))
    }

    /** Runs entity extraction (prediction). */
    public LogDialogExtract(
        appId: string,
        logDialogId: string,
        turnIndex: string,
        userInput: CLM.UserInput
    ): Promise<CLM.ExtractResponse> {
        let apiPath = `app/${appId}/logdialog/${logDialogId}/extractor/${turnIndex}`
        // Always retrieve entity list
        let query = { includeDefinitions: true }
        return this.send('PUT', this.MakeURL(apiPath, query), userInput)
    }


    //=============================================================================
    // Train Dialogs
    //=============================================================================
    /**
     * Retrieves information about a specific trainDialog in the current package
     * (or the specified package, if provided)
     */
    public GetTrainDialog(appId: string, trainDialogId: string, includeDefinitions: boolean = false): Promise<CLM.TrainDialog> {
        let apiPath = `app/${appId}/traindialog/${trainDialogId}`
        let query = { includeDefinitions }
        return this.send('GET', this.MakeURL(apiPath, query))
    }

    /** Runs entity extraction (prediction). */
    public TrainDialogExtract(
        appId: string,
        trainDialogId: string,
        turnIndex: string,
        userInput: CLM.UserInput
    ): Promise<CLM.ExtractResponse> {
        let apiPath = `app/${appId}/traindialog/${trainDialogId}/extractor/${turnIndex}`
        // Always retrieve entity list
        let query = { includeDefinitions: true }
        return this.send('PUT', this.MakeURL(apiPath, query), userInput)
    }

    /**
     * Returns a 409 if text variation conflicts with existing labels, otherwise 200
     * filteredDialog is dialog to ignore when checking for conflicts
     */
    public TrainDialogValidateTextVariation(appId: string, trainDialogId: string, textVariation: CLM.TextVariation, excludeConflictCheckId: string): Promise<null> {
        let apiPath = `app/${appId}/traindialog/${trainDialogId}/extractor/textvariation`
        // Note: service can take a list of filteredDialogs, but we just use one for now
        let query = excludeConflictCheckId
            ? { filteredDialogs: excludeConflictCheckId }
            : undefined
        return this.send('POST', this.MakeURL(apiPath, query), textVariation)
    }

    //=============================================================================
    // Session
    //=============================================================================

    /** Creates a new session and a corresponding logDialog */
    public StartSession(appId: string, sessionCreateParams: CLM.SessionCreateParams): Promise<CLM.Session> {
        let apiPath = `app/${appId}/session`
        return this.send('POST', this.MakeSessionURL(apiPath), sessionCreateParams)
    }

    /** Gets information about a session */
    // TODO: move this to session API path next time that the API definition gets updated
    public GetSession(appId: string, sessionId: string): Promise<CLM.Session> {
        let apiPath = `app/${appId}/session/${sessionId}`
        return this.send('GET', this.MakeURL(apiPath))
    }

    /** Runs entity extraction (prediction). */
    public SessionExtract(appId: string, sessionId: string, userInput: CLM.UserInput): Promise<CLM.ExtractResponse> {
        let apiPath = `app/${appId}/session/${sessionId}/extractor`

        // Always retrieve entity list
        let query = { includeDefinitions: true }
        return this.send('PUT', this.MakeSessionURL(apiPath, query), userInput)
    }

    /** Take a turn and returns chosen action */
    public SessionScore(appId: string, sessionId: string, scorerInput: CLM.ScoreInput): Promise<CLM.ScoreResponse> {
        let apiPath = `app/${appId}/session/${sessionId}/scorer`
        return this.send('PUT', this.MakeSessionURL(apiPath), scorerInput)
    }

    public SessionLogicResult(appId: string, sessionId: string, actionId: string, actionResult: IActionResult) {
        let apiPath = `app/${appId}/session/${sessionId}/scorerSteps/action/${actionId}/logicResult`
        return this.send('PUT', this.MakeSessionURL(apiPath), { logicResult: actionResult.logicResult })
    }

    /** End a session. */
    public EndSession(appId: string, sessionId: string): Promise<string> {
        let apiPath = `app/${appId}/session/${sessionId}`
        //TODO: remove this when redundant query parameter is removed
        let query = { saveDialog: false }
        return this.send('DELETE', this.MakeSessionURL(apiPath, query))
    }

    //=============================================================================
    // Teach
    //=============================================================================

    /** Creates a new teaching session and a corresponding trainDialog */
    public StartTeach(appId: string, createTeachParams: CLM.CreateTeachParams): Promise<CLM.TeachResponse> {
        let apiPath = `app/${appId}/teach`
        return this.send('POST', this.MakeURL(apiPath), createTeachParams)
    }

    /**
     * Runs entity extraction (prediction).
     * If a more recent version of the package is available on
     * the server, the session will first migrate to that newer version.  This
     * doesn't affect the trainDialog maintained.
     */
    public TeachExtract(appId: string, teachId: string, userInput: CLM.UserInput, excludeConflictCheckId: string | null): Promise<CLM.ExtractResponse> {
        let apiPath = `app/${appId}/teach/${teachId}/extractor`
        // Note: service can take a list of filteredDialogs, but we just use one for now
        const query: QueryObject = { includeDefinitions: true }
        if (excludeConflictCheckId) {
            query.filteredDialogs = excludeConflictCheckId
        }
        return this.send('PUT', this.MakeURL(apiPath, query), { text: userInput.text })
    }

    /**
     * Uploads a labeled entity extraction instance
     * ie "commits" an entity extraction label, appending it to the teach session's
     * trainDialog, and advancing the dialog. This may yield produce a new package.
     */
    public TeachExtractFeedback(appId: string, teachId: string, extractorStep: CLM.TrainExtractorStep): Promise<CLM.TeachResponse> {
        let apiPath = `app/${appId}/teach/${teachId}/extractor`
        return this.send('POST', this.MakeURL(apiPath), extractorStep)
    }

    /**
     * Takes a turn and return distribution over actions.
     * If a more recent version of the package is
     * available on the server, the session will first migrate to that newer version.
     * This doesn't affect the trainDialog maintained by the teaching session.
     */
    public TeachScore(appId: string, teachId: string, scorerInput: CLM.ScoreInput): Promise<CLM.ScoreResponse> {
        let apiPath = `app/${appId}/teach/${teachId}/scorer`
        return this.send('PUT', this.MakeURL(apiPath), scorerInput)
    }

    /**
     * Uploads a labeled scorer step instance
     * – ie "commits" a scorer label, appending it to the teach session's
     * trainDialog, and advancing the dialog. This may yield produce a new package.
     */
    public TeachScoreFeedback(appId: string, teachId: string, scorerResponse: CLM.TrainScorerStep): Promise<CLM.TeachResponse> {
        let apiPath = `app/${appId}/teach/${teachId}/scorer`
        return this.send('POST', this.MakeURL(apiPath), scorerResponse)
    }

    /**
     * Ends a teach.
     * For Teach sessions, does NOT delete the associated trainDialog.
     * To delete the associated trainDialog, call DELETE on the trainDialog.
     */
    public EndTeach(appId: string, teachId: string, save: boolean): Promise<CLM.TrainResponse> {
        let apiPath = `app/${appId}/teach/${teachId}`
        const query = { saveDialog: save }
        return this.send('DELETE', this.MakeURL(apiPath, query))
    }
}
