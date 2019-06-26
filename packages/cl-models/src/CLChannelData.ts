/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { SenderType } from './TrainDialog'
import { ReplayError } from './ReplayError'

export interface CLChannelData {
  senderType: SenderType | null
  roundIndex: number | null
  scoreIndex: number | null
  validWaitAction?: boolean
  replayError?: ReplayError | null
  activityIndex?: number
  isValidationTest?: boolean
}
