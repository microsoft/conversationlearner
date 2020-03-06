/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { EntityBase } from './Entity'
import { ActionBase } from './Action'
import { TrainDialog } from './TrainDialog'

export interface AppDefinition {
  appId?: string
  entities: EntityBase[]
  actions: ActionBase[]
  trainDialogs: TrainDialog[]
}

export interface AppDefinitionChanges {
  entities: IChangeResult<EntityBase>[]
  actions: IChangeResult<ActionBase>[]
  trainDialogs: IChangeResult<TrainDialog>[]
}

export interface AppDefinitionWithoutChange {
  isChanged: false
  currentAppDefinition: AppDefinition
}

export interface AppDefinitionWithChange {
  isChanged: true
  currentAppDefinition: AppDefinition
  updatedAppDefinition: AppDefinition
  appDefinitionChanges: AppDefinitionChanges
}

export type AppDefinitionChange = AppDefinitionWithChange | AppDefinitionWithoutChange

export interface IChangeResult<T> {
  isChanged: boolean
  value: T
  changes: string[]
}
