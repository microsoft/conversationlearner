/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { ScoreResponse, ScoreInput } from './Score'
import { ExtractResponse } from './Extract'
import { Metrics } from './Metrics'

export interface LogExtractorStep extends ExtractResponse {
  stepBeginDatetime: string
  stepEndDatetime: string
}

export interface LogScorerStep {
  input: ScoreInput
  predictedAction: string
  predictionDetails: ScoreResponse
  stepBeginDatetime: string
  stepEndDatetime: string
  metrics: Metrics
}

export interface LogRound {
  extractorStep: LogExtractorStep
  scorerSteps: LogScorerStep[]
}

export interface LogDialog {
  logDialogId: string
  targetTrainDialogIds: string[]
  dialogBeginDatetime: string
  dialogEndDatetime: string
  packageId: string
  metrics: string
  rounds: LogRound[]
}

export interface LogDialogList {
  logDialogs: LogDialog[]
}

export interface LogDialogIdList {
  logDialogIds: string[]
}
