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
  callbacks: Callback[]
  templates: Template[]
  validationError: string | null
  checksum: string
  banner: Banner | null
}
