/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as CLM from 'clwoz-models'
import * as OF from 'office-ui-fabric-react'

export interface App extends CLM.AppBase {
    didPollingExpire: boolean
}

export interface SourceAndModelPair {
    source: CLM.AppDefinition,
    model: CLM.AppBase,
    // ActionBase or source, only care about ID for consistent labelAction 
    action: any | undefined,
}

export interface ImportedAction {
    text: string,
    buttons: string[],
    isTerminal: boolean,
    reprompt: boolean,
    isEntryNode?: boolean,
    lgName?: string,
    actionHash?: string
}

export interface ActivityHeight {
    sourceName: string
    index: number
    id: string,
    height: number | undefined,
    padding: number | undefined
}

export type MockResultsWithSource = {
    mockResults: CLM.CallbackResult[]
    source: MockResultSource
}

export enum MockResultSource {
    CODE = 'code',
    MODEL = 'model',
}

export type MockResultWithSource = {
    mockResult: CLM.CallbackResult,
    source: MockResultSource,
}

// Used to add id for running UI tests
export interface ChoiceGroupOptionWithTestId extends OF.IChoiceGroupOption {
    'data-testid': string
}

export type PartialTrainDialog = Pick<CLM.TrainDialog, "trainDialogId" | "tags" | "description"> & Partial<CLM.TrainDialog>