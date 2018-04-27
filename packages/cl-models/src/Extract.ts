/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { PredictedEntity } from './Entity'
import { Metrics } from './Metrics'
import { AppDefinition } from './AppDefinition'

export interface ExtractResponse {
  text: string
  predictedEntities: PredictedEntity[]
  metrics: Metrics
  packageId: string
  definitions: AppDefinition
}
