/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { FilledEntity, FilledEntityMap, filledEntityValueAsString, MemoryValue } from './conversationlearner-models'

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

    describe('EntityValueAsList', () => {
      test('given filled entity with no matching entity name return empty array', () => {
        expect(filledEntityMap.EntityValueAsList('entityName2')).toEqual([])
      })

      test('given filled entity with multiple values return userText values', () => {
        expect(filledEntityMap.EntityValueAsList('entityName1')).toEqual(memoryValues.map(v => v.userText))
      })
    })

    describe('EntityValueAsString', () => {
      test('given filled entity with no matching entity name return null', () => {
        expect(filledEntityMap.EntityValueAsString('entityName2')).toEqual(null)
      })

      test('given filled entity with multiple values return displayText/userText values formatted as string', () => {
        expect(filledEntityMap.EntityValueAsString('entityName1')).toEqual('e1d1, e1d2 and e1d3')
      })
    })

    describe('Split', () => {
      test('given action name split it', () => {
        expect(FilledEntityMap.Split('test1 test2.test3?test4')).toEqual(['test1', 'test2', 'test3', 'test4'])
      })
    })
  })
})
