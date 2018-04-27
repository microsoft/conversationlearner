/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
export interface AppMetaData {
  botFrameworkApps: string[]
  markdown: string
  video: string
  isLoggingOn: boolean
}

export interface AppBase {
  appName: string
  appId: string
  locale: string
  luisAppId: string
  metadata: AppMetaData
  trainingFailureMessage: string
  trainingStatus: TrainingStatusCode
  datetime: Date
  packageVersions?: PackageReference[]
  livePackageId?: string
  devPackageId?: string
}

export interface AppList {
  apps: AppBase[]
}

export interface AppIdList {
  appIds: string[]
}

export enum TrainingStatusCode {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed'
}

export interface TrainingStatus {
  trainingStatus: TrainingStatusCode
  trainingFailureMessage: string | null | undefined
}

export interface PackageReference {
  packageId: string
  packageVersion: string
}
