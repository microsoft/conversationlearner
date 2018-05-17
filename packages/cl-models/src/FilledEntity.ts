/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { MemoryValue } from './Memory'

const SUBSTITUTE_PREFIX = '$'

export interface FilledEntity {
  entityId: string | null
  values: MemoryValue[]
}

export const filledEntityValueAsString = (fe: FilledEntity): string => memoryValuesAsString(fe.values)

export const memoryValuesAsString = (memories: MemoryValue[]): string => {
  // Print out list in friendly manner
  let group = ''
  for (let key in memories) {
    let index = +key
    let prefix = ''
    if (memories.length !== 1 && index === memories.length - 1) {
      prefix = ' and '
    } else if (index !== 0) {
      prefix = ', '
    }
    let value = memories[key]
    let text = value.displayText ? value.displayText : value.userText
    group += `${prefix}${text}`
  }
  return group
}

// In future will refactor to remove FilledEntityMap, but this method provides abstraction
// or isolation to methods that would normally consume filledEntityMap to reduce coupling
// and make code more flexible
export const getEntityDisplayValueMap = (filledEntityMap: FilledEntityMap): Map<string, string> => {
  return Object.keys(filledEntityMap.map).reduce((m, key) => {
    const entityDisplayValue = filledEntityMap.EntityValueAsString(key)

    // TODO: Required check because poor API from filledEntityMap which can return null
    if (entityDisplayValue) {
      m.set(key, entityDisplayValue)
    }

    return m
  }, new Map<string, string>())
}

// TODO: Refactor to native Map
export class FilledEntityMap {
  public map: { [key: string]: FilledEntity } = {}

  public constructor(init?: Partial<FilledEntityMap>) {
    Object.assign(this, init)
  }

  public EntityValueAsList(entityName: string): string[] {
    if (!this.map[entityName]) {
      return []
    }

    return this.map[entityName].values.filter(v => typeof v.userText === 'string').map(v => v.userText!)
  }

  public EntityValueAsString(entityName: string): string | null {
    if (!this.map[entityName]) {
      return null
    }

    // Print out list in friendly manner
    return filledEntityValueAsString(this.map[entityName])
  }

  public static Split(action: string): string[] {
    return action.split(/[\s,:.?!\[\]]+/)
  }
}
