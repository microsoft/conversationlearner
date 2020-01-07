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

    return <OF.Modal
        isOpen={props.isOpen}
        containerClassName="cl-modal cl-modal--medium"
    >
        <div className="cl-modal_header">
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
                        <OF.Label className="ms-Label--tight cl-label">
                            <FormattedMessageId id={FM.CALLBACK_RESULT_MODAL_ENTITY_VALUES} />
                            <HelpIcon tipType={ToolTips.TipType.CALLBACK_RESULT} />
                        </OF.Label>
                    </div>

                    {callbackResultEntityValueEntries.length === 0
                        ? <p>No Entity Values Set</p>
                        : callbackResultEntityValueEntries.map(([entityName, entityValue]) => {
                            const [firstValue, ...rest] = Array.isArray(entityValue) ? entityValue : [entityValue]
                                // TODO: Show null or undefined by string
                                .filter(Util.notNullOrUndefined)
                                .map(v => typeof v === 'object'
                                    ? JSON.stringify(v, null, '  ')
                                    : v.toString())
                                .map(v => {
                                    const isMultiline = v.includes('/n')
                                    return {
                                        value: v,
                                        isMultiline,
                                    }
                                })

                            return <div className="cl-callback-result-modal__entity-values">
                                <OF.TextField
                                    label={entityName}
                                    readOnly={true}
                                    value={`${firstValue}`}
                                />
                                {rest.map(value => {
                                    return <OF.TextField
                                        readOnly={true}
                                        value={`${value}`}
                                    />
                                })}
                            </div>
                        })}
                </div>
            </div>
        </div>
        <div className="cl-modal_footer cl-modal-buttons cl-modal_footer--border">
            <div className="cl-modal-buttons_secondary">
            </div>
            <div className="cl-modal-buttons_primary">
                <OF.PrimaryButton
                    data-testid="teach-session-ok-button"
                    onClick={onClickSubmit}
                    disabled={isSaveDisabled}
                    ariaDescription={Util.formatMessageId(props.intl, FM.BUTTON_OK)}
                    text={Util.formatMessageId(props.intl, FM.BUTTON_OK)}
                    iconProps={{ iconName: 'Accept' }}
                />
                <OF.DefaultButton
                    data-testid="teach-session-cancel-button"
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