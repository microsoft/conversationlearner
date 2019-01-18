/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import {
  FilledEntity,
  FilledEntityMap,
  filledEntityValueAsString,
  MemoryValue,
  getEntityDisplayValueMap
} from './conversationlearner-models'

const createFilledEntity = (values: string[]): FilledEntity => {
  return {
    entityId: '',
    values: values.map(v => ({
      builtinType: '',
      resolution: {},
      displayText: v,
      userText: v
    }))
  }
}

describe('filledEntity', () => {
  describe('FilledEntity', () => {
    describe('filledEntityValueAsString', () => {
      test('given filled entity with single value return single value', () => {
        // Arrange
        const filledEntity = createFilledEntity(['d1'])
        const expected = 'd1'

        // Assert
        expect(filledEntityValueAsString(filledEntity)).toEqual(expected)
      })

      test('given filled entity with two values return two values separated by "and"', () => {
        // Arrange
        const filledEntity = createFilledEntity(['d1', 'd2'])
        const expected = 'd1 and d2'

        // Assert
        expect(filledEntityValueAsString(filledEntity)).toEqual(expected)
      })

      test('given filled entity with three values return values separated by commas and "and"', () => {
        // Arrange
        const filledEntity = createFilledEntity(['d1', 'd2', 'd3'])
        const expected = 'd1, d2 and d3'

        // Assert
        expect(filledEntityValueAsString(filledEntity)).toEqual(expected)
      })
    })
  })

  describe('FilledEntityMap', () => {
    const memoryValues: MemoryValue[] = [
      {
        userText: 'e1u1',
        displayText: 'e1d1',
        builtinType: 'none',
        resolution: {}
      },
      {
        userText: 'e1u2',
        displayText: 'e1d2',
        builtinType: 'none',
        resolution: {}
      },
      {
        userText: 'e1u3',
        displayText: 'e1d3',
        builtinType: 'none',
        resolution: {}
      }
    ]

    const filledEntityMap = new FilledEntityMap({
      map: {
        entityName1: {
          entityId: 'entityId1',
          values: memoryValues
        }
      }
    })

    const entity1 = {
      entityId: 'entityId1',
      values: [
        {
          userText: '3',
          displayText: '3',
          builtinType: 'none',
          resolution: {}
        }
      ]
    }

    const entity2 = 
    {
      entityId: 'entityId2',
      values: [
        {
          userText: '3',
          displayText: '3',
          builtinType: 'none',
          resolution: {}
        }
      ]
    }

    let newEntityMap = () => {
      return new FilledEntityMap({
        map: {
          entityName1: entity1,
          entityName2: entity2
        }
      })
  }


    describe('getEntityDisplayValueMap', () => {
      test('given filledEntityMap should return Map which has entity id to entity display value', () => {
        const displayFilledEntityName = getEntityDisplayValueMap(filledEntityMap)
        const entityName = 'entityName1'
        expect(displayFilledEntityName.get(entityName)).toEqual(filledEntityMap.ValueAsString(entityName))
      })
    })

    describe('ValueAsList', () => {
      test('given filled entity with no matching entity name return empty array', () => {
        expect(filledEntityMap.ValueAsList('entityName2')).toEqual([])
      })

      test('given filled entity with multiple values return userText values', () => {
        expect(filledEntityMap.ValueAsList('entityName1')).toEqual(memoryValues.map(v => v.userText))
      })
    })

    describe('ValueAsString', () => {
      test('given filled entity with no matching entity name return null', () => {
        expect(filledEntityMap.ValueAsString('entityName2')).toEqual(null)
      })

      test('given filled entity with multiple values return displayText/userText values formatted as string', () => {
        expect(filledEntityMap.ValueAsString('entityName1')).toEqual('e1d1, e1d2 and e1d3')
      })
    })

    describe('ValueAsNumber', () => {
      test('given filled entity with no matching entity name return null', () => {
        expect(filledEntityMap.ValueAsNumber('entityName1')).toEqual(null)
      })

      test('given filled entity with non-number value name return null', () => {
        expect(filledEntityMap.ValueAsNumber('entityName1')).toEqual(null)
      })

      test('given filled entity number value return number', () => {
        const filledEntityMapWithNumber = new FilledEntityMap({
          map: {
            entityName1: {
              entityId: 'entityId1',
              values: [
                {
                  userText: '3',
                  displayText: '3',
                  builtinType: 'none',
                  resolution: {}
                }
              ]
            }
          }
        })

        expect(filledEntityMapWithNumber.ValueAsNumber('entityName1')).toEqual(3)
      })
    })

    describe('EntityMapToIdMap', () => {

      let entityMap = newEntityMap()
      const idMap = entityMap.EntityMapToIdMap([entity1 as any, entity2 as any])
      expect(idMap.map[entity1.entityId]).toEqual(entity1)
      expect(idMap.map[entity2.entityId]).toEqual(entity2)
    })

    describe('FilledEntities', () => {
      test('given filledEntityMap return values in array', () => {
        expect(filledEntityMap.FilledEntities()).toEqual([
          {
            entityId: 'entityId1',
            values: memoryValues
          }
        ])
      })
    })

    describe('DeleteWithEmptyString', () => {
      test('DeleteNonMultiWithEmptyString', () => {

        let entityMap = newEntityMap()
        expect(Object.keys(entityMap.map).length).toEqual(2)
        entityMap.Remember("entityName1", entity1.entityId, "")
        expect(Object.keys(entityMap.map).length).toEqual(1)
      })

      test('DeleteMultiWithEmptyString', () => {
        let entityMap = newEntityMap()
        expect(Object.keys(entityMap.map).length).toEqual(2)
        entityMap.RememberMany("entityName1", entity1.entityId, ["",""])
        expect(Object.keys(entityMap.map).length).toEqual(1)
      })

      test('DeleteMultiWithEmptyString', () => {
        let entityMap = newEntityMap()
        expect(Object.keys(entityMap.map).length).toEqual(2)
        entityMap.RememberMany("entityName1", entity1.entityId, [])
        expect(Object.keys(entityMap.map).length).toEqual(1)
      })
    })

    describe('Split', () => {
      test('given action name split it', () => {
        expect(FilledEntityMap.Split('test1 test2.test3?test4')).toEqual(['test1', 'test2', 'test3', 'test4'])
      })
    })
  })
})
