/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import EntityIdSerializer, { IOptions } from './slateSerializer'
import { ScoredBase, ScoredAction } from './Score'
import { CallbackResult } from './Callback'

export enum ActionTypes {
  TEXT = 'TEXT',
  API_LOCAL = 'API_LOCAL',
  CARD = 'CARD',
  END_SESSION = 'END_SESSION',
  SET_ENTITY = 'SET_ENTITY',
  DISPATCH = 'DISPATCH',
  CHANGE_MODEL = 'CHANGE_MODEL',
}

export enum ConditionType {
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  GREATER_THAN = "GREATER_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
  LESS_THAN = "LESS_THAN",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  STRING_EQUAL = "STRING_EQUAL",
}

export enum ComparisonType {
  NUMBER_OF_VALUES = "NUMBER_OF_VALUES",
  NUMERIC_VALUE = "NUMERIC_VALUE",
  STRING = "STRING",
}

export interface Condition {
  entityId: string
  valueId?: string
  value?: number
  stringValue?: string
  condition: ConditionType
}

export interface ActionClientData {
  // Used to match import utterances
  actionHashes?: string[]
  lgName?: string
  mockResults: CallbackResult[]
}

// Need dummy actionId for stub action
export const CL_STUB_IMPORT_ACTION_ID = '51cd7df5-e504-451d-b629-0932e604689c'

export class ActionBase {
  actionId: string
  actionType: ActionTypes
  createdDateTime: string
  payload: string
  isTerminal: boolean
  // If true, CL will generate out of domain example utterances that point to this action.
  // There should be at most one action in a model with this flag set to `true`.
  isEntryNode?: boolean
  // Should server train for reprompting and if so what action to take when reprompting
  repromptActionId?: string
  requiredEntitiesFromPayload: string[]
  requiredEntities: string[] = []
  negativeEntities: string[] = []
  requiredConditions: Condition[] = []
  negativeConditions: Condition[] = []
  suggestedEntity: string | undefined
  version: number
  packageCreationId: number
  packageDeletionId: number
  entityId: string | undefined
  enumValueId: string | undefined
  clientData?: ActionClientData

  constructor(action: ActionBase) {
    this.actionId = action.actionId
    this.actionType = action.actionType
    this.createdDateTime = action.createdDateTime
    this.payload = action.payload
    this.isTerminal = action.isTerminal
    this.isEntryNode = action.isEntryNode
    this.repromptActionId = action.repromptActionId
    this.requiredEntitiesFromPayload = action.requiredEntitiesFromPayload
    this.requiredEntities = action.requiredEntities
    this.negativeEntities = action.negativeEntities
    this.requiredConditions = action.requiredConditions
    this.negativeConditions = action.negativeConditions
    this.suggestedEntity = action.suggestedEntity
    this.version = action.version
    this.packageCreationId = action.packageCreationId
    this.packageDeletionId = action.packageDeletionId
    this.entityId = action.entityId
    this.enumValueId = action.enumValueId
    this.clientData = action.clientData
  }

  // TODO: Refactor away from generic GetPayload for different action types
  // They all return strings but the strings are very different (Text is the substituted values, but other actions dont)
  // This causes issue of having to pass in entityValueMap even when it's not required, but making it optional ruins
  // safety for those places which should require it.
  // TODO: Remove ScoredAction since it doesn't have payload
  static GetPayload(action: ActionBase | ScoredBase, entityValues: Map<string, string>): string {

    if (this.useSimplePayload(action)) {
      let simpleAction = new SimpleAction(action as ActionBase)
      return simpleAction.renderValue(entityValues)
    }

    switch (action.actionType) {
      case ActionTypes.TEXT: {
        /**
         * For backwards compatibility check if payload is of new TextPayload type
         * Ideally we would implement schema refactor:
         * 1. Make payloads discriminated unions (E.g. After checking the action.type, flow control knows the type of the payload property)
         * This removes the need for the GetPayload function and GetArguments which are brittle coding patterns.
         */
        try {
          const textPayload = JSON.parse(action.payload) as TextPayload
          return EntityIdSerializer.serialize(textPayload.json, entityValues)
        } catch (e) {
          const error = e as Error
          throw new Error(
            `Error when attempting to parse text action payload. This might be an old action which was saved as a string.  Please create a new action. ${error.message
            }`
          )
        }
      }
      case ActionTypes.END_SESSION: {
        const textPayload = JSON.parse(action.payload) as TextPayload
        return EntityIdSerializer.serialize(textPayload.json, entityValues)
      }
      case ActionTypes.CARD: {
        // For API or CARD the payload field of the outer payload is the name of API or the filename of the card template without extension
        let cardPayload = JSON.parse(action.payload) as CardPayload
        return cardPayload.payload
      }
      case ActionTypes.API_LOCAL: {
        let actionPayload = JSON.parse(action.payload) as ActionPayload
        return actionPayload.payload
      }
      case ActionTypes.DISPATCH: {
        // TODO: Another reason to schema refactor...
        let actionPayload = JSON.parse(action.payload) as ModelPayload
        return `${ActionTypes.DISPATCH}: ${actionPayload.modelName}`
      }
      case ActionTypes.CHANGE_MODEL: {
        const actionPayload = JSON.parse(action.payload) as ModelPayload
        return `${ActionTypes.CHANGE_MODEL}: ${actionPayload.modelName}`
      }
      default:
        return action.payload
    }
  }

