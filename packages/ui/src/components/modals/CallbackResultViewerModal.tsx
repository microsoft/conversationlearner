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
    isOpen: boolean
    callbackResult: CLM.CallbackResult
    onClickSubmit: (callbackResult: CLM.CallbackResult) => void
    onClickCancel: () => void
}

type Props = ReceivedProps & InjectedIntlProps

const Component: React.FC<Props> = (props) => {
    const onClickSubmit = (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement | HTMLDivElement | OF.BaseButton | OF.Button | HTMLSpanElement, MouseEvent>) => {
        props.onClickSubmit(props.callbackResult)
    }
    const onClickCancel = props.onClickCancel
    const isSaveDisabled = false
    const callbackResultEntityValueEntries = Object.entries(props.callbackResult.entityValues)
    const returnValueString = JSON.stringify(props.callbackResult.returnValue, null, '  ')
    const isReturnValueMultiline = returnValueString.includes('\n')

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
                        readOnly={true}
                        value={props.callbackResult.name}
                    />
                </div>
                <div>
                    <div className={OF.FontClassNames.mediumPlus}>
                        <OF.Label className="cl-label">
                            <FormattedMessageId id={FM.CALLBACK_RESULT_MODAL_ENTITY_VALUES} />
                            <HelpIcon tipType={ToolTips.TipType.MOCK_RESULT} />
                        </OF.Label>
                    </div>

                    {callbackResultEntityValueEntries.length === 0
                        ? <p>No Entity Values Set</p>
                        : <div className="cl-callback-result-modal__entity-values">
                            {callbackResultEntityValueEntries.map(([entityName, entityValue], entityValueEntryIndex) => {
                                let values
                                if (entityValue === null) {
                                    values = <div className="cl-callback-result-modal__entity-values__entity-removed">Deleted</div>
                                }
                                else {
                                    // Entity might be single value or multi value, convert all to array for consistent processing
                                    const entityValuesArray = Array.isArray(entityValue) ? entityValue : [entityValue]
                                    const entityValuesForDisplay = entityValuesArray
                                        .map(value => JSON.stringify(value, null, '  '))
                                        // Enable multiline if the value is multiline
                                        // Likely used to represent readable JSON objects, but could be multiline strings
                                        .map(value => {
                                            const isMultiline = value.includes('\n')

                                            return {
                                                value,
                                                isMultiline,
                                            }
                                        })

                                    values = entityValuesForDisplay.map((valueObject, i) =>
                                        <OF.TextField
                                            key={`${entityName}-${i}`}
                                            readOnly={true}
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

                    {returnValueString &&
                        <div className="cl-callback-result-modal__return-value">
                            <OF.Label>Return Value</OF.Label>
                            <OF.TextField
                                readOnly={true}
                                multiline={isReturnValueMultiline}
                                value={returnValueString}
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
                    disabled={isSaveDisabled}
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