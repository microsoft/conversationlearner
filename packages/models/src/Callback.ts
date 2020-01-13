/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Information about a callback action.
 * logicArguments and renderArguments are only valid if the appropriate is_Provided field is true.
 */
export interface Callback {
  name: string
  logicArguments: string[]
  isLogicFunctionProvided: boolean
  renderArguments: string[]
  isRenderFunctionProvided: boolean
  // List of mock objects containing the entity values and return value from logic function
  mockResults: CallbackResult[]
}

export type EntityValue = string | number | boolean | object

export interface CallbackResult {
  name: string
  entityValues: Record<string, EntityValue | EntityValue[] | null | undefined>
  returnValue: unknown
}