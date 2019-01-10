/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { MemoryValue, Memory } from './Memory'
import { ModelUtils } from './ModelUtils'
import { EntityBase } from './Entity'

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
    const entityDisplayValue = filledEntityMap.ValueAsString(key)

    // TODO: Required check because poor API from filledEntityMap which can return null
    if (entityDisplayValue) {
      m.set(key, entityDisplayValue)
    }

    return m
  }, new Map<string, string>())
}

export class FilledEntityMap {
  public map: { [key: string]: FilledEntity } = {}

  public constructor(init?: Partial<FilledEntityMap>) {
    Object.assign(this, init)
  }

  public static FromFilledEntities(filledEntities: FilledEntity[], entities: EntityBase[]): FilledEntityMap {
    let filledEntityMap = new FilledEntityMap()
    for (let filledEntity of filledEntities) {
      let entity = entities.find(e => e.entityId === filledEntity.entityId)
      if (entity) {
        filledEntityMap.map[entity.entityName] = filledEntity
      }
    }
    return filledEntityMap
  }

  // Flips entity name based map to entityId based map
  public EntityMapToIdMap(entities: EntityBase[]) {
    let filledEntityMap = new FilledEntityMap()
    for (let entityName in this.map) {
      const filledEntity = this.map[entityName]
      filledEntityMap.map[filledEntity.entityId!] = filledEntity
    }
    return filledEntityMap
  }

  // Provided an update (diff), update the filled entity list
  public UpdateFilledEntities(filledEntities: FilledEntity[], entities: EntityBase[]) {
    for (let filledEntity of filledEntities) {
      let entity = entities.find(e => e.entityId === filledEntity.entityId)
      if (entity) {
        this.map[entity.entityName] = filledEntity
      }
    }
  }

  public ToMemory(): Memory[] {
    let memory: Memory[] = []
    for (let entityName in this.map) {
      let entityValues = this.map[entityName] ? this.map[entityName].values : []
      memory.push({ entityName: entityName, entityValues })
    }
    return memory
  }

  public ValueAsList(entityName: string): string[] {
    if (!this.map[entityName]) {
      return []
    }

    return this.map[entityName].values.filter(v => typeof v.userText === 'string').map(v => v.userText!)
  }

  public ValueAsString(entityName: string): string | null {
    if (!this.map[entityName]) {
      return null
    }

    if (this.map[entityName].values.length === 0) {
      return `[?????]`
    }
    // Print out[] list in friendly manner
    return filledEntityValueAsString(this.map[entityName])
  }

  public ValueAsNumber(entityName: string): number | null {
    const textObj = this.ValueAsString(entityName)
    let number = Number(textObj)
    if (isNaN(number)) {
      return null
    }
    return number
  }

  public ValueAsBoolean(entityName: string): boolean | null {
    const textObj = this.ValueAsString(entityName)
    if (textObj) {
      if (textObj.toLowerCase() === 'true') {
        return true
      }
      if (textObj.toLowerCase() === 'false') {
        return false
      }
    }
    return null
  }

  public ValueAsObject<T>(entityName: string): T | null {
    const textObj = this.ValueAsString(entityName)
    if (textObj) {
      return JSON.parse(textObj) as T
    }
    return null
  }

  public Values(entityName: string): MemoryValue[] {
    if (!this.map[entityName]) {
      return []
    }
    return this.map[entityName].values
  }

  public Forget(entityName: string, entityValue: string | null = null, isBucket: boolean = false): void {
    // Check if entity buckets values
    if (isBucket) {
      // Entity might not be in memory
      if (!this.map[entityName]) {
        return
      }

      // If no entity Value provide, clear the entity
      if (!entityValue) {
        delete this.map[entityName]
      } else {
        // Find case insensitive index
        let lowerCaseNames = this.map[entityName].values.filter(mv => mv.userText).map(mv => mv.userText!.toLowerCase())

        let index = lowerCaseNames.indexOf(entityValue.toLowerCase())
        if (index > -1) {
          this.map[entityName].values.splice(index, 1)
          if (this.map[entityName].values.length === 0) {
            delete this.map[entityName]
          }
        }
      }
    } else {
      delete this.map[entityName]
    }
  }

  // Remember multiple values for an entity
  public RememberMany(
    entityName: string,
    entityId: string,
    entityValues: string[],
    isBucket: boolean = false,
    builtinType: string | null = null,
    resolution: {} | null = null
  ): void {
    for (let entityValue of entityValues) {
      this.Remember(entityName, entityId, entityValue, isBucket, builtinType, resolution)
    }
  }

  // Remember value for an entity
  public Remember(
    entityName: string,
    entityId: string,
    entityValue: string,
    isBucket: boolean = false,
    builtinType: string | null = null,
    resolution: any | null = null
  ): void {
    // If we don't already have entry in map for this item, create one
    if (!this.map[entityName]) {
      this.map[entityName] = {
        entityId,
        values: []
      }
    }

    const displayText = builtinType && resolution ? ModelUtils.PrebuiltDisplayText(builtinType, resolution, entityValue) : entityValue

    const newFilledEntityValue = {
      userText: entityValue,
      displayText,
      builtinType,
      resolution
    }

    const filledEntity = this.map[entityName]
    // Check if entity buckets values
    if (isBucket) {
      // Add if not a duplicate
      const containsDuplicateValue = filledEntity.values.some(memoryValue => memoryValue.userText === entityValue)
      if (!containsDuplicateValue) {
        filledEntity.values.push(newFilledEntityValue)
      }
    } else {
      filledEntity.values = [newFilledEntityValue]
    }
  }

  /** Return FilledEntity array for items I've remembered */
  public FilledEntities(): FilledEntity[] {
    return Object.keys(this.map).map(val => {
      return this.map[val]
    })
  }

  public static Split(action: string): string[] {
    return action.split(/[\s,:.?!\[\]]+/)
  }
}
