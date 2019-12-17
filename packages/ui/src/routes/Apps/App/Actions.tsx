/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as Utils from '../../../Utils/util'
import actions from '../../../actions'
import ActionDetailsList from '../../../components/ActionDetailsList'
import FormattedMessageId from '../../../components/FormattedMessageId'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { ActionCreatorEditor } from '../../../components/modals'
import { State } from '../../../types'
import { FM } from '../../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { autobind } from 'core-decorators'

interface ComponentState {
    actionSelected: CLM.ActionBase | null
    actionIDToDelete: string | null
    isConfirmDeleteActionModalOpen: boolean
    isActionEditorModalOpen: boolean
    searchValue: string
    isActionEditorOpen: boolean
}

class Actions extends React.Component<Props, ComponentState> {
    private newActionButtonRef = React.createRef<OF.IButton>()

    constructor(p: any) {
        super(p)
        this.state = {
            actionIDToDelete: null,
            actionSelected: null,
            searchValue: '',
            isConfirmDeleteActionModalOpen: false,
            isActionEditorModalOpen: false,
            isActionEditorOpen: false,
        }

        this.onSelectAction = this.onSelectAction.bind(this)
        this.onChangeSearchString = this.onChangeSearchString.bind(this)
    }

    componentDidMount() {
        this.focusNewActionButton()
    }

    onSelectAction(action: CLM.ActionBase) {
        if (this.props.editingPackageId === this.props.app.devPackageId) {
            this.setState({
                actionSelected: action,
                isActionEditorOpen: true
            })
        }
    }

    onClickOpenActionEditor() {
        this.setState({
            isActionEditorOpen: true,
            actionSelected: null
        })
    }

    @autobind
    onClickCancelActionEditor() {
        this.setState({
            isActionEditorOpen: false,
            actionSelected: null
        }, () => {
            setTimeout(() => this.focusNewActionButton(), 500)
        })
    }

    @autobind
    async onClickDeleteActionEditor(action: CLM.ActionBase, removeFromDialogs: boolean) {
        await Utils.setStateAsync(this, {
            isActionEditorOpen: false,
            actionSelected: null
        })

        this.props.deleteActionThunkAsync(this.props.app.appId, action.actionId, removeFromDialogs)
        setTimeout(() => this.focusNewActionButton(), 1000)
    }

    @autobind
    async onClickSubmitActionEditor(action: CLM.ActionBase) {
        const wasEditing = this.state.actionSelected
        await Utils.setStateAsync(this, {
            isActionEditorOpen: false,
            actionSelected: null
        })

        const apiFunc = wasEditing
            ? () => this.props.editActionThunkAsync(this.props.app.appId, action)
            : () => this.props.createActionThunkAsync(this.props.app.appId, action)
        apiFunc()
        setTimeout(() => this.focusNewActionButton(), 500)
    }

    getFilteredActions(): CLM.ActionBase[] {
        //runs when user changes the text 
        const searchStringLower = this.state.searchValue.toLowerCase()
        return this.props.actions.filter(a => {
            const nameMatch = a.payload.toLowerCase().includes(searchStringLower)
            const typeMatch = a.actionType.toLowerCase().includes(searchStringLower)
            const entities = this.props.entities
                .filter(e => [...a.requiredEntities, ...a.negativeEntities, ...(a.suggestedEntity ? [a.suggestedEntity] : [])].includes(e.entityId))
            const entityMatch = entities.some(e => e.entityName.toLowerCase().includes(searchStringLower))

            return (nameMatch || typeMatch || entityMatch)
        })
    }

    @autobind
    onChangeSearchString(event?: React.ChangeEvent<HTMLInputElement>, newValue?: string) {
        if (!newValue) {
            return
        }

        this.onSearch(newValue)
    }

    @autobind
    onSearch(searchString: string) {
        this.setState({
            searchValue: searchString.toLowerCase()
        })
    }

