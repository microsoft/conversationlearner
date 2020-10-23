/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../../Utils/util'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { autobind } from 'core-decorators'
import { FeatureStrings } from '../../types/const'

interface ComponentState {
    value: string
}

class TextboxRestrictableModal extends React.Component<Props, ComponentState> {
    state: ComponentState = {
        value: '',
    }

    @autobind
    onChangeText(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) {
        this.setState({
            value: text
        })
    }

    isContinueDisabled() {
        if (Util.isFeatureEnabled(this.props.settings.features, FeatureStrings.CCI) && this.state.value.indexOf("*") >= 0) {
            return false;
        }
        return (this.props.matchedText != null) && this.props.matchedText !== this.state.value
    }

    @autobind
    onClickOK() {
        this.setState({
            value: ""
        })
        if (Util.isFeatureEnabled(this.props.settings.features, FeatureStrings.CCI) && this.state.value.indexOf("*") >= 0) {
            this.props.onOK(this.state.value)
        }
        this.props.onOK()
    }

    @autobind
    onClickCancel() {
        this.setState({
            value: ""
        })
        this.props.onCancel()
    }

    @autobind
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        if ((event.key === 'Enter') && !this.isContinueDisabled()) {
            this.onClickOK()
        }
    }

    render() {
        return (
            <OF.Modal
                isOpen={this.props.open}
                onDismiss={() => this.onClickCancel()}
                isBlocking={false}
                containerClassName='cl-modal cl-modal--small'
            >
                <div className='cl-modal_header'>
                    <span className={OF.FontClassNames.mediumPlus}>
                        {this.props.message}
                    </span>
                </div>
                <div className="cl-fieldset">
                    <OF.TextField
                        data-testid="user-input-modal-new-message-input"
                        onChange={this.onChangeText}
                        placeholder={this.props.placeholder}
                        onKeyDown={key => this.onKeyDown(key)}
                        value={this.state.value}
                    />
                </div>
                <div className='cl-modal_footer'>
                    <div className="cl-modal-buttons">
                        <div className="cl-modal-buttons_secondary" />
                        <div className="cl-modal-buttons_primary">

                            <OF.PrimaryButton
                                disabled={this.isContinueDisabled()}
                                data-testid="app-modal-continue-button"
                                onClick={this.onClickOK}
                                ariaDescription={this.props.buttonOk}
                                text={this.props.buttonOk}
                            />
                            <OF.DefaultButton
                                onClick={this.onClickCancel}
                                ariaDescription={this.props.buttonCancel}
                                text={this.props.buttonCancel}
                            />
                        </div>
                    </div>
                </div>
            </OF.Modal>
        )
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    return {
        apps: state.apps.all,
        settings: state.settings,
    }
}

export interface ReceivedProps {
    open: boolean
    message: JSX.Element
    placeholder: string
    matchedText: any
    buttonOk: string
    buttonCancel: string
    onOK: (pattern?: string) => void
    onCancel: () => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(TextboxRestrictableModal))