/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import { ActionObject, ActionState } from '../types'
import { AT } from '../types/ActionTypes'
import { Reducer } from 'redux'
import { replace } from '../Utils/util'
import produce from 'immer'

const initialState: ActionState = []

const actionsReducer: Reducer<ActionState> = produce((state: ActionState, actionObject: ActionObject) => {
    switch (actionObject.type) {
        case AT.USER_LOGOUT:
            return [...initialState]
        case AT.FETCH_ACTIONS_FULFILLED:
            return actionObject.allActions
        case AT.FETCH_APPSOURCE_FULFILLED:
            return actionObject.appDefinition.actions
        case AT.SOURCE_PROMOTE_UPDATED_APP_DEFINITION:
            return actionObject.updatedAppDefinition.actions
        case AT.CREATE_APPLICATION_FULFILLED:
            return [...initialState]
        case AT.CREATE_ACTION_FULFILLED:
            state.push(actionObject.action)
            return
        case AT.DELETE_ACTION_FULFILLED:
            return state.filter(a => a.actionId !== actionObject.actionId)
        case AT.EDIT_ACTION_FULFILLED:
            return replace(state, actionObject.action, a => a.actionId)
        default:
            return
    }
}, initialState)

export default actionsReducer