    render() {
        // TODO: Look to move this up to the set state calls instead of forcing it to be on every render
        const { actions: allActions } = this.props
        const computedActions = this.getFilteredActions()
        return (
            <div className="cl-page">
                <span data-testid="actions-title" className={OF.FontClassNames.xxLarge}>
                    <FormattedMessageId id={FM.ACTIONS_TITLE} />
                </span>
                {this.props.editingPackageId === this.props.app.devPackageId
                    ? <span className={OF.FontClassNames.mediumPlus}>
                        <FormattedMessageId id={FM.ACTIONS_SUBTITLE} />
                    </span>
                    : <span className="cl-errorpanel">Editing is only allowed in Master Tag</span>
                }
                <div>
                    <OF.PrimaryButton
                        data-testid="actions-button-create"
                        disabled={this.props.editingPackageId !== this.props.app.devPackageId}
                        onClick={() => this.onClickOpenActionEditor()}
                        ariaDescription={this.props.intl.formatMessage({
                            id: FM.ACTIONS_CREATEBUTTONARIADESCRIPTION,
                            defaultMessage: 'Create a New Action'
                        })}
                        text={this.props.intl.formatMessage({
                            id: FM.ACTIONS_CREATEBUTTONTITLE,
                            defaultMessage: 'New Action'
                        })}
                        iconProps={{ iconName: 'Add' }}
                        componentRef={this.newActionButtonRef}
                    />
                </div>
                {allActions.length === 0
                    ? <div className="cl-page-placeholder">
                        <div className="cl-page-placeholder__content">
                            <div className={`cl-page-placeholder__description ${OF.FontClassNames.xxLarge}`} data-testid="create-an-action-title">Create an Action</div>
                            <OF.PrimaryButton
                                iconProps={{
                                    iconName: "Add"
                                }}
                                disabled={this.props.editingPackageId !== this.props.app.devPackageId}
                                onClick={() => this.onClickOpenActionEditor()}
                                ariaDescription={this.props.intl.formatMessage({
                                    id: FM.ACTIONS_CREATEBUTTONARIADESCRIPTION,
                                    defaultMessage: 'Create a New Action'
                                })}
                                text={this.props.intl.formatMessage({
                                    id: FM.ACTIONS_CREATEBUTTONTITLE,
                                    defaultMessage: 'New Action'
                                })}
                            />
                        </div>
                    </div>
                    : <React.Fragment>
                        <div>
                            <OF.Label htmlFor="entities-input-search" className={OF.FontClassNames.medium}>
                                Search:
                            </OF.Label>
                            <OF.SearchBox
                                id="actions-input-search"
                                data-testid="actions-input-search"
                                className={OF.FontClassNames.mediumPlus}
                                onChange={this.onChangeSearchString}
                                onSearch={this.onSearch}
                            />
                        </div>
                        <ActionDetailsList
                            actions={computedActions}
                            onSelectAction={this.onSelectAction}
                        />
                    </React.Fragment>}

                <ActionCreatorEditor
                    app={this.props.app}
                    editingPackageId={this.props.editingPackageId}
                    open={this.state.isActionEditorOpen}
                    action={this.state.actionSelected}
                    actions={this.props.actions}
                    handleClose={this.onClickCancelActionEditor}
                    handleDelete={this.onClickDeleteActionEditor}
                    handleEdit={this.onClickSubmitActionEditor}
                />
            </div>
        )
    }

    private focusNewActionButton() {
        if (this.newActionButtonRef.current) {
            this.newActionButtonRef.current.focus()
        }
    }

}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        createActionThunkAsync: actions.action.createActionThunkAsync,
        editActionThunkAsync: actions.action.editActionThunkAsync,
        deleteActionThunkAsync: actions.action.deleteActionThunkAsync,
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    return {
        actions: state.actions,
        entities: state.entities
    }
}

export interface ReceivedProps {
    app: CLM.AppBase
    editingPackageId: string
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(Actions) as any)
