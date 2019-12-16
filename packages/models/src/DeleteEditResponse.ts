/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
export interface DeleteEditResponse {
  actionIds: string[]
  packageId: number
  trainingStatus: string
  // TrainDialogs invalidated by the Delete/Edit action
  trainDialogIds: string[]
}
