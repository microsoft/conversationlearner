/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ScoreInput, ScoredAction } from './Score'
import { LabeledEntity } from './Entity'
import { AppDefinition } from './AppDefinition'
import { FilledEntity } from './FilledEntity'

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

export interface TrainScorerStep {
  input: ScoreInput
  // ID of the selected action
  labelAction: string | undefined
  logicResult: string | undefined
  // Score of the selected action
  scoredAction: ScoredAction | undefined
}

export interface TrainRound {
  extractorStep: TrainExtractorStep
  scorerSteps: TrainScorerStep[]
}

export enum Validity {
  VALID = 'valid',
  INVALID = 'invalid',
  UNKNOWN = 'unknown'
}

export interface TrainDialogInput {
  sourceLogDialogId: string
  rounds: TrainRound[]
  definitions?: AppDefinition | null
  validity?: Validity
}

export interface TrainDialog extends TrainDialogInput {
  createdDateTime: string
  lastModifiedDateTime: string
  trainDialogId: string
  version: number
  packageCreationId: number
  packageDeletionId: number
  initialFilledEntities: FilledEntity[]
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
