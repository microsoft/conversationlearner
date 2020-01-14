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
    OpenModal,
}

type Action = {
    type: ActionTypes.ChangeName
    name: string
} | {
    type: ActionTypes.AddEntity
} | {
    type: ActionTypes.AddEntityValue
} | {
    type: ActionTypes.OpenModal,
    mockResult: CLM.CallbackResult | undefined
}

const reducer: React.Reducer<State, Action> = (state, action) => {
    switch (action.type) {
        case ActionTypes.OpenModal: {
            state = initializeState(action.mockResult)
            break
        }
    }

    return state
}

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

const Component: React.FC<Props> = (props) => {
    const [state, dispatch] = React.useReducer(reducer, props.callbackResult, initializeState)
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

    return <OF.Modal
        isOpen={props.isOpen}
        containerClassName="cl-modal cl-modal--medium"
    >
        <div className="cl-modal_header" data-testid="callback-result-viewer-title">
            <span className={OF.FontClassNames.xxLarge}>
                <FormattedMessageId id={FM.CALLBACK_RESULT_MODAL_TITLE} />
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
                            {state.entitiesValues.map(([entityName, entityValues], entityValueEntryIndex) => {
                                let values
                                if (entityValues === null) {
                                    values = <div className="cl-callback-result-modal__entity-values__entity-removed">Deleted</div>
                                }
                                else {
                                    values = entityValues.values.map((valueObject, i) =>
                                        <OF.TextField
                                            key={`${entityName}-${i}`}
                                            readOnly={props.isEditing === false}
                                            multiline={valueObject.isMultiline}
                                            value={valueObject.value}
                                        />
                                    )
                                }

                                return <React.Fragment key={entityValueEntryIndex}>
                                    <div><OF.Label>{entityName}</OF.Label></div>
                                    <div className="cl-callback-result-modal__entity-values__list">{values}</div>
                                </React.Fragment>
                            })}
                        </div>
                    }

                    {state.returnValue &&
                        <div className="cl-callback-result-modal__return-value">
                            <OF.Label>Return Value</OF.Label>
                            <OF.TextField
                                readOnly={props.isEditing === false}
                                multiline={state.isReturnValueMultiline}
                                value={state.returnValue}
                            />
                        </div>}
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
                    ariaDescription={Util.formatMessageId(props.intl, FM.BUTTON_OK)}
                    text={Util.formatMessageId(props.intl, FM.BUTTON_OK)}
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