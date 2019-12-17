/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as Util from '../../../Utils/util'
import * as ValidityUtils from '../../../Utils/validityUtils'
import * as DialogEditing from '../../../Utils/dialogEditing'
import * as DialogUtils from '../../../Utils/dialogUtils'
import * as OBIUtils from '../../../Utils/obiUtils'
import * as OBIDialogParser from '../../../Utils/obiDialogParser'
import * as OBITranscriptParser from '../../../Utils/obiTranscriptParser'
import * as OF from 'office-ui-fabric-react'
import * as moment from 'moment'
import * as BB from 'botbuilder'
import FormattedMessageId from '../../../components/FormattedMessageId'
import actions from '../../../actions'
import TreeView from '../../../components/modals/TreeView/TreeView'
import TranscriptImporter from '../../../components/modals/TranscriptImporter'
import TranscriptImportWaitModal from '../../../components/modals/TranscriptImportWaitModal'
import ProgressModal from '../../../components/modals/ProgressModal'
import ConfirmCancelModal from '../../../components/modals/ConfirmCancelModal'
import { PartialTrainDialog } from '../../../types/models'
import { withRouter } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State, ErrorType } from '../../../types'
import { EditDialogType, EditState, SelectionType, FeatureStrings } from '../../../types/const'
import { TeachSessionModal, EditDialogModal, MergeModal } from '../../../components/modals'
import { injectIntl, InjectedIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../../../react-intl-messages'
import { TeachSessionState } from '../../../types/StateTypes'
import { autobind } from 'core-decorators'
import { DispatcherAlgorithmType } from '../../../components/modals/DispatcherCreator'
import './TrainDialogs.css'

export interface EditHandlerArgs {
    userInput?: string,
    extractResponse?: CLM.ExtractResponse,
    textVariations?: CLM.TextVariation[],
    trainScorerStep?: CLM.TrainScorerStep
    selectionType?: SelectionType
}

interface IRenderableColumn extends OF.IColumn {
    render: (x: CLM.TrainDialog, component: TrainDialogs) => React.ReactNode
    getSortValue: (trainDialog: CLM.TrainDialog, component: TrainDialogs) => string
}

const returnErrorStringWhenError = Util.returnStringWhenError("ERR")

function textClassName(trainDialog: CLM.TrainDialog): string {
    if (trainDialog.validity === CLM.Validity.INVALID) {
        return `${OF.FontClassNames.mediumPlus} cl-font--highlight`
    }
    return OF.FontClassNames.mediumPlus!
}

function getColumns(intl: InjectedIntl): IRenderableColumn[] {
    const equalizeColumnWidth = window.innerWidth / 3
    return [
        {
            key: `description`,
            name: Util.formatMessageId(intl, FM.TRAINDIALOGS_DESCRIPTION),
            fieldName: `description`,
            minWidth: 100,
            maxWidth: equalizeColumnWidth,
            isResizable: true,
            render: (trainDialog, component) => {
                // TODO: Keep firstInput and lastInput available in DOM until tests are upgraded */}
                const firstInput = DialogUtils.trainDialogFirstInput(trainDialog)
                const lastInput = DialogUtils.trainDialogLastInput(trainDialog)
                const lastResponse = DialogUtils.trainDialogLastResponse(trainDialog, component.props.actions, component.props.entities)

                return <>
                    <span className={textClassName(trainDialog)}>
                        {trainDialog.validity && trainDialog.validity !== CLM.Validity.VALID &&
                            <OF.Icon
                                className={`cl-icon ${ValidityUtils.validityColorClassName(trainDialog.validity)}`}
                                iconName="IncidentTriangle"
                                data-testid="train-dialogs-validity-indicator"
                            />
                        }
                        <span data-testid="train-dialogs-description">
                            {DialogUtils.trainDialogRenderDescription(trainDialog)}
                        </span>
                    </span>
                    {/* TODO: Keep firstInput and lastInput available in DOM until tests are upgraded */}
                    <span style={{ display: "none" }} data-testid="train-dialogs-first-input">{firstInput ? firstInput : ''}</span>
                    <span style={{ display: "none" }} data-testid="train-dialogs-last-input">{lastInput ? lastInput : ''}</span>
                    <span style={{ display: "none" }} data-testid="train-dialogs-last-response">{lastResponse ? lastResponse : ''}</span>
                </>
            },
            getSortValue: trainDialog => trainDialog.description
                ? trainDialog.description
                : DialogUtils.dialogSampleInput(trainDialog)
        },
        {
            key: `tags`,
            name: Util.formatMessageId(intl, FM.TRAINDIALOGS_TAGS),
            fieldName: `tags`,
            minWidth: 100,
            maxWidth: equalizeColumnWidth,
            isResizable: true,
            render: trainDialog => DialogUtils.trainDialogRenderTags(trainDialog),
            getSortValue: trainDialog => trainDialog.tags.join(' ')
        },
        {
            key: 'turns',
            name: Util.formatMessageId(intl, FM.TRAINDIALOGS_TURNS),
            fieldName: 'dialog',
            minWidth: 50,
            maxWidth: 50,
            isResizable: false,
            render: trainDialog => {
                const count = trainDialog.rounds ? trainDialog.rounds.length : 0
                return <span className={textClassName(trainDialog)} data-testid="train-dialogs-turns">{count}</span>
            },
            getSortValue: trainDialog => (trainDialog.rounds ? trainDialog.rounds.length : 0).toString().padStart(4, '0')
        },
        {
            key: 'lastModifiedDateTime',
            name: Util.formatMessageId(intl, FM.TRAINDIALOGS_LAST_MODIFIED_DATE_TIME),
            fieldName: 'lastModifiedDateTime',
            minWidth: 100,
            isResizable: false,
            isSortedDescending: false,
            render: trainDialog => <span className={OF.FontClassNames.mediumPlus} data-testid="train-dialogs-last-modified">{Util.earlierDateOrTimeToday(trainDialog.lastModifiedDateTime)}</span>,
            getSortValue: trainDialog => moment(trainDialog.lastModifiedDateTime).valueOf().toString()
        },
        {
            key: 'created',
            name: Util.formatMessageId(intl, FM.TRAINDIALOGS_CREATED_DATE_TIME),
            fieldName: 'created',
            minWidth: 100,
            isResizable: false,
            render: trainDialog => <span className={OF.FontClassNames.mediumPlus} data-testid="train-dialogs-created">{Util.earlierDateOrTimeToday(trainDialog.createdDateTime)}</span>,
            getSortValue: trainDialog => moment(trainDialog.createdDateTime).valueOf().toString()
        }
    ]
}

const defaultEntityFilter = (intl: InjectedIntl) => ({ key: -1, text: Util.formatMessageId(intl, FM.TRAINDIALOGS_FILTERING_ENTITIES), data: null })
const defaultActionFilter = (intl: InjectedIntl) => ({ key: -1, text: Util.formatMessageId(intl, FM.TRAINDIALOGS_FILTERING_ACTIONS) })
const defaultTagFilter = (intl: InjectedIntl) => ({ key: -1, text: Util.formatMessageId(intl, FM.TRAINDIALOGS_FILTERING_TAGS) })
const getDialogKey = (trainDialog: OF.IObjectWithKey) => (trainDialog as CLM.TrainDialog).trainDialogId

interface TranscriptImportData {
    index: number | undefined
    trainDialogs: CLM.TrainDialog[]
    lgItems: CLM.LGItem[] | undefined
    autoCreate: boolean
    autoMerge: boolean
    autoActionCreate: boolean
    warnings: string[]
    // Conditions are keyed by TrainScorerStep.importId.
    conditions?: { [key: string]: CLM.Condition[] }
    actionImportIdToExpectedEntityName?: { [key: string]: string }
}

interface ComponentState {
    columns: IRenderableColumn[]
    sortColumn: IRenderableColumn
    activityHistory: BB.Activity[]
    lastAction: CLM.ActionBase | null
    isTeachDialogModalOpen: boolean
    isEditDialogModalOpen: boolean
    isTranscriptImportOpen: boolean
    isImportWaitModalOpen: boolean
    transcriptImport: TranscriptImportData | undefined
    isTreeViewModalOpen: boolean
    replayDialogs: CLM.TrainDialog[]
    replayDialogIndex: number
    isReplaySelectedActive: boolean
    isRegenActive: boolean
    mergeExistingTrainDialog: CLM.TrainDialog | null
    mergeNewTrainDialog: CLM.TrainDialog | null
    // Item selected in webchat window
    selectedActivityIndex: number | null
    // Current train dialogs being edited
    currentTrainDialog: CLM.TrainDialog | null
    // If Train Dialog was edited, the original one
    originalTrainDialog: CLM.TrainDialog | null
    // Is Dialog being edited a new one, a TrainDialog or a LogDialog
    editType: EditDialogType
    searchValue: string
    selectionCount: number
    dialogKey: number
    tagsFilter: OF.IDropdownOption | null
    entityFilter: OF.IDropdownOption | null
    actionFilter: OF.IDropdownOption | null
    // Used to prevent screen from flashing when transition to Edit Page
    lastTeachSession: TeachSessionState | null
}

class TrainDialogs extends React.Component<Props, ComponentState> {
    newTeachSessionButtonRef = React.createRef<OF.IButton>()
    state: ComponentState

    private selection: OF.ISelection = new OF.Selection({
        getKey: getDialogKey,
        onSelectionChanged: this.onSelectionChanged
    })

    constructor(props: Props) {
        super(props)
        const columns = getColumns(this.props.intl)
        const lastModifiedColumn = columns.find(c => c.key === 'lastModifiedDateTime')!
        columns.forEach(col => {
            col.isSorted = false
            col.isSortedDescending = false

            if (col === lastModifiedColumn) {
                col.isSorted = true
            }
        })

        this.state = {
            columns: columns,
            sortColumn: lastModifiedColumn,
            activityHistory: [],
            lastAction: null,
            isTeachDialogModalOpen: false,
            isEditDialogModalOpen: false,
            isTranscriptImportOpen: false,
            isImportWaitModalOpen: false,
            transcriptImport: undefined,
            isTreeViewModalOpen: false,
            isReplaySelectedActive: false,
            isRegenActive: false,
            replayDialogs: [],
            replayDialogIndex: 0,
            mergeExistingTrainDialog: null,
            mergeNewTrainDialog: null,
            selectedActivityIndex: null,
            currentTrainDialog: null,
            originalTrainDialog: null,
            editType: EditDialogType.TRAIN_ORIGINAL,
            searchValue: '',
            selectionCount: 0,
            dialogKey: 0,
            tagsFilter: null,
            entityFilter: null,
            actionFilter: null,
            lastTeachSession: null,
        }
    }

    async componentDidMount() {
        this.focusNewTeachSessionButton()
        if (this.props.filteredAction) {
            this.setState({
                actionFilter: this.toActionFilter(this.props.filteredAction, this.props.entities)
            })
        }
        if (this.props.filteredEntity) {
            this.setState({
                entityFilter: this.toEntityFilter(this.props.filteredEntity)
            })
        }
        if (this.props.trainDialogs.length === 0 && this.props.obiImportData?.appId === this.props.app.appId) {
            await this.importOBIFiles(this.props.obiImportData)
        }
        else {
            await this.handleQueryParameters(this.props.location.search)
        }
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {
        // Prevent flash when switching to EditDialogModal by keeping teach session around
        // after teach session has been terminated
        // Will go away once Edit/Teach dialogs are merged
        if (newProps.teachSession?.teach && newProps.teachSession !== this.props.teachSession) {
            this.setState({
                lastTeachSession: { ...this.props.teachSession }
            })
        }
        if (newProps.filteredAction && this.props.filteredAction !== newProps.filteredAction) {
            this.setState({
                actionFilter: this.toActionFilter(newProps.filteredAction, newProps.entities)
            })
        }
        if (newProps.filteredEntity && this.props.filteredEntity !== newProps.filteredEntity) {
            this.setState({
                entityFilter: this.toEntityFilter(newProps.filteredEntity)
            })
        }
        // If train dialogs have been updated, update selected trainDialog too
        if (this.props.trainDialogs !== newProps.trainDialogs) {
            this.focusNewTeachSessionButton()
        }
    }

    async componentDidUpdate(prevProps: Props, prevState: ComponentState) {
        await this.handleQueryParameters(this.props.location.search, prevProps.location.search)
    }

    async handleQueryParameters(newSearch: string, oldSearch?: string): Promise<void> {
        const searchParams = new URLSearchParams(newSearch)
        const selectedDialogId = searchParams.get(DialogUtils.DialogQueryParams.id)

        // Check that I need to update
        if (oldSearch) {
            const searchParamsPrev = new URLSearchParams(oldSearch)
            const selectedDialogIdPrev = searchParamsPrev.get(DialogUtils.DialogQueryParams.id)
            if (selectedDialogId === selectedDialogIdPrev) {
                return
            }
        }

        // If dialog id is in query param and edit modal not open, open it
        if (selectedDialogId &&
            (!this.state.isEditDialogModalOpen && !this.state.isTeachDialogModalOpen)) {
            const trainDialog = this.props.trainDialogs.find(td => td.trainDialogId === selectedDialogId)
            if (!trainDialog) {
                // Invalid train dialog, go back to TD list
                this.props.history.replace(this.props.match.url, { app: this.props.app })
                return
            }
            await this.openTrainDialog(trainDialog)
        }
    }

    sortTrainDialogs(
        trainDialogs: CLM.TrainDialog[],
        columns: IRenderableColumn[],
        sortColumn: IRenderableColumn | undefined,
    ): CLM.TrainDialog[] {
        // If column header not selected, no sorting needed, return items
        if (!sortColumn) {
            return trainDialogs
        }

        return [...trainDialogs]
            .sort((a, b) => {
                // Always put invalid at top (values can also be undefined)
                if (a.validity === CLM.Validity.INVALID && b.validity !== CLM.Validity.INVALID) {
                    return -1
                }
                if (b.validity === CLM.Validity.INVALID && a.validity !== CLM.Validity.INVALID) {
                    return 1
                }

                // Then sort by column value
                let firstValue = sortColumn.getSortValue(a, this)
                let secondValue = sortColumn.getSortValue(b, this)
                let compareValue = firstValue.localeCompare(secondValue)

                // If primary sort is the same do secondary sort on another column, to prevent sort jumping around
                if (compareValue === 0) {
                    const sortColumn2 = (sortColumn !== columns[0])
                        ? columns[0]
                        : columns[1]
                    firstValue = sortColumn2.getSortValue(a, this)
                    secondValue = sortColumn2.getSortValue(b, this)
                    compareValue = firstValue.localeCompare(secondValue)
                }

                return sortColumn.isSortedDescending
                    ? compareValue
                    : compareValue * -1
            })
    }

    @autobind
    onSelectionChanged() {
        const selectionCount = this.selection.getSelectedCount()
        this.setState({ selectionCount })
    }

    @autobind
    onClickColumnHeader(event: any, clickedColumn: IRenderableColumn) {
        const sortColumn = this.state.columns.find(c => c.key === clickedColumn.key)!
        const columns = this.state.columns.map(column => {
            column.isSorted = false
            column.isSortedDescending = false
            if (column === sortColumn) {
                column.isSorted = true
                column.isSortedDescending = !clickedColumn.isSortedDescending
            }
            return column
        })

        this.setState({
            columns,
            sortColumn,
        })
    }

    toActionFilter(action: CLM.ActionBase, entities: CLM.EntityBase[]): OF.IDropdownOption | null {
        try {
            return {
                key: action.actionId,
                text: CLM.ActionBase.GetPayload(action, Util.getDefaultEntityMap(entities))
            }
        }
        catch {
            // Action could have an invalid payload
            return null
        }

    }

    toEntityFilter(entity: CLM.EntityBase): OF.IDropdownOption {
        return {
            key: entity.entityId,
            text: entity.entityName,
            data: entity.negativeId
        }
    }

    @autobind
    onSelectTagsFilter(event: React.FormEvent<HTMLDivElement>, item: OF.IDropdownOption) {
        this.setState({
            tagsFilter: (item.key !== -1) ? item : null
        })
    }

    @autobind
    onSelectEntityFilter(event: React.FormEvent<HTMLDivElement>, item: OF.IDropdownOption) {
        this.setState({
            entityFilter: (item.key !== -1) ? item : null
        })
    }

    @autobind
    onSelectActionFilter(event: React.FormEvent<HTMLDivElement>, item: OF.IDropdownOption) {
        this.setState({
            actionFilter: (item.key !== -1) ? item : null
        })
    }

    @autobind
    async onSetInitialEntities(initialFilledEntityMap: CLM.FilledEntityMap) {

        if (this.props.teachSession.teach) {

            await Util.setStateAsync(this, {
                lastTeachSession: { ...this.props.teachSession }
            })

            await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app) as any) as Promise<void>)

            // Create new one with initial entities
            await this.onClickNewTeachSession(initialFilledEntityMap)
        }
    }

    async onClickNewTeachSession(initialFilledEntityMap: CLM.FilledEntityMap | null = null) {
        try {
            await ((this.props.createTeachSessionThunkAsync(this.props.app.appId, initialFilledEntityMap) as any) as Promise<void>)

            this.setState({
                isTeachDialogModalOpen: true,
                editType: EditDialogType.NEW,
                currentTrainDialog: null,
                originalTrainDialog: null
            })
        }
        catch (error) {
            console.warn(`Error when attempting to create teach session: `, error)
        }
    }

    // If editing an existing train dialog, return its Id, otherwise null
    sourceTrainDialogId(): string | null {
        if (this.state.editType === EditDialogType.BRANCH
            || this.state.editType === EditDialogType.NEW
            || this.state.editType === EditDialogType.IMPORT) {
            return null
        }
        if (this.state.originalTrainDialog) {
            return this.state.originalTrainDialog.trainDialogId
        }

        if (this.state.currentTrainDialog) {
            return this.state.currentTrainDialog.trainDialogId
        }
        return null
    }

    @autobind
    async onCloseTeachSession(save: boolean, tags: string[] = [], description: string = '', stopImport: boolean = false) {
        if (this.props.teachSession?.teach) {
            // Delete the teach session unless it was already closed with and EndSessionAction
            if (this.props.teachSession.dialogMode !== CLM.DialogMode.EndSession) {

                if (save) {
                    // If editing an existing train dialog, extract its dialogId
                    const sourceTrainDialogId = this.sourceTrainDialogId()

                    // Delete the teach session and retrieve the new TrainDialog
                    let newTrainDialog = await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app, true, sourceTrainDialogId) as any) as Promise<CLM.TrainDialog>)
                    newTrainDialog.tags = tags
                    newTrainDialog.description = description

                    // Check to see if new TrainDialog can be merged with an existing TrainDialog
                    const matchedTrainDialog = DialogUtils.findMatchingTrainDialog(newTrainDialog, this.props.trainDialogs, sourceTrainDialogId)
                    if (matchedTrainDialog) {

                        // If editing an existing Train Dialog, replace existing with the new one
                        if (sourceTrainDialogId) {
                            await ((this.props.trainDialogReplaceThunkAsync(this.props.app.appId, sourceTrainDialogId, newTrainDialog) as any) as Promise<void>)
                            // Grab the replaced version
                            const updatedTrainDialog = this.props.trainDialogs.find(td => td.trainDialogId === sourceTrainDialogId)
                            if (!updatedTrainDialog) {
                                throw new Error(`Unexpected missing TrainDialog ${sourceTrainDialogId}`)
                            }
                            newTrainDialog = updatedTrainDialog
                        }

                        await this.handlePotentialMerge(newTrainDialog, matchedTrainDialog)
                        return
                    }
                    else {
                        // If editing an existing Train Dialog, replace existing with the new one
                        if (sourceTrainDialogId) {
                            await ((this.props.trainDialogReplaceThunkAsync(this.props.app.appId, sourceTrainDialogId, newTrainDialog) as any) as Promise<void>)
                        }
                        // Otherwise just update the tags and description
                        else {
                            await ((this.props.editTrainDialogThunkAsync(this.props.app.appId, { trainDialogId: newTrainDialog.trainDialogId, tags, description }) as any) as Promise<void>)
                        }
                    }
                }
                // Just delete the teach session without saving
                else {
                    await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app) as any) as Promise<void>)
                }
            }
        }
        await Util.setStateAsync(this, {
            isTeachDialogModalOpen: false,
            activityHistory: [],
            lastAction: null,
            currentTrainDialog: null,
            // originalTrainDialogId - do not clear. Need for later
            dialogKey: this.state.dialogKey + 1
        })

        if (!this.haveTrainDialogsToImport()) {
            if (stopImport) {
                this.setState({ transcriptImport: undefined })
            }
            else {
                await this.onImportNextTrainDialog()
            }
        }

        // Remove active dialog from query parameter if present
        const searchParams = new URLSearchParams(this.props.location.search)
        const selectedDialogId = searchParams.get(DialogUtils.DialogQueryParams.id)
        if (selectedDialogId) {
            this.props.history.replace(this.props.match.url, { app: this.props.app })
        }
    }

    async handlePotentialMerge(newTrainDialog: CLM.TrainDialog, matchedTrainDialog: CLM.TrainDialog) {

        // If importing and auto merge set, do the merge automatically
        if (this.state.editType === EditDialogType.IMPORT && this.state.transcriptImport?.autoMerge) {
            // Use default merged tags and descriptions by passing in nulls
            await this.mergeTrainDialogs(newTrainDialog, matchedTrainDialog, null, null)
        }
        // Otherwise ask the user if they want to merge
        else {
            this.setState({
                mergeExistingTrainDialog: matchedTrainDialog,
                mergeNewTrainDialog: newTrainDialog,
                isTeachDialogModalOpen: false
            })
        }
    }

    @autobind
    async onInsertAction(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity, isLastActivity: boolean, selectionType: SelectionType) {
        try {
            const newTrainDialog = await DialogEditing.onInsertAction(
                trainDialog,
                selectedActivity,
                isLastActivity,
                this.props.entities,
                this.props.actions,
                this.props.app.appId,
                this.props.scoreFromTrainDialogThunkAsync as any,
                this.props.clearWebchatScrollPosition,
            )

            await this.onUpdateActivities(newTrainDialog, selectedActivity, selectionType, this.state.editType)
        }
        catch (error) {
            console.warn(`Error when attempting to insert an Action `, { error })
        }
    }

    @autobind
    async onChangeAction(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity, trainScorerStep: CLM.TrainScorerStep | undefined) {
        if (!trainScorerStep) {
            throw new Error(`You attempted to change an Action but the step you are editing was undefined. Please open an issue.`)
        }

        try {
            const newTrainDialog = await DialogEditing.onChangeAction(
                trainDialog,
                selectedActivity,
                trainScorerStep,
                this.state.editType,
                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.state.transcriptImport ? this.state.transcriptImport.lgItems : undefined,
                this.props.trainDialogReplayThunkAsync as any,
                this.props.editActionThunkAsync as any
            )

            await this.onUpdateActivities(newTrainDialog, selectedActivity, SelectionType.NONE, this.state.editType)
        }
        catch (error) {
            console.warn(`Error when attempting to change an Action: `, error)
        }
    }

    @autobind
    async onChangeExtraction(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity, extractResponse: CLM.ExtractResponse | undefined, textVariations: CLM.TextVariation[] | undefined) {
        if (!extractResponse || !textVariations) {
            throw new Error("missing args")
        }

        try {
            const newTrainDialog = await DialogEditing.onChangeExtraction(
                trainDialog,
                selectedActivity,
                textVariations,
                this.state.editType,
                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.props.trainDialogReplayThunkAsync as any,
            )

            await this.onUpdateActivities(newTrainDialog, selectedActivity, SelectionType.NONE, this.state.editType)
        }
        catch (error) {
            console.warn(`Error when attempting to change extraction: `, error)
        }
    }

    @autobind
    async onDeleteTurn(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity) {
        const newTrainDialog = await DialogEditing.onDeleteTurn(
            trainDialog,
            selectedActivity,
            this.props.app.appId,
            this.props.entities,
            this.props.actions,
            this.props.trainDialogReplayThunkAsync as any,
        )

        await this.onUpdateActivities(newTrainDialog, selectedActivity, SelectionType.CURRENT, this.state.editType)
    }

    @autobind
    async onReplayTrainDialog(trainDialog: CLM.TrainDialog) {
        try {
            const newTrainDialog = await DialogEditing.onReplayTrainDialog(
                trainDialog,
                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.props.trainDialogReplayThunkAsync as any,
            )

            await this.onUpdateActivities(newTrainDialog, null, SelectionType.NONE, this.state.editType)
        }
        catch (error) {
            console.warn(`Error when attempting to Replay a train dialog: `, error)
        }
    }

    @autobind
    async onBranchTrainDialog(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity, inputText: string) {

        try {
            const clData: CLM.CLChannelData = selectedActivity.channelData.clData
            const roundIndex = clData.roundIndex!
            const definitions = {
                entities: this.props.entities,
                actions: this.props.actions,
                trainDialogs: []
            }

            // Copy, Remove rounds / scorer steps below branch
            let newTrainDialog = Util.deepCopy(trainDialog)
            newTrainDialog.definitions = definitions
            newTrainDialog.rounds = newTrainDialog.rounds.slice(0, roundIndex)

            const userInput: CLM.UserInput = { text: inputText }

            // Get extraction
            const extractResponse = await ((this.props.extractFromTrainDialogThunkAsync(this.props.app.appId, newTrainDialog, userInput) as any) as Promise<CLM.ExtractResponse>)

            if (!extractResponse) {
                throw new Error("No extract response")
            }

            const textVariations = CLM.ModelUtils.ToTextVariations([extractResponse])
            const extractorStep: CLM.TrainExtractorStep = { textVariations }

            // Create new round
            const newRound = {
                extractorStep,
                scorerSteps: []
            }

            // Append new Round
            newTrainDialog.rounds.push(newRound)

            // Replay logic functions on train dialog
            newTrainDialog = await ((this.props.trainDialogReplayThunkAsync(this.props.app.appId, newTrainDialog) as any) as Promise<CLM.TrainDialog>)

            // Allow to scroll to bottom
            this.props.clearWebchatScrollPosition()

            await this.onUpdateActivities(newTrainDialog, selectedActivity, SelectionType.NONE, EditDialogType.BRANCH)
        }
        catch (error) {
            console.warn(`Error when attempting to create teach session from activityHistory: `, error)
        }
    }

    @autobind
    async onInsertInput(trainDialog: CLM.TrainDialog, selectedActivity: BB.Activity, inputText: string, selectionType: SelectionType) {
        try {
            const newTrainDialog = await DialogEditing.onInsertInput(
                trainDialog,
                selectedActivity,
                inputText,

                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.props.extractFromTrainDialogThunkAsync as any,
                this.props.trainDialogReplayThunkAsync as any,
                this.props.clearWebchatScrollPosition,
            )

            await this.onUpdateActivities(newTrainDialog, selectedActivity, selectionType, this.state.editType)
        }
        catch (error) {
            console.warn(`Error when attempting to create teach session from activityHistory: `, error)
        }
    }

    @autobind
    onCloseTreeView() {
        this.setState({ isTreeViewModalOpen: false })
    }

    @autobind
    onOpenTreeView() {
        this.setState({ isTreeViewModalOpen: true })
    }

    @autobind
    async mergeTrainDialogs(newTrainDialog: CLM.TrainDialog, matchedTrainDialog: CLM.TrainDialog, description: string | null, tags: string[] | null) {

        // If editing an existing train dialog, extract its dialogId
        const sourceTrainDialogId = this.sourceTrainDialogId()

        await ((this.props.trainDialogMergeThunkAsync(this.props.app.appId, newTrainDialog, matchedTrainDialog, description, tags, sourceTrainDialogId) as any) as Promise<void>)

        await Util.setStateAsync(this, {
            mergeExistingTrainDialog: null,
            mergeNewTrainDialog: null,
            isTeachDialogModalOpen: false,
            activityHistory: [],
            lastAction: null,
            currentTrainDialog: null,
            // originalTrainDialogId - do not clear. Need for later
            dialogKey: this.state.dialogKey + 1
        })

        if (this.haveTrainDialogsToImport()) {
            await this.onImportNextTrainDialog()
        }
    }

    haveTrainDialogsToImport(): boolean {
        return (this.state.transcriptImport?.trainDialogs !== undefined
            && this.state.transcriptImport.trainDialogs.length > 0)
    }

    @autobind
    async onCloseMergeModal(shouldMerge: boolean, description: string = "", tags: string[] = []) {

        if (!this.state.mergeNewTrainDialog || !this.state.mergeExistingTrainDialog) {
            throw new Error("Expected merge props to be set")
        }

        // If editing an existing train dialog, extract its dialogId
        const sourceTrainDialogId = this.sourceTrainDialogId()

        if (shouldMerge) {
            await this.mergeTrainDialogs(this.state.mergeNewTrainDialog, this.state.mergeExistingTrainDialog, description, tags)
        }
        else {
            // The dialog exists as side affect of closing each session but tags and description where not updated since merge modal was possible.
            const partialDialog: PartialTrainDialog = {
                trainDialogId: this.state.mergeNewTrainDialog.trainDialogId,
                tags: this.state.mergeNewTrainDialog.tags,
                description: this.state.mergeNewTrainDialog.description
            }

            await ((this.props.editTrainDialogThunkAsync(this.props.app.appId, partialDialog) as any) as Promise<void>)

            // If editing an existing Train Dialog, replace existing with the new one
            if (sourceTrainDialogId) {
                await ((this.props.trainDialogReplaceThunkAsync(this.props.app.appId, sourceTrainDialogId, this.state.mergeNewTrainDialog) as any) as Promise<void>)
            }

            await Util.setStateAsync(this, {
                mergeExistingTrainDialog: null,
                mergeNewTrainDialog: null,
                isTeachDialogModalOpen: false,
                activityHistory: [],
                lastAction: null,
                currentTrainDialog: null,
                // originalTrainDialogId - do not clear. Need for later
                dialogKey: this.state.dialogKey + 1
            })

            if (this.haveTrainDialogsToImport()) {
                await this.onImportNextTrainDialog()
            }
        }
    }

    onDeleteTrainDialog() {
        if (!this.state.currentTrainDialog) {
            throw new Error(`You attempted to delete a train dialog, but currentTrainDialog is not defined. Please open an issue.`)
        }

        this.setState({
            isEditDialogModalOpen: false,
        })

        const deleteDialogId = this.state.currentTrainDialog.trainDialogId
        this.props.deleteTrainDialogThunkAsync(this.props.app, deleteDialogId)
        this.props.fetchApplicationTrainingStatusThunkAsync(this.props.app.appId)
        void this.onCloseEditDialogModal()
    }

    // End Session activity selected.  Switch from Teach to Edit
    @autobind
    async onEndSessionActivity(tags: string[] = [], description: string = '') {

        try {
            if (this.props.teachSession.teach) {
                // Get train dialog associated with the teach session
                const trainDialog = await ((this.props.fetchTrainDialogThunkAsync(this.props.app.appId, this.props.teachSession.teach.trainDialogId, false) as any) as Promise<CLM.TrainDialog>)
                trainDialog.tags = tags
                trainDialog.description = description
                trainDialog.definitions = {
                    entities: this.props.entities,
                    actions: this.props.actions,
                    trainDialogs: []
                }

                // Delete the teach session w/o saving
                await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app) as any) as Promise<void>)

                // Generate activityHistory
                await this.onUpdateActivities(trainDialog, null, SelectionType.NONE, this.state.editType)
            }
        }
        catch (error) {
            console.warn(`Error when attempting to use EndSession Action`, error)
        }
    }

    @autobind
    async onUpdateActivities(newTrainDialog: CLM.TrainDialog, selectedActivity: BB.Activity | null, selectionType: SelectionType, editDialogType: EditDialogType) {
        const originalId = this.state.originalTrainDialog || this.state.currentTrainDialog

        try {
            const { teachWithActivities, activityIndex } = await DialogEditing.onUpdateActivities(
                newTrainDialog,
                selectedActivity,
                selectionType,

                this.props.app.appId,
                this.props.user,
                this.props.fetchActivitiesThunkAsync as any
            )

            const editType =
                (editDialogType !== EditDialogType.NEW &&
                    editDialogType !== EditDialogType.BRANCH &&
                    editDialogType !== EditDialogType.IMPORT)
                    ? EditDialogType.TRAIN_EDITED
                    : editDialogType

            await Util.setStateAsync(this, {
                activityHistory: teachWithActivities.activities,
                lastAction: teachWithActivities.lastAction,
                currentTrainDialog: newTrainDialog,
                originalTrainDialog: originalId,
                selectedActivityIndex: activityIndex,
                isEditDialogModalOpen: true,
                isTeachDialogModalOpen: false,
                editType
            })

            // If auto importing and new dialog has matched all actions
            if (this.state.transcriptImport?.autoCreate && !DialogUtils.hasImportActions(newTrainDialog)) {
                // Fetch activityHistory as needed for validation checks
                await Util.setStateAsync(this, {
                    activityHistory: teachWithActivities.activities,
                    editType: EditDialogType.IMPORT
                })
                newTrainDialog.validity = CLM.Validity.VALID
                await this.onCreateTrainDialog(newTrainDialog)
            }
        }
        catch (error) {
            console.warn(`Error when attempting to update activityHistory: `, error)
        }
    }

    async onContinueTrainDialog(newTrainDialog: CLM.TrainDialog, initialUserInput: CLM.UserInput) {

        try {
            if (this.props.teachSession?.teach) {
                // Delete the teach session w/o saving
                await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app) as any) as Promise<void>)
            }

            const conflictIgnoreId = this.state.currentTrainDialog ? this.state.currentTrainDialog.trainDialogId : null
            const teachWithActivities = await ((this.props.createTeachSessionFromTrainDialogThunkAsync(this.props.app, newTrainDialog, this.props.user.name, this.props.user.id, initialUserInput, conflictIgnoreId) as any) as Promise<CLM.TeachWithActivities>)

            const editType =
                (this.state.editType !== EditDialogType.NEW &&
                    this.state.editType !== EditDialogType.BRANCH &&
                    this.state.editType !== EditDialogType.IMPORT)
                    ? EditDialogType.TRAIN_EDITED : this.state.editType

            // Update currentTrainDialog with tags and description
            const currentTrainDialog = this.state.currentTrainDialog ? {
                ...this.state.currentTrainDialog,
                tags: newTrainDialog.tags,
                description: newTrainDialog.description
            } : null

            // Note: Don't clear currentTrainDialog so I can delete it if I save my edits
            this.setState({
                activityHistory: teachWithActivities.activities,
                lastAction: teachWithActivities.lastAction,
                isEditDialogModalOpen: false,
                selectedActivityIndex: null,
                isTeachDialogModalOpen: true,
                editType,
                currentTrainDialog
            })
        }
        catch (error) {
            console.warn(`Error when attempting to Continue a train dialog: `, error)
        }
    }

    // Replace the current trainDialog with a new one
    async onReplaceTrainDialog(newTrainDialog: CLM.TrainDialog) {

        this.setState({
            isEditDialogModalOpen: false,
        })

        try {
            const validity = DialogUtils.getTrainDialogValidity(newTrainDialog, this.state.activityHistory)

            const originalTrainDialogId = this.state.originalTrainDialog ? this.state.originalTrainDialog.trainDialogId : null

            // Remove any data added for rendering
            DialogUtils.cleanTrainDialog(newTrainDialog)

            newTrainDialog.validity = validity
            newTrainDialog.trainDialogId = originalTrainDialogId || newTrainDialog.trainDialogId
            newTrainDialog.definitions = null

            // Check to see if it can be merged with an existing TrainDialog
            const matchedTrainDialog = DialogUtils.findMatchingTrainDialog(newTrainDialog, this.props.trainDialogs, originalTrainDialogId)
            if (matchedTrainDialog) {
                await this.handlePotentialMerge(newTrainDialog, matchedTrainDialog)
                return
            }
            // Otherwise save as a new TrainDialog
            else {
                await ((this.props.editTrainDialogThunkAsync(this.props.app.appId, newTrainDialog) as any) as Promise<void>)
                await this.onCloseEditDialogModal()
            }
        }
        catch (error) {
            console.warn(`Error when attempting to replace an edited train dialog: `, error)
        }
    }

    // Create a new trainDialog
    async onCreateTrainDialog(newTrainDialog: CLM.TrainDialog) {

        this.setState({
            isEditDialogModalOpen: false,
        })

        newTrainDialog.validity = DialogUtils.getTrainDialogValidity(newTrainDialog, this.state.activityHistory)

        // Remove dummy scorer rounds used for rendering
        newTrainDialog.rounds.forEach(r => r.scorerSteps = r.scorerSteps.filter(ss => {
            return ss.labelAction !== undefined
        }))

        // Check to see if new TrainDialog can be merged with an existing TrainDialog
        const matchedTrainDialog = DialogUtils.findMatchingTrainDialog(newTrainDialog, this.props.trainDialogs)
        if (matchedTrainDialog) {
            await this.handlePotentialMerge(newTrainDialog, matchedTrainDialog)
        }
        else {
            try {
                await ((this.props.createTrainDialogThunkAsync(this.props.app.appId, newTrainDialog) as any) as Promise<CLM.TrainDialog>)
            }
            catch (error) {
                console.warn(`Error when attempting to create a train dialog: `, error)
            }

            void this.onCloseEditDialogModal()
        }
    }

    @autobind
    async selectTrainDialog(trainDialog: CLM.TrainDialog, roundIndex: number, scoreIndex: number | null) {
        const selectedActivityIndex = DialogUtils.activityIndexFromRound(trainDialog, roundIndex, scoreIndex) || null
        await this.openTrainDialog(trainDialog, EditDialogType.TRAIN_ORIGINAL, selectedActivityIndex)
    }

    @autobind
    async onClickTrainDialogItem(trainDialog: CLM.TrainDialog) {
        const { history } = this.props
        let url = `${this.props.match.url}?id=${trainDialog.trainDialogId}`
        history.push(url, { app: this.props.app })
    }

    @autobind
    async onClickReplaySelected() {
        const selectedTrainDialogs = this.selection.getSelection() as CLM.TrainDialog[]
        await Util.setStateAsync(this, {
            isReplaySelectedActive: true,
            replayDialogs: selectedTrainDialogs,
            replayDialogIndex: 0
        })

        for (const [trainDialogIndex, trainDialog] of this.state.replayDialogs.entries()) {
            await Util.setStateAsync(this, {
                replayDialogIndex: trainDialogIndex,
            })

            const newTrainDialog = await DialogEditing.onReplayTrainDialog(
                trainDialog,
                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.props.trainDialogReplayThunkAsync as any,
            )

            // Get new activities to check for errors or warnings
            const teachWithActivities = await ((this.props.fetchActivitiesThunkAsync(this.props.app.appId, newTrainDialog, this.props.user.name, this.props.user.id) as any) as Promise<CLM.TeachWithActivities>)
            const replayError = DialogUtils.getMostSevereReplayError(teachWithActivities.activities)

            if (replayError) {
                if (replayError.errorLevel === CLM.ReplayErrorLevel.WARNING) {
                    newTrainDialog.validity = CLM.Validity.WARNING
                }
                else {
                    newTrainDialog.validity = CLM.Validity.INVALID
                }
            }
            else {
                newTrainDialog.validity = CLM.Validity.VALID
            }

            await ((this.props.trainDialogReplaceThunkAsync(this.props.app.appId, trainDialog.trainDialogId, newTrainDialog, false) as any) as Promise<void>)

            // If user clicks 'Cancel' replay dialogs will be reset
            if (this.state.replayDialogs.length === 0) {
                console.warn(`Replay Selected Dialogs Canceled!`)
                break
            }
        }

        this.setState({
            isReplaySelectedActive: false,
            replayDialogs: [],
            replayDialogIndex: 0,
        })
    }

    @autobind
    async onClickRegen() {
        await Util.setStateAsync(this, {
            isRegenActive: true,
        })

        let algorithmType = DispatcherAlgorithmType.DeterministicSingleTransfer
        const match = (this.props.app.metadata.markdown || '').match(/Type: ([\w ]+)/)
        if (match?.[1]) {
            console.log(`Dispatch Algorithm Type: `, { match })
            // TODO: Find way to extract algorithm type
        }

        this.props.regenerateDispatchTrainDialogsAsync(this.props.app.appId, algorithmType, this.props.actions, this.props.trainDialogs)

        this.setState({
            isRegenActive: false,
        })
    }

    async importOBIFiles(obiImportData: OBIUtils.OBIImportData): Promise<void> {
        const obiDialogParser = new OBIDialogParser.ObiDialogParser(
            this.props.app.appId,
            this.props.actions,
            this.props.entities,
            this.props.createActionThunkAsync as any,
            this.props.createEntityThunkAsync as any)
        try {
            const obiParseResult = await obiDialogParser.parse(obiImportData.files)

            const transcriptImport: TranscriptImportData = {
                index: undefined,
                trainDialogs: obiParseResult.trainDialogs,
                lgItems: obiParseResult.lgItems,
                autoCreate: obiImportData.autoCreate,
                autoMerge: obiImportData.autoMerge,
                autoActionCreate: obiImportData.autoActionCreate,
                warnings: obiParseResult.warnings,
                conditions: obiParseResult.conditions,
                actionImportIdToExpectedEntityName: obiParseResult.actionImportIdToExpectedEntityName,
            }

            await Util.setStateAsync(this, {
                transcriptImport
            })

            if (obiParseResult.warnings.length === 0) {
                await this.onImportNextTrainDialog()
            }
        }
        catch (error) {
            await Util.setStateAsync(this, {
                transcriptImport: undefined
            })
            const message = error.currentTarget ? error.currentTarget.error.message : error.message
            this.props.setErrorDisplay(ErrorType.Error, "Import Failed", message)
        }
    }

    @autobind
    async onCloseImportWarning(cancel: boolean): Promise<void> {
        // Delete app if user chooses to cancel or there are no imported train dialogs
        if (cancel || this.state.transcriptImport?.trainDialogs.length === 0) {
            this.setState({ transcriptImport: undefined })
            this.props.onDeleteApp(this.props.app.appId)
        }
        // Otherwise start the import
        else if (this.state.transcriptImport) {
            await Util.setStateAsync(this, { transcriptImport: { ...this.state.transcriptImport, warnings: [] } })
            await this.onImportNextTrainDialog()
        }
    }
    //-----------------------------
    // Transcript import
    //-----------------------------
    @autobind
    onClickImportTranscripts(): void {
        this.setState({
            isTranscriptImportOpen: true
        })
    }

    @autobind
    onCancelImportTranscripts(): void {
        this.setState({
            isTranscriptImportOpen: false
        })
    }

    @autobind
    async onSubmitImportTranscripts(transcriptFiles: File[], lgFiles: File[], autoCreate: boolean, autoMerge: boolean, autoActionCreate: boolean): Promise<void> {

        await Util.setStateAsync(this, {
            isTranscriptImportOpen: false,

        })

        if (transcriptFiles.length === 0) {
            return
        }

        const obiTranscriptParser = new OBITranscriptParser.ObiTranscriptParser(
            this.props.app,
            this.props.actions,
            this.props.entities,
            this.props.trainDialogs,
            this.props.createActionThunkAsync as any,
            this.props.createEntityThunkAsync as any
        )

        try {
            const trainDialogs = await obiTranscriptParser.getTrainDialogs(transcriptFiles, lgFiles)

            const transcriptImport: TranscriptImportData = {
                index: undefined,
                autoCreate,
                autoMerge,
                autoActionCreate,
                trainDialogs,
                lgItems: undefined,
                warnings: []
            }

            await Util.setStateAsync(this, {
                isTranscriptImportOpen: false,
                transcriptImport
            })

            await this.onImportNextTrainDialog()
        }
        catch (e) {
            const error = e as Error
            this.props.setErrorDisplay(ErrorType.Error, error.message, "")
            this.setState({
                transcriptImport: undefined,
                isImportWaitModalOpen: false
            })
        }
    }

    // Import a train dialog
    async onImportNextTrainDialog(): Promise<void> {

        if (!this.haveTrainDialogsToImport() || !this.state.transcriptImport) {
            return
        }
        const importData = this.state.transcriptImport
        // Set or increment import index.
        importData.index = importData.index === undefined ? 0 : importData.index + 1
        await Util.setStateAsync(this, { transcriptImport: importData })

        // Check if I'm done importing
        if (importData.index === undefined || importData.index >= importData.trainDialogs.length) {
            this.setState({
                transcriptImport: undefined,
                isImportWaitModalOpen: false
            })
            return
        }

        this.setState({ isImportWaitModalOpen: true })

        let trainDialog = importData.trainDialogs[importData.index]

        // Extract entities, if the model has any custom-trained entities.
        if (this.props.entities.length > 0 && this.props.entities.find(e => e.entityType === CLM.EntityType.LUIS) !== undefined) {
            await this.addEntityExtractions(trainDialog)
        }

        // Replay to fill in memory
        let newTrainDialog = await DialogEditing.onReplayTrainDialog(
            trainDialog,
            this.props.app.appId,
            this.props.entities,
            this.props.actions,
            this.props.trainDialogReplayAsync as any,
        )

        DialogUtils.cleanTrainDialog(newTrainDialog)

        // Try to map action again now that we have entities
        OBIUtils.replaceImportActions(newTrainDialog, this.props.actions, this.props.entities)

        // Automatically create actions for imported actions if requested
        if (importData.autoActionCreate) {
            await OBIUtils.createImportedActions(
                this.props.app.appId,
                newTrainDialog,
                this.props.botInfo.templates,
                importData.lgItems,
                this.props.actions,
                this.props.entities,
                importData.conditions,
                importData.actionImportIdToExpectedEntityName,
                this.props.createActionThunkAsync as any,
            )

            // Update memory state, if applicable.
            OBIUtils.setMemoryStateForImportedTrainDialog(
                this.props.entities,
                this.props.actions,
                newTrainDialog,
                importData.conditions,
            )

            // Replay to validate
            newTrainDialog = await DialogEditing.onReplayTrainDialog(
                newTrainDialog,
                this.props.app.appId,
                this.props.entities,
                this.props.actions,
                this.props.trainDialogReplayAsync as any,
            )
        }

        await Util.setStateAsync(this, {
            originalTrainDialog: newTrainDialog
        })

        // If auto importing and new dialog has matched all actions
        if (importData.autoCreate && !DialogUtils.hasImportActions(newTrainDialog)) {
            // Fetch activityHistory as needed for validation checks
            const teachWithActivities = await ((this.props.fetchActivitiesThunkAsync(this.props.app.appId, newTrainDialog, this.props.user.name, this.props.user.id) as any) as Promise<CLM.TeachWithActivities>)
            await Util.setStateAsync(this, {
                activityHistory: teachWithActivities.activities,
                editType: EditDialogType.IMPORT
            })
            newTrainDialog.validity = CLM.Validity.VALID

            await this.onCreateTrainDialog(newTrainDialog)
        }
        else {
            // Expand LGItems from name to full text
            if (importData.lgItems) {
                OBIUtils.expandLGItems(newTrainDialog, importData.lgItems)
            }
            this.setState({ isImportWaitModalOpen: false })
            await this.openTrainDialog(newTrainDialog, EditDialogType.IMPORT)
        }
    }

    async addEntityExtractions(trainDialog: CLM.TrainDialog) {
        // TODO: Consider checking locally stored TrainDialogs first for matches to lighten load on server

        // Generate list of all unique user utterances
        const userInput: string[] = []
        trainDialog.rounds.forEach(round => round.extractorStep.textVariations.forEach(textVariation => userInput.push(textVariation.text)))
        const uniqueInput = [...new Set(userInput)]

        // Get extraction results
        const extractResponses = await ((this.props.fetchExtractionsThunkAsync(this.props.app.appId, uniqueInput) as any) as Promise<CLM.ExtractResponse[]>)

        if (!extractResponses) {
            throw new Error("Failed to process entity extractions")
        }

        // Now swap in any extract values
        trainDialog.rounds.forEach(round => round.extractorStep.textVariations
            .forEach(textVariation => {
                const extractResponse = extractResponses.find(er => er.text === textVariation.text)
                if (extractResponse && extractResponse.predictedEntities.length > 0) {
                    textVariation.labelEntities = CLM.ModelUtils.ToLabeledEntities(extractResponse.predictedEntities)
                }
            })
        )
    }

    async onCloseEditDialogModal(reload: boolean = false, stopImport: boolean = false) {

        if (this.props.teachSession?.teach) {
            // Delete the teach session w/o saving
            await ((this.props.deleteTeachSessionThunkAsync(this.props.teachSession.teach, this.props.app) as any) as Promise<void>)
        }

        if (reload && this.state.originalTrainDialog) {
            // Reload local copy
            await ((this.props.fetchTrainDialogThunkAsync(this.props.app.appId, this.state.originalTrainDialog.trainDialogId, true) as any) as Promise<CLM.TrainDialog>)
        }
        await Util.setStateAsync(this, {
            isEditDialogModalOpen: false,
            selectedActivityIndex: null,
            currentTrainDialog: null,
            // originalTrainDialog: Do not clear.  Save for later
            activityHistory: [],
            lastAction: null,
            dialogKey: this.state.dialogKey + 1
        })

        // Remove selection from query parameter
        const searchParams = new URLSearchParams(this.props.location.search)
        const selectedDialogId = searchParams.get(DialogUtils.DialogQueryParams.id)
        if (selectedDialogId) {
            this.props.history.replace(this.props.match.url, { app: this.props.app })
        }

        if (this.haveTrainDialogsToImport()) {
            if (stopImport) {
                // If I was doing an OBI import and abandoned, delete the train dialog
                if (this.props.obiImportData?.appId === this.props.app.appId) {
                    this.props.onDeleteApp(this.props.app.appId)
                }
                // Otherwise just clear dialogs to be imported
                else {
                    this.setState({ transcriptImport: undefined })
                }
            }
            else {
                await this.onImportNextTrainDialog()
            }
        }
    }

    @autobind
    onChangeSearchString(event?: React.ChangeEvent<HTMLInputElement>, newValue?: string) {
        if (typeof newValue === 'undefined') {
            return
        }

        this.onSearch(newValue)
    }

    @autobind
    onSearch(newValue: string) {
        const lcString = newValue.toLowerCase()
        this.setState({
            searchValue: lcString
        })
    }

    @autobind
    onClickCancelReplaySelected() {
        this.setState({
            replayDialogs: []
        })
    }

    getFilteredDialogs(
        trainDialogs: CLM.TrainDialog[],
    ): CLM.TrainDialog[] {
        if (!this.isFilter()) {
            return trainDialogs
        }

        // TODO: Consider caching as not very efficient
        return trainDialogs.filter(trainDialog => {
            const entitiesInTD: CLM.EntityBase[] = []
            const actionsInTD: CLM.ActionBase[] = []
            const textVariations: string[] = []

            for (const round of trainDialog.rounds) {
                for (const variation of round.extractorStep.textVariations) {
                    textVariations.push(variation.text)
                    for (const le of variation.labelEntities) {
                        // Include pos and neg examples of entity if reversable
                        const entity = this.props.entities.find(e => e.entityId === le.entityId)
                        if (!entity) {
                            continue
                        }

                        entitiesInTD.push(entity)
                        const negativeEntity = this.props.entities.find(e => e.entityId === entity.negativeId)
                        if (!negativeEntity) {
                            continue
                        }
                        entitiesInTD.push(negativeEntity)
                    }
                }
                for (const ss of round.scorerSteps) {
                    const foundAction = this.props.actions.find(a => a.actionId === ss.labelAction)
                    // Invalid train dialogs can contain deleted actions
                    if (!foundAction) {
                        continue
                    }

                    actionsInTD.push(foundAction)

                    // Need to check filledEntities for programmatic only entities
                    const entities = ss.input.filledEntities
                        .map((fe: any) => fe.entityId)
                        .filter(Util.notNullOrUndefined)
                        .map((entityId: any) => this.props.entities.find(e => e.entityId === entityId))
                        .filter(Util.notNullOrUndefined)

                    entitiesInTD.push(...entities)
                }
            }

            // Filter out train dialogs that don't match filters (data = negativeId for multivalue)
            const entityFilter = this.state.entityFilter
            if (entityFilter?.key
                && !entitiesInTD.find(en => en.entityId === entityFilter.key)
                && !entitiesInTD.find(en => en.entityId === entityFilter.data)) {
                return false
            }
            const actionFilter = this.state.actionFilter
            if (actionFilter?.key
                && !actionsInTD.find(a => a.actionId === actionFilter.key)) {
                return false
            }

            const tagFilter = this.state.tagsFilter
            if (tagFilter && tagFilter.key !== null
                && !trainDialog.tags.map(tag => tag.toLowerCase()).includes(tagFilter.text.toLowerCase())) {
                return false
            }

            const entityNames = entitiesInTD.map(e => e.entityName)
            const actionPayloads = actionsInTD.map(a => {
                try {
                    return CLM.ActionBase.GetPayload(a, Util.getDefaultEntityMap(this.props.entities))
                }
                catch {
                    // Backwards compatibility to models with old payload type
                    return ""
                }
            })

            // Then check search terms
            const searchString = [
                ...textVariations,
                ...actionPayloads,
                ...entityNames,
                ...trainDialog.tags,
                trainDialog.description
            ].join(' ').toLowerCase()

            return searchString.includes(this.state.searchValue)
        })
    }

    getFilteredAndSortedDialogs() {
        let trainDialogs = this.getFilteredDialogs(this.props.trainDialogs)
        trainDialogs = this.sortTrainDialogs(trainDialogs, this.state.columns, this.state.sortColumn)
        return trainDialogs
    }

    render() {
        const { intl } = this.props
        const computedTrainDialogs = this.getFilteredAndSortedDialogs()
        const isNoDialogs = this.props.trainDialogs.length === 0
        const editState = (this.props.editingPackageId !== this.props.app.devPackageId)
            ? EditState.INVALID_PACKAGE
            : this.props.invalidBot
                ? EditState.INVALID_BOT
                : EditState.CAN_EDIT

        // LastTeachSession used to prevent screen flash when moving between Edit and Teach pages
        const teachSession = (this.props.teachSession?.teach)
            ? this.props.teachSession
            : this.state.lastTeachSession

        const isEditingDisabled = (this.props.editingPackageId !== this.props.app.devPackageId) || this.props.invalidBot

        // Assume if app has DISPATCH actions, it must be dispatcher model
        const isDispatchModel = this.props.actions.some(a => a.actionType === CLM.ActionTypes.DISPATCH)

        return (
            <div className="cl-page">
                <div data-testid="train-dialogs-title" className={`cl-dialog-title cl-dialog-title--train ${OF.FontClassNames.xxLarge}`}>
                    <OF.Icon iconName="EditContact" />
                    <FormattedMessageId id={FM.TRAINDIALOGS_TITLE} />
                </div>
                {this.props.editingPackageId === this.props.app.devPackageId ?
                    <span data-testid="train-dialogs-subtitle" className={OF.FontClassNames.mediumPlus}>
                        <FormattedMessageId id={FM.TRAINDIALOGS_SUBTITLE} />
                    </span>
                    :
                    <span className="cl-errorpanel">Editing is only allowed in Master Tag</span>
                }
                <div className="cl-buttons-row">
                    <OF.PrimaryButton
                        data-testid="button-new-train-dialog"
                        disabled={isEditingDisabled}
                        onClick={() => this.onClickNewTeachSession()}
                        ariaDescription={Util.formatMessageId(intl, FM.TRAINDIALOGS_CREATEBUTTONARIALDESCRIPTION)}
                        text={Util.formatMessageId(intl, FM.TRAINDIALOGS_CREATEBUTTONTITLE)}
                        componentRef={this.newTeachSessionButtonRef}
                        iconProps={{ iconName: 'Add' }}
                    />
                    {Util.isFeatureEnabled(this.props.settings.features, FeatureStrings.CCI) &&
                        <OF.DefaultButton
                            iconProps={{ iconName: "CloudUpload" }}
                            disabled={isEditingDisabled}
                            onClick={this.onClickImportTranscripts}
                            ariaDescription={Util.formatMessageId(intl, FM.BUTTON_IMPORT)}
                            text={Util.formatMessageId(intl, FM.BUTTON_IMPORT)}
                        />
                    }
                    {this.state.isTreeViewModalOpen ?
                        <OF.DefaultButton
                            className="cl-rotate"
                            iconProps={{ iconName: 'AlignJustify' }}
                            onClick={this.onCloseTreeView}
                            ariaDescription={Util.formatMessageId(intl, FM.TRAINDIALOGS_LISTVIEW_BUTTON)}
                            text={Util.formatMessageId(intl, FM.TRAINDIALOGS_LISTVIEW_BUTTON)}
                        />
                        :
                        <OF.DefaultButton
                            className="cl-rotate"
                            iconProps={{ iconName: 'BranchFork2' }}
                            onClick={this.onOpenTreeView}
                            ariaDescription={Util.formatMessageId(intl, FM.TRAINDIALOGS_TREEVIEW_BUTTON)}
                            text={Util.formatMessageId(intl, FM.TRAINDIALOGS_TREEVIEW_BUTTON)}
                        />
                    }
                    <OF.DefaultButton
                        data-testid="button-replay-selected"
                        iconProps={{
                            iconName: "Refresh"
                        }}
                        disabled={this.state.isReplaySelectedActive || isEditingDisabled || this.state.selectionCount === 0}
                        onClick={this.onClickReplaySelected}
                        ariaDescription={Util.formatMessageId(intl, FM.BUTTON_REPLAY_SELECTED, { selectionCount: this.state.selectionCount })}
                        text={Util.formatMessageId(intl, FM.BUTTON_REPLAY_SELECTED, { selectionCount: this.state.selectionCount })}
                    />

                    {isDispatchModel &&
                        <OF.DefaultButton
                            iconProps={{
                                iconName: "Refresh"
                            }}
                            disabled={this.state.isRegenActive}
                            onClick={this.onClickRegen}
                            ariaDescription={Util.formatMessageId(intl, FM.BUTTON_REGENERATE, { selectionCount: this.state.selectionCount })}
                            text={Util.formatMessageId(intl, FM.BUTTON_REGENERATE, { selectionCount: this.state.selectionCount })}
                        />
                    }
                </div>
                <TreeView
                    open={this.state.isTreeViewModalOpen}
                    app={this.props.app}
                    trainDialogs={this.props.trainDialogs}
                    originalTrainDialogId={this.state.originalTrainDialog ? this.state.originalTrainDialog.trainDialogId : null}
                    sourceTrainDialog={this.state.currentTrainDialog}
                    editType={this.state.editType}
                    editState={editState}
                    editingPackageId={this.props.editingPackageId}
                    onCancel={this.onCloseTreeView}
                    openTrainDialog={this.selectTrainDialog}
                />

                {isNoDialogs &&
                    <div className="cl-page-placeholder">
                        <div className="cl-page-placeholder__content">
                            <div className={`cl-page-placeholder__description ${OF.FontClassNames.xxLarge}`}>Create a Train Dialog</div>
                            <OF.PrimaryButton
                                iconProps={{
                                    iconName: "Add"
                                }}
                                disabled={isEditingDisabled}
                                onClick={() => this.onClickNewTeachSession()}
                                ariaDescription={Util.formatMessageId(intl, FM.TRAINDIALOGS_CREATEBUTTONARIALDESCRIPTION)}
                                text={Util.formatMessageId(intl, FM.TRAINDIALOGS_CREATEBUTTONTITLE)}
                            />
                        </div>
                    </div>
                }
                {!this.state.isTreeViewModalOpen && !isNoDialogs &&
                    <React.Fragment>
                        <div>
                            <OF.Label htmlFor="train-dialogs-input-search" className={OF.FontClassNames.medium}>
                                Search:
                            </OF.Label>
                            <div className="cl-traindialogs-filter-search">
                                <OF.SearchBox
                                    // TODO: This next line has no visible affect on the DOM, but test automation needs it!
                                    data-testid="train-dialogs-input-search"
                                    id="train-dialogs-input-search"
                                    value={this.state.searchValue}
                                    className={OF.FontClassNames.medium}
                                    onChange={this.onChangeSearchString}
                                    onSearch={this.onSearch}
                                />
                                <OF.PrimaryButton
                                    iconProps={{
                                        iconName: "Clear"
                                    }}
                                    disabled={!this.isFilter()}
                                    onClick={() => this.onClickResetFilters()}
                                    ariaDescription={Util.formatMessageId(intl, FM.TRAINDIALOGS_FILTERING_RESET)}
                                    text={Util.formatMessageId(intl, FM.TRAINDIALOGS_FILTERING_RESET)}
                                    data-testid="train-dialogs-clear-filter-button"
                                />
                            </div>
                        </div>
                        <div className="cl-list-filters">
                            <OF.Dropdown
                                data-testid="dropdown-filter-by-tag"
                                ariaLabel={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_TAGS_LABEL)}
                                label={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_TAGS_LABEL)}
                                selectedKey={(this.state.tagsFilter ? this.state.tagsFilter.key : -1)}
                                onChange={this.onSelectTagsFilter}
                                placeholder={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_TAGS_LABEL)}
                                options={this.props.allUniqueTags
                                    .map<OF.IDropdownOption>((tag, i) => ({
                                        key: i,
                                        text: tag
                                    }))
                                    .concat(defaultTagFilter(this.props.intl))
                                }
                            />

                            <OF.Dropdown
                                data-testid="dropdown-filter-by-entity"
                                ariaLabel={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ENTITIES_LABEL)}
                                label={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ENTITIES_LABEL)}
                                selectedKey={(this.state.entityFilter ? this.state.entityFilter.key : -1)}
                                onChange={this.onSelectEntityFilter}
                                placeholder={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ENTITIES_LABEL)}
                                options={this.props.entities
                                    // Only show positive versions of negatable entities
                                    .filter(e => e.positiveId == null)
                                    .map(e => this.toEntityFilter(e))
                                    .concat(defaultEntityFilter(this.props.intl))
                                }
                            />

                            <OF.Dropdown
                                data-testid="dropdown-filter-by-action"
                                ariaLabel={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ACTIONS_LABEL)}
                                label={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ACTIONS_LABEL)}
                                selectedKey={(this.state.actionFilter ? this.state.actionFilter.key : -1)}
                                onChange={this.onSelectActionFilter}
                                placeholder={Util.formatMessageId(this.props.intl, FM.TRAINDIALOGS_FILTERING_ACTIONS_LABEL)}
                                options={this.props.actions
                                    .map(a => this.toActionFilter(a, this.props.entities))
                                    .filter(Util.notNullOrUndefined)
                                    .concat(defaultActionFilter(this.props.intl))
                                }
                            />
                        </div>
                        {computedTrainDialogs.length === 0
                            ? <div><OF.Icon iconName="Warning" className="cl-icon" /> No dialogs match the search criteria</div>
                            : <OF.DetailsList
                                data-testid="detail-list"
                                key={this.state.dialogKey}
                                className={OF.FontClassNames.mediumPlus}
                                items={computedTrainDialogs}
                                selection={this.selection}
                                layoutMode={OF.DetailsListLayoutMode.justified}
                                getKey={getDialogKey}
                                setKey="selectionKey"
                                columns={this.state.columns}
                                checkboxVisibility={OF.CheckboxVisibility.onHover}
                                onColumnHeaderClick={this.onClickColumnHeader}
                                onRenderRow={(props, defaultRender) => <div data-selection-invoke={true}>{defaultRender?.(props)}</div>}
                                onRenderItemColumn={(trainDialog, i, column: IRenderableColumn) => returnErrorStringWhenError(() => column.render(trainDialog, this))}
                                onItemInvoked={trainDialog => this.onClickTrainDialogItem(trainDialog)}
                            />}
                    </React.Fragment>}

                {teachSession && teachSession.teach &&
                    <TeachSessionModal
                        isOpen={this.state.isTeachDialogModalOpen}
                        app={this.props.app}
                        teachSession={teachSession}
                        editingPackageId={this.props.editingPackageId}
                        originalTrainDialogId={this.state.originalTrainDialog ? this.state.originalTrainDialog.trainDialogId : null}
                        onClose={this.onCloseTeachSession}
                        onEditTeach={(activityIndex, editHandlerArgs, tags, description, editHandler) => this.onEditTeach(activityIndex, editHandlerArgs ? editHandlerArgs : undefined, tags, description, editHandler)}
                        onInsertAction={(trainDialog, activity, editHandlerArgs) => this.onInsertAction(trainDialog, activity, editHandlerArgs.isLastActivity!, editHandlerArgs.selectionType!)}
                        onInsertInput={(trainDialog, activity, editHandlerArgs) => this.onInsertInput(trainDialog, activity, editHandlerArgs.userInput!, editHandlerArgs.selectionType!)}
                        onDeleteTurn={(trainDialog, activity) => this.onDeleteTurn(trainDialog, activity)}
                        onChangeExtraction={(trainDialog, activity, editHandlerArgs) => this.onChangeExtraction(trainDialog, activity, editHandlerArgs.extractResponse, editHandlerArgs.textVariations)}
                        onChangeAction={(trainDialog, activity, editHandlerArgs) => this.onChangeAction(trainDialog, activity, editHandlerArgs.trainScorerStep)}
                        onEndSessionActivity={this.onEndSessionActivity}
                        onReplayDialog={this.onReplayTrainDialog}
                        onSetInitialEntities={this.onSetInitialEntities}
                        initialHistory={this.state.activityHistory}
                        editType={this.state.editType}
                        lastAction={this.state.lastAction}
                        sourceTrainDialog={this.state.currentTrainDialog}
                        allUniqueTags={this.props.allUniqueTags}
                        importIndex={this.state.transcriptImport ? this.state.transcriptImport.index : undefined}
                        importCount={(this.state.transcriptImport && this.state.transcriptImport.trainDialogs) ? this.state.transcriptImport.trainDialogs.length : undefined}
                    />
                }
                <MergeModal
                    open={this.state.mergeExistingTrainDialog !== null}
                    onMerge={(description, tags) => this.onCloseMergeModal(true, description, tags)}
                    onCancel={() => this.onCloseMergeModal(false)}
                    savedTrainDialog={this.state.mergeNewTrainDialog}
                    existingTrainDialog={this.state.mergeExistingTrainDialog}
                    allUniqueTags={this.props.allUniqueTags}
                />
                <EditDialogModal
                    data-testid="train-dialog-modal"
                    app={this.props.app}
                    editingPackageId={this.props.editingPackageId}
                    editState={editState}
                    open={this.state.isEditDialogModalOpen}
                    trainDialog={this.state.currentTrainDialog!}
                    originalTrainDialog={this.state.originalTrainDialog}
                    editingLogDialogId={null}
                    activityHistory={this.state.activityHistory}
                    initialSelectedActivityIndex={this.state.selectedActivityIndex}
                    editType={this.state.editType}
                    onCloseModal={(reload, stopImport) => this.onCloseEditDialogModal(reload, stopImport)}
                    onInsertAction={(trainDialog, activity, isLastActivity, selectionType) => this.onInsertAction(trainDialog, activity, isLastActivity, selectionType)}
                    onInsertInput={(trainDialog, activity, userInput, selectionType) => this.onInsertInput(trainDialog, activity, userInput, selectionType)}
                    onDeleteTurn={(trainDialog, activity) => this.onDeleteTurn(trainDialog, activity)}
                    onChangeExtraction={(trainDialog, activity, extractResponse, textVariations) => this.onChangeExtraction(trainDialog, activity, extractResponse, textVariations)}
                    onChangeAction={this.onChangeAction}
                    onBranchDialog={(trainDialog, activity, userInput) => this.onBranchTrainDialog(trainDialog, activity, userInput)}
                    onDeleteDialog={() => this.onDeleteTrainDialog()}
                    onContinueDialog={(editedTrainDialog, initialUserInput) => this.onContinueTrainDialog(editedTrainDialog, initialUserInput)}
                    onSaveDialog={(editedTrainDialog) => this.onReplaceTrainDialog(editedTrainDialog)}
                    onReplayDialog={this.onReplayTrainDialog}
                    onCreateDialog={(newTrainDialog) => this.onCreateTrainDialog(newTrainDialog)}
                    allUniqueTags={this.props.allUniqueTags}
                    importIndex={this.state.transcriptImport?.index}
                    importCount={this.state.transcriptImport?.trainDialogs.length}
                    importingOBI={this.props.obiImportData?.appId === this.props.app.appId}
                />
                {this.state.transcriptImport?.warnings && this.state.transcriptImport.warnings.length > 0 &&
                    <ConfirmCancelModal
                        open={true}
                        onCancel={() => this.onCloseImportWarning(true)}
                        onOk={() => this.onCloseImportWarning(false)}
                        title={Util.formatMessageId(intl, FM.TRAINDIALOGS_IMPORT_WARNING)}
                        message={() =>
                            <OF.List
                                className="cl-warning-list"
                                items={this.state.transcriptImport ? this.state.transcriptImport.warnings : []}
                                onRenderCell={(item: string, index: number) => { return item }}
                            />
                        }
                    />
                }
                <ProgressModal
                    open={this.state.replayDialogs.length > 0}
                    title={'Replaying'}
                    index={this.state.replayDialogIndex + 1}
                    total={this.state.replayDialogs.length}
                    onClose={this.onClickCancelReplaySelected}
                />
                {this.state.isTranscriptImportOpen &&
                    <TranscriptImporter
                        app={this.props.app}
                        open={true}
                        onSubmit={this.onSubmitImportTranscripts}
                        onCancel={this.onCancelImportTranscripts}
                    />
                }
                {this.state.isImportWaitModalOpen && this.state.transcriptImport?.index &&
                    <TranscriptImportWaitModal
                        importIndex={this.state.transcriptImport.index}
                        importCount={this.state.transcriptImport.trainDialogs ? this.state.transcriptImport.trainDialogs.length : 0}
                    />
                }
            </div>
        )
    }

    private focusNewTeachSessionButton() {
        if (this.newTeachSessionButtonRef.current) {
            this.newTeachSessionButtonRef.current.focus()
        }
    }

    private isFilter(): boolean {
        return this.state.searchValue !== ''
            || this.state.entityFilter != null
            || this.state.actionFilter != null
            || this.state.tagsFilter != null
    }

    private onClickResetFilters(): void {
        this.setState({
            searchValue: '',
            entityFilter: null,
            actionFilter: null,
            tagsFilter: null,
        })
    }

    private async openTrainDialog(trainDialog: CLM.TrainDialog, editType: EditDialogType = EditDialogType.TRAIN_ORIGINAL, selectedActivityIndex: number | null = null) {
        this.props.clearWebchatScrollPosition()
        const trainDialogWithDefinitions: CLM.TrainDialog = {
            ...trainDialog,
            createdDateTime: new Date().toJSON(),
            lastModifiedDateTime: new Date().toJSON(),
            trainDialogId: undefined!,
            sourceLogDialogId: trainDialog.sourceLogDialogId,
            version: undefined!,
            packageCreationId: undefined!,
            packageDeletionId: undefined!,
            rounds: trainDialog.rounds,
            initialFilledEntities: trainDialog.initialFilledEntities,
            definitions: {
                actions: this.props.actions,
                entities: this.props.entities,
                trainDialogs: []
            },
        }

        try {
            const teachWithActivities = await ((this.props.fetchActivitiesThunkAsync(this.props.app.appId, trainDialogWithDefinitions, this.props.user.name, this.props.user.id) as any) as Promise<CLM.TeachWithActivities>)

            this.setState({
                activityHistory: teachWithActivities.activities,
                lastAction: teachWithActivities.lastAction,
                currentTrainDialog: trainDialog,
                originalTrainDialog: this.state.currentTrainDialog,
                editType,
                isEditDialogModalOpen: true,
                selectedActivityIndex
            })
        }
        catch (e) {
            const error = e as Error
            console.warn(`Error when attempting to create activities: `, error)
        }
    }

    // User has edited an Activity in a TeachSession
    private async onEditTeach(
        activityIndex: number | null,
        args: DialogEditing.EditHandlerArgs | undefined,
        tags: string[],
        description: string,
        editHandler: (trainDialog: CLM.TrainDialog, activity: BB.Activity, args?: DialogEditing.EditHandlerArgs) => any
    ) {
        try {
            if (!this.props.teachSession.teach) {
                return
            }

            await DialogEditing.onEditTeach(
                activityIndex,
                args,
                tags,
                description,
                editHandler,
                this.props.teachSession.teach,
                this.props.app,
                this.props.user,
                this.props.actions,
                this.props.entities,
                this.props.fetchTrainDialogThunkAsync as any,
                this.props.deleteTeachSessionThunkAsync as any,
                this.props.fetchActivitiesThunkAsync as any,
            )
        }
        catch (error) {
            console.warn(`Error when attempting to edit Teach session`, error)
        }
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        clearWebchatScrollPosition: actions.display.clearWebchatScrollPosition,
        createActionThunkAsync: actions.action.createActionThunkAsync,
        createEntityThunkAsync: actions.entity.createEntityThunkAsync,
        createTeachSessionThunkAsync: actions.teach.createTeachSessionThunkAsync,
        createTeachSessionFromTrainDialogThunkAsync: actions.teach.createTeachSessionFromTrainDialogThunkAsync,
        createTrainDialogThunkAsync: actions.train.createTrainDialogThunkAsync,
        deleteTrainDialogThunkAsync: actions.train.deleteTrainDialogThunkAsync,
        deleteTeachSessionThunkAsync: actions.teach.deleteTeachSessionThunkAsync,
        deleteMemoryThunkAsync: actions.teach.deleteMemoryThunkAsync,
        editActionThunkAsync: actions.action.editActionThunkAsync,
        editTrainDialogThunkAsync: actions.train.editTrainDialogThunkAsync,
        extractFromTrainDialogThunkAsync: actions.train.extractFromTrainDialogThunkAsync,
        fetchActivitiesThunkAsync: actions.train.fetchActivitiesThunkAsync,
        fetchApplicationTrainingStatusThunkAsync: actions.app.fetchApplicationTrainingStatusThunkAsync,
        regenerateDispatchTrainDialogsAsync: actions.train.regenerateDispatchTrainDialogsAsync,
        fetchTrainDialogThunkAsync: actions.train.fetchTrainDialogThunkAsync,
        fetchExtractionsThunkAsync: actions.app.fetchExtractionsThunkAsync,
        trainDialogMergeThunkAsync: actions.train.trainDialogMergeThunkAsync,
        trainDialogReplaceThunkAsync: actions.train.trainDialogReplaceThunkAsync,
        trainDialogReplayAsync: actions.train.trainDialogReplayThunkAsync,
        scoreFromTrainDialogThunkAsync: actions.train.scoreFromTrainDialogThunkAsync,
        trainDialogReplayThunkAsync: actions.train.trainDialogReplayThunkAsync,
        setErrorDisplay: actions.display.setErrorDisplay,
        spinnerAdd: actions.display.spinnerAdd,
        spinnerRemove: actions.display.spinnerRemove
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render TrainDialogs but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    if (!state.bot.botInfo) {
        throw new Error(`You attempted to render the TrainDialogs which requires botInfo, but botInfo was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        actions: state.actions,
        entities: state.entities,
        trainDialogs: state.trainDialogs,
        teachSession: state.teachSession,
        settings: state.settings,
        botInfo: state.bot.botInfo,
        obiImportData: state.apps.obiImportData,
        // Get all tags from all train dialogs then put in Set to get unique tags
        allUniqueTags: [...new Set(state.trainDialogs.reduce((tags, trainDialog) => [...tags, ...trainDialog.tags], []))]
    }
}

export interface ReceivedProps {
    app: CLM.AppBase,
    invalidBot: boolean,
    editingPackageId: string,
    filteredAction?: CLM.ActionBase,
    filteredEntity?: CLM.EntityBase,
    onDeleteApp: (id: string) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps & RouteComponentProps<any>

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(withRouter(injectIntl(TrainDialogs)))