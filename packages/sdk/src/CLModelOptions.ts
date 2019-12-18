/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export const DEFAULT_MAX_SESSION_LENGTH = 20 * 60 * 1000  // 20 minutes

// Model Settings
export interface CLModelOptions {
    // How long before a session automatically times out
    sessionTimeout: number
}
