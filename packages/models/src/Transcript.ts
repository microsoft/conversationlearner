/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { PredictedEntity } from './Entity';
import { FilledEntity } from './FilledEntity'

export interface TranscriptValidationTurn {
    inputText: string
    // API placeholder results following input
    apiResults: FilledEntity[][]
    // If test forces extractor results this will be set
    predictedEntities?: PredictedEntity[]
}