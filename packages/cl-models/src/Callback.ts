/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
/** Information about the running bot */

export interface Callback {
  name: string
  logicArguments: string[]
  isLogicFunctionProvided: boolean
  renderArguments: string[]
  isRenderFunctionProvided: boolean
}
