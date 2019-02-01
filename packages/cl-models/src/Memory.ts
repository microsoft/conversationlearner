/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
export interface MemoryValue {
  userText: string | null
  displayText: string | null
  builtinType: string | null
  resolution: {}
  enumValueId?: string | null
}

export interface Memory {
  entityName: string
  entityValues: MemoryValue[]
}
