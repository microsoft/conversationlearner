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
import { MockResultWithSource, MockResultSource } from 'src/types'

type ReceivedProps = {
    entities: CLM.EntityBase[]
    isOpen: boolean
    isEditing: boolean
    // Existing callbacks results excluding the one being edited.
    existingCallbackResults: MockResultWithSource[]
    // The callback result currently being edited.
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

enum EntityValuesError {
    NONE = 'NONE',
    UNKNOWN = 'UNKNOWN',
    SINGLE_VALUE_ASSIGNED_TO_MULTI_VALUE = 'SINGLE_VALUE_ASSIGNED_TO_MULTI_VALUE',
    MULTI_VALUE_ASSIGNED_TO_SINGLE_VALUE = 'MULTI_VALUE_ASSIGNED_TO_SINGLE_VALUE',
}

type EntityValues = {
    values: EntityValue[]
    clear: boolean
    errorType: EntityValuesError
}

type State = {
    source: MockResultSource
    name: string
    entitiesValues: [string, EntityValues][]
    returnValue: string
    isReturnValueMultiline: boolean
    viewCode: boolean
}

enum ActionTypes {
    AddEntity = 'AddEntity',
    AddEntityValue = 'AddEntityValue',
    RemoveEntityValue = 'RemoveEntityValue',
    ChangeName = 'ChangeName',
    ChangeValue = 'ChangeValue',
    ChangeReturnValue = 'ChangeReturnValue',
    OpenModal = 'OpenModal',
    ToggleClear = 'ToggleClear',
    ToggleViewCode = 'ToggleViewCode',
}

type Action = {
    type: ActionTypes.OpenModal
    entities: CLM.EntityBase[]
    mockResult: MockResultWithSource | undefined
} | {
    type: ActionTypes.ChangeName
    name: string
} | {
    type: ActionTypes.ChangeValue
    entityKey: string
    valueIndex: number
    value: string
} | {
    type: ActionTypes.ChangeReturnValue
    returnValue: string
} | {
    type: ActionTypes.AddEntity
    entity: CLM.EntityBase
} | {
    type: ActionTypes.AddEntityValue
    entityKey: string
} | {
    type: ActionTypes.RemoveEntityValue
    entityKey: string
    valueIndex: number
} | {
    type: ActionTypes.ToggleClear
    entityKey: string
    cleared: boolean
} | {
    type: ActionTypes.ToggleViewCode
}

const reducer: React.Reducer<State, Action> = produce((state: State, action: Action) => {
    switch (action.type) {
        case ActionTypes.AddEntity: {
            // Add new empty value the user can fill in. Currently editable values are strings
            const newValue: EntityValue = { value: '', isMultiline: false }
            const newEntity: [string, EntityValues] = [
                action.entity.entityId,
                {
                    values: [newValue],
                    clear: false,
                    errorType: EntityValuesError.NONE,
                }
            ]

            state.entitiesValues.push(newEntity)
            return
        }
        case ActionTypes.AddEntityValue: {
            const entityValues = state.entitiesValues.find(([entityKey]) => entityKey === action.entityKey)
            if (!entityValues) {
                throw new Error(`Could not find entity values entry for entity named: ${action.entityKey}`)
            }

            const newValue: EntityValue = {
                value: '',
                isMultiline: false,
            }

            entityValues[1].values.push(newValue)
            return
        }
        case ActionTypes.RemoveEntityValue: {
            const entityStateIndex = state.entitiesValues.findIndex(([entityKey]) => entityKey === action.entityKey)
            if (entityStateIndex < 0) {
                throw new Error(`Entity state not found for entity named: ${action.entityKey} on callback results: ${state.name}`)
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
            const entityState = state.entitiesValues.find(([entityKey]) => entityKey === action.entityKey)
            if (!entityState) {
                throw new Error(`Entity state not found for entity named: ${action.entityKey} on callback results: ${state.name}`)
            }

            entityState[1].clear = action.cleared
            return
        }
        case ActionTypes.ChangeName: {
            state.name = action.name
            return
        }
        case ActionTypes.ChangeValue: {
            const entityState = state.entitiesValues.find(([entityKey]) => entityKey === action.entityKey)
            if (!entityState) {
                throw new Error(`Entity state not found for entity named: ${action.entityKey} on callback results: ${state.name}`)
            }

            entityState[1].values[action.valueIndex].value = action.value
            return
        }
        case ActionTypes.ChangeReturnValue: {
            state.returnValue = action.returnValue
            return
        }
        case ActionTypes.OpenModal: {
            return initializeState(action.entities, action.mockResult)
        }
        case ActionTypes.ToggleViewCode: {
            state.viewCode = !state.viewCode
            return
        }
        default: {
            console.warn(`You dispatched an action of type: ${(action as any).type} which was not handled. This is likely an error.`)
            return
        }
    }
})

const initializeState = (entities: CLM.EntityBase[], callbackResult: MockResultWithSource | undefined): State => {
    const source = callbackResult?.source ?? MockResultSource.MODEL
    const name = callbackResult?.mockResult.name ?? ''
    const entitiesValues = Object.entries(callbackResult?.mockResult.entityValues ?? [])
        .map<[string, EntityValues]>(([entityKey, entityValue]) => {
            const entity = entities.find(e => source === MockResultSource.CODE
                ? entityKey === e.entityName
                : entityKey === e.entityId)

            let clear = false
            if (entityValue === null) {
                clear = true
            }

            let errorType = EntityValuesError.NONE
            if (entityValue !== null) {
                if (entity?.isMultivalue === true
                    && Array.isArray(entityValue) === false) {
                    errorType = EntityValuesError.SINGLE_VALUE_ASSIGNED_TO_MULTI_VALUE
                } else if (entity?.isMultivalue !== true
                    && Array.isArray(entityValue) === true) {
                    errorType = EntityValuesError.MULTI_VALUE_ASSIGNED_TO_SINGLE_VALUE
                }
            }

            // Entity might be single value or multi value, convert all to array for consistent processing
            const entityValuesArray = Array.isArray(entityValue) ? entityValue : [entityValue]
            const entityValuesForDisplay = entityValuesArray
                // Convert all values to strings
                .map<string>(value => {
                    if (value === null) {
                        return ''
                    }

                    if (callbackResult?.source === MockResultSource.CODE) {
                        return JSON.stringify(value, null, '  ')
                    }

                    if (callbackResult?.source === MockResultSource.MODEL) {
                        return value as string
                    }

                    return JSON.stringify(value, null, '  ')
                })
                // Enable multiline if the value is multiline
                // Likely used to represent readable JSON objects, but could be multiline strings
                .map<EntityValue>(value => {
                    const isMultiline = value.includes('\n')

                    return {
                        value,
                        isMultiline,
                    }
                })

            return [
                entityKey,
                {
                    values: entityValuesForDisplay,
                    clear,
                    errorType,
                }
            ]
        })

    const returnValueString = callbackResult?.mockResult.returnValue
        ? JSON.stringify(callbackResult.mockResult.returnValue, null, '  ').slice(1, -1)
        : ''
    const isReturnValueMultiline = returnValueString?.includes('\n') ?? false

    return {
        source,
        name,
        entitiesValues,
        returnValue: returnValueString,
        isReturnValueMultiline,
        viewCode: false,
    }
}

const convertStateToMockResult = (state: State, entities: CLM.EntityBase[], options: { useEntityNameAsKey?: boolean } = {}): CLM.CallbackResult => {
    const entityValues = state.entitiesValues.reduce((eValues, [entityKey, entityValues]) => {

        const entity = entities.find(e => state.source === MockResultSource.CODE
            ? e.entityName === entityKey
            : e.entityId === entityKey)

        if (entity) {
            const nonEmptyValues = entityValues.values
                .filter(v => v.value !== '')
                .map(v => v.value)

            const isValueRemoved = entityValues.clear
                || nonEmptyValues.length === 0

            const entityKey = options.useEntityNameAsKey === true
                ? entity.entityName
                : entity.entityId

            // If entity should be cleared set to null
            // If entity is multi value, use array, otherwise use first value
            eValues[entityKey] = isValueRemoved
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

    const [selectedEntityOption, setSelectedEntityOption] = React.useState<OF.IDropdownOption | undefined>()
    const [state, dispatch] = React.useReducer(reducer, props.callbackResult, callbackResult => initializeState(props.entities, callbackResult))
    // Every time the modal opens, reset the state
    React.useEffect(() => {
        if (props.isOpen) {
            dispatch({
                type: ActionTypes.OpenModal,
                entities: props.entities,
                mockResult: props.callbackResult,
            })
        }
    }, [props.isOpen])

    // When new mock entity value is added, adjust selected entity dropdown for addition of next entity
    const existingEntityKeysWithValue = state.entitiesValues.map(([entityKey]) => entityKey)
    const availableEntityOptions = entityDropdownOptions.filter(eo => {
        const entity = eo.data as CLM.EntityBase
        const entityKeyValue = state.source === MockResultSource.CODE
            ? entity.entityName
            : entity.entityId
        return existingEntityKeysWithValue.includes(entityKeyValue) === false
    })

    React.useEffect(() => {
        const firstOption: OF.IDropdownOption | undefined = availableEntityOptions[0]
        setSelectedEntityOption(firstOption)
    }, [state.entitiesValues.length])

    const onChangeSelectedEntity = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number): void => {
        if (!option) {
            return
        }

        setSelectedEntityOption(option)
    }

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

    const onChangeClear = (entityKey: string, cleared: boolean): void => {
        dispatch({
            type: ActionTypes.ToggleClear,
            entityKey,
            cleared,
        })
    }

    const acceptText = props.isEditing
        ? Util.formatMessageId(props.intl, FM.BUTTON_SAVE)
        : Util.formatMessageId(props.intl, FM.BUTTON_OK)

    const onClickAddEntityValue = (entityKey: string) => {
        dispatch({
            type: ActionTypes.AddEntityValue,
            entityKey,
        })
    }

    const onClickAddEntity = (entity: CLM.EntityBase) => {
        dispatch({
            type: ActionTypes.AddEntity,
            entity,
        })
    }

    const onClickDeleteEntityValue = (entityKey: string, valueIndex: number): void => {
        dispatch({
            type: ActionTypes.RemoveEntityValue,
            entityKey,
            valueIndex,
        })
    }

    const onChangeValue = (entityKey: string, valueIndex: number, value: string): void => {
        dispatch({
            type: ActionTypes.ChangeValue,
            entityKey,
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

        // Validate name
        if (state.name === ''
            || doesNameMatchExistingCallback
        ) {
            return false
        }

        // Validate values
        if (state.entitiesValues.length === 0
            && state.returnValue === '') {
            return false
        }

        return true
    }

    const onChangeViewToggle = (event: React.MouseEvent<HTMLElement, MouseEvent>, checked?: boolean | undefined): void => {
        if (typeof checked === 'boolean') {
            dispatch({
                type: ActionTypes.ToggleViewCode,
            })
        }
    }

    const isStateValid = isResultValid(state)

    return <OF.Modal
        isOpen={props.isOpen}
        containerClassName="cl-modal cl-modal--medium"
    >
        <div className="cl-modal_header" data-testid="callback-result-modal-title">
            <span className={OF.FontClassNames.xxLarge}>
                {props.isEditing
                    ? props.callbackResult
                        ? 'Edit'
                        : 'Create New'
                    : 'View'} Mocked Callback Result
            </span>
        </div>
        <div className="cl-modal_body">
            {state.viewCode
                ? <pre className="cl-callback-result-modal__code" data-testid="callback-result-modal__code">
                    {props.callbackResult?.source === MockResultSource.CODE
                        ? JSON.stringify(props.callbackResult?.mockResult, null, '  ')
                        : JSON.stringify(convertStateToMockResult(state, props.entities, { useEntityNameAsKey: true }), null, '  ')}
                </pre>
                : <div className="cl-callback-result-modal__fields">
                    <OF.TextField
                        label={"Name"}
                        readOnly={props.isEditing === false}
                        value={state.name}
                        onChange={onChangeName}
                        autoComplete={"off"}
                        onGetErrorMessage={onGetNameErrorMessage}
                        validateOnLoad={false}
                        data-testid="callback-result-modal-input-name"
                    />
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
                                {state.entitiesValues.map(([entityKey, entityValues], entityIndex) => {
                                    // const previousEntityValuesNames = state.entitiesValues.slice(0, entityIndex).map(entry => entry[0])
                                    // const availableEntityDropdownOptions = entityDropdownOptions.filter(e => e.text === noneOption.text || previousEntityValuesNames.includes(e.text) === false)
                                    const entity = props.entities.find(e => state.source === MockResultSource.CODE
                                        ? e.entityName === entityKey
                                        : e.entityId === entityKey)

                                    const isMultiValue = entity?.isMultivalue === true

                                    let values
                                    if (entityValues === null) {
                                        values = [<div className="cl-callback-result-modal__entity-values__entity-removed">Deleted</div>]
                                    }
                                    else {
                                        values = entityValues.values.map((valueObject, valueIndex) => {
                                            return <div
                                                className="cl-callback-result-modal__entity-value"
                                                key={`${entityKey}-value-${valueIndex}`}
                                            >
                                                <OF.TextField
                                                    readOnly={props.isEditing === false}
                                                    multiline={valueObject.isMultiline}
                                                    value={valueObject.value}
                                                    disabled={entityValues.clear}
                                                    onChange={(e, value) => value !== undefined && onChangeValue(entityKey, valueIndex, value)}
                                                    autoComplete={"off"}
                                                    data-testid="callback-result-modal-input-entity-value"
                                                />
                                                <OF.IconButton
                                                    data-testid={`callback-result-modal-button-delete-value`}
                                                    disabled={props.isEditing === false || entityValues.clear}
                                                    className={`cl-button-delete`}
                                                    iconProps={{ iconName: 'Delete' }}
                                                    onClick={() => onClickDeleteEntityValue(entityKey, valueIndex)}
                                                    ariaDescription="Delete Entity Value"
                                                />
                                            </div>
                                        })
                                    }

                                    if (isMultiValue) {
                                        const newValueButton = <div key={`${entityKey}-add-value-button`}>
                                            <OF.DefaultButton
                                                onClick={() => onClickAddEntityValue(entityKey)}
                                                disabled={props.isEditing === false || entityValues.clear}
                                                text={"Add Value"}
                                                iconProps={{ iconName: 'Add' }}
                                                data-testid="callback-result-modal-button-add-value"
                                            />
                                        </div>

                                        values.push(newValueButton)
                                    }

                                    if (entityValues.errorType !== EntityValuesError.NONE) {
                                        let message = 'Unknown'
                                        if (entityValues.errorType === EntityValuesError.MULTI_VALUE_ASSIGNED_TO_SINGLE_VALUE) {
                                            message = 'Multiple values assigned to entity that can only have single value'
                                        } else if (entityValues.errorType === EntityValuesError.SINGLE_VALUE_ASSIGNED_TO_MULTI_VALUE) {
                                            message = 'Non-array value assigned to entity that is multi value'
                                        }

                                        const entityValueError = <div key={`entity-value-error`}
                                            className="cl-callback-result-modal__entity-value__error"
                                            data-testid="callback-result-modal-entity-value-error">
                                            Error: {message} <HelpIcon tipType={ToolTips.TipType.MOCK_RESULT_INVALID_VALUE} />
                                        </div>

                                        values.push(entityValueError)
                                    }

                                    return <React.Fragment key={`${entityKey}-${entityIndex}`}>
                                        <div className="cl-callback-result-modal__entity-name"
                                            data-testid="callback-result-modal-entity-name">
                                            {entity?.entityName ?? entityKey}
                                            {entity === undefined
                                                && <div className="cl-callback-result-modal__entity-name__error"
                                                    data-testid="callback-result-modal-entity-name-error">
                                                    Entity does not exist on model <HelpIcon tipType={ToolTips.TipType.MOCK_RESULT_MISSING_ENTITY} />
                                                </div>}
                                        </div>
                                        <div className="cl-callback-result-modal__entity-values__list"
                                            data-testid="callback-result-modal-entity-values-list">{values}</div>
                                        <OF.Checkbox
                                            label={"Clear"}
                                            disabled={props.isEditing === false}
                                            checked={entityValues.clear}
                                            onChange={(e, cleared) => cleared !== undefined && onChangeClear(entityKey, cleared)}
                                            data-testid="callback-result-modal-button-clear"
                                        />
                                    </React.Fragment>
                                })}
                            </div>
                        }
                    </div>

                    {props.isEditing && <div className="cl-callback-result-modal__new-entity-section">
                        <OF.Dropdown
                            data-testid="callback-result-modal-dropdown-entity"
                            selectedKey={selectedEntityOption?.key}
                            options={availableEntityOptions}
                            onChange={onChangeSelectedEntity}
                            disabled={selectedEntityOption === undefined}
                        />

                        <OF.DefaultButton
                            onClick={() => selectedEntityOption && onClickAddEntity(selectedEntityOption.data)}
                            disabled={selectedEntityOption === undefined}
                            text={"Add Mock Entity Value"}
                            iconProps={{ iconName: 'Add' }}
                            className="cl-callback-result-modal__new-entity-button"
                            data-testid="callback-result-modal-button-add-entity"
                        />
                    </div>}

                    <div>
                        <OF.Label>Return Value</OF.Label>
                        <OF.TextField
                            readOnly={props.isEditing === false}
                            multiline={state.isReturnValueMultiline}
                            value={state.returnValue}
                            onChange={onChangeReturnValue}
                            autoComplete={"off"}
                            data-testid="callback-result-modal-return-value"
                        />
                    </div>
                </div>
            }
        </div>
        <div className="cl-modal_footer cl-modal-buttons cl-modal_footer--border">
            <div className="cl-modal-buttons_secondary">
                <OF.Toggle
                    label="View"
                    onText="Code"
                    offText="Visual"
                    checked={state.viewCode}
                    onChange={onChangeViewToggle}
                    inlineLabel={true}
                    data-testid="callback-result-modal-toggle-view"
                />
            </div>
            <div className="cl-modal-buttons_primary">
                <OF.PrimaryButton
                    data-testid="callback-result-modal-button-ok"
                    onClick={onClickSubmit}
                    disabled={isStateValid === false}
                    ariaDescription={acceptText}
                    text={acceptText}
                    iconProps={{ iconName: 'Accept' }}
                />
                <OF.DefaultButton
                    data-testid="callback-result-modal-button-cancel"
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