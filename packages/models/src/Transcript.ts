/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { FilledEntity } from './FilledEntity'

export interface TranscriptValidationTurn {
    inputText: string
    // API placeholder results following input
    apiResults: FilledEntity[][]
}