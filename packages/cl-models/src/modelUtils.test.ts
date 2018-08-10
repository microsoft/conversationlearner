/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ModelUtils, TrainDialog } from './conversationlearner-models'

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

  describe('ToCreateTeachParams', () => {
    const trainDialog: TrainDialog = {
      createdDateTime: new Date().toJSON(),
      trainDialogId: 'trainDialogId',
      sourceLogDialogId: 'sourceLogDialogId',
      version: 1,
      packageCreationId: 1,
      packageDeletionId: 2,
      definitions: null,
      invalid: false,
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
      sourceLogDialogId: trainDialog.sourceLogDialogId
    })
  })
})
