/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Memory } from './Memory'
import { ScoreResponse, ScoreInput } from './Score'
import { ReplayError } from './ReplayError'

export enum DialogMode {
  Extractor = 'Extract', // Waiting for Extractor feedback
  Scorer = 'Score', // Waiting for Scorer feedback
  Wait = 'Wait' // Waiting for user input
}

export interface Teach {
  teachId: string
  trainDialogId: string
  createdDatetime: string | undefined
  lastQueryDatetime: string | undefined
  packageId: number | undefined
}

export interface TeachResponse {
  packageId: number
  teachId: string
  trainDialogId: string
}

export interface TeachList {
  teaches: Teach[]
}

export interface TeachIdList {
  teachIds: string[]
}

export interface TeachWithHistory {
  teach: Teach | undefined
  history: any[]
  memories: Memory[]
  prevMemories: Memory[]
  dialogMode: DialogMode
  scoreResponse: ScoreResponse | undefined
  scoreInput: ScoreInput | undefined
  isLastActionTerminal: boolean
  replayErrors: ReplayError[]
}
