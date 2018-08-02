/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Template } from './Template'
import { Callback } from './Callback'
import { Banner } from './Banner'

export interface IUser {
  name: string
  id: string
}

/** Information about the running bot */
export interface BotInfo {
  user: IUser
  apiCallbacks: Callback[]
  renderCallbacks: Callback[]
  templates: Template[]
  validationErrors: string[]
  banner: Banner | null
}
