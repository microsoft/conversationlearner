/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import { ErrorType } from './const'
import { AT } from './ActionTypes'
import { TipType } from '../components/ToolTips/ToolTips'
import { OBIImportData } from '../Utils/obiUtils'

export type ActionState = CLM.ActionBase[]
export type EntityState = CLM.EntityBase[]
export type ErrorState = {
    type: ErrorType,
    title?: string,
    messages: string[],
    actionType?: AT,
    closeCallback?: (() => void)
}
export type TrainDialogState = CLM.TrainDialog[]

export type LogDialogState = {
    logDialogs: CLM.LogDialog[]
    continuationToken: string | undefined
    pendingDelete: CLM.LogDialog[]
}

export type AppsState = {
    all: CLM.AppBase[],
    activeApps: { [appId: string]: string }  // appId: packageId
    selectedAppId: string | undefined,
    obiImportData?: OBIImportData
}
export type BotState = {
    botInfo: CLM.BotInfo | null
    browserId: string
}
export type TeachSessionState = {
    teach: CLM.Teach | undefined,
    dialogMode: CLM.DialogMode,
    input: string,
    prevMemories: CLM.Memory[],
    memories: CLM.Memory[],
    scoreInput: CLM.ScoreInput | undefined,
    uiScoreInput: CLM.UIScoreInput | undefined,
    extractResponses: CLM.ExtractResponse[],
    extractConflict: CLM.ExtractResponse | null,
    botAPIError: CLM.LogicAPIError | null,
    scoreResponse: CLM.ScoreResponse | undefined,
    autoTeach: boolean
}
export type ChatSessionState = {
    all: CLM.Session[],
    current: CLM.Session | null
}
export type DisplayState = {
    displaySpinner: string[],
    tipType: TipType,
    clearedBanner: CLM.Banner | null,
    webchatScrollPosition: number | undefined
}

export interface User {
    name: string
    id: string
}

export type UserState = {
    user: User | undefined
}

export interface ProfileState {
    current: any
}

export interface SettingsState {
    botPort: number
    customPort: number
    useCustomPort: boolean
    features: string
}

export type SourceState = { [appId: string]: CLM.AppDefinitionChange }

export type State = {
    profile: ProfileState,
    user: UserState,
    bot: BotState,
    apps: AppsState,
    entities: EntityState,
    actions: ActionState,
    trainDialogs: TrainDialogState,
    display: DisplayState,
    error: ErrorState,
    logDialogState: LogDialogState,
    teachSession: TeachSessionState,
    chatSessions: ChatSessionState,
    settings: SettingsState,
    source: SourceState
}
