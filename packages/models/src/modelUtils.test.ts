/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ModelUtils, TrainDialog, Validity, MemoryValue, FilledEntity, FilledEntityMap } from './'

function makeMemoryValue(userText: string = 'userText'): MemoryValue {
  return {
    userText: userText,
    displayText: 'displayText',
    builtinType: 'number',
    resolution: { data: 'one', number: '5' }
  }
}

function makeFilledEntity(elementValues: string[]): FilledEntity {
  let values: MemoryValue[] = []
  for (let value of elementValues) {
    values.push(makeMemoryValue(value))
  }
  return {
    entityId: elementValues.join('.'),
    values
  }
}

interface MapMaker {
  name: string
  values: string[]
}

function makeFilledEntityMap(mapMakers: MapMaker[]): FilledEntityMap {
  let filledEntityMap: FilledEntityMap = new FilledEntityMap()
  for (let mapMaker of mapMakers) {
    let filledEntities = makeFilledEntity(mapMaker.values)
    filledEntityMap.map[mapMaker.name] = filledEntities
  }
  return filledEntityMap
}

describe('ModelUtils', () => {
  describe('RemoveWords', () => {
    test('given empty string return empty string', () => {
      expect(ModelUtils.RemoveWords('', 0)).toEqual('')
    })

    test('given string and removing 0 words return string', () => {
      expect(ModelUtils.RemoveWords('test', 0)).toEqual('test')
    })

    test('given string with 2 word and removing 1 word return word', () => {
      expect(ModelUtils.RemoveWords('test1 test2', 1)).toEqual('test2')
    })
  })

  describe('TextVariationEqual', () => {
    test(`pass`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(true)
    })

    test(`complex pass`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'this is tag and frog',
            labelEntities: [
              {
                entityId: 'c56fb3b8-923c-4d58-9150-838616e29913',
                startCharIndex: 8,
                endCharIndex: 10,
                entityText: 'tag',
                resolution: {},
                builtinType: ''
              },
              {
                entityId: 'c56fb3b8-923c-4d58-9150-838616e29913',
                startCharIndex: 16,
                endCharIndex: 19,
                entityText: 'frog',
                resolution: {},
                builtinType: ''
              }
            ]
          },
          {
            text: 'this is tag and frog',
            labelEntities: [
              {
                entityId: 'c56fb3b8-923c-4d58-9150-838616e29913',
                startCharIndex: 8,
                endCharIndex: 10,
                entityText: 'tag',
                resolution: {},
                builtinType: ''
              },
              {
                entityId: 'c56fb3b8-923c-4d58-9150-838616e29913',
                startCharIndex: 16,
                endCharIndex: 19,
                entityText: 'frog',
                resolution: {},
                builtinType: 'LUIS'
              }
            ]
          }
        )
      ).toEqual(true)
    })

    test(`fail based on different text`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some different text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(false)
    })

    test(`fail based on different number of entities`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' },
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(false)
    })

    test(`fail based on different entityIds`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'differentGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(false)
    })

    test(`fail based on different positions`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 10, endCharIndex: 14, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(false)
    })

    test(`fail based on different entity text`, () => {
      expect(
        ModelUtils.areEqualTextVariations(
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'text', resolution: {}, builtinType: '' }
            ]
          },
          {
            text: 'some text',
            labelEntities: [
              { entityId: 'someGUID', startCharIndex: 5, endCharIndex: 9, entityText: 'other', resolution: {}, builtinType: '' }
            ]
          }
        )
      ).toEqual(false)
    })
  })

  describe('areEqualMemoryValues', () => {
    test(`equal`, () => {
      const userText = 'User Text'
      let mv1 = makeMemoryValue(userText)
      let mv2 = makeMemoryValue(userText)
      expect(ModelUtils.areEqualMemoryValues([mv1], [mv2])).toEqual(true)
    })

    test(`mv1 diff`, () => {
      let mv1 = makeMemoryValue('mv1')
      let mv2 = makeMemoryValue('mv2')
      expect(ModelUtils.areEqualMemoryValues([mv1], [mv2])).toEqual(false)
    })

    test(`no mv2`, () => {
      let mv1 = makeMemoryValue('mv1')
      expect(ModelUtils.areEqualMemoryValues([mv1], [])).toEqual(false)
    })

    test(`no mv2`, () => {
      let mv1 = makeMemoryValue('mv1')
      expect(ModelUtils.areEqualMemoryValues([], [mv1])).toEqual(false)
    })
  })

  describe('changedFilledEntities', () => {
    test(`equal`, () => {
      let fe1 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }, { name: 'e2', values: ['bob'] }])
      let fe2 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }, { name: 'e2', values: ['bob'] }])
      expect(Object.keys(ModelUtils.changedFilledEntities(fe1, fe2).map).length).toEqual(0)
    })

    test(`removed entity`, () => {
      let fe1 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }, { name: 'e2', values: ['bob'] }])
      let fe2 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }])
      let cem = ModelUtils.changedFilledEntities(fe1, fe2)
      expect(cem.length).toEqual(1)
      expect(cem[0].entityId === 'bob')
      expect(cem[0].values.length === 0)
    })

    test(`added entity`, () => {
      let fe1 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }])
      let fe2 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }, { name: 'e2', values: ['bob'] }])
      let cem = ModelUtils.changedFilledEntities(fe1, fe2)
      expect(cem.length).toEqual(1)
      expect(cem[0].values.length === 1)
      expect(cem[0].values[0].userText === 'bob')
    })

    test(`changed entity`, () => {
      let fe1 = makeFilledEntityMap([{ name: 'e1', values: ['joe', 'sue'] }, { name: 'e2', values: ['bob'] }])
      let fe2 = makeFilledEntityMap([{ name: 'e1', values: ['mary', 'sue'] }, { name: 'e2', values: ['bob'] }])
      let cem = ModelUtils.changedFilledEntities(fe1, fe2)
      expect(cem.length).toEqual(1)
      expect(cem[0].values.length === 1)
      expect(cem[0].values[0].userText === 'mary')
    })
  })

  describe('PrebuiltDisplayText', () => {
    test(`given prebuilt with unknown type return entity text`, () => {
      expect(ModelUtils.PrebuiltDisplayText('builtin.nonexistingtype', null, 'entityText')).toEqual('entityText')
    })

    test('given prebuilt type starts with encyclopedia should return entityText', () => {
      // Arrange
      const expected = 'randomValue1'

      // Act
      const actual = ModelUtils.PrebuiltDisplayText('builtin.encyclopedia', null, expected)

      // Assert
      expect(actual).toEqual(expected)
    })

    test(`given prebuilt with type datetimeV2.date should return resolution values split by 'or'`, () => {
      expect(
        ModelUtils.PrebuiltDisplayText(
          'builtin.datetimeV2.date',
          {
            values: [
              {
                value: 'fake-date'
              },
              {
                value: 'fake-date-2'
              }
            ]
          },
          'entity-text'
        )
      ).toEqual('fake-date or fake-date-2')
    })

    test(`given prebuilt with type datetimeV2.time should return resolution values split by 'or'`, () => {
      expect(
        ModelUtils.PrebuiltDisplayText(
          'builtin.datetimeV2.time',
          {
            values: [
              {
                value: 'fake-time'
              },
              {
                value: 'fake-time-2'
              }
            ]
          },
          'entity-text'
        )
      ).toEqual('fake-time or fake-time-2')
    })

    test(`given prebuilt with type datetimeV2.daterange return start and end values from resolution`, () => {
      expect(
        ModelUtils.PrebuiltDisplayText(
          'builtin.datetimeV2.daterange',
          {
            values: [
              {
                start: 'start',
                end: 'end'
              }
            ]
          },
          'entityText'
        )
      ).toEqual('start to end')
    })

    test(`given prebuilt with type datetimeV2.daterange return start and end values from resolution`, () => {
      expect(
        ModelUtils.PrebuiltDisplayText(
          'builtin.datetimeV2.duration',
          {
            values: [
              {
                value: 'duration'
              }
            ]
          },
          'entityText'
        )
      ).toEqual('duration seconds')
    })
  })

  describe('Params', () => {
    const trainDialog: TrainDialog = {
      createdDateTime: new Date().toJSON(),
      lastModifiedDateTime: new Date().toJSON(),
      trainDialogId: 'trainDialogId',
      sourceLogDialogId: 'sourceLogDialogId',
      version: 1,
      packageCreationId: 1,
      packageDeletionId: 2,
      definitions: null,
      validity: Validity.VALID,
      initialFilledEntities: [],
      tags: [],
      description: '',
      rounds: [
        {
          extractorStep: {
            textVariations: []
          },
          scorerSteps: [
            {
              input: {
                filledEntities: [],
                context: {},
                maskedActions: []
              },
              logicResult: undefined,
              labelAction: 'test',
              scoredAction: undefined
            }
          ]
        }
      ]
    }

    const createTeachParams = ModelUtils.ToCreateTeachParams(trainDialog)

    expect(createTeachParams).toEqual({
      contextDialog: trainDialog.rounds,
      sourceLogDialogId: trainDialog.sourceLogDialogId,
      initialFilledEntities: trainDialog.initialFilledEntities
    })
  })
})

