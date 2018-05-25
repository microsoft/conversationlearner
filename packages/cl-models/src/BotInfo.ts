/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Template } from './Template'
import { CallbackAPI } from './CallbackAPI'
import { Banner } from './Banner'

export interface IUser {
  name: string
  id: string
}

/** Information about the running bot */
export interface BotInfo {
  user: IUser
  /** APICallbacks available to the Conversation Learner App */
  callbacks: CallbackAPI[]
  templates: Template[]
  validationErrors: string[]
  banner: Banner | null
}
