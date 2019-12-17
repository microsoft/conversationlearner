/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as BotChat from '@conversationlearner/webchat'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../../Utils/util'
import * as DialogUtils from '../../Utils/dialogUtils'
import * as DialogEditing from '../../Utils/dialogEditing'
import * as CLM from '@conversationlearner/models'
import * as BB from 'botbuilder'
import AddButtonInput from './AddButtonInput'
import AddButtonScore from './AddButtonScore'
import actions from '../../actions'
import ConfirmCancelModal from './ConfirmCancelModal'
import UserInputModal from './UserInputModal'
import TeachSessionAdmin from './TeachSessionAdmin'
import TeachSessionInitState from './TeachSessionInitState'
import FormattedMessageId from '../FormattedMessageId'
import TranscriptImportCancelModal from './TranscriptImportCancelModal'
import Webchat, { renderActivity } from '../Webchat'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { ErrorHandler } from '../../Utils/ErrorHandler'
import { AT } from '../../types/ActionTypes'
import { State, TeachSessionState } from '../../types'
import { renderReplayError } from '../../Utils/RenderReplayError'
import { FM } from '../../react-intl-messages'
import { EditDialogType, SelectionType, fromLogTag } from '../../types/const'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import './TeachSessionModal.css'
import { autobind } from 'core-decorators'

interface ComponentState {
    isConfirmDeleteOpen: boolean,
    isImportAbandonOpen: boolean,
    isUserInputModalOpen: boolean,
    addUserInputSelectionType: SelectionType
    isInitStateOpen: boolean,
    isInitAvailable: boolean,
    initialEntities: CLM.FilledEntityMap | null,
    webchatKey: number,
    editing: boolean,
    hasTerminalAction: boolean,
    nextActivityIndex: number,
    // If activity selected its index
    selectedActivityIndex: number | null,
    // If activity was part of existing history, the actual item
    selectedHistoryActivity: BB.Activity | null,
    // For handling button sumbits
    ignoreSelectionCount: number,
    replaceActivityText: string | null
    replaceActivityIndex: number | null
    tags: string[]
    description: string
}

class TeachModal extends React.Component<Props, ComponentState> {

    state: ComponentState = {
        isConfirmDeleteOpen: false,
        isImportAbandonOpen: false,
        isUserInputModalOpen: false,
        addUserInputSelectionType: SelectionType.NONE,
        isInitStateOpen: false,
        isInitAvailable: true,
        initialEntities: null,
        webchatKey: 0,
        editing: false,
        hasTerminalAction: false,
        nextActivityIndex: 0,
        selectedActivityIndex: null,
        selectedHistoryActivity: null,
        ignoreSelectionCount: 0,
        replaceActivityText: null,
        replaceActivityIndex: null,
        tags: [],
        description: ''
    }

    private callbacksId: string | null = null;

    componentDidMount() {
        this.callbacksId = ErrorHandler.RegisterCallbacks(
            [
                { actionType: AT.POST_SCORE_FEEDBACK_ASYNC, callback: this.onDismissError },
                { actionType: AT.RUN_SCORER_ASYNC, callback: this.onDismissError },
            ]
        )

        if (this.props.sourceTrainDialog) {
            const { tags, description } = this.props.sourceTrainDialog
            this.setState({
                tags,
                description
            })
        }
    };

    componentWillUnmount() {
        if (this.callbacksId) {
            ErrorHandler.DeleteCallbacks(this.callbacksId)
        }
    }

