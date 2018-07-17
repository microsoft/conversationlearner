/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/** Banner/Status info to display */
export interface Banner {
  message?: string
  type?: string
  datestring?: string
  link?: string
  linktext?: string
  /* Only display message when SDK version is less that one listed below x.y.x */
  sdkversion?: string
}