  // Return true if action is a placeholder
  static isPlaceholderAPI(action: Partial<ActionBase> | undefined): boolean {
    if (!action) {
      return false
    }
    if (action.payload && JSON.parse(action.payload).isPlaceholder) {
      return true
    }
    return false
  }

  // Return true if text action contains simple payload and no slate document
  static useSimplePayload(action: Partial<ActionBase> | undefined): boolean {
    if (action === undefined) {
      return false
    }
    if (action.payload !== undefined && action.actionType === ActionTypes.TEXT) {
      const json = JSON.parse(action.payload)
      if (json.nodes == null && json.simplePayload != null) {
        return true
      }
    }
    return false
  }

  // Create dummy placeholder API action
  static createPlaceholderAPIAction(placeholderName: string, isTerminal: boolean): ActionBase {
    return new ActionBase({
      actionId: null!,
      payload: JSON.stringify({ payload: placeholderName, logicArguments: [], renderArguments: [], isPlaceholder: true }),
      createdDateTime: new Date().toJSON(),
      isTerminal,
      isEntryNode: false,
      requiredEntitiesFromPayload: [],
      requiredEntities: [],
      negativeEntities: [],
      requiredConditions: [],
      negativeConditions: [],
      suggestedEntity: undefined,
      version: 0,
      packageCreationId: 0,
      packageDeletionId: 0,
      actionType: ActionTypes.API_LOCAL,
      entityId: undefined,
      enumValueId: undefined
    })
  }

  /** Return arguments for an action */
  static GetActionArguments(action: ActionBase | ScoredAction): ActionArgument[] {
    if (ActionTypes.CARD === action.actionType) {
      let cardPayload = JSON.parse(action.payload) as CardPayload
      return cardPayload.arguments.map(aa => new ActionArgument(aa))
    } else if (action.actionType === ActionTypes.API_LOCAL) {
      let actionPayload = JSON.parse(action.payload) as ActionPayload
      return [...actionPayload.logicArguments, ...actionPayload.renderArguments].map(aa => new ActionArgument(aa))
    }

    return []
  }
}

export interface ActionList {
  actions: ActionBase[]
}

export interface ActionIdList {
  actionIds: string[]
}

// TODO: Remove was originally storing two properties text/json
// but now text is removed and this is only here for backwards compatibility
export interface TextPayload {
  json: object
}

export interface ActionPayload {
  payload: string
  logicArguments: IActionArgument[]
  renderArguments: IActionArgument[]
  isPlaceholder?: boolean
  // TODO: Remove after consolidation with placeholder
  // Has different behavior than placeholders and implies only mock results can be used
  isCallbackUnassigned?: boolean
}

export interface ActionPayloadSingleArguments {
  payload: string
  arguments: IActionArgument[]
}

export interface CardPayload {
  payload: string
  arguments: IActionArgument[]
}

export interface IActionArgument {
  parameter: string
  value: TextPayload
}

export class ActionArgument {
  parameter: string
  value: object

  constructor(actionArgument: IActionArgument) {
    this.parameter = actionArgument.parameter
    this.value = actionArgument.value.json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export interface RenderedActionArgument {
  parameter: string
  value: string | null
}

export class TextAction extends ActionBase {
  value: object // json slate value

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.TEXT) {
      throw new Error(`You attempted to create text action from action of type: ${action.actionType}`)
    }

    this.value = JSON.parse(this.payload).json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export class ApiAction extends ActionBase {
  name: string
  logicArguments: ActionArgument[]
  renderArguments: ActionArgument[]
  isPlaceholder?: boolean
  isCallbackUnassigned?: boolean

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.API_LOCAL) {
      throw new Error(`You attempted to create api action from action of type: ${action.actionType}`)
    }

    const actionPayload: ActionPayload = JSON.parse(this.payload)
    this.name = actionPayload.payload
    this.logicArguments = actionPayload.logicArguments ? actionPayload.logicArguments.map(aa => new ActionArgument(aa)) : []
    this.renderArguments = actionPayload.renderArguments ? actionPayload.renderArguments.map(aa => new ActionArgument(aa)) : []
    this.isPlaceholder = actionPayload.isPlaceholder
    this.isCallbackUnassigned = actionPayload.isCallbackUnassigned
  }

  renderLogicArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.renderArgs(this.logicArguments, entityValues, serializerOptions)
  }

  renderRenderArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.renderArgs(this.renderArguments, entityValues, serializerOptions)
  }

  private renderArgs(
    args: ActionArgument[],
    entityValues: Map<string, string>,
    serializerOptions: Partial<IOptions> = {}
  ): RenderedActionArgument[] {
    return args.map(aa => {
      let value = null
      try {
        value = EntityIdSerializer.serialize(aa.value, entityValues, serializerOptions)
      } catch (error) {
        // Just return null if argument doesn't have a value
      }

      return {
        ...aa,
        value: value
      }
    })
  }
}

export class CardAction extends ActionBase {
  templateName: string
  arguments: ActionArgument[]

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.CARD) {
      throw new Error(`You attempted to create card action from action of type: ${action.actionType}`)
    }

    const payload: CardPayload = JSON.parse(this.payload)
    this.templateName = payload.payload
    this.arguments = payload.arguments.map(aa => new ActionArgument(aa))
  }

  renderArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.arguments.map(aa => {
      let value = null
      try {
        value = EntityIdSerializer.serialize(aa.value, entityValues, serializerOptions)
      } catch (error) {
        // Just return null if argument doesn't have a value
      }

      return {
        ...aa,
        value: value
      }
    })
  }
}

export class SessionAction extends ActionBase {
  value: object // json slate value

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.END_SESSION) {
      throw new Error(`You attempted to create session action from action of type: ${action.actionType}`)
    }

    this.value = JSON.parse(this.payload).json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export class SimpleAction extends ActionBase {
  value: string

  constructor(action: ActionBase) {
    super(action)

    const payload = JSON.parse(this.payload)
    if (!payload.simplePayload) {
      throw new Error(`You attempted to create simple action for item without simplePayload`)
    }

    this.value = payload.simplePayload
  }

  renderValue(entityValues: Map<string, string>): string {
    let output = this.value
    entityValues.forEach((value: string, key: string) => {
      output = output.replace(new RegExp(`{${key}}`, 'g'), value)
    })
    return output
  }
}

export type SetEntityPayload = {
  entityId: string
  enumValueId: string
}

export class SetEntityAction extends ActionBase {
  entityId: string
  enumValueId: string

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.SET_ENTITY) {
      throw new Error(`You attempted to create set entity action from action of type: ${action.actionType}`)
    }

    // TODO: Server already has actual entityId and enumValueId values, should not need to use payload like this
    // but some things like scored action only have the payload
    const jsonPayload = JSON.parse(this.payload) as SetEntityPayload
    this.entityId = jsonPayload.entityId
    this.enumValueId = jsonPayload.enumValueId
  }
}

export type ModelPayload = {
  modelId: string
  modelName: string
}

export class ModelAction extends ActionBase {
  modelId: string
  modelName: string

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.DISPATCH
      && action.actionType !== ActionTypes.CHANGE_MODEL) {
      throw new Error(`You attempted to create Model action from action of type: ${action.actionType}`)
    }

    // TODO: Server already has actual modelId and modelName values, should not need to use payload like this
    // but some things like scored action only have the payload
    const jsonPayload = JSON.parse(this.payload) as ModelPayload
    this.modelId = jsonPayload.modelId
    this.modelName = jsonPayload.modelName
  }
}

export class DispatchAction extends ModelAction {
  constructor(action: ActionBase) {
    if (action.actionType !== ActionTypes.DISPATCH) {
      throw new Error(`You attempted to create Dispatch action from action of type: ${action.actionType}`)
    }

    super(action)
  }
}

export class ChangeModelAction extends ModelAction {
  constructor(action: ActionBase) {
    if (action.actionType !== ActionTypes.CHANGE_MODEL) {
      throw new Error(`You attempted to create ChangeModel action from action of type: ${action.actionType}`)
    }

    super(action)
  }
}