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

type ReceivedProps = {
    entities: CLM.EntityBase[]
    isOpen: boolean
    isEditing: boolean
    callbackResult: CLM.CallbackResult | undefined
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
    returnValue: string | undefined
    isReturnValueMultiline: boolean
    isSaveDisabled: boolean
}

enum ActionTypes {
    AddEntity,
    AddEntityValue,
    ChangeName,
    ChangeEntity,
    OpenModal,
    ToggleClear,
}

type Action = {
    type: ActionTypes.ChangeName
    name: string
} | {
    type: ActionTypes.AddEntity
} | {
    type: ActionTypes.AddEntityValue
    entityName: string
} | {
    type: ActionTypes.OpenModal
    mockResult: CLM.CallbackResult | undefined
} | {
    type: ActionTypes.ToggleClear
    cleared: boolean
} | {
    type: ActionTypes.ChangeEntity
    entityName: string
}

const reducer: React.Reducer<State, Action> = produce((state: State, action: Action) => {
    switch (action.type) {
        case ActionTypes.AddEntity: {
            // Add new empty value the user can fill in. Currently editable values are strings
            const newValue: EntityValue = { value: '', isMultiline: false }
            const newEntity: [string, EntityValues] = ['', { values: [newValue], clear: false }]
            state.entitiesValues.push(newEntity)
            break
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
            break
        }
        case ActionTypes.ChangeName: {
            state.name = action.name
            break
        }
        case ActionTypes.OpenModal: {
            state = initializeState(action.mockResult)
            break
        }
        default: {
            console.warn(`You dispatched an action of type: ${action.type} which was not handled. This is likely an error.`)
        }
    }

    return state
})

const initializeState = (callbackResult: CLM.CallbackResult | undefined): State => {
    const name = callbackResult?.name ?? ''
    const entitiesValues = Object.entries(callbackResult?.entityValues ?? [])
        .map<[string, EntityValues]>(([entityName, entityValue]) => {
            // Entity might be single value or multi value, convert all to array for consistent processing
            const entityValuesArray = Array.isArray(entityValue) ? entityValue : [entityValue]
            const entityValuesForDisplay = entityValuesArray
                .map(value => JSON.stringify(value, null, '  '))
                // Enable multiline if the value is multiline
                // Likely used to represent readable JSON objects, but could be multiline strings
                .map<EntityValue>(value => {
                    const isMultiline = value.includes('\n')

                    return {
                        value,
                        isMultiline,
                    }
                })

            return [entityName, { values: entityValuesForDisplay, clear: false }]
        })

    const returnValueString = callbackResult
        ? JSON.stringify(callbackResult.returnValue, null, '  ')
        : undefined
    const isReturnValueMultiline = returnValueString?.includes('\n') ?? false

    return {
        name,
        entitiesValues,
        returnValue: returnValueString,
        isReturnValueMultiline,
        isSaveDisabled: false,
    }
}

const noneOption: OF.IDropdownOption = {
    key: 'none',
    text: 'None',
}

