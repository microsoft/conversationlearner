/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ScoreInput, ScoredAction, ScoreResponse } from './Score'
import { LabeledEntity } from './Entity'
import { AppDefinition } from './AppDefinition'
import { FilledEntity } from './FilledEntity'

export const MAX_TEXT_VARIATIONS = 20

export enum SenderType {
  User = 0,
  Bot = 1
}

export interface TextVariation {
  text: string
  labelEntities: LabeledEntity[]
}

export interface TrainExtractorStep {
  textVariations: TextVariation[]
}

export interface LogicResult {
  // Result passed to render portion of API callback
  logicValue: string | undefined
  // Entities that changed as part of logic callback
  changedFilledEntities: FilledEntity[]
}

export interface LogicAPIError {
  APIError: string
}

export interface TrainScorerStep {
  input: ScoreInput
  // ID of the selected action
  labelAction: string | undefined
  logicResult: LogicResult | undefined
  // Score of the selected action
  scoredAction: ScoredAction | undefined
  // Import text for this action (before real action is created)
  importText?: string
  // Used for UI rendering only
  uiScoreResponse?: ScoreResponse
}

export interface TrainRound {
  extractorStep: TrainExtractorStep
  scorerSteps: TrainScorerStep[]
}

export enum Validity {
  VALID = 'valid',
  INVALID = 'invalid',
  UNKNOWN = 'unknown',
  WARNING = 'warning'
}

export interface TrainDialogInput {
  sourceLogDialogId: string
  rounds: TrainRound[]
  definitions?: AppDefinition | null
  validity?: Validity
}

export interface TranscriptValidationTurn {
  inputText: string
  actionHashes: string[]
}

export interface TranscriptValidationResult {
  validity: Validity
  logDialogId: string | null
  fileName?: string
  // Original transcript history
  sourceHistory?: any
}

export interface TrainDialogClientData {
  // Hashes of .transcript files used to create this TrainDialog
  importHashes: string[]
}

export interface TrainDialog extends TrainDialogInput {
  createdDateTime: string
  lastModifiedDateTime: string
  trainDialogId: string
  version: number
  packageCreationId: number
  packageDeletionId: number
  initialFilledEntities: FilledEntity[]
  tags: string[]
  description: string
  clientData?: TrainDialogClientData
}

export interface TrainResponse {
  packageId: number
  trainingStatus: string
  trainDialogId: string
}

export interface TrainDialogList {
  trainDialogs: TrainDialog[]
  definitions?: AppDefinition
}

export interface TrainDialogIdList {
  trainDialogIds: string[]
}

export interface CreateTeachParams {
  contextDialog: TrainRound[]
  sourceLogDialogId?: string
  initialFilledEntities: FilledEntity[]
}
