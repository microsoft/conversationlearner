/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as CLM from '@conversationlearner/models'
import * as DialogUtils from '../../Utils/dialogUtils'
import * as BB from 'botbuilder'
import DialogMetadata from './DialogMetadata'
import actions from '../../actions'
import EntityExtractor from './EntityExtractor'
import ActionScorer from './ActionScorer'
import MemoryTable from './MemoryTable'
import FormattedMessageId from '../FormattedMessageId'
import { ImportedAction } from '../../types/models'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import { FM } from '../../react-intl-messages'
import { EditDialogType, EditState } from '../../types/const'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import './EditDialogAdmin.css'
import "./TeachSessionModal.css"
import { autobind } from 'core-decorators'

class EditDialogAdmin extends React.Component<Props, ComponentState> {
    constructor(p: Props) {
        super(p)
        this.state = {
            senderType: null,
            roundIndex: null,
            scoreIndex: null
        }
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {

        if (newProps.selectedActivity && newProps.trainDialog) {
            const clData: CLM.CLChannelData = newProps.selectedActivity.channelData.clData
            // If rounds were trimmed, selectedActivity could have been in deleted rounds

            if (clData.roundIndex === null) {
                this.setState({
                    senderType: null,
                    roundIndex: null,
                    scoreIndex: null
                })
                return
            }
            // If past last round, pick previous round, last scorer step
            const lastRoundIndex = newProps.trainDialog.rounds.length - 1
            if (clData.roundIndex > lastRoundIndex) {
                const lastRound = newProps.trainDialog.rounds[lastRoundIndex]
                const roundLastScoreIndex = lastRound.scorerSteps.length - 1
                this.setState({
                    senderType: clData.senderType,
                    roundIndex: lastRoundIndex,
                    scoreIndex: lastRound.scorerSteps.length > 0 ? roundLastScoreIndex : null
                })
                return
            }

            // If no scorer steps
            if (clData.scoreIndex === null) {
                this.setState({
                    senderType: clData.senderType,
                    roundIndex: clData.roundIndex,
                    scoreIndex: null
                })
                return
            }

            // If past last scorer step, pick previous scorer step or null (is is none)
            const lastScoreIndex = newProps.trainDialog.rounds[clData.roundIndex].scorerSteps.length - 1
            if (clData.scoreIndex > lastScoreIndex) {
                this.setState({
                    senderType: clData.senderType,
                    roundIndex: clData.roundIndex,
                    scoreIndex: lastScoreIndex > 0 ? lastScoreIndex : null
                })
                return

            }

            this.setState({
                senderType: clData.senderType,
                roundIndex: clData.roundIndex,
                scoreIndex: clData.scoreIndex
            })
        }
        else {
            this.setState({
                senderType: null,
                roundIndex: null,
                scoreIndex: null
            })
        }
    }

    async hasConflicts(textVariations: CLM.TextVariation[]): Promise<boolean> {

        // Generate list of textVariations that have changed
        const renderData = DialogUtils.getDialogRenderData(this.props.trainDialog, this.props.entities, this.props.actions, this.state.roundIndex, this.state.scoreIndex, this.state.senderType)
        const originalTextVariations = renderData.textVariations
        const changedTextVariations: CLM.TextVariation[] = []
        textVariations.map(tv => {
            const found = originalTextVariations.find(otv => CLM.ModelUtils.areEqualTextVariations(tv, otv))
            if (!found) {
                changedTextVariations.push(tv)
            }
        })

        // Check the changed ones for conflicts

        // First check for internal conflicts
        for (const changedTextVariation of changedTextVariations) {
            const extractConflict = DialogUtils.internalConflict(changedTextVariation, this.props.trainDialog, renderData.roundIndex)
            if (extractConflict) {
                this.props.setTextVariationConflict(extractConflict)
                return true
            }
        }

        const dialogId = this.props.editingLogDialogId ?? this.props.trainDialog.trainDialogId
        // Next against other TrainDialogs
        for (const changedTextVariation of changedTextVariations) {
            const conflict = await ((this.props.fetchTextVariationConflictThunkAsync(
                this.props.app.appId,
                dialogId,
                changedTextVariation,
                // Exclude the originalTrain dialog from check
                this.props.originalTrainDialogId) as any) as Promise<CLM.ExtractResponse | null>)
            if (conflict) {
                return true
            }
        }
        return false
    }

    @autobind
    async onEntityExtractorSubmit(extractResponse: CLM.ExtractResponse, textVariations: CLM.TextVariation[]): Promise<void> {

        if (await this.hasConflicts(textVariations)) {
            return
        }

        this.props.clearExtractResponses()

        // If no conflicts, submit the extractions
        this.props.onSubmitExtraction(extractResponse, textVariations)
    }

    renderHelpText(isLogDialog: boolean) {
        if (isLogDialog) {
            return (
                <div className="cl-dialog-admin__content">
                    <div className="cl-dialog-admin-title">
                        <FormattedMessageId
                            data-testid="dialog-admin-title-traindialog"
                            id={FM.EDITDIALOGADMIN_HELPTEXT_TITLE_LOG}
                        />
                    </div>
                    <div>
                        <FormattedMessageId id={FM.EDITDIALOGADMIN_HELPTEXT_DESCRIPTION_LOG} />
                    </div>
                    <div>
                        <FormattedMessageId id={FM.EDITDIALOGADMIN_HELPTEXT_DESCRIPTION2_LOG} />
                    </div>
                </div>
            )
        }
        else {
            return (
                <div className="cl-dialog-admin__content">
                    <div className="cl-dialog-admin-title">
                        <FormattedMessageId
                            data-testid="dialog-admin-title-traindialog"
                            id={FM.EDITDIALOGADMIN_HELPTEXT_TITLE_TRAIN}
                        />
                    </div>
                    <div>
                        <FormattedMessageId id={FM.EDITDIALOGADMIN_HELPTEXT_DESCRIPTION_TRAIN} />
                    </div>
                    <div>
                        <FormattedMessageId id={FM.EDITDIALOGADMIN_HELPTEXT_DESCRIPTION2_TRAIN} />
                    </div>
                </div>
            )
        }
    }

    render() {
        if (!this.props.trainDialog) {
            return null
        }

        const isLogDialog = (this.props.editType === EditDialogType.LOG_EDITED || this.props.editType === EditDialogType.LOG_ORIGINAL)
        const editTypeClass = this.props.editType === EditDialogType.IMPORT ? "import" : isLogDialog ? 'log' : 'train'
        const hasEndSession = DialogUtils.hasEndSession(this.props.trainDialog, this.props.actions)
        const renderData = DialogUtils.getDialogRenderData(this.props.trainDialog, this.props.entities, this.props.actions, this.state.roundIndex, this.state.scoreIndex, this.state.senderType)
        return (
            <div className={`cl-dialog-admin`}>
                <div className="cl-dialog-admin__header">
                    <div data-testid="traindialog-title" className={`cl-dialog-title cl-dialog-title--${editTypeClass} ${OF.FontClassNames.xxLarge}`}>
                        <OF.Icon
                            iconName={this.props.editType === EditDialogType.IMPORT
                                ? 'DownloadDocument'
                                : isLogDialog
                                    ? 'UserFollowed'
                                    : 'EditContact'}
                        />
                        {this.props.editType === EditDialogType.IMPORT
                            ? "Import"
                            : isLogDialog
                                ? 'Log Dialog'
                                : 'Train Dialog'}
                        {this.props.editType === EditDialogType.IMPORT &&
                            <div className="cl-dialog-importcount">
                                {`${this.props.importIndex} of ${this.props.importCount}`}
                            </div>
                        }
                    </div>
                    <DialogMetadata
                        description={this.props.description}
                        tags={this.props.tags}
                        allUniqueTags={this.props.allUniqueTags}
                        onChangeDescription={this.props.onChangeDescription}
                        onAddTag={this.props.onAddTag}
                        onRemoveTag={this.props.onRemoveTag}
                        readOnly={this.props.editState !== EditState.CAN_EDIT}
                    />
                    <b />
                </div>
                {this.props.selectedActivity && (this.state.senderType === CLM.SenderType.User
                    ? (
                        <div className="cl-dialog-admin__content">
                            <div
                                className={`cl-wc-message cl-wc-message--user cl-wc-message--${editTypeClass}`}
                            >
                                <FormattedMessageId
                                    data-testid="modal-user-input"
                                    id={FM.EDITDIALOGADMIN_DIALOGMODE_USER}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="cl-dialog-admin__content">
                            <div className="cl-wc-message cl-wc-message--bot">
                                <FormattedMessageId
                                    data-testid="modal-bot-response"
                                    id={FM.EDITDIALOGADMIN_DIALOGMODE_TEXT}
                                />
                            </div>
                        </div>
                    ))
                }
                {this.props.selectedActivity ?
                    (<div className="cl-dialog-admin__content">
                        <div className="cl-dialog-admin-title">
                            <FormattedMessageId
                                data-testid="modal-memory-title"
                                id={FM.EDITDIALOGADMIN_MEMORY_TITLE}
                            />
                        </div>
                        <MemoryTable
                            data-testid="modal-memory-table"
                            memories={renderData.memories}
                            prevMemories={renderData.prevMemories}
                        />
                    </div>
                    ) : this.renderHelpText(isLogDialog)
                }
                {this.state.senderType === CLM.SenderType.User &&
                    <div className="cl-dialog-admin__content">
                        <div className="cl-dialog-admin-title">
                            <FormattedMessageId
                                data-testid="dialog-admin-entity-detection"
                                id={FM.EDITDIALOGADMIN_ENTITYDETECTION_TITLE}
                            />
                        </div>
                        <div>
                            {renderData.roundIndex !== null ?
                                <EntityExtractor
                                    data-testid="dialog-admin-entity-extractor"
                                    app={this.props.app}
                                    editingPackageId={this.props.editingPackageId}
                                    originalTrainDialogId={this.props.originalTrainDialogId}
                                    canEdit={this.props.editState === EditState.CAN_EDIT}
                                    extractType={isLogDialog
                                        ? CLM.DialogType.LOGDIALOG
                                        : CLM.DialogType.TRAINDIALOG}
                                    editType={this.props.editType}
                                    teachId={null}
                                    dialogId={this.props.editingLogDialogId
                                        ? this.props.editingLogDialogId
                                        : this.props.trainDialog.trainDialogId}
                                    roundIndex={this.state.roundIndex}
                                    autoTeach={false}
                                    dialogMode={renderData.dialogMode}
                                    extractResponses={this.props.teachSession ? this.props.teachSession.extractResponses : []}
                                    extractConflict={this.props.teachSession ? this.props.teachSession.extractConflict : null}
                                    originalTextVariations={renderData.textVariations}
                                    onSubmitExtractions={this.onEntityExtractorSubmit}
                                    onPendingStatusChanged={this.props.onPendingStatusChanged}
                                />
                                : <span>
                                    <FormattedMessageId id={FM.EDITDIALOGADMIN_ENTITYDETECTION_HELPTEXT} />
                                </span>
                            }
                        </div>
                    </div>
                }
                {renderData.scoreResponse && renderData.scoreInput
                    && this.state.senderType === CLM.SenderType.Bot
                    && <div className="cl-dialog-admin__content">
                        <div className="cl-dialog-admin-title">
                            <FormattedMessageId
                                data-testid="dialog-admin-action"
                                id={FM.EDITDIALOGADMIN_ACTION_TITLE}
                            />
                        </div>
                        <div>
                            <ActionScorer
                                data-testid="dialog-admin-scorer"
                                app={this.props.app}
                                editingPackageId={this.props.editingPackageId}
                                historyItemSelected={true}
                                canEdit={this.props.editState === EditState.CAN_EDIT}
                                isEndSessionAvailable={!hasEndSession && this.props.isLastActivitySelected}
                                dialogType={CLM.DialogType.TRAINDIALOG}
                                autoTeach={false}
                                importedAction={this.props.importedAction}
                                dialogMode={renderData.dialogMode}
                                scoreResponse={renderData.scoreResponse}
                                scoreInput={renderData.scoreInput}
                                selectedActionId={undefined}  // Will always be first one when editing
                                memories={renderData.memories}
                                onActionSelected={this.props.onChangeAction}
                                onActionCreatorClosed={this.props.onActionCreatorClosed}
                            />
                        </div>
                    </div>
                }
            </div>
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        clearExtractResponses: actions.teach.clearExtractResponses,
        fetchTextVariationConflictThunkAsync: actions.train.fetchTextVariationConflictThunkAsync,
        setTextVariationConflict: actions.train.setTextVariationConflict
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    return {
        actions: state.actions,
        entities: state.entities,
        teachSession: state.teachSession
    }
}

interface ComponentState {
    // Did extraction change on edit
    senderType: CLM.SenderType | null,
    roundIndex: number | null,
    scoreIndex: number | null
}

export interface ReceivedProps {
    app: CLM.AppBase
    editingPackageId: string
    trainDialog: CLM.TrainDialog
    // If editing a log dialog, this was the source
    editingLogDialogId: string | null
    // Train Dialog that this edit originally came from
    originalTrainDialogId: string | null
    selectedActivity: BB.Activity | null
    isLastActivitySelected: boolean
    editState: EditState
    editType: EditDialogType
    // If creating an action with a pre-filled text value
    importedAction?: ImportedAction
    onChangeAction: (trainScorerStep: CLM.TrainScorerStep) => void
    onSubmitExtraction: (extractResponse: CLM.ExtractResponse, textVariations: CLM.TextVariation[]) => void
    onPendingStatusChanged: (changed: boolean) => void
    onActionCreatorClosed: () => void
    importIndex?: number
    importCount?: number
    allUniqueTags: string[]
    tags: string[]
    onAddTag: (tag: string) => void
    onRemoveTag: (tag: string) => void

    description: string
    onChangeDescription: (description: string) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(EditDialogAdmin))