const Component: React.FC<Props> = (props) => {
    // If mock result is sourced from model, allow editing
    const entityDropdownOptions = React.useMemo(() => {
        const entityOptions = props.entities
            .map<OF.IDropdownOption>(e => {
                return {
                    key: e.entityId,
                    text: e.entityName,
                    data: e,
                }
            })

        return [
            noneOption,
            ...entityOptions,
        ]
    }, [props.entities.length])

    const [state, dispatch] = React.useReducer(reducer, props.callbackResult, initializeState)
    // Every time the modal opens, reset the state
    React.useEffect(() => {
        if (props.isOpen) {
            console.debug(`Modal opened`)
            dispatch({
                type: ActionTypes.OpenModal,
                mockResult: props.callbackResult,
            })
        }
    }, [props.isOpen])

    const onClickSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (props.callbackResult) {
            props.onClickSubmit(props.callbackResult)
        }
    }
    const onClickCancel = props.onClickCancel

    const onChangeName = (event: React.FormEvent<HTMLInputElement>, newValue?: string | undefined): void => {
        if (!newValue) {
            return
        }

        dispatch({
            type: ActionTypes.ChangeName,
            name: newValue,
        })
    }

    const onChangeClear = (ev?: React.FormEvent<HTMLElement | HTMLInputElement> | undefined, checked?: boolean | undefined): void => {
        if (checked === undefined) {
            return
        }

        dispatch({
            type: ActionTypes.ToggleClear,
            cleared: checked,
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

    const onChangeEntity = (event: React.FormEvent<HTMLDivElement>, option?: OF.IDropdownOption | undefined, index?: number | undefined): void => {
        if (!option) {
            return
        }

        dispatch({
            type: ActionTypes.ChangeEntity,
            entityName: option.data.entityName,
        })
    }

    const onClickNewEntity = () => {
        dispatch({
            type: ActionTypes.AddEntity,
        })
    }

    const onClickDeleteEntityValue = (entityValueIndex: number): void => {
        console.log(`Delete Value`, entityValueIndex)
    }

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
            <div>
                <div className="cl-callback-result-modal__name">
                    <OF.TextField
                        label={"Name"}
                        className={OF.FontClassNames.mediumPlus}
                        readOnly={props.isEditing === false}
                        value={state.name}
                        onChange={onChangeName}
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
                        ? <p>No Entity Values Set</p>
                        : <div className="cl-callback-result-modal__entity-values">
                            {state.entitiesValues.map(([entityName, entityValues], entityIndex) => {
                                const previousEntityValuesNames = state.entitiesValues.slice(0, entityIndex).map(entry => entry[0])
                                const availableEntityDropdownOptions = entityDropdownOptions.filter(e => previousEntityValuesNames.includes(e.text) === false)
                                const entityDropdownOption = entityDropdownOptions.find(e => e.data?.entityName === entityName)
                                const selectedEntityOption = entityDropdownOption ?? noneOption
                                const isMultiValue = selectedEntityOption.data?.isMultivalue === true

                                let values
                                if (entityValues === null) {
                                    values = [<div className="cl-callback-result-modal__entity-values__entity-removed">Deleted</div>]
                                }
                                else {
                                    values = entityValues.values.map((valueObject, valueIndex) =>
                                        <div className="cl-callback-result-modal__entity-value">
                                            <OF.TextField
                                                key={`${entityName}-${valueIndex}`}
                                                readOnly={props.isEditing === false}
                                                multiline={valueObject.isMultiline}
                                                value={valueObject.value}
                                            />
                                            <OF.IconButton
                                                data-testid="entity-enum-value-button-delete"
                                                className={`cl-inputWithButton-button`}
                                                iconProps={{ iconName: 'Delete' }}
                                                onClick={() => onClickDeleteEntityValue(valueIndex)}
                                                ariaDescription="Delete Entity Value"
                                            />
                                        </div>
                                    )
                                }

                                if (isMultiValue) {
                                    const newValueButton = <div>
                                        <OF.DefaultButton
                                            onClick={() => onClickNewEntityValue(entityName)}
                                            text={"New Value"}
                                            iconProps={{ iconName: 'Add' }}
                                            data-testid="callback-result-modal-button-new-value"
                                        />
                                    </div>

                                    values.push(newValueButton)
                                }

                                return <React.Fragment key={entityName}>
                                    <OF.Dropdown
                                        data-testid="condition-creator-modal-dropdown-entity"
                                        selectedKey={selectedEntityOption.key}
                                        options={availableEntityDropdownOptions}
                                        onChange={onChangeEntity}
                                    />
                                    <div className="cl-callback-result-modal__entity-values__list">{values}</div>
                                    <OF.Checkbox
                                        label={"Clear"}
                                        checked={entityValues.clear}
                                        onChange={onChangeClear}
                                    />
                                </React.Fragment>
                            })}
                        </div>
                    }
                    {props.isEditing && <div>
                        <OF.DefaultButton
                            onClick={onClickNewEntity}
                            text={"New Entity"}
                            iconProps={{ iconName: 'Add' }}
                            data-testid="callback-result-modal-button-new-entity"
                        />
                    </div>}

                    <div className="cl-callback-result-modal__return-value">
                        <OF.Label>Return Value</OF.Label>
                        <OF.TextField
                            readOnly={props.isEditing === false}
                            multiline={state.isReturnValueMultiline}
                            value={state.returnValue}
                        />
                    </div>
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
                    disabled={state.isSaveDisabled}
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

export default injectIntl(Component)