    @autobind
    onDismissError(errorType: AT): void {
        this.props.onClose(false)
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {

        let webchatKey = this.state.webchatKey
        let hasTerminalAction = this.state.hasTerminalAction
        let isInitAvailable = this.state.isInitAvailable
        let nextActivityIndex = this.state.nextActivityIndex
        let selectedActivityIndex = this.state.selectedActivityIndex
        let selectedHistoryActivity = this.state.selectedHistoryActivity
        let initialEntities = this.state.initialEntities
        let ignorePostCount = this.state.ignoreSelectionCount
        let replaceActivityText = this.state.replaceActivityText
        let replaceActivityIndex = this.state.replaceActivityIndex

        // Dialog will be closed, reset state
        if (this.props.isOpen && !newProps.isOpen) {
            selectedActivityIndex = null
            selectedHistoryActivity = null
            initialEntities = null
            ignorePostCount = 0
            replaceActivityText = null
            replaceActivityIndex = null

            this.setState({
                tags: [],
                description: ''
            })
        }

        if (this.props.initialHistory !== newProps.initialHistory) {
            webchatKey = this.state.webchatKey + 1
            isInitAvailable = !newProps.initialHistory || newProps.initialHistory.length === 0
            nextActivityIndex = newProps.initialHistory.length
            replaceActivityText = null
            replaceActivityIndex = null
        }

        // If new session
        if (this.props.teachSession.teach !== newProps.teachSession.teach) {
            isInitAvailable = true
            hasTerminalAction = false
            initialEntities = null
            this.setState({
                tags: newProps.sourceTrainDialog ? newProps.sourceTrainDialog.tags : [],
                description: newProps.sourceTrainDialog ? newProps.sourceTrainDialog.description : ''
            })
        }

        // Set terminal action from History but only if I just loaded it
        if (this.props.initialHistory !== newProps.initialHistory && newProps.initialHistory && newProps.initialHistory.length > 0) {
            hasTerminalAction = newProps.lastAction
                ? newProps.lastAction.isTerminal
                : false
        }

        if (webchatKey !== this.state.webchatKey ||
            hasTerminalAction !== this.state.hasTerminalAction ||
            isInitAvailable !== this.state.isInitAvailable) {
            this.setState({
                webchatKey,
                hasTerminalAction,
                isInitAvailable,
                initialEntities,
                nextActivityIndex,
                selectedActivityIndex,
                selectedHistoryActivity,
                ignoreSelectionCount: ignorePostCount,
                replaceActivityText,
                replaceActivityIndex
            })
        }

        // If we just added a sourceTrainDialog it's because we continued from an existing Train Dialog
        // Or if the tags or description were changed before continuing
        // Copy over the tags and description from it
        if (!this.props.sourceTrainDialog && newProps.sourceTrainDialog
            || ((this.props.sourceTrainDialog && newProps.sourceTrainDialog)
                && (!Util.equal(this.props.sourceTrainDialog.tags, newProps.sourceTrainDialog.tags)
                    || this.props.sourceTrainDialog.description !== newProps.sourceTrainDialog.description)
            )) {
            const { tags, description } = newProps.sourceTrainDialog
            this.setState({
                tags,
                description
            })
        }
    }

    //---- INIT STATE ----
    @autobind
    onInitStateClicked() {
        this.setState({
            isInitStateOpen: true
        })
    }

    @autobind
    async onCloseInitState(filledEntityMap: CLM.FilledEntityMap | null) {
        if (filledEntityMap && this.props.onSetInitialEntities) {
            await this.props.onSetInitialEntities(filledEntityMap)
        }
        this.setState({
            isInitStateOpen: false,
            initialEntities: filledEntityMap ?? null
        })
    }

    //---- ABANDON ----
    @autobind
    async onClickAbandonTeach() {
        if (this.props.editType === EditDialogType.IMPORT) {
            this.setState({
                isImportAbandonOpen: true
            })
        }
        else if (this.state.nextActivityIndex) {
            this.setState({
                isConfirmDeleteOpen: true
            })
        } else {
            await this.onClickConfirmDelete(false)
        }
    }

    @autobind
    onClickSave() {
        const tags = [...this.state.tags]
        if (this.props.editType === EditDialogType.LOG_EDITED) {
            tags.push(fromLogTag)
        }

        this.props.onClose(true, tags, this.state.description, false)
    }

    @autobind
    async onClickConfirmDelete(stopImport: boolean) {
        await Util.setStateAsync(this, {
            isConfirmDeleteOpen: false,
            isImportAbandonOpen: false
        })
        this.props.onClose(false, undefined, undefined, stopImport)
    }

    @autobind
    onClickCancelDelete() {
        this.setState({
            isConfirmDeleteOpen: false,
            isImportAbandonOpen: false
        })
    }

    autoTeachChanged(ev: React.FormEvent<HTMLElement>, isChecked: boolean) {
        this.props.toggleAutoTeach(isChecked)
    }

    async onWebChatSelectActivity(activity: BB.Activity) {

        // If last action was button submit will generate two calls, ignore the selection
        if (this.state.ignoreSelectionCount > 0) {
            this.setState({ ignoreSelectionCount: this.state.ignoreSelectionCount - 1 })
            return
        }

        // Activities from history can be looked up
        if (this.props.initialHistory.length > 0) {
            const selectedActivityIndex = this.props.initialHistory.findIndex(a => a.id === activity.id)
            if (selectedActivityIndex > -1) {
                this.setState({
                    selectedActivityIndex,
                    selectedHistoryActivity: activity
                })
                return
            }
        }
        if (activity.channelData) {
            const clData: CLM.CLChannelData = activity.channelData.clData
            // Otherwise newly create activities with have index in channel data
            this.setState({
                selectedActivityIndex: clData.activityIndex!,
                selectedHistoryActivity: null
            })
        }
    }

    async onWebChatPostActivity(activity: BB.Activity) {

        if (activity.type === 'message' && activity.text && activity.text !== "") {
            if (!this.props.teachSession.teach) {
                throw new Error(`Current teach session is not defined. This may be due to race condition where you attempted to chat with the bot before the teach session has been created.`)
            }

            // Content could come from button submit
            const buttonSubmit = activity.channelData && activity.channelData.imback
            const userInput: CLM.UserInput = { text: activity.text! }

            if (buttonSubmit) {
                // For now always add button response to bottom of dialog even
                // when card is selected.  In future  want to add below the
                // selected card but webchat injects imback at bottom, which causes a jump
                // Need to update webchat to change behavior when activity is selected to not send message
                /*
                // If selected was a selected, insert it
                if (this.state.selectedActivityIndex) {
                    this.onSubmitAddUserInput(userInput.text)
                    return
                }
                */

                // Ignore the next to action selections
                await Util.setStateAsync(this, { ignoreSelectionCount: 2 })

                // If button clicked when not waiting for user input, must insert rather than continue as not valid combination
                if (this.props.teachSession.dialogMode !== CLM.DialogMode.Wait) {
                    await Util.setStateAsync(this, { selectedActivityIndex: this.state.nextActivityIndex - 1 })
                    this.onSubmitAddUserInput(userInput.text)
                    return
                }
            }
            // Add channel data to activity so can process when clicked on later
            const clData: CLM.CLChannelData = {
                senderType: CLM.SenderType.User,
                roundIndex: null,
                scoreIndex: null,
                activityIndex: this.state.nextActivityIndex,
            }
            if (!activity.channelData) {
                activity.channelData = {}
            }
            activity.channelData.clData = clData

            this.setState({
                // No initialization allowed after first input
                isInitAvailable: false,
                initialEntities: null,
                nextActivityIndex: this.state.nextActivityIndex + 1,
                selectedActivityIndex: null,
                selectedHistoryActivity: null
            })

            // If there's an error when I try to continue, reset webchat to ignore new input
            this.props.setErrorDismissCallback(this.onClickUndoInput)
            await (this.props.runExtractorThunkAsync(
                this.props.app.appId,
                CLM.DialogType.TEACH,
                this.props.teachSession.teach.teachId,
                null,
                userInput,
                this.props.originalTrainDialogId) as any as Promise<void>)
        }
    }

    // TODO: this is redundant with EditDialogAdmin
    @autobind
    getRenderData(): DialogUtils.DialogRenderData {

        if (this.state.selectedHistoryActivity === null || !this.props.sourceTrainDialog) {
            throw new Error("getRenderData missing data")
        }

        const clData: CLM.CLChannelData = this.state.selectedHistoryActivity.channelData.clData
        const roundIndex = clData.roundIndex!
        const scoreIndex = clData.scoreIndex
        const senderType = clData.senderType

        return DialogUtils.getDialogRenderData(this.props.sourceTrainDialog, this.props.entities, this.props.actions, roundIndex, scoreIndex, senderType)
    }

    @autobind
    onClickAddUserInput() {
        const isLastActivity = this.state.selectedActivityIndex === (this.state.nextActivityIndex - 1)
        const selectionType = isLastActivity ? SelectionType.NONE : SelectionType.NEXT
        this.setState({
            isUserInputModalOpen: true,
            addUserInputSelectionType: selectionType
        })
    }

    @autobind
    onCancelAddUserInput() {
        this.setState({
            isUserInputModalOpen: false
        })
    }

    @autobind
    onClickUndoInput(): void {
        if (this.state.nextActivityIndex > 1) {
            // Replay dialog to get rid of input
            this.props.onEditTeach(0, null, this.state.tags, this.state.description, this.props.onReplayDialog)
        }
        else {
            // Reset webchat to clear input
            this.setState({
                webchatKey: this.state.webchatKey + 1,
                nextActivityIndex: 0
            })
        }
    }

    @autobind
    onCloseBotAPIError(): void {
        // If first turn close the train dialog
        if (this.state.nextActivityIndex === 1) {
            this.props.onClose(false)
        }
        else {
            // Otherwise delete the most recent turn with the error
            this.props.onEditTeach(this.state.nextActivityIndex - 1, null, this.state.tags, this.state.description, this.props.onDeleteTurn)
        }
    }

    @autobind
    onSubmitAddUserInput(userInput: string) {
        this.setState({
            isUserInputModalOpen: false
        })
        if (this.state.selectedActivityIndex != null) {
            this.props.onEditTeach(this.state.selectedActivityIndex, { userInput, selectionType: this.state.addUserInputSelectionType }, this.state.tags, this.state.description, this.props.onInsertInput)
        }
    }

    @autobind
    onInsertAction() {
        if (this.state.selectedActivityIndex != null) {
            const isLastActivity = this.state.selectedActivityIndex === (this.state.nextActivityIndex - 1)
            const selectionType = isLastActivity ? SelectionType.NONE : SelectionType.NEXT
            this.props.onEditTeach(this.state.selectedActivityIndex, { isLastActivity, selectionType }, this.state.tags, this.state.description, this.props.onInsertAction)
        }
    }

    @autobind
    onDeleteTurn() {
        if (this.state.selectedActivityIndex != null) {
            this.props.onEditTeach(this.state.selectedActivityIndex, null, this.state.tags, this.state.description, this.props.onDeleteTurn)
        }
    }

    @autobind
    onEditExtraction(extractResponse: CLM.ExtractResponse, textVariations: CLM.TextVariation[]) {
        if (this.state.selectedActivityIndex != null) {
            this.props.onEditTeach(this.state.selectedActivityIndex, { extractResponse, textVariations }, this.state.tags, this.state.description, this.props.onChangeExtraction)
        }
    }

    @autobind
    onEditScore(trainScorerStep: CLM.TrainScorerStep) {
        if (this.state.selectedActivityIndex != null) {
            this.props.onEditTeach(this.state.selectedActivityIndex, { trainScorerStep }, this.state.tags, this.state.description, this.props.onChangeAction)
        }
    }

    @autobind
    onAddTag(tag: string) {
        this.setState(prevState => ({
            tags: [...prevState.tags, tag]
        }))
    }

    @autobind
    onRemoveTag(tag: string) {
        this.setState(prevState => ({
            tags: prevState.tags.filter(t => t !== tag)
        }))
    }

    @autobind
    onChangeDescription(description: string) {
        this.setState({
            description
        })
    }

    renderActivity(activityProps: BotChat.WrappedActivityProps, children: React.ReactNode, setRef: (div: HTMLDivElement | null) => void): JSX.Element {
        return renderActivity(activityProps, children, setRef, this.renderSelectedActivity, this.props.editType, this.state.selectedActivityIndex != null)
    }

    @autobind
    renderSelectedActivity(activity: BB.Activity): (JSX.Element | null) {

        if (this.state.selectedActivityIndex === null) {
            return null
        }

        const isUser = activity.from.name === 'ConversationLearnerDeveloper'

        // Can't delete first user input
        const canDeleteRound = this.state.selectedActivityIndex !== 0
        const isEndSession = this.props.teachSession.dialogMode === CLM.DialogMode.EndSession
            && activity.channelData.clData
            && this.state.nextActivityIndex === activity.channelData.clData.activityIndex + 1

        return (
            <div className="cl-wc-buttonbar">
                {!isEndSession &&
                    <AddButtonInput
                        onClick={this.onClickAddUserInput}
                        editType={this.props.editType}
                    />
                }
                {!isEndSession &&
                    <AddButtonScore
                        onClick={this.onInsertAction}
                    />
                }
                {canDeleteRound &&
                    <OF.IconButton
                        data-testid="chat-edit-delete-turn-button"
                        className={`cl-wc-deleteturn ${isUser ? `cl-wc-deleteturn--user` : `cl-wc-deleteturn--bot`}`}
                        iconProps={{ iconName: 'Delete' }}
                        onClick={this.onDeleteTurn}
                        ariaDescription="Delete Turn"
                    />
                }
            </div>
        )
    }

    renderAbandonText(intl: ReactIntl.InjectedIntl) {
        switch (this.props.editType) {
            case EditDialogType.NEW:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON)
            case EditDialogType.IMPORT:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON_IMPORT)
            case EditDialogType.BRANCH:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON_BRANCH)
            case EditDialogType.LOG_EDITED:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON_EDIT)
            case EditDialogType.LOG_ORIGINAL:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON)
            case EditDialogType.TRAIN_EDITED:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON_EDIT)
            case EditDialogType.TRAIN_ORIGINAL:
                return Util.formatMessageId(intl, FM.BUTTON_ABANDON)
            default:
                return ""
        }
    }

    renderSaveText(intl: ReactIntl.InjectedIntl) {
        switch (this.props.editType) {
            case EditDialogType.NEW:
            case EditDialogType.IMPORT:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE)
            case EditDialogType.BRANCH:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE_BRANCH)
            case EditDialogType.LOG_EDITED:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE_AS_TRAIN_DIALOG)
            case EditDialogType.LOG_ORIGINAL:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE_AS_TRAIN_DIALOG)
            case EditDialogType.TRAIN_EDITED:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE_EDIT)
            case EditDialogType.TRAIN_ORIGINAL:
                return Util.formatMessageId(intl, FM.BUTTON_SAVE)
            default:
                return ""
        }
    }

    renderConfirmText(intl: ReactIntl.InjectedIntl) {
        switch (this.props.editType) {
            case EditDialogType.NEW:
            case EditDialogType.IMPORT:
            case EditDialogType.BRANCH:
                return Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_TEACH_CONFIRMDELETE_TITLE)
            case EditDialogType.LOG_EDITED:
                return Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_EDIT_CONFIRMDELETE_TITLE)
            case EditDialogType.LOG_ORIGINAL:
                return Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_EDIT_CONFIRMDELETE_TITLE)
            case EditDialogType.TRAIN_EDITED:
                return Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_EDIT_CONFIRMDELETE_TITLE)
            case EditDialogType.TRAIN_ORIGINAL:
                return Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_TEACH_CONFIRMDELETE_TITLE)
            default:
                return ""
        }
    }

    onScrollChange(position: number): void {
        this.props.setWebchatScrollPosition(position)
    }

    @autobind
    onScoredAction(scoredAction: CLM.ScoredAction) {
        this.setState({
            hasTerminalAction: scoredAction.isTerminal,
            nextActivityIndex: this.state.nextActivityIndex + 1
        })
        if (scoredAction.actionType === CLM.ActionTypes.END_SESSION
            || scoredAction.actionType === CLM.ActionTypes.CHANGE_MODEL) {
            this.props.onEndSessionActivity(this.state.tags, this.state.description)
        }
    }

    // Does history have any replay errors
    hasReplayError(): boolean {
        if (!this.props.initialHistory || this.props.initialHistory.length === 0) {
            return false
        }

        return (this.props.initialHistory.filter(h => {
            const clData: CLM.CLChannelData = h.channelData.clData
            return (clData && clData.replayError)
        }).length > 0)
    }

    shouldShowScoreButton(): boolean {
        return (this.props.teachSession.dialogMode === CLM.DialogMode.Scorer
            && this.state.selectedActivityIndex !== null)
    }

    @autobind
    renderWebchatInput(): JSX.Element | null {
        if (this.shouldShowScoreButton() && this.state.selectedActivityIndex != null) {
            return (
                <div className="wc-console">
                    <OF.PrimaryButton
                        className="cl-rightjustify"
                        onClick={this.onInsertAction}
                        ariaDescription={'Score Actions'}
                        text={'Score Actions'} // TODO internationalize
                    />
                </div>)
        }
        return null
    }

    renderWarning() {

        const replayError = DialogUtils.getReplayError(this.state.selectedHistoryActivity)
        if (replayError) {
            return renderReplayError(replayError)
        }
        else if (this.hasReplayError()) {
            // Replay error, but not activity selected
            return (
                <div
                    className={`cl-editdialog-error ${OF.FontClassNames.mediumPlus}`}
                    data-testid="dialog-modal-error-noselection"
                >
                    <FormattedMessageId id={FM.REPLAYERROR_ERROR} />
                </div>
            )
        }
        else {
            return null
        }
    }

    render() {
        const { intl } = this.props

        // Put mask of webchat if waiting for score selector or extraction labelling
        const waitingForScore = this.state.selectedActivityIndex === null && this.props.teachSession.dialogMode === CLM.DialogMode.Scorer
        const waitingForExtract = this.props.teachSession.dialogMode === CLM.DialogMode.Extractor
        const chatDisable = (waitingForScore || waitingForExtract) ? <div className="cl-overlay" /> : null
        const saveDisable = this.props.teachSession.dialogMode === CLM.DialogMode.Extractor
            || this.props.teachSession.botAPIError !== null
            || this.state.isInitAvailable  // Empty TD
            || !this.state.hasTerminalAction
        const isLastActivitySelected = this.state.selectedActivityIndex ? this.state.selectedActivityIndex === (this.state.nextActivityIndex - 1) : false
        return (
            <div>
                <OF.Modal
                    isOpen={this.props.isOpen}
                    isBlocking={true}
                    containerClassName="cl-modal cl-modal--large cl-modal--teach"
                >
                    <div className="cl-modal_body">
                        <div className="cl-chatmodal">
                            <div className="cl-chatmodal_webchat">
                                <Webchat
                                    data-testid="teach-session-modal-webchat"
                                    isOpen={this.props.isOpen}
                                    key={this.state.webchatKey}
                                    app={this.props.app}
                                    history={this.props.initialHistory}
                                    onPostActivity={activity => this.onWebChatPostActivity(activity)}
                                    onSelectActivity={activity => this.onWebChatSelectActivity(activity)}
                                    onScrollChange={position => this.onScrollChange(position)}
                                    hideInput={this.props.teachSession.dialogMode !== CLM.DialogMode.Wait}
                                    focusInput={this.props.teachSession.dialogMode === CLM.DialogMode.Wait}
                                    renderActivity={(props, children, setRef) => this.renderActivity(props, children, setRef)}
                                    renderInput={() => this.renderWebchatInput()}
                                    selectedActivityIndex={this.state.selectedActivityIndex}
                                    replaceActivityText={this.state.replaceActivityText}
                                    replaceActivityIndex={this.state.replaceActivityIndex}
                                    disableCardActions={this.props.teachSession.dialogMode === CLM.DialogMode.EndSession}
                                />
                                {chatDisable}
                            </div>
                            <div className="cl-chatmodal_controls">
                                <div className="cl-chatmodal_admin-controls">
                                    <TeachSessionAdmin
                                        data-testid="teach-session-admin"
                                        app={this.props.app}
                                        teachSession={this.props.teachSession}
                                        editingPackageId={this.props.editingPackageId}
                                        originalTrainDialogId={this.props.originalTrainDialogId}
                                        sourceTrainDialog={this.props.sourceTrainDialog}
                                        editType={this.props.editType}
                                        initialEntities={this.state.initialEntities}
                                        nextActivityIndex={this.state.nextActivityIndex}
                                        selectedActivityIndex={this.state.selectedActivityIndex}
                                        isLastActivitySelected={isLastActivitySelected}
                                        historyRenderData={this.state.selectedHistoryActivity ? this.getRenderData : null}
                                        onScoredAction={this.onScoredAction}
                                        onReplaceActivityText={(userText, index) => {
                                            this.setState({
                                                replaceActivityIndex: index,
                                                replaceActivityText: userText
                                            })
                                        }}
                                        importIndex={this.props.importIndex}
                                        importCount={this.props.importCount}
                                        onEditExtraction={this.onEditExtraction}
                                        onEditAction={this.onEditScore}

                                        allUniqueTags={this.props.allUniqueTags}
                                        tags={this.state.tags}
                                        onAddTag={this.onAddTag}
                                        onRemoveTag={this.onRemoveTag}

                                        description={this.state.description}
                                        onChangeDescription={this.onChangeDescription}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="cl-modal_footer cl-modal_footer--border">
                        <div className="cl-modal-buttons">
                            <div className="cl-modal-buttons_secondary">
                                {this.state.isInitAvailable &&
                                    <OF.DefaultButton
                                        data-testid="teach-session-set-initial-state"
                                        disabled={false}
                                        onClick={this.onInitStateClicked}
                                        ariaDescription={Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_INITSTATE_ARIADESCRIPTION)}
                                        text={Util.formatMessageId(intl, FM.TEACHSESSIONMODAL_INITSTATE_TEXT)}
                                    />
                                }
                                <div className="cl-modal-buttons_secondary">
                                    {this.renderWarning()}
                                </div>
                            </div>

                            <div className="cl-modal-buttons_primary">
                                {this.props.teachSession.dialogMode === CLM.DialogMode.Extractor && this.state.nextActivityIndex > 1 &&
                                    <OF.PrimaryButton
                                        data-testid="edit-teach-dialog-undo-button"
                                        disabled={false}
                                        onClick={this.onClickUndoInput}
                                        ariaDescription={Util.formatMessageId(intl, FM.BUTTON_UNDO)}
                                        text={Util.formatMessageId(intl, FM.BUTTON_UNDO)}
                                        iconProps={{ iconName: 'Undo' }}
                                    />
                                }
                                <OF.PrimaryButton
                                    data-testid="edit-teach-dialog-close-save-button"
                                    disabled={saveDisable}
                                    onClick={this.onClickSave}
                                    ariaDescription={this.renderSaveText(intl)}
                                    text={this.renderSaveText(intl)}
                                    iconProps={{ iconName: 'Accept' }}
                                />
                                <OF.DefaultButton
                                    data-testid="edit-dialog-modal-abandon-delete-button"
                                    disabled={false}
                                    className="cl-button-delete"
                                    onClick={this.onClickAbandonTeach}
                                    ariaDescription={this.renderAbandonText(intl)}
                                    text={this.renderAbandonText(intl)}
                                    iconProps={{ iconName: 'Cancel' }}
                                />

                            </div>
                        </div>
                    </div>
                    <TranscriptImportCancelModal
                        open={this.state.isImportAbandonOpen}
                        onCancel={this.onClickCancelDelete}
                        onConfirm={this.onClickConfirmDelete}
                        allowContinue={this.props.importIndex !== this.props.importCount}
                    />
                    <ConfirmCancelModal
                        data-testid="teach-session-confirm-cancel"
                        open={this.state.isConfirmDeleteOpen}
                        onCancel={this.onClickCancelDelete}
                        onConfirm={this.onClickConfirmDelete}
                        title={this.renderConfirmText(intl)}
                    />
                    {this.props.teachSession.botAPIError !== null &&
                        <ConfirmCancelModal
                            open={true}
                            onOk={this.onCloseBotAPIError}
                            title={this.props.teachSession.botAPIError.APIError}
                        />
                    }
                    <UserInputModal
                        titleFM={FM.USERINPUT_ADD_TITLE}
                        placeholderFM={FM.USERINPUT_PLACEHOLDER}
                        open={this.state.isUserInputModalOpen}
                        onCancel={() => { this.onCancelAddUserInput() }}
                        onSubmit={this.onSubmitAddUserInput}
                    />
                </OF.Modal>
                <TeachSessionInitState
                    isOpen={this.state.isInitStateOpen}
                    app={this.props.app}
                    editingPackageId={this.props.editingPackageId}
                    handleClose={this.onCloseInitState}
                />
            </div>
        )
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        runExtractorThunkAsync: actions.teach.runExtractorThunkAsync,
        toggleAutoTeach: actions.teach.toggleAutoTeach,
        setWebchatScrollPosition: actions.display.setWebchatScrollPosition,
        setErrorDismissCallback: actions.display.setErrorDismissCallback
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render TeachSessionAdmin but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        entities: state.entities,
        actions: state.actions
    }
}

