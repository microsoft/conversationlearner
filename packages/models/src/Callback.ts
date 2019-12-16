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
}
