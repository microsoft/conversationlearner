/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ScoreInput, ScoredAction } from './Score'
import { LabeledEntity } from './Entity'
import { AppDefinition } from './AppDefinition'

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
  // I'd of the selected action
  labelAction: string
  // Score of the selected action
  scoredAction: ScoredAction | undefined
}

export interface TrainRound {
  extractorStep: TrainExtractorStep
  scorerSteps: TrainScorerStep[]
}

export interface TrainDialogInput {
  sourceLogDialogId: string
  rounds: TrainRound[]
  definitions?: AppDefinition | null
  invalid?: boolean
}

export interface TrainDialog extends TrainDialogInput {
  trainDialogId: string
  version: number
  packageCreationId: number
  packageDeletionId: number
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
}
