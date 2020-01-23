import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as ToolTips from '../ToolTips/ToolTips'
import * as Util from '../../Utils/util'
import FormattedMessageId from '../FormattedMessageId'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import HelpIcon from '../HelpIcon'
import './CallbackResultViewerModal.css'
import produce from 'immer'
import { MockResultWithSource } from 'src/types'

type ReceivedProps = {
    entities: CLM.EntityBase[]
    isOpen: boolean
    isEditing: boolean
    existingCallbackResults: MockResultWithSource[]
    callbackResult: MockResultWithSource | undefined
    onClickSubmit: (callbackResult: CLM.CallbackResult) => void
    onClickCancel: () => void
}

type Props = ReceivedProps & InjectedIntlProps

// TODO: Clicking clear after setting strings would clear strings. Undesirable to lose but confusing to save.
type EntityValue = {
    value: string
    isMultiline: boolean
}

type EntityValues = {
    values: EntityValue[]
    clear: boolean
}

type State = {
    name: string
    entitiesValues: [string, EntityValues][]
    returnValue: string
    isReturnValueMultiline: boolean
}

enum ActionTypes {
    AddEntity,
    AddEntityValue,
    RemoveEntityValue,
    ChangeName,
    ChangeEntity,
    ChangeValue,
    ChangeReturnValue,
    OpenModal,
    ToggleClear,
}

type Action = {
    type: ActionTypes.ChangeName
    name: string
} | {
    type: ActionTypes.AddEntity
    entity: CLM.EntityBase
} | {
    type: ActionTypes.AddEntityValue
    entityName: string
} | {
    type: ActionTypes.RemoveEntityValue
    entityName: string
    valueIndex: number
} | {
    type: ActionTypes.OpenModal
    mockResult: CLM.CallbackResult | undefined
} | {
    type: ActionTypes.ToggleClear
    entityName: string
    cleared: boolean
} | {
    type: ActionTypes.ChangeEntity
    entityValuesIndex: number
    entityName: string
} | {
    type: ActionTypes.ChangeValue
    entityName: string
    valueIndex: number
    value: string
} | {
    type: ActionTypes.ChangeReturnValue
    returnValue: string
}

const reducer: React.Reducer<State, Action> = produce((state: State, action: Action) => {
    switch (action.type) {
        case ActionTypes.AddEntity: {
            // Add new empty value the user can fill in. Currently editable values are strings
            const newValue: EntityValue = { value: '', isMultiline: false }
            const newEntity: [string, EntityValues] = [action.entity.entityName, { values: [newValue], clear: false }]
            state.entitiesValues.push(newEntity)
            return
        }
        case ActionTypes.AddEntityValue: {
            const entityValues = state.entitiesValues.find(([entityName]) => entityName === action.entityName)
            if (!entityValues) {
                throw new Error(`Could not find entity values entry for entity named: ${action.entityName}`)
            }

            const newValue: EntityValue = {
                value: '',
                isMultiline: false,
            }

            entityValues[1].values.push(newValue)
            return
        }
        case ActionTypes.RemoveEntityValue: {
            const entityStateIndex = state.entitiesValues.findIndex(([entityName]) => entityName === action.entityName)
            if (entityStateIndex < 0) {
                throw new Error(`Entity state not found for entity named: ${action.entityName} on callback results: ${state.name}`)
            }

            const [, entityValues] = state.entitiesValues[entityStateIndex]
            entityValues.values.splice(action.valueIndex, 1)

            // If value removed was last value, also remove the whole entity entry
            if (entityValues.values.length === 0) {
                state.entitiesValues.splice(entityStateIndex, 1)
            }

            return
        }
        case ActionTypes.ToggleClear: {
            const entityState = state.entitiesValues.find(([entityName]) => entityName === action.entityName)
            if (!entityState) {
                throw new Error(`Entity state not found for entity named: ${action.entityName} on callback results: ${state.name}`)
            }

            entityState[1].clear = action.cleared
            return
        }
        case ActionTypes.ChangeEntity: {
            const entityState = state.entitiesValues[action.entityValuesIndex]
            if (!entityState) {
                throw new Error(`Entity state not found for entity named: ${action.entityName} on callback results: ${state.name}`)
            }

            entityState[0] = action.entityName
            return
        }
        case ActionTypes.ChangeName: {
            state.name = action.name
            return
        }
        case ActionTypes.ChangeValue: {
            const entityState = state.entitiesValues.find(([entityName]) => entityName === action.entityName)
            if (!entityState) {
                throw new Error(`Entity state not found for entity named: ${action.entityName} on callback results: ${state.name}`)
            }

            entityState[1].values[action.valueIndex].value = action.value
            return
        }
        case ActionTypes.ChangeReturnValue: {
            state.returnValue = action.returnValue
            return
        }
        case ActionTypes.OpenModal: {
            return initializeState(action.mockResult)
        }
        default: {
            console.warn(`You dispatched an action of type: ${ActionTypes[(action as any).type]} which was not handled. This is likely an error.`)
            return
        }
    }
})

