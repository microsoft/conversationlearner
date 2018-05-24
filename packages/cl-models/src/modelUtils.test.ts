/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ModelUtils } from './conversationlearner-models'

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
    test('given prebuilt type starts with encyclopediea should return entityText', () => {
      // Arrange
      const expected = 'randomValue1'

      // Act
      const actual = ModelUtils.PrebuiltDisplayText('builtin.encyclopedia', null, expected)

      // Assert
      expect(actual).toEqual(expected)
    })
  })
})
