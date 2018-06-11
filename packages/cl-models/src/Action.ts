/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import EntityIdSerializer, { IOptions } from './slateSerializer'
import { ScoredAction } from './Score'

export const ActionTypes = {
  TEXT: 'TEXT',
  API_LOCAL: 'API_LOCAL',
  // API_AZURE : "API_AZURE", TODO
  CARD: 'CARD'
}

export class ActionBase {
  actionId: string
  actionType: string
  payload: string
  isTerminal: boolean
  requiredEntitiesFromPayload: string[]
  requiredEntities: string[] = []
  negativeEntities: string[] = []
  suggestedEntity: string | null = null
  version: number
  packageCreationId: number
  packageDeletionId: number

  constructor(action: ActionBase) {
    this.actionId = action.actionId
    this.actionType = action.actionType
    this.payload = action.payload
    this.isTerminal = action.isTerminal
    this.requiredEntitiesFromPayload = action.requiredEntitiesFromPayload || []
    this.requiredEntities = action.requiredEntities || []
    this.negativeEntities = action.negativeEntities || []
    this.suggestedEntity = action.suggestedEntity || null
    this.version = action.version
    this.packageCreationId = action.packageCreationId
    this.packageDeletionId = action.packageDeletionId
  }

  // TODO: Refactor away from generic GetPayload for different action types
  // They all return strings but the strings are very different (Text is the substituted values, but other actions dont)
  // This causes issue of having to pass in entityValueMap even when it's not required, but making it optional ruins
  // safety for those places which should require it.
  // TODO: Remove ScoredAction since it doesn't have payload
  static GetPayload(action: ActionBase | ScoredAction, entityValues: Map<string, string>): string {
    if (action.actionType === ActionTypes.TEXT) {
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
          `Error when attempting to parse text action payload. This might be an old action which was saved as a string.  Please create a new action. ${
            error.message
          }`
        )
      }
    }
    // For API or CARD the payload field of the outer payload is the name of API or the filename of the card template without extension
    else if ([ActionTypes.CARD, ActionTypes.API_LOCAL].includes(action.actionType)) {
      let actionPayload = JSON.parse(action.payload) as ActionPayload
      return actionPayload.payload
    }
    return action.payload
  }

  /** Return arguments for an action */
  static GetActionArguments(action: ActionBase | ScoredAction): ActionArgument[] {
    if (action.actionType !== ActionTypes.TEXT) {
      let actionPayload = JSON.parse(action.payload) as ActionPayload
      return actionPayload.arguments.map(aa => new ActionArgument(aa))
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
  arguments: ActionArgument[]

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.API_LOCAL) {
      throw new Error(`You attempted to create api action from action of type: ${action.actionType}`)
    }

    const actionPayload: ActionPayload = JSON.parse(this.payload)
    this.name = actionPayload.payload
    this.arguments = actionPayload.arguments.map(aa => new ActionArgument(aa))
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

export class CardAction extends ActionBase {
  templateName: string
  arguments: ActionArgument[]

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.CARD) {
      throw new Error(`You attempted to create card action from action of type: ${action.actionType}`)
    }

    const actionPayload: ActionPayload = JSON.parse(this.payload)
    this.templateName = actionPayload.payload
    this.arguments = actionPayload.arguments.map(aa => new ActionArgument(aa))
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
