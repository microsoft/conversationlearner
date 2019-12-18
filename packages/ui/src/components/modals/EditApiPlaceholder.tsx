/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as TC from '../tipComponents'
import * as ToolTip from '../ToolTips/ToolTips'
import * as Util from '../../Utils/util'
import EntityCreatorEditor from './EntityCreatorEditor'
import FormattedMessageId from '../FormattedMessageId'
import HelpIcon from '../HelpIcon'
import MemorySetter from './MemorySetter'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../../react-intl-messages'
import './EditApiPlaceholder.css'
import { autobind } from 'core-decorators'

interface ComponentState {
    filledEntityMap: CLM.FilledEntityMap
    isEntityEditorModalOpen: boolean
    apiNameVal: string
    // If editing an is exiting placeholder
    editingExisting: boolean
    isTerminal: boolean
}

class EditApiPlaceholder extends React.Component<Props, ComponentState> {

    constructor(props: Props) {
        super(props)
        this.state = {
            filledEntityMap: new CLM.FilledEntityMap(),
            isEntityEditorModalOpen: false,
            apiNameVal: '',
            editingExisting: false,
            isTerminal: true
        }
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {
        if (this.props.isOpen !== newProps.isOpen) {
            this.setState({
                filledEntityMap: newProps.initMemories ?? new CLM.FilledEntityMap(),
                apiNameVal: newProps.placeholderName ?? '',
                editingExisting: newProps.placeholderName !== null
            })
        }
    }

    @autobind
    onClickCreateEntity() {
        this.setState({
            isEntityEditorModalOpen: true
        })
    }

    @autobind
    onCloseEntityEditor() {
        this.setState({
            isEntityEditorModalOpen: false
        })
    }

    @autobind
    onClickCancel() {
        this.props.handleClose(null, null, false)
    }

    @autobind
    onClickSubmit() {
        // Remove any empty items
        for (const entityName of Object.keys(this.state.filledEntityMap.map)) {
            const filledEntity = this.state.filledEntityMap.map[entityName]
            filledEntity.values = filledEntity.values.filter(entityValue => entityValue.userText !== '' || entityValue.enumValueId)
            if (filledEntity.values.length === 0) {
                delete this.state.filledEntityMap.map[entityName]
            }
        }

        this.props.handleClose(this.state.filledEntityMap, this.state.apiNameVal, this.state.isTerminal)
    }

    @autobind
    onChangeName(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) {
        this.setState({
            apiNameVal: text
        })
    }

    @autobind
    onChangeWaitCheckbox() {
        this.setState(prevState => ({
            isTerminal: !prevState.isTerminal
        }))
    }

    onGetNameErrorMessage(value: string): string {
        // Don't need to check if editing existing placeholder
        if (this.state.editingExisting) {
            return ''
        }

        const MAX_NAME_LENGTH = 30

        if (value.length === 0) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_REQUIREDVALUE)
        }

        if (value.length > MAX_NAME_LENGTH) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_MAX_30)
        }

        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_ALPHANUMERIC)
        }

        if (this.props.actions.filter(a => CLM.ActionBase.isPlaceholderAPI(a))
            .map(aa => new CLM.ApiAction(aa))
            .find(aaa => aaa.name === value)) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_DISTINCT)
        }

        return ''
    }

    isSaveDisabled(): boolean {
        return (this.onGetNameErrorMessage(this.state.apiNameVal) !== '')
    }

    @autobind
    updateFilledEntityMap(map: { [key: string]: CLM.FilledEntity }) {
        this.setState({ filledEntityMap: new CLM.FilledEntityMap({ map: map }) })
    }

    render() {
        const { intl } = this.props
        return (
            <OF.Modal
                isOpen={this.props.isOpen}
                isBlocking={true}
                containerClassName="cl-modal cl-modal--medium"
            >
                <div className="cl-modal_header">
                    <span className={OF.FontClassNames.xxLarge}>
                        <FormattedMessageId id={FM.TEACHSESSIONPLACEHOLDER_TITLE} />
                    </span>
                </div>
                <div>
                    <div className="cl-edit-api-stub-fields cl-ux-flexpanel--left">
                        <OF.TextField
                            className={OF.FontClassNames.mediumPlus}
                            readOnly={this.state.editingExisting}
                            onChange={this.onChangeName}
                            label={Util.formatMessageId(intl, FM.SETTINGS_FIELDS_NAMELABEL)}
                            onGetErrorMessage={value => this.onGetNameErrorMessage(value)}
                            value={this.state.apiNameVal}
                        />
                        {!this.state.editingExisting &&
                            <div className="cl-actioncreator-form-section">
                                <TC.Checkbox
                                    label="Wait for Response?"
                                    checked={this.state.isTerminal}
                                    onChange={this.onChangeWaitCheckbox}
                                    tipType={ToolTip.TipType.ACTION_WAIT}
                                />
                            </div>
                        }
                        <div className={OF.FontClassNames.mediumPlus}>
                            <FormattedMessageId id={FM.TEACHSESSIONPLACEHOLDER_DESCRIPTION} />
                            <HelpIcon tipType={ToolTip.TipType.PLACEHOLDER_API} />
                        </div>
                    </div>
                    <MemorySetter
                        map={this.state.filledEntityMap.map}
                        onUpdate={this.updateFilledEntityMap}
                    />
                </div>
                <div className="cl-modal_footer cl-modal-buttons cl-modal_footer--border">
                    <div className="cl-modal-buttons_secondary">
                        <OF.DefaultButton
                            onClick={this.onClickCreateEntity}
                            ariaDescription={Util.formatMessageId(intl, FM.BUTTON_ENTITY)}
                            text={Util.formatMessageId(intl, FM.BUTTON_ENTITY)}
                            iconProps={{ iconName: 'CirclePlus' }}
                        />
                    </div>
                    <div className="cl-modal-buttons_primary">
                        <OF.PrimaryButton
                            data-testid="teach-session-ok-button"
                            onClick={this.onClickSubmit}
                            disabled={this.isSaveDisabled()}
                            ariaDescription={Util.formatMessageId(this.props.intl, FM.BUTTON_OK)}
                            text={Util.formatMessageId(this.props.intl, FM.BUTTON_OK)}
                            iconProps={{ iconName: 'Accept' }}
                        />
                        <OF.DefaultButton
                            data-testid="teach-session-cancel-button"
                            onClick={this.onClickCancel}
                            ariaDescription={Util.formatMessageId(this.props.intl, FM.BUTTON_CANCEL)}
                            text={Util.formatMessageId(this.props.intl, FM.BUTTON_CANCEL)}
                            iconProps={{ iconName: 'Cancel' }}
                        />
                    </div>
                </div>
                <EntityCreatorEditor
                    app={this.props.app}
                    editingPackageId={this.props.editingPackageId}
                    open={this.state.isEntityEditorModalOpen}
                    entity={null}
                    handleClose={this.onCloseEntityEditor}
                    handleDelete={() => { }}
                    entityTypeFilter={null}
                />
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
        entities: state.entities
    }
}

export interface ReceivedProps {
    isOpen: boolean,
    app: CLM.AppBase,
    actions: CLM.ActionBase[],
    placeholderName: string | null
    editingPackageId: string
    initMemories: CLM.FilledEntityMap | null
    handleClose: (filledEntityMap: CLM.FilledEntityMap | null, apiName: string | null, isTerminal: boolean) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(EditApiPlaceholder))
