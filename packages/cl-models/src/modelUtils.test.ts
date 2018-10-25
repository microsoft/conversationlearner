/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ModelUtils, TrainDialog, Validity } from './conversationlearner-models'

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
