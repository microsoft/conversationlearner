/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
/** Information about the running bot */
export interface Template {
  name: string
  variables: TemplateVariable[]
  body?: string
  validationError: string | null
}

export interface TemplateVariable {
  key: string
  type: string
}