const initializeState = (callbackResult: CLM.CallbackResult | undefined): State => {
    const name = callbackResult?.name ?? ''
    const entitiesValues = Object.entries(callbackResult?.entityValues ?? [])
        .map<[string, EntityValues]>(([entityName, entityValue]) => {
            // Entity might be single value or multi value, convert all to array for consistent processing
            let clear = false
            if (entityValue === null) {
                clear = true
            }

            const entityValuesArray = Array.isArray(entityValue) ? entityValue : [entityValue]
            const entityValuesForDisplay = entityValuesArray
                // Convert all values to strings and strip off quotes
                .map(value => value === null ? '' : JSON.stringify(value, null, '  ').slice(1, -1))
                // Enable multiline if the value is multiline
                // Likely used to represent readable JSON objects, but could be multiline strings
                .map<EntityValue>(value => {
                    const isMultiline = value.includes('\n')

                    return {
                        value,
                        isMultiline,
                    }
                })

            return [entityName, { values: entityValuesForDisplay, clear }]
        })

    const returnValueString = callbackResult?.returnValue
        ? JSON.stringify(callbackResult.returnValue, null, '  ').slice(1, -1)
        : ''
    const isReturnValueMultiline = returnValueString?.includes('\n') ?? false

    return {
        name,
        entitiesValues,
        returnValue: returnValueString,
        isReturnValueMultiline,
    }
}

const convertStateToMockResult = (state: State, entities: CLM.EntityBase[]): CLM.CallbackResult => {
    const entityValues = state.entitiesValues.reduce((eValues, [entityName, entityValues]) => {
        const entity = entities.find(e => e.entityName === entityName)
        if (entity) {
            const nonEmptyValues = entityValues.values
                .filter(v => v.value !== '')
                .map(v => v.value)

            const isValueRemoved = entityValues.clear
                || nonEmptyValues.length === 0

            // If entity should be cleared set to null
            // If entity is multi value, use array, otherwise use first value
            eValues[entityName] = isValueRemoved
                ? null
                : entity.isMultivalue
                    ? nonEmptyValues
                    : nonEmptyValues[0]
        }

        return eValues
    }, {})

    // If return value is empty, assume nothing, similar to above
    const returnValue = state.returnValue === ''
        ? undefined
        : state.returnValue

    return {
        name: state.name,
        entityValues,
        returnValue,
    }
}