describe('textVariationToMarkdown', () => {
  test('no entities', () => {
    let textVariation = { text: 'no entities', labelEntities: [] }
    let expected = 'no entities'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test('**_start_** entity only', () => {
    let textVariation = {
      text: 'start entity only',
      labelEntities: [
        {
          entityId: '0f427885-b4b2-4b62-af10-040e5e1001de',
          startCharIndex: 0,
          endCharIndex: 4,
          entityText: 'start',
          resolution: {},
          builtinType: 'LUIS'
        }
      ]
    }
    let expected = '**_start_** entity only'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test('**_start_** and **_end_**', () => {
    let textVariation = {
      text: 'start and end',
      labelEntities: [
        {
          entityId: '0f427885-b4b2-4b62-af10-040e5e1001de',
          startCharIndex: 0,
          endCharIndex: 4,
          entityText: 'start',
          resolution: {},
          builtinType: 'LUIS'
        },
        {
          entityId: 'b558509d-5045-4055-b8c4-a8673b4b9ace',
          startCharIndex: 10,
          endCharIndex: 12,
          entityText: 'end',
          resolution: {},
          builtinType: 'LUIS'
        }
      ]
    }
    let expected = '**_start_** and **_end_**'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test('is **_next_** **_together_** entities', () => {
    let textVariation = {
      text: 'is next together entities',
      labelEntities: [
        {
          entityId: '0f427885-b4b2-4b62-af10-040e5e1001de',
          startCharIndex: 3,
          endCharIndex: 6,
          entityText: 'next',
          resolution: {},
          builtinType: 'LUIS'
        },
        {
          entityId: 'b558509d-5045-4055-b8c4-a8673b4b9ace',
          startCharIndex: 8,
          endCharIndex: 15,
          entityText: 'together',
          resolution: {},
          builtinType: 'LUIS'
        }
      ]
    }
    let expected = 'is **_next_** **_together_** entities'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test('a **_multi word_** entity', () => {
    let textVariation = {
      text: 'a multi word entity',
      labelEntities: [
        {
          entityId: '0f427885-b4b2-4b62-af10-040e5e1001de',
          startCharIndex: 2,
          endCharIndex: 11,
          entityText: 'multi word',
          resolution: {},
          builtinType: 'LUIS'
        }
      ]
    }
    let expected = 'a **_multi word_** entity'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test('**_solo_**', () => {
    let textVariation = {
      text: 'solo',
      labelEntities: [
        {
          entityId: '0f427885-b4b2-4b62-af10-040e5e1001de',
          startCharIndex: 0,
          endCharIndex: 3,
          entityText: 'solo',
          resolution: {},
          builtinType: 'LUIS'
        }
      ]
    }
    let expected = '**_solo_**'
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test(`i'd like to go **_tomorrow_**`, () => {
    let textVariation = {
      text: "i'd like to go tomorrow",
      labelEntities: [
        {
          score: 0,
          entityId: "b18c67af-26c3-4756-88af-76baf68a59ee",
          startCharIndex: 15,
          endCharIndex: 22,
          entityText: "tomorrow",
          resolution: {
            values: [
              {
                timex: "2019-01-03",
                type: "date",
                value: "2019-01-03"
              }
            ]
          },
          builtinType: "builtin.datetimeV2.date"
        },
        {
          entityId: "7367096c-80a1-4fe6-8d55-e78522e342bf",
          startCharIndex: 15,
          endCharIndex: 22,
          entityText: "tomorrow",
          resolution: {

          },
          builtinType: "LUIS",
          score: 0
        }
      ]
    }
    let expected = `i'd like to go **_tomorrow_**`
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  test(`**_today_**`, () => {
    let textVariation = {
      text: "today",
      labelEntities: [
        {
          entityId: "cb7c14f5-bb3b-4f4f-a7ba-bd8289efa995",
          startCharIndex: 0,
          endCharIndex: 4,
          entityText: "today"
        }
      ]
    }
    let expected = `**_today_**`
    let result = ModelUtils.textVariationToMarkdown(textVariation as any, [])
    expect(result).toBe(expected)
  })

  test(`send to **_lars@outlook.com_**`, () => {
    let textVariation = {
      text: "send to lars@outlook.com",
      labelEntities: [
        {
          entityId: "1a4cad5c-0eab-41d4-b569-e93af4b6a19e",
          startCharIndex: 8,
          endCharIndex: 23,
          entityText: "lars@outlook.com",
          resolution: {
            value: "lars@outlook.com"
          },
          builtinType: "builtin.email"
        }
      ]
    }
    let expected = `send to **_lars@outlook.com_**`
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })

  // Built in that is only used as a resolver and not labelled
  test(`i'd like to go tomorrow`, () => {
    let textVariation = {
      text: "i'd like to go tomorrow",
      labelEntities: [
        {
          score: 0,
          entityId: "b18c67af-26c3-4756-88af-76baf68a59ee",
          startCharIndex: 15,
          endCharIndex: 22,
          entityText: "tomorrow",
          resolution: {
            values: [
              {
                timex: "2019-01-03",
                type: "date",
                value: "2019-01-03"
              }
            ]
          },
          builtinType: "builtin.datetimeV2.date"
        }
      ]
    }
    let expected = `i'd like to go tomorrow`
    let result = ModelUtils.textVariationToMarkdown(textVariation, ["b18c67af-26c3-4756-88af-76baf68a59ee"])
    expect(result).toBe(expected)
  })

  // Built-in subset of custom
  test(`meet me on Wednesday`, () => {
    let textVariation = {
      text: "meet me on Wednesday",
      labelEntities: [
        {
          score: 0,
          entityId: "26f0b940-64a0-44c3-ab1a-14894ccae3fe",
          startCharIndex: 0,
          endCharIndex: 19,
          entityText: "meet me on wednesday",
          resolution: {},
          builtinType: "LUIS"
        },
        {
          entityId: "6875e7e7-a020-4c88-b7d3-3b8023303022",
          startCharIndex: 11,
          endCharIndex: 19,
          entityText: "wednesday",
          resolution:
          {
            values:
              [
                {
                  timex: "XXXX-WXX-3",
                  type: "date",
                  value: "2019-07-03"
                },
                {
                  timex: "XXXX-WXX-3",
                  type: "date",
                  value: "2019-07-10"
                }
              ]
          },
          builtinType: "builtin.datetimeV2.date"
        }
      ]
    }

    let expected = `**_meet me on Wednesday_**`
    let result = ModelUtils.textVariationToMarkdown(textVariation, [])
    expect(result).toBe(expected)
  })
})
