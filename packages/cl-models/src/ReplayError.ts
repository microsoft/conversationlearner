/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
export enum ReplayErrorType {
  /* Action does not exist in the model */
  ActionUndefined = 'ActionUndefined',
  /* Entity does not exist in the model */
  EntityUndefined = 'EntityUndefined',
  /* Entity used in Action but has not value */
  EntityEmpty = 'EntityEmpty',
  /* Selected Action is not available with given constraints */
  ActionUnavailable = 'ActionUnavailable',
  EntityDiscrepancy = 'EntityDiscrepancy',
  /* Action in Score Rounds after Wait action */
  ActionAfterWait = 'ActionAfterWait',
  /* Two consecutive user inputs */
  TwoUserInputs = 'TwoUserInputs',
  /* User input after non-wait */
  InputAfterNonWait = 'InputAfterNonWait',
  /* Exception */
  Exception = 'Exception'
}

export enum ReplayErrorLevel {
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  BLOCKING = 'BLOCKING' // Can't be edited
}

export class ReplayError {
  constructor(public type: ReplayErrorType, public errorLevel: ReplayErrorLevel) {}
}

export class ReplayErrorActionUndefined extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionUndefined, ReplayErrorLevel.BLOCKING)
  }
}

export class ReplayErrorEntityUndefined extends ReplayError {
  constructor(public value: string) {
    super(ReplayErrorType.EntityUndefined, ReplayErrorLevel.WARNING)
  }
}

export class ReplayErrorEntityEmpty extends ReplayError {
  constructor(public values: string[]) {
    super(ReplayErrorType.EntityEmpty, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorActionUnavailable extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionUnavailable, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorEntityDiscrepancy extends ReplayError {
  constructor(public lastUserInput: string, public originalEntities: string[], public newEntities: string[]) {
    super(ReplayErrorType.EntityDiscrepancy, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorActionAfterWait extends ReplayError {
  constructor() {
    super(ReplayErrorType.ActionAfterWait, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorTwoUserInputs extends ReplayError {
  constructor() {
    super(ReplayErrorType.TwoUserInputs, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorInputAfterNonWait extends ReplayError {
  constructor() {
    super(ReplayErrorType.InputAfterNonWait, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorException extends ReplayError {
  constructor() {
    super(ReplayErrorType.Exception, ReplayErrorLevel.BLOCKING)
  }
}
