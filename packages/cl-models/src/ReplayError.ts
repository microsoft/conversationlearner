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
  InputAfterNonWait = 'InputAfterNonWait'
}

export class ReplayError {
  constructor(public type: ReplayErrorType) {}
}

export class ReplayErrorActionUndefined extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionUndefined)
  }
}

export class ReplayErrorEntityUndefined extends ReplayError {
  constructor(public value: string) {
    super(ReplayErrorType.EntityUndefined)
  }
}

export class ReplayErrorEntityEmpty extends ReplayError {
  constructor(public values: string[]) {
    super(ReplayErrorType.EntityEmpty)
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

export class ReplayErrorActionAfterWait extends ReplayError {
  constructor() {
    super(ReplayErrorType.ActionAfterWait)
  }
}

export class ReplayErrorTwoUserInputs extends ReplayError {
  constructor() {
    super(ReplayErrorType.TwoUserInputs)
  }
}

export class ReplayErrorInputAfterNonWait extends ReplayError {
  constructor() {
    super(ReplayErrorType.InputAfterNonWait)
  }
}