export interface ReceivedProps {
    isOpen: boolean
    onClose: (save: boolean, tags?: string[], description?: string, stopImport?: boolean) => void
    onEditTeach: (activityIndex: number | null, args: DialogEditing.EditHandlerArgs | null, tags: string[], description: string, editHandler: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args: DialogEditing.EditHandlerArgs) => any) => void
    onInsertAction: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args: DialogEditing.EditHandlerArgs) => any
    onInsertInput: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args: DialogEditing.EditHandlerArgs) => any
    onChangeExtraction: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args: DialogEditing.EditHandlerArgs) => any
    onChangeAction: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args: DialogEditing.EditHandlerArgs) => any
    onDeleteTurn: (trainDialog: CLM.TrainDialog, activity: BB.Activity) => any
    onEndSessionActivity: (tags: string[], description: string) => any
    onReplayDialog: (trainDialog: CLM.TrainDialog) => any
    onSetInitialEntities: ((initialFilledEntityMap: CLM.FilledEntityMap) => Promise<void>) | null
    app: CLM.AppBase
    teachSession: TeachSessionState
    editingPackageId: string
    // Is it new, from a TrainDialog or LogDialog
    editType: EditDialogType,
    // When editing and existing log or train dialog
    sourceTrainDialog: CLM.TrainDialog | null
    // Train Dialog that this edit originally came from (not same as sourceTrainDialog)
    originalTrainDialogId: string | null,
    // When editing, the initial history before teach starts
    initialHistory: BB.Activity[]
    lastAction: CLM.ActionBase | null
    allUniqueTags: string[]
    importIndex?: number
    importCount?: number
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(TeachModal))
