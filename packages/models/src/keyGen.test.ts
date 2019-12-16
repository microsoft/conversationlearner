/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { KeyGen } from './KeyGen'

describe('KeyGen', () => {
  describe('HashCode', () => {
    test('given a string return a unique hash of the string', () => {
      const hash1 = KeyGen.MakeKey('test1')
      const hash2 = KeyGen.MakeKey('test2')

      expect(typeof hash1).toBe('string')
      expect(hash1).not.toBe(hash2)
    })
  })
})