const CallbackResultModal: React.FC<Props> = (props) => {
    // If mock result is sourced from model, allow editing
    const entityDropdownOptions = React.useMemo(() => {
        return props.entities
            .map<OF.IDropdownOption>(e => {
                return {
                    key: e.entityId,
                    text: e.entityName,
                    data: e,
                }
            })
    }, [props.entities.length])
    const firstOption: OF.IDropdownOption | undefined = entityDropdownOptions[0]
    const [selectedEntityOption, setSelectedEntityOption] = React.useState<OF.IDropdownOption | undefined>(firstOption)
    const onChangeSelectedEntity = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number): void => {
        if (!option) {
            return
        }

        setSelectedEntityOption(option)
    }

    const [state, dispatch] = React.useReducer(reducer, props.callbackResult?.mockResult, initializeState)
    // Every time the modal opens, reset the state
    React.useEffect(() => {
        if (props.isOpen) {
            dispatch({
                type: ActionTypes.OpenModal,
                mockResult: props.callbackResult?.mockResult,
            })
        }
    }, [props.isOpen])

    const onClickSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
        const mockResult = convertStateToMockResult(state, props.entities)
        props.onClickSubmit(mockResult)
    }
    const onClickCancel = props.onClickCancel

    const onChangeName = (event: React.FormEvent<HTMLInputElement>, newValue?: string | undefined): void => {
        if (typeof newValue !== 'string') {
            return
        }

        dispatch({
            type: ActionTypes.ChangeName,
            name: newValue,
        })
    }

    const onChangeClear = (entityName: string, cleared: boolean): void => {
        dispatch({
            type: ActionTypes.ToggleClear,
            entityName,
            cleared,
        })
    }

    const acceptText = props.isEditing
        ? Util.formatMessageId(props.intl, FM.BUTTON_SAVE)
        : Util.formatMessageId(props.intl, FM.BUTTON_OK)

    const onClickNewEntityValue = (entityName: string) => {
        dispatch({
            type: ActionTypes.AddEntityValue,
            entityName,
        })
    }

    const onChangeEntity = (entityValuesIndex: number, event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number | undefined): void => {
        if (!option) {
            return
        }

        const entityName = option.text as string
        dispatch({
            type: ActionTypes.ChangeEntity,
            entityValuesIndex,
            entityName,
        })
    }

    const onClickNewEntity = (entity: CLM.EntityBase) => {
        dispatch({
            type: ActionTypes.AddEntity,
            entity,
        })
    }

    const onClickDeleteEntityValue = (entityName: string, valueIndex: number): void => {
        dispatch({
            type: ActionTypes.RemoveEntityValue,
            entityName,
            valueIndex,
        })
    }

    const onChangeValue = (entityName: string, valueIndex: number, value: string): void => {
        dispatch({
            type: ActionTypes.ChangeValue,
            entityName,
            valueIndex,
            value,
        })
    }

    const onChangeReturnValue = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, returnValue?: string | undefined): void => {
        if (returnValue === undefined) {
            return
        }

        dispatch({
            type: ActionTypes.ChangeReturnValue,
            returnValue,
        })
    }

    const onGetNameErrorMessage = (value: string): string | undefined => {
        if (value === '') {
            return `Mock results must have a name to identify them.`
        }

        const doesNameMatchExistingCallback = props.existingCallbackResults.some(cr => cr.mockResult.name.toLowerCase() === state.name.toLowerCase())
        if (doesNameMatchExistingCallback) {
            return `Callback name matches existing callback, choose another name.`
        }

        return
    }

    const isResultValid = (state: State): boolean => {
        const doesNameMatchExistingCallback = props.existingCallbackResults.some(cr => cr.mockResult.name.toLowerCase() === state.name.toLowerCase())

        if (state.name === ''
            || doesNameMatchExistingCallback
        ) {
            return false
        }

        const noEntityValues = state.entitiesValues.length === 0
            || state.entitiesValues.some(([entityName, entityValues]) =>
                entityValues.clear === false
                && entityValues.values.every(entityValue => entityValue.value === ''))

        if (noEntityValues && state.returnValue === '') {
            return false
        }

        return true
    }

    const isStateValid = isResultValid(state)
    const existingEntitiesWithValue = state.entitiesValues.map(([entityName]) => entityName)
    const availableEntityOptions = entityDropdownOptions.filter(eo => existingEntitiesWithValue.includes(eo.data.entityName) === false)
    const nextEntityOption: OF.IDropdownOption | undefined = availableEntityOptions.sort((a, b) => a.data.entityName.localeCompare(b.data.entityName))[0]

    return <OF.Modal
        isOpen={props.isOpen}
        containerClassName="cl-modal cl-modal--medium"
    >
        <div className="cl-modal_header" data-testid="callback-result-viewer-title">
            <span className={OF.FontClassNames.xxLarge}>
                {props.isEditing
                    ? 'Edit'
                    : 'View'} Mocked Callback Result
            </span>
        </div>
        <div className="cl-modal_body">
            <div className="cl-callback-result-modal__fields">
                <div className="cl-callback-result-modal__name">
                    <OF.TextField
                        label={"Name"}
                        className={OF.FontClassNames.mediumPlus}
                        readOnly={props.isEditing === false}
                        value={state.name}
                        onChange={onChangeName}
                        autoComplete={"off"}
                        onGetErrorMessage={onGetNameErrorMessage}
                        validateOnLoad={false}
                    />
                </div>
                <div>
                    <div className={OF.FontClassNames.mediumPlus}>
                        <OF.Label className="cl-label">
                            <FormattedMessageId id={FM.CALLBACK_RESULT_MODAL_ENTITY_VALUES} />
                            <HelpIcon tipType={ToolTips.TipType.MOCK_RESULT} />
                        </OF.Label>
                    </div>

                    {state.entitiesValues.length === 0
                        ? <div>No Entity Values Set</div>
                        : <div className="cl-callback-result-modal__entity-values">
                            {state.entitiesValues.map(([entityName, entityValues], entityIndex) => {
                                // const previousEntityValuesNames = state.entitiesValues.slice(0, entityIndex).map(entry => entry[0])
                                // const availableEntityDropdownOptions = entityDropdownOptions.filter(e => e.text === noneOption.text || previousEntityValuesNames.includes(e.text) === false)
                                const entity = props.entities.find(e => e.entityName === entityName)
                                const isMultiValue = entity?.isMultivalue === true

                                let values
                                if (entityValues === null) {
                                    values = [<div className="cl-callback-result-modal__entity-values__entity-removed">Deleted</div>]
                                }
                                else {
                                    values = entityValues.values.map((valueObject, valueIndex) => {
                                        return <div className="cl-callback-result-modal__entity-value" key={`${entityName}-value-${valueIndex}`}>
                                            <OF.TextField
                                                readOnly={props.isEditing === false}
                                                multiline={valueObject.isMultiline}
                                                value={valueObject.value}
                                                disabled={entityValues.clear}
                                                onChange={(e, value) => value !== undefined && onChangeValue(entityName, valueIndex, value)}
                                                autoComplete={"off"}
                                            />
                                            <OF.IconButton
                                                data-testid="entity-enum-value-button-delete"
                                                disabled={props.isEditing === false || entityValues.clear}
                                                className={`cl-button-delete`}
                                                iconProps={{ iconName: 'Delete' }}
                                                onClick={() => onClickDeleteEntityValue(entityName, valueIndex)}
                                                ariaDescription="Delete Entity Value"
                                            />
                                        </div>
                                    })
                                }

                                if (isMultiValue) {
                                    const newValueButton = <div key={`${entityName}-add-value-button`}>
                                        <OF.DefaultButton
                                            onClick={() => onClickNewEntityValue(entityName)}
                                            disabled={props.isEditing === false || entityValues.clear}
                                            text={"Add Value"}
                                            iconProps={{ iconName: 'Add' }}
                                            data-testid="callback-result-modal-button-new-value"
                                        />
                                    </div>

                                    values.push(newValueButton)
                                }

                                return <React.Fragment key={`${entityName}-${entityIndex}`}>
                                    <div className="cl-callback-result-modal__entity-name">{entityName} {entity === undefined && 'Entity name does not exist'}</div>
                                    <div className="cl-callback-result-modal__entity-values__list">{values}</div>
                                    <OF.Checkbox
                                        label={"Clear"}
                                        disabled={props.isEditing === false}
                                        checked={entityValues.clear}
                                        onChange={(e, cleared) => cleared !== undefined && onChangeClear(entityName, cleared)}
                                    />
                                </React.Fragment>
                            })}
                        </div>
                    }
                </div>

                {props.isEditing && <div className="cl-callback-result-modal__new-entity-section">
                    <OF.Dropdown
                        data-testid="condition-creator-modal-dropdown-entity"
                        // selectedKey={selectedEntityOption?.key}
                        options={availableEntityOptions}
                        // onChange={onChangeSelectedEntity}
                        disabled={nextEntityOption === undefined}
                    />

                    <OF.DefaultButton
                        onClick={() => onClickNewEntity(nextEntityOption.data)}
                        disabled={nextEntityOption === undefined}
                        text={"Add Mock Entity Value"}
                        iconProps={{ iconName: 'Add' }}
                        className="cl-callback-result-modal__new-entity-button"
                        data-testid="callback-result-modal-button-new-entity"
                    />
                </div>}

                <div className="cl-callback-result-modal__return-value">
                    <OF.Label>Return Value</OF.Label>
                    <OF.TextField
                        readOnly={props.isEditing === false}
                        multiline={state.isReturnValueMultiline}
                        value={state.returnValue}
                        onChange={onChangeReturnValue}
                        autoComplete={"off"}
                    />
                </div>
            </div>
        </div>
        <div className="cl-modal_footer cl-modal-buttons cl-modal_footer--border">
            <div className="cl-modal-buttons_secondary">
            </div>
            <div className="cl-modal-buttons_primary">
                <OF.PrimaryButton
                    data-testid="callback-result-viewer-button-ok"
                    onClick={onClickSubmit}
                    disabled={isStateValid === false}
                    ariaDescription={acceptText}
                    text={acceptText}
                    iconProps={{ iconName: 'Accept' }}
                />
                <OF.DefaultButton
                    data-testid="callback-result-viewer-button-cancel"
                    onClick={onClickCancel}
                    ariaDescription={Util.formatMessageId(props.intl, FM.BUTTON_CANCEL)}
                    text={Util.formatMessageId(props.intl, FM.BUTTON_CANCEL)}
                    iconProps={{ iconName: 'Cancel' }}
                />
            </div>
        </div>
    </OF.Modal>
}

export default injectIntl(CallbackResultModal)