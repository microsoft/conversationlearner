/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import { bindActionCreators } from 'redux'
import { State } from '../types'
import { connect } from 'react-redux'
import * as ToolTip from './ToolTips/ToolTips'
import * as OF from 'office-ui-fabric-react'
import { setTipType } from '../actions/displayActions'
import FormattedMessageId from '../components/FormattedMessageId'
import { FM } from '../react-intl-messages'

class HelpPanel extends React.Component<Props> {
    onDismiss(): void {
        this.props.setTipType(ToolTip.TipType.NONE)
    }

    render() {
        return (
            <OF.Panel
                isOpen={this.props.tipType !== ToolTip.TipType.NONE}
                isLightDismiss={true}
                onDismiss={() => { this.onDismiss() }}
                type={OF.PanelType.medium}
                customWidth="400px"
                closeButtonAriaLabel="Close"
                isFooterAtBottom={true}
                onRenderFooterContent={this._onRenderFooterContent}
            >
                {ToolTip.getTip(this.props.tipType)}
            </OF.Panel>
        )
    }

    private _onRenderFooterContent = () => {
        return (
            <OF.DefaultButton
                data-testid="helppanel-close-button"
                className="cl-button-close cl-ux-flexpanel--right"
                onClick={() => { this.onDismiss() }}
                style={{ marginBottom: "1.5em" }}
            >
                <FormattedMessageId id={FM.BUTTON_CLOSE} />
            </OF.DefaultButton>
        )
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        setTipType
    }, dispatch)
}
const mapStateToProps = (state: State, ownProps: any) => {
    return {
        tipType: state.display.tipType
    }
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps

export default connect<stateProps, dispatchProps, {}>(mapStateToProps, mapDispatchToProps)(HelpPanel)
