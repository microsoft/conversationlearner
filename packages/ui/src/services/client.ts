/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import { PartialTrainDialog } from '../types/models'
import { REPROMPT_SELF } from '../types/const'
import Axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import * as querystring from 'query-string'

export interface ClientHeaders {
    botChecksum: string
    memoryKey: string
}

interface TypedAxiosResponse<T> extends AxiosResponse {
    data: T
}

// shape of client
/*
const clClient = new CLClient(getAccessToken, { ... })

const apps = await clClient.apps.list()
const app = await clClient.apps(appId)
const app = await clClient.apps.create({ ... })

const app = await clClient.apps(appId).update({ ... })
await clClient.apps(appId).delete()

const entities = await clClient.apps(appId).entries()
const actions = await clClient.apps(appId).actions()
const logDialogs = await clClient.apps(appId).logDialogs()
const trainDialogs = await clClient.apps(appId).trainDialogs()
*/

interface IActionCreationResponse {
    actionId: string
    packageId: string
    trainingStatus: string
}

export type TrainDialogUpdateQueryParams = {
    ignoreLabelConflicts: boolean
}

export default class ClClient {
    getBaseUrl: () => string
    defaultConfig: AxiosRequestConfig = {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    forceError: boolean = false

    // The memory is key is used by ConversationLearner-SDK to access the memory partition for a particular user and check consistency of running bot
    getClientHeaders: () => ClientHeaders

    constructor(getBaseUrl: () => string, getClientHeaders: () => ClientHeaders, defaultHeaders?: { [x: string]: string }, forceError: boolean = false) {
        this.getBaseUrl = getBaseUrl
        this.getClientHeaders = getClientHeaders
        this.defaultConfig.headers = { ...this.defaultConfig.headers, ...defaultHeaders }
        this.forceError = forceError
    }

    send<T = any>(config: AxiosRequestConfig) {
        if (this.forceError) {
            return Promise.reject(new Error("Injected Error"))
        }

        const clientHeaders = this.getClientHeaders()
        const finalConfig = {
            ...this.defaultConfig,
            ...config
        }

        // Defer getting baseUrl until execution to ensure we get latest Bot port
        finalConfig.url = `${this.getBaseUrl()}${config.url}`
        finalConfig.headers[CLM.MEMORY_KEY_HEADER_NAME] = clientHeaders.memoryKey
        finalConfig.headers[CLM.BOT_CHECKSUM_HEADER_NAME] = clientHeaders.botChecksum

        return Axios(finalConfig) as Promise<TypedAxiosResponse<T>>
    }

    async setApp(app: CLM.AppBase): Promise<void> {
        await this.send({
            method: 'put',
            url: `/state/app`,
            data: app
        })
    }

    async setConversationId(userName: string, userId: string, conversationId: string): Promise<void> {
        await this.send({
            method: 'put',
            url: `/state/conversationId?userName=${userName}&conversationId=${conversationId}`,
        })
    }

    // Each browser instance has a different browserId
    async getBotInfo(browserId: string, appId?: string): Promise<CLM.BotInfo> {
        const response = await this.send<CLM.BotInfo>({
            url: `/bot?browserId=${browserId}${appId ? `&appId=${appId}` : ''}`
        })
        return response.data
    }

    async apps(userId: string): Promise<CLM.UIAppList> {
        const response = await this.send<CLM.UIAppList>({
            url: `/apps?userId=${userId}`
        })
        return response.data
    }

    async appGet(appId: string): Promise<CLM.AppBase> {
        const response = await this.send<CLM.AppBase>({
            url: `/app/${appId}`
        })
        return response.data
    }

    async appGetTrainingStatus(appId: string): Promise<CLM.TrainingStatus> {
        const response = await this.send<CLM.TrainingStatus>({
            url: `/app/${appId}/trainingstatus`
        })
        return response.data
    }

    // AT.CREATE_APPLICATION_ASYNC
    async appsCreate(userId: string, appInput: Partial<CLM.AppBase>): Promise<CLM.AppBase> {
        const response = await this.send<CLM.AppBase>({
            method: 'post',
            url: `/app?userId=${userId}`,
            data: appInput
        })
        return response.data
    }

    // AT.COPY_APPLICATION_ASYNC
    async appCopy(srcUserId: string, destUserId: string, appId: string): Promise<void> {
        await this.send<string>({
            method: 'post',
            url: `/apps/copy?srcUserId=${srcUserId}&destUserId=${destUserId}&appId=${appId}`
        })
    }

    async appsDelete(appId: string): Promise<void> {
        await this.send({
            method: 'delete',
            url: `/app/${appId}`
        })
    }

    async appsUpdate(appId: string, app: CLM.AppBase): Promise<CLM.AppBase> {
        await this.send({
            method: 'put',
            url: `/app/${appId}`,
            data: app
        })
        return app
    }

    async appCreateTag(appId: string, tagName: string, makeLive: boolean): Promise<CLM.AppBase> {
        const response = await this.send<CLM.AppBase>({
            method: 'put',
            url: `/app/${appId}/publish?version=${tagName}&makeLive=${makeLive}`
        })
        return response.data
    }

    async appSetLiveTag(appId: string, tagName: string): Promise<CLM.AppBase> {
        const response = await this.send<CLM.AppBase>({
            method: 'post',
            url: `/app/${appId}/publish/${tagName}`
        })
        return response.data
    }

    async appSetEditingTag(appId: string, tagName: string): Promise<{ [appId: string]: string }> {
        const response = await this.send<{
            [appId: string]: string
        }>({
            method: 'post',
            url: `/app/${appId}/edit/${tagName}`
        })
        return response.data
    }

    async appExtract(appId: string, userUtterances: string[]): Promise<CLM.ExtractResponse[]> {
        const response = await this.send<CLM.ExtractResponse[]>({
            method: 'post',
            url: `/app/${appId}/extract`,
            data: userUtterances
        })
        return response.data
    }

    async entitiesGetById(appId: string, entityId: string): Promise<CLM.EntityBase> {
        const response = await this.send<CLM.EntityBase>({
            url: `/app/${appId}/entity/${entityId}`
        })
        return response.data
    }

    async entities(appId: string): Promise<CLM.EntityBase[]> {
        const response = await this.send<CLM.EntityList>({
            url: `/app/${appId}/entities`
        })
        return response.data.entities
    }

    async entitiesCreate(appId: string, entity: CLM.EntityBase): Promise<CLM.EntityBase> {
        const response = await this.send<CLM.ChangeEntityResponse>({
            method: 'post',
            url: `/app/${appId}/entity`,
            data: entity
        })

        const changeEntityResponse = response.data
        entity.entityId = changeEntityResponse.entityId
        entity.negativeId = changeEntityResponse.negativeEntityId

        // Note: Is synchronous API and could return whole object but there was hesitance of breaking change
        // Make second request to get other fields from new entity such as enumValueIds
        const newEntity = await this.entitiesGetById(appId, entity.entityId)
        Object.assign(entity, newEntity)

        return entity
    }

    async entitiesDelete(appId: string, entityId: string): Promise<CLM.DeleteEditResponse> {
        const response = await this.send({
            method: 'delete',
            url: `/app/${appId}/entity/${entityId}`
        })
        return response.data
    }

    async entitiesDeleteValidation(appId: string, packageId: string, entityId: string): Promise<string[]> {
        const response = await this.send({
            method: 'get',
            url: `/app/${appId}/entity/${entityId}/deleteValidation?packageId=${packageId}`
        })
        return response.data
    }

    async entitiesUpdate(appId: string, entity: CLM.EntityBase): Promise<CLM.ChangeEntityResponse> {
        const { version, packageCreationId, packageDeletionId, ...entityToSend } = entity
        const response = await this.send<CLM.ChangeEntityResponse>({
            method: 'put',
            url: `/app/${appId}/entity/${entity.entityId}`,
            data: entityToSend
        })

        const changeEntityResponse = response.data
        entity.entityId = changeEntityResponse.entityId
        entity.negativeId = changeEntityResponse.negativeEntityId

        // TODO: Might be able to avoid since we still return the changeEntityResponse instead of updatedEntity
        // people should be using the return value instead of relying on mutation of passed in value
        // Note: Is synchronous API and could return whole object but there was hesitance of breaking change
        // Make second request to get other fields from new entity such as enumValueIds
        const newEntity = await this.entitiesGetById(appId, entity.entityId)
        Object.assign(entity, newEntity)

        return changeEntityResponse
    }

    async entitiesUpdateValidation(appId: string, packageId: string, entity: CLM.EntityBase): Promise<string[]> {
        const { version, packageCreationId, packageDeletionId, ...entityToSend } = entity
        const response = await this.send({
            method: 'post',
            url: `/app/${appId}/entity/${entity.entityId}/editValidation?packageId=${packageId}`,
            data: entityToSend
        })
        return response.data
    }

    async source(appId: string, packageId: string): Promise<CLM.AppDefinitionChange> {
        const response = await this.send<CLM.AppDefinitionChange>({
            url: `/app/${appId}/source?packageId=${packageId}`
        })
        return response.data
    }

    async sourcepost(appId: string, source: CLM.AppDefinition): Promise<any> {
        const response = await this.send({
            method: 'post',
            url: `/app/${appId}/source`,
            data: source
        })
        return response.data
    }

    async actions(appId: string): Promise<CLM.ActionBase[]> {
        const response = await this.send<CLM.ActionList>({
            url: `/app/${appId}/actions`
        })
        return response.data.actions
    }

    async actionsCreate(appId: string, action: CLM.ActionBase): Promise<CLM.ActionBase> {
        const response = await this.send<IActionCreationResponse>({
            method: 'post',
            url: `/app/${appId}/action`,
            data: action
        })
        action.actionId = response.data.actionId
        if (action.repromptActionId === REPROMPT_SELF) {
            action.repromptActionId = action.actionId
        }
        return action
    }

    async actionsDelete(appId: string, actionId: string, removeFromDialogs?: boolean): Promise<CLM.DeleteEditResponse> {
        let url = `/app/${appId}/action/${actionId}`
        if (removeFromDialogs) {
            url += `?removeFromDialogs=true`
        }

        const response = await this.send({
            method: 'delete',
            url
        })
        return response.data
    }

    async actionsDeleteValidation(appId: string, packageId: string, actionId: string): Promise<string[]> {
        const response = await this.send({
            method: 'get',
            url: `/app/${appId}/action/${actionId}/deleteValidation?packageId=${packageId}`
        })
        return response.data
    }

    async actionsUpdate(appId: string, action: CLM.ActionBase): Promise<CLM.DeleteEditResponse> {
        const { version, packageCreationId, packageDeletionId, ...actionToSend } = action
        const response = await this.send({
            method: 'put',
            url: `/app/${appId}/action/${action.actionId}`,
            data: actionToSend
        })
        return response.data
    }

    async actionsUpdateValidation(appId: string, packageId: string, action: CLM.ActionBase): Promise<string[]> {
        const { version, packageCreationId, packageDeletionId, ...actionToSend } = action
        const response = await this.send({
            method: 'post',
            url: `/app/${appId}/action/${action.actionId}/editValidation?packageId=${packageId}`,
            data: actionToSend
        })
        return response.data
    }

    //AT.EDIT_TRAINDIALOG_ASYNC
    async trainDialogEdit(appId: string, trainDialog: PartialTrainDialog, options?: Partial<TrainDialogUpdateQueryParams>): Promise<CLM.TrainResponse> {
        const queryString = querystring.stringify(options ?? {})
        const response = await this.send<CLM.TrainResponse>({
            method: 'put',
            url: `/app/${appId}/traindialog/${trainDialog.trainDialogId}?${queryString}`,
            data: trainDialog
        })
        return response.data
    }

    //AT.FETCH_TRAIN_DIALOG_ASYNC
    async trainDialog(appId: string, trainDialogId: string): Promise<CLM.TrainDialog> {
        const response = await this.send<CLM.TrainDialog>({
            url: `/app/${appId}/traindialog/${trainDialogId}`
        })
        return response.data
    }

    async trainDialogs(appId: string): Promise<CLM.TrainDialog[]> {
        const response = await this.send<CLM.TrainDialogList>({
            url: `/app/${appId}/traindialogs?includeDefinitions=false`
        })
        return response.data.trainDialogs
    }

    async trainDialogsCreate(appId: string, trainDialog: CLM.TrainDialog): Promise<CLM.TrainDialog> {
        const response = await this.send({
            method: 'post',
            url: `/app/${appId}/traindialog`,
            data: trainDialog
        })
        trainDialog.trainDialogId = response.data.trainDialogId
        return trainDialog
    }

    async trainDialogsDelete(appId: string, trainDialogId: string): Promise<void> {
        await this.send({
            method: 'delete',
            url: `/app/${appId}/traindialog/${trainDialogId}`
        })
    }

    //AT.FETCH_SCOREFROMTRAINDIALOG_ASYNC
    async trainDialogScoreFromTrainDialog(appId: string, trainDialog: CLM.TrainDialog): Promise<CLM.UIScoreResponse> {
        const response = await this.send<CLM.UIScoreResponse>({
            method: 'post',
            url: `/app/${appId}/scorefromtraindialog`,
            data: trainDialog
        })
        return response.data
    }

    //AT.FETCH_EXTRACTFROMTRAINDIALOG_ASYNC
    async trainDialogExtractFromTrainDialog(appId: string, trainDialog: CLM.TrainDialog, userInput: CLM.UserInput): Promise<CLM.ExtractResponse> {
        const response = await this.send<CLM.ExtractResponse>({
            method: 'post',
            url: `/app/${appId}/extractfromtraindialog`,
            data: { trainDialog, userInput }
        })
        return response.data
    }

    //AT.FETCH_TRAINDIALOGREPLAY_ASYNC
    async trainDialogReplay(appId: string, trainDialog: CLM.TrainDialog): Promise<CLM.TrainDialog> {
        const response = await this.send<CLM.TrainDialog>({
            method: 'post',
            url: `/app/${appId}/traindialogreplay`,
            data: trainDialog
        })
        return response.data
    }

    async trainDialogsUpdateExtractStep(appId: string, trainDialogId: string, turnIndex: number, userInput: CLM.UserInput): Promise<CLM.UIExtractResponse> {
        const response = await this.send({
            method: 'put',
            url: `/app/${appId}/traindialog/${trainDialogId}/extractor/${turnIndex}?includeDefinitions=true`,
            data: userInput
        })
        return response.data
    }

    //AT.FETCH_TEXTVARIATIONCONFLICT_ASYNC
    // If there is a conflicting text variation, returns corresponding extractresponse, otherwise null
    // excludeDialogId = dialog to ignore when checking for conflicting labels
    async fetchTextVariationConflict(appId: string, trainDialogId: string, textVariation: CLM.TextVariation, excludeDialogId: string | null): Promise<CLM.ExtractResponse | null> {
        let url = `/app/${appId}/traindialog/${trainDialogId}/extractor/textvariation`
        if (excludeDialogId) {
            url = `${url}?filteredDialog=${excludeDialogId}`
        }
        const response = await this.send<CLM.ExtractResponse>({
            method: 'post',
            url,
            data: textVariation
        })
        return response.data
    }

    async tutorials(userId: string): Promise<CLM.AppBase[]> {
        const response = await this.send<CLM.UIAppList>({
            url: `/apps?userId=${userId}`
        })
        return response.data.appList.apps
    }

    async history(appId: string, trainDialog: CLM.TrainDialog, userName: string, userId: string, useMarkdown: boolean): Promise<CLM.TeachWithActivities> {
        const response = await this.send<CLM.TeachWithActivities>({
            method: 'post',
            url: `/app/${appId}/history?username=${userName}&userid=${userId}&useMarkdown=${useMarkdown}`,
            data: trainDialog
        })
        return response.data
    }

    //AT.FETCH_LOG_DIALOG_ASYNC
    async logDialog(appId: string, logDialogId: string): Promise<CLM.LogDialog> {
        const response = await this.send<CLM.LogDialog>({
            url: `/app/${appId}/logdialog/${logDialogId}`
        })
        return response.data
    }

    async logDialogs(appId: string, packageIds: string[], maxPageSize: number, continuationToken?: string): Promise<CLM.LogQueryResult> {
        const packages = packageIds.map(p => `package=${p}`).join("&")
        let url = `/app/${appId}/logdialogs?includeDefinitions=false&excludeConverted=true&${packages}`
        if (maxPageSize) {
            url += `&maxPageSize=${maxPageSize}`
        }
        if (continuationToken) {
            url += `&continuationToken=${encodeURIComponent(continuationToken)}`
        }
        const response = await this.send<CLM.LogQueryResult>({
            url
        })
        return response.data
    }

    async logDialogsCreate(appId: string, logDialog: CLM.LogDialog): Promise<CLM.LogDialog> {
        const response = await this.send<string>({
            method: 'post',
            url: `/app/${appId}/logdialog`,
            data: logDialog
        })
        logDialog.logDialogId = response.data
        return logDialog
    }

    async logDialogsDelete(appId: string, logDialogId: string): Promise<void> {
        await this.send({
            method: 'delete',
            url: `/app/${appId}/logdialog/${logDialogId}`
        })
    }

    async logDialogsDeleteMany(appId: string, logDialogIds: string[]): Promise<void> {
        const logDialogIdQueryString = logDialogIds.map(id => `id=${id}`).join("&")
        await this.send({
            method: 'delete',
            url: `/app/${appId}/logdialog?${logDialogIdQueryString}`
        })
    }

    async logDialogsUpdateExtractStep(appId: string, logDialogId: string, turnIndex: number, userInput: CLM.UserInput): Promise<CLM.UIExtractResponse> {
        const response = await this.send({
            method: 'put',
            url: `/app/${appId}/logdialog/${logDialogId}/extractor/${turnIndex}`,
            data: userInput
        })
        return response.data
    }

    async chatSessions(appId: string): Promise<CLM.Session[]> {
        const response = await this.send<CLM.SessionList>({
            url: `/app/${appId}/sessions`
        })
        return response.data.sessions
    }

    async chatSessionsCreate(appId: string, sessionCreateParams: CLM.SessionCreateParams): Promise<CLM.Session> {
        const response = await this.send<CLM.Session>({
            method: 'post',
            url: `/app/${appId}/session`,
            data: sessionCreateParams
        })
        return response.data
    }

    async chatSessionsExpire(appId: string): Promise<void> {
        await this.send<void>({
            method: 'put',
            url: `/app/${appId}/session`
        })
    }

    // AT.DELETE_CHAT_SESSION_ASYNC
    async chatSessionsDelete(appId: string): Promise<void> {
        await this.send({
            method: 'delete',
            url: `/app/${appId}/session`
        })
    }

    async teachSessions(appId: string): Promise<CLM.Teach[]> {
        const response = await this.send<CLM.TeachList>({
            url: `/app/${appId}/teaches`
        })
        return response.data.teaches
    }

    async teachSessionCreate(appId: string, initialFilledEntities: CLM.FilledEntity[] = []): Promise<CLM.TeachResponse> {
        const response = await this.send<CLM.TeachResponse>({
            method: 'post',
            url: `/app/${appId}/teach`,
            data: initialFilledEntities
        })
        return response.data
    }

    // DELETE_TEACH_SESSION_ASYNC
    async teachSessionDelete(appId: string, teachSession: CLM.Teach, save: boolean): Promise<string> {
        const response = await this.send({
            method: 'delete',
            url: `/app/${appId}/teach/${teachSession.teachId}?save=${save}`
        })

        return response.data.trainDialogId
    }

    // filteredDialog = dialog to ignore when checking for conflicting labels
    async teachSessionAddExtractStep(appId: string, sessionId: string, userInput: CLM.UserInput, filteredDialog: string | null): Promise<CLM.UIExtractResponse> {
        let url = `/app/${appId}/teach/${sessionId}/extractor`
        if (filteredDialog) {
            url = `${url}?filteredDialog=${filteredDialog}`
        }
        const response = await this.send({
            method: 'put',
            url,
            data: userInput
        })
        return response.data
    }

    async teachSessionRescore(appId: string, teachId: string, scoreInput: CLM.ScoreInput): Promise<CLM.UIScoreResponse> {
        const response = await this.send<CLM.UIScoreResponse>({
            method: 'put',
            url: `/app/${appId}/teach/${teachId}/rescore`,
            data: scoreInput
        })
        return response.data
    }

    // AT.POST_SCORE_FEEDBACK_ASYNC
    async teachSessionAddScorerStep(appId: string, teachId: string, uiTrainScorerStep: CLM.UITrainScorerStep): Promise<CLM.UIPostScoreResponse> {
        const response = await this.send<CLM.UIPostScoreResponse>({
            method: 'post',
            url: `/app/${appId}/teach/${teachId}/scorer`,
            data: uiTrainScorerStep
        })
        return response.data
    }

    // AT.RUN_SCORER_ASYNC
    async teachSessionUpdateScorerStep(appId: string, teachId: string, uiScoreInput: CLM.UIScoreInput): Promise<CLM.UIScoreResponse> {
        const response = await this.send<CLM.UIScoreResponse>({
            method: 'put',
            url: `/app/${appId}/teach/${teachId}/scorer`,
            data: uiScoreInput
        })
        return response.data
    }

    async teachSessionFromBranch(appId: string, trainDialogId: string, userName: string, userId: string, turnIndex: number): Promise<CLM.TeachWithActivities> {
        const response = await this.send<CLM.TeachWithActivities>({
            method: 'post',
            url: `/app/${appId}/traindialog/${trainDialogId}/branch/${turnIndex}?username=${userName}&userid=${userId}`
        })
        return response.data
    }

    // AT.CREATE_TEACH_SESSION_FROMTRAINDIALOGASYNC
    // filteredDialog = dialog to ignore when checking for conflicting labels
    async teachSessionFromTrainDialog(appId: string, trainDialog: CLM.TrainDialog, userInput: CLM.UserInput | null, userName: string, userId: string, filteredDialog: string | null): Promise<CLM.TeachWithActivities> {
        let url = `/app/${appId}/teachwithactivities?username=${userName}&userid=${userId}`
        if (filteredDialog) {
            url = `${url}&filteredDialog=${filteredDialog}`
        }
        const response = await this.send<CLM.TeachWithActivities>({
            method: 'post',
            url,
            data: {
                trainDialog,
                userInput
            }
        })

        return response.data
    }

    // AT.FETCH_TRANSCRIPT_VALIDATION_ASYNC
    async validateTranscript(appId: string, packageId: string, testId: string, transcriptValidationTurns: CLM.TranscriptValidationTurn[]): Promise<string | null> {
        const response = await this.send<string | null>({
            method: 'post',
            url: `/app/${appId}/validatetranscript?testId=${testId}&packageId=${packageId}`,
            data: transcriptValidationTurns
        })
        return response.data
    }

    // AT.DELETE_MEMORY_ASYNC
    async memoryDelete(appId: string): Promise<void> {
        await this.send({
            method: 'delete',
            url: `/app/${appId}/botmemory`
        })
    }
}
