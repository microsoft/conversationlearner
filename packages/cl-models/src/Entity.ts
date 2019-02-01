/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
export enum EntityType {
  // Programmatic Entity
  LOCAL = 'LOCAL',
  // Entity trained in LUIS
  LUIS = 'LUIS',
  // Enumeration
  ENUM = 'ENUM'
}

export const makeNegative = (entity: EntityBase, positiveId: string): EntityBase => ({
  ...entity,
  negativeId: null,
  positiveId
})

export interface EntityBase {
  entityId: string
  entityName: string
  entityType: EntityType | string
  resolverType: string | null
  createdDateTime: string
  version: number | null
  packageCreationId: number | null
  packageDeletionId: number | null
  lastModifiedDateTime?: string

  isMultivalue: boolean

  /** If set, has a negative and positive version */
  isNegatible: boolean

  /** If Negatable, the Id of negative entity associates with this Entity */
  negativeId: string | null

  /** If a Negative, Id of positive entity associated with this Entity */
  positiveId: string | null

  /** If an ENUM entity, the supported enums */
  enumValues?: EnumValue[]

  /** If it is set to true, it means that the entity is not persisted in the bot memory.
   * This is only true for built-in entities that are not created with "Always extract"
   */
  doNotMemorize: boolean | null

}

export function isPrebuilt(entity: EntityBase) {
  return (entity.entityName === `builtin-${entity.entityType.toLowerCase()}`)
}

export interface EnumValue {
  enumValueId?: string
  enumValue: string
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
