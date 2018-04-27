/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
export enum EntityType {
  LOCAL = 'LOCAL',
  LUIS = 'LUIS'
}

export const makeNegative = (entity: EntityBase, positiveId: string): EntityBase => ({
  ...entity,
  negativeId: null,
  positiveId
})

export interface EntityBase {
  entityId: string
  entityName: string
  entityType: string
  version: number | null
  packageCreationId: number | null
  packageDeletionId: number | null

  isMultivalue: boolean

  /** If set, has a negative and positive version */
  isNegatible: boolean

  /** If Negatable, the Id of negative entity associates with this Entity */
  negativeId: string | null

  /** If a Negative, Id of positive entity associated with this Entity */
  positiveId: string | null
}

export interface LabeledEntity {
  entityId: string
  startCharIndex: number
  endCharIndex: number
  entityText: string
  resolution: {}
  builtinType: string
}

export interface PredictedEntity extends LabeledEntity {
  score: number | undefined
}

export interface EntityList {
  entities: EntityBase[]
}

export interface EntityIdList {
  entityIds: string[]
}
