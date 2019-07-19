/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
export enum TranscriptRating {
    BETTER = 'BETTER',
    WORSE = 'WORSE',
    SAME = 'SAME',
    UNKNOWN = 'UNKNOWN'
}

export enum TranscriptValidationResultType {
    REPRODUCED = 'REPRODUCED',
    CHANGED = 'CHANGED',
    TEST_FAILED = 'TEST_FAILED',
    INVALID_TRANSCRIPT = 'INVALID_TRANSCRIPT'
}

export interface TranscriptValidationTurn {
    inputText: string
    actionHashes: string[]
}

export interface TranscriptValidationResult {
    validity: TranscriptValidationResultType
    logDialogId: string | null
    fileName?: string
    // Original transcript history
    sourceHistory?: any
    rating: TranscriptRating
}

export interface TranscriptValidationSet {
    appId?: string
    fileName?: string
    transcriptValidationResults: TranscriptValidationResult[]
}