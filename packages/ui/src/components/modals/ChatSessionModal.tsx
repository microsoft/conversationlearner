/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as BotChat from '@conversationlearner/webchat'
import * as Util from '../../Utils/util'
import ConfirmCancelModal from './ConfirmCancelModal'
import actions from '../../actions'
import Webchat, { renderActivity } from '../Webchat'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { EditDialogType } from '../../types/const'
import { State } from '../../types'
import { AppBase } from '@conversationlearner/models'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { autobind } from 'core-decorators'

interface ComponentState {
    isSessionEndModalOpen: boolean
    hasChatActivity: boolean
}
class SessionWindow extends React.Component<Props, ComponentState> {

    constructor(props: Props) {
        super(props)
        this.state = {
            isSessionEndModalOpen: false,
            hasChatActivity: false
        }
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {
        if (this.props.open && !newProps.open) {
            // Reset
            this.setState({ hasChatActivity: false })
        }
    }
    @autobind
    async onClickDone() {
        if (this.props.chatSession.current !== null) {
            await (this.props.deleteChatSessionThunkAsync(this.props.chatSession.current, this.props.app, this.props.editingPackageId) as any as Promise<void>)
        }

        this.props.onClose()
    }

    @autobind
    async onClickAbandon() {
        if (this.props.chatSession.current !== null) {
            const deleteAssociatedLogDialog = this.state.hasChatActivity
            await (this.props.deleteChatSessionThunkAsync(this.props.chatSession.current, this.props.app, this.props.editingPackageId, deleteAssociatedLogDialog) as any as Promise<void>)
        }

        this.props.onClose()
    }

    // Force timeout of the session
    @autobind
    onClickExpire() {
        if (this.props.chatSession.current !== null) {
            this.props.editChatSessionExpireThunkAsync(this.props.app.appId, this.props.chatSession.current.sessionId)
            this.setState({ isSessionEndModalOpen: true })
        }
    }

    renderActivity(activityProps: BotChat.WrappedActivityProps, children: React.ReactNode, setRef: (div: HTMLDivElement | null) => void): JSX.Element {
        return renderActivity(activityProps, children, setRef, null, EditDialogType.LOG_ORIGINAL, false)
    }

    render() {
        const { intl } = this.props
        return (
            <OF.Modal
                isOpen={this.props.open && this.props.error == null}
                isBlocking={true}
                containerClassName="cl-modal cl-modal--narrow cl-modal--log"
            >
                <div className="cl-modal_body">
                    <div className="cl-sessionmodal">
                        <div className="cl-sessionmodal-title">
                            <div className={`cl-dialog-title cl-dialog-title--log ${OF.FontClassNames.xxLarge}`}>
                                <OF.Icon iconName="UserFollowed" />Log Dialog
                            </div>
                        </div>
                        <div className="cl-chatmodal_webchat" data-testid="chat-session-modal-webchat">
                            <Webchat
                                isOpen={this.props.open && this.props.error == null}
                                app={this.props.app}
                                history={[]}
                                onPostActivity={() => {
                                    if (!this.state.hasChatActivity) {
                                        this.setState({ hasChatActivity: true })
                                    }
                                }}
                                onSelectActivity={() => { }}
                                hideInput={false}
                                focusInput={true}
                                renderActivity={(props, children, setRef) => this.renderActivity(props, children, setRef)}
                            />
                        </div>
                    </div>
                </div>
                <div className="cl-modal_footer cl-modal_footer--border">
                    <div className="cl-modal-buttons">
                        <div className="cl-modal-buttons_secondary" />
                        <div className="cl-modal-buttons_primary">
                            <OF.PrimaryButton
                                data-testid="chat-session-modal-done-testing-button"
                                onClick={this.onClickDone}
                                ariaDescription={Util.formatMessageId(intl, FM.CHATSESSIONMODAL_PRIMARYBUTTON_ARIADESCRIPTION)}
                                text={Util.formatMessageId(intl, FM.CHATSESSIONMODAL_PRIMARYBUTTON_TEXT)}
                                iconProps={{ iconName: 'Accept' }}
                            />
                            <OF.DefaultButton
                                data-testid="chat-session-modal-session-timeout-button"
                                onClick={this.onClickExpire}
                                ariaDescription={Util.formatMessageId(intl, FM.CHATSESSIONMODAL_EXPIREBUTTON_ARIADESCRIPTION)}
                                text={Util.formatMessageId(intl, FM.CHATSESSIONMODAL_EXPIREBUTTON_TEXT)}
                            />
                            <OF.DefaultButton
                                data-testid="edit-dialog-modal-abandon-delete-button"
                                className="cl-button-delete"
                                onClick={this.onClickAbandon}
                                ariaDescription={Util.formatMessageId(intl, FM.BUTTON_ABANDON)}
                                text={Util.formatMessageId(intl, FM.BUTTON_ABANDON)}
                                iconProps={{ iconName: 'Delete' }}
                            />
                        </div>
                    </div>
                </div>
                <ConfirmCancelModal
                    open={this.state.isSessionEndModalOpen}
                    onOk={() => this.setState({ isSessionEndModalOpen: false })}
                    title={Util.formatMessageId(intl, FM.CHATSESSIONMODAL_TIMEOUT_TITLE)}
                />
            </OF.Modal>
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        deleteChatSessionThunkAsync: actions.chat.deleteChatSessionThunkAsync,
        editChatSessionExpireThunkAsync: actions.chat.editChatSessionExpireThunkAsync,
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render ChatSessionModal but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        chatSession: state.chatSessions,
        error: state.error.title
    }
}

export interface ReceivedProps {
    open: boolean
    onClose: () => void
    app: AppBase,
    editingPackageId: string
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(SessionWindow))
