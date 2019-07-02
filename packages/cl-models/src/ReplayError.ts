/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
export enum ReplayErrorType {
  /* Action does not exist in the model */
  ActionUndefined = 'ActionUndefined',
  /* Action has not been created for this imported utterance */
  ActionStub = 'ActionStub',
  /* Entity does not exist in the model */
  EntityUndefined = 'EntityUndefined',
  /* API bad Card */
  APIBadCard = 'APIBadCard',
  /* API returns logicValue but has no Render function */
  APIMalformed = 'APIMalformed',
  /* API is stub */
  APIStub = 'APIStub',
  /* API does not exist on the Bot */
  APIUndefined = 'APIUndefined',
  /* Bot API threw and exception */
  APIException= 'APIException',
  /* Entity used in Action but has not value */
  EntityEmpty = 'EntityEmpty',
  /* Non-multi value has multiple values */
  EntityUnexpectedMultivalue = 'EntityUnexpectedMultivalue',
  /* Selected Action is not available with given constraints */
  ActionUnavailable = 'ActionUnavailable',
  /* Action in Score Rounds after Wait action */
  ActionAfterWait = 'ActionAfterWait',
  /* Two consecutive user inputs */
  TwoUserInputs = 'TwoUserInputs',
  /* User input after non-wait */
  InputAfterNonWait = 'InputAfterNonWait',
  /* Exception */
  Exception = 'Exception',
  EntityDiscrepancy = 'EntityDiscrepancy',
  SetEntityException = 'SetEntityException',
  // Transcript failed to replay as expected during test
  TranscriptValidationError = 'TranscriptValidationError'
}

export enum ReplayErrorLevel {
  // TrainDialog can still be used in training
  WARNING = 'WARNING',
  // TrainDialog will be disabled
  ERROR = 'ERROR',
  //TrainDialog will be disabled and can't be edited / replayed
  BLOCKING = 'BLOCKING'
}

export class ReplayError {
  constructor(public type: ReplayErrorType, public errorLevel: ReplayErrorLevel) {}
}

export class ReplayErrorActionUndefined extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionUndefined, ReplayErrorLevel.BLOCKING)
  }
}

export class ReplayErrorActionStub extends ReplayError {
  constructor(public lastUserInput: string) {
    super(ReplayErrorType.ActionStub, ReplayErrorLevel.BLOCKING)
  }
}

export class ReplayErrorEntityUndefined extends ReplayError {
  constructor(public value: string) {
    super(ReplayErrorType.EntityUndefined, ReplayErrorLevel.WARNING)
  }
}

export class ReplayErrorAPIBadCard extends ReplayError {
  constructor() {
    super(ReplayErrorType.APIBadCard, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorAPIMalformed extends ReplayError {
  constructor() {
    super(ReplayErrorType.APIMalformed, ReplayErrorLevel.ERROR)
  }
}


export class ReplayErrorAPIStub extends ReplayError {
  constructor() {
    super(ReplayErrorType.APIStub, ReplayErrorLevel.WARNING)
  }
}

export class ReplayErrorAPIUndefined extends ReplayError {
  constructor(public value: string) {
    super(ReplayErrorType.APIUndefined, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorAPIException extends ReplayError {
  constructor() {
    super(ReplayErrorType.APIException, ReplayErrorLevel.ERROR)
  }
}

export class ReplayErrorEntityEmpty extends ReplayError {
  constructor(public values: string[]) {
    super(ReplayErrorType.EntityEmpty, ReplayErrorLevel.ERROR)
  }
}

export class EntityUnexpectedMultivalue extends ReplayError {
  constructor(public entityName: string) {
    super(ReplayErrorType.EntityUnexpectedMultivalue, ReplayErrorLevel.WARNING)
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

export class ReplayErrorTranscriptValidation extends ReplayError {
  constructor() {
    super(ReplayErrorType.TranscriptValidationError, ReplayErrorLevel.ERROR)
  }
}

// TODO: Why do we have two types for the same errors?
// This makes it possible for them to be mismatched.
// E.g. API exception error could be a InputAfterNoWait error which should be impossible
export class ReplaySetEntityException extends ReplayError {
  constructor() {
    super(ReplayErrorType.SetEntityException, ReplayErrorLevel.ERROR)
  }
}
