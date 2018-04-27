/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
export enum ReplayErrorType {
  MissingAction = 'MissingAcion',
  MissingEntity = 'MissingEntity',
  ActionUnavailable = 'ActionUnavailable',
  EntityDiscrepancy = 'EntityDiscrepancy'
}

export class ReplayError {
  constructor(public type: ReplayErrorType) {}
}

export class ReplayErrorMissingAction extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.MissingAction)
  }
}

export class ReplayErrorMissingEntity extends ReplayError {
  constructor(public value: string) {
    super(ReplayErrorType.MissingEntity)
  }
}

export class ReplayErrorActionUnavailable extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionUnavailable)
  }
}

export class ReplayErrorEntityDiscrepancy extends ReplayError {
  constructor(public lastUserInput: string, public originalEntities: string[], public newEntities: string[]) {
    super(ReplayErrorType.EntityDiscrepancy)
  }
}
