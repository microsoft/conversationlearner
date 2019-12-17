/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as Util from '../../Utils/util'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as ToolTips from '../ToolTips/ToolTips'
import * as ExtractorResponseEditor from '../ExtractorResponseEditor'
import ExtractConflictModal, { ExtractionChange, ExtractionType } from './ExtractConflictModal'
import actions from '../../actions'
import HelpIcon from '../HelpIcon'
import EntityCreatorEditor from './EntityCreatorEditor'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { EditDialogType } from '../../types/const'
import { FM } from '../../react-intl-messages'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import './EntityExtractor.css'
import { autobind } from 'core-decorators'

interface ExtractResponseForDisplay {
    extractResponse: CLM.ExtractResponse
    isValid: boolean
    duplicateEntityNames: string[]
    isPickerVisible: boolean
}

interface ComponentState {
    // Has the user made any changes
    isPendingSubmit: boolean
    pendingVariationChange: boolean
    entityModalOpen: boolean
    entityTypeFilter: string | null
    warningOpen: boolean
    // Handle saves after round change
    savedExtractResponses: CLM.ExtractResponse[]
    savedRoundIndex: number
    textVariationValue: string
    newTextVariations: CLM.TextVariation[]
    activePickerText: string | null
}

// TODO: Need to re-define TextVariation / ExtractResponse class defs so we don't need
// to do all the messy conversion back and forth
class EntityExtractor extends React.Component<Props, ComponentState> {
    private doneExtractingButtonRef = React.createRef<OF.IButton>()

    constructor(p: any) {
        super(p)
        this.state = {
            isPendingSubmit: false,
            pendingVariationChange: false,
            entityModalOpen: false,
            warningOpen: false,
            savedExtractResponses: [],
            savedRoundIndex: 0,
            textVariationValue: '',
            newTextVariations: [],
            entityTypeFilter: CLM.EntityType.LUIS,
            activePickerText: null
        }
    }

    componentDidMount() {
        this.setState({ newTextVariations: this.props.originalTextVariations })
        setTimeout(this.focusPrimaryButton, 100)
    }

    @autobind
    focusPrimaryButton(): void {
        if (this.doneExtractingButtonRef.current) {
            this.doneExtractingButtonRef.current.focus()
        }
        else {
            setTimeout(this.focusPrimaryButton, 100)
        }
    }

    UNSAFE_componentWillReceiveProps(newProps: Props) {
        // If I'm switching my round or have added/removed text variations
        if (this.props.teachId !== newProps.teachId ||
            this.props.roundIndex !== newProps.roundIndex ||
            JSON.stringify(this.props.originalTextVariations) !== JSON.stringify(newProps.originalTextVariations)) {

            let nextState: Pick<ComponentState, any> = {
                newTextVariations: [...newProps.originalTextVariations],
                extractionChanged: false,
            }
            // If I made an unsaved change, show save prompt before switching
            if (this.state.isPendingSubmit) {
                nextState = {
                    ...nextState,
                    savedExtractResponses: this.allResponses(),
                    savedRoundIndex: this.props.roundIndex
                }
            }

            this.setState(nextState)
            this.props.clearExtractResponses()
        }
    }

    @autobind
    onEntityConflictModalAbandon() {
        this.setState({
            isPendingSubmit: true
        })
        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(true)
        }
        this.props.clearExtractConflict()
    }

    @autobind
    async onEntityConflictModalAccept(extractionChange: ExtractionChange) {
        const { extractResponse } = extractionChange

        if (extractionChange.chosenExtractType === ExtractionType.Existing) {
            await this.onUpdateExtractResponse(extractResponse)
        }
        else if (extractionChange.chosenExtractType === ExtractionType.Attempted) {
            for (const trainDialog of extractionChange.trainDialogs) {
                this.props.editTrainDialogThunkAsync(this.props.app.appId, trainDialog, { ignoreLabelConflicts: true })
            }
        }

        // If extractions are valid, go ahead and submit them
        const allResponses = this.allResponses()
        if (this.allValid(allResponses)) {
            this.onClickSubmitExtractions()
        }

        // Clear the conflict
        this.props.clearExtractConflict()
    }

    @autobind
    entityEditorHandleClose() {
        this.setState({
            entityModalOpen: false
        })
    }

    @autobind
    onNewEntity(entityTypeFilter: string) {
        this.setState({
            entityModalOpen: true,
            entityTypeFilter
        })
    }

    @autobind
    onClickCreateEntity(): void {
        this.setState({
            entityModalOpen: true,
            entityTypeFilter: null,
        })
    }

    @autobind
    onOpenPicker(extractResponse: CLM.ExtractResponse): void {
        this.setState({ activePickerText: extractResponse.text })
    }

    @autobind
    onClosePicker(extractResponse: CLM.ExtractResponse, onlyCloseOthers: boolean): void {
        if (!onlyCloseOthers || extractResponse.text !== this.state.activePickerText) {
            this.setState({ activePickerText: null })
        }
    }

    handleCloseWarning() {
        this.setState({
            warningOpen: false
        })
    }
    handleOpenWarning() {
        this.setState({
            warningOpen: true
        })
    }

    withoutPreBuilts(preditedEntities: CLM.PredictedEntity[]): CLM.PredictedEntity[] {
        return preditedEntities.filter(pe => {
            const entity = this.props.entities.find(e => e.entityId === pe.entityId)
            if (entity) {
                return !entity.doNotMemorize
            }
            console.log('Missing Entity')
            return false
        })
    }

    // Return list of non-multivalue entity names that have been labelled more than once
    duplicateEntityNames(extractResponse: CLM.ExtractResponse): string[] {
        const extractEntities = this.withoutPreBuilts(extractResponse.predictedEntities)

        // Get list of entity ids that are tagged more than once
        const multiEntityIds = extractEntities.map(pe => pe.entityId)
            .filter(entityId => {
                return extractEntities.filter(pe => pe.entityId === entityId).length > 1
            })

        // If any aren't multi-value they are duplicate labels
        const duplicateEntityNames: string[] = []
        for (const entityId of multiEntityIds) {
            let entity = this.props.entities.find(e => e.entityId === entityId)
            if (entity && !entity.isMultivalue) {
                duplicateEntityNames.push(entity.entityName)
            }
        }
        return [...new Set(duplicateEntityNames)]
    }

    // Returns true if predicted entities match
    isValid(primaryResponse: CLM.ExtractResponse, extractResponse: CLM.ExtractResponse): boolean {
        // Ignore prebuilts that aren't resolvers
        const primaryEntities = this.withoutPreBuilts(primaryResponse.predictedEntities)
        const extractEntities = this.withoutPreBuilts(extractResponse.predictedEntities)

        let missing = primaryEntities.filter(item =>
            !extractEntities.find(er => item.entityId === er.entityId))

        if (missing.length > 0) {
            return false
        }

        missing = extractEntities.filter(item =>
            !primaryEntities.find(er => item.entityId === er.entityId))
        if (missing.length > 0) {
            return false
        }

        return true
    }

    /**
     * Ensure each extract response has the same types of predicted entities
     * E.g. if Primary (response[0]) has name and color declared, all variations (1 through n) must also
     * have name and color declared
     */
    allValid(extractResponses: CLM.ExtractResponse[]): boolean {
        const primaryExtractResponse = extractResponses[0]
        return extractResponses.every(extractResponse => (extractResponse === primaryExtractResponse)
            ? true
            : this.isValid(primaryExtractResponse, extractResponse)
            && this.duplicateEntityNames(extractResponse).length === 0)
    }

    // Return merge of extract responses and text variations
    allResponses(): CLM.ExtractResponse[] {
        return [...CLM.ModelUtils.ToExtractResponses(this.state.newTextVariations), ...this.props.extractResponses]
            .map(e => ({
                ...e,
                definitions: {
                    ...e.definitions,
                    entities: this.props.entities
                }
            }))
    }

    @autobind
    onClickUndoChanges() {
        this.props.clearExtractResponses()
        this.setState({
            newTextVariations: [...this.props.originalTextVariations],
            isPendingSubmit: false,
        })
        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(false)
        }
    }

    @autobind
    onClickSubmitExtractions(): void {
        this.setState({
            isPendingSubmit: false,
        })
        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(false)
        }

        this.submitExtractions(this.allResponses(), this.props.roundIndex)
    }

    submitExtractions(allResponses: CLM.ExtractResponse[], roundIndex: number | null): void {
        const primaryExtractResponse = allResponses[0]

        if (!this.allValid(allResponses)) {
            this.handleOpenWarning()
            return
        }

        const textVariations = allResponses.map<CLM.TextVariation>(extractResponse => ({
            text: extractResponse.text,
            // When converting predicted entities to labeled entities the metadata field was lost and causing problems
            // so here we simply re-use predicted entities.
            labelEntities: extractResponse.predictedEntities
        }))

        this.props.onSubmitExtractions(primaryExtractResponse, textVariations, roundIndex)
    }

    onAddExtractResponse(): void {
        this.setState({
            isPendingSubmit: true,
            pendingVariationChange: false
        })

        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(true)
        }
    }

    onChangeTextVariation = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, value: string): void => {
        this.setState({
            textVariationValue: value,
            pendingVariationChange: (value.trim().length > 0)
        })
    }

    @autobind
    onRemoveExtractResponse(extractResponse: CLM.ExtractResponse): void {

        // First look for match in extract responses
        const foundResponse = this.props.extractResponses.find(e => e.text === extractResponse.text)
        if (foundResponse) {
            this.props.removeExtractResponse(foundResponse)
            this.setState({ isPendingSubmit: true })
        } else {
            // Otherwise change is in text variation
            const newVariations = this.state.newTextVariations
                .filter(v => v.text !== extractResponse.text)
            this.setState({
                newTextVariations: newVariations,
                isPendingSubmit: true
            })
        }

        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(true)
        }
    }

    @autobind
    async onUpdateExtractResponse(extractResponse: CLM.ExtractResponse): Promise<void> {
        // First look for match in extract responses
        const foundResponse = this.props.extractResponses.find(e => e.text === extractResponse.text)
        if (foundResponse) {
            this.props.updateExtractResponse(extractResponse)
            await Util.setStateAsync(this, { isPendingSubmit: true })
        } else {
            // Replace existing text variation (if any) with new one and maintain ordering
            const index = this.state.newTextVariations.findIndex((v: CLM.TextVariation) => v.text === extractResponse.text)
            if (index < 0) {
                // Should never happen, but protect just in case
                return
            }
            const newVariation = CLM.ModelUtils.ToTextVariation(extractResponse)
            const newVariations = [...this.state.newTextVariations]
            newVariations[index] = newVariation
            await Util.setStateAsync(this, {
                newTextVariations: newVariations,
                isPendingSubmit: true
            })
        }
        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(true)
        }
    }
    onClickSaveCheckYes() {
        // Submit saved extractions and clear saved responses
        this.submitExtractions(this.state.savedExtractResponses, this.state.savedRoundIndex)
        this.setState({
            savedExtractResponses: [],
            savedRoundIndex: 0
        })
    }
    onClickSaveCheckNo() {
        // Clear saved responses
        this.setState({
            savedExtractResponses: [],
            savedRoundIndex: 0
        })
    }

    @autobind
    async onSubmitTextVariation() {
        const text = this.state.textVariationValue.trim()
        if (text.length === 0) {
            return
        }

        if (this.props.extractType !== CLM.DialogType.TEACH && this.props.roundIndex === null) {
            throw new Error(`You attempted to submit text variation but roundIndex was null. This is likely a problem with the code. Please open an issue.`)
        }

        let extractType = this.props.extractType
        // Can't extract on running teach session on existing round
        if (this.props.roundIndex !== null) {
            if (this.props.editType === EditDialogType.LOG_ORIGINAL || this.props.editType === EditDialogType.LOG_EDITED) {
                extractType = CLM.DialogType.LOGDIALOG
            }
            else {
                extractType = CLM.DialogType.TRAINDIALOG
            }
        }

        // Use teach session Id when in teach, otherwise use dialog Id
        const extractId = extractType === CLM.DialogType.TEACH ? this.props.teachId : this.props.dialogId
        if (extractId === null) {
            throw new Error('Invalid extract Id')
        }

        const userInput: CLM.UserInput = { text: text }
        await (this.props.runExtractorThunkAsync(
            this.props.app.appId,
            extractType,
            extractId,
            this.props.roundIndex,
            userInput,
            this.props.originalTrainDialogId
        ) as any as Promise<void>)

        this.setState({
            isPendingSubmit: true,
            pendingVariationChange: false,
            textVariationValue: ''
        })

        if (this.props.onPendingStatusChanged) {
            this.props.onPendingStatusChanged(true)
        }
    }

    render() {
        const allResponses = this.allResponses()
        const primaryExtractResponse = allResponses[0]
        if (!primaryExtractResponse) {
            return null
        }

        // Don't show edit components when in auto TEACH or on score step
        const canEdit = (!this.props.autoTeach && this.props.dialogMode === CLM.DialogMode.Extractor && this.props.canEdit)

        // I'm editing an existing round if I'm not in Teach or have selected a round
        const editingRound = canEdit && (this.props.extractType !== CLM.DialogType.TEACH || this.props.roundIndex !== null)

        // If editing is not allowed, only show the primary response which is the first response
        const extractResponsesToRender = canEdit ? allResponses : [primaryExtractResponse]
        const extractResponsesForDisplay = extractResponsesToRender
            .map<ExtractResponseForDisplay>(extractResponse =>
                ({
                    extractResponse,
                    isValid: this.isValid(primaryExtractResponse, extractResponse),
                    duplicateEntityNames: this.duplicateEntityNames(extractResponse),
                    isPickerVisible: this.state.activePickerText === extractResponse.text
                }))
        const allExtractResponsesValid = extractResponsesForDisplay.every(e => e.isValid)

        // Need to save this to separate variable for typescript control flow
        const extractConflict = this.props.extractConflict
        const attemptedExtractResponse = extractConflict && allResponses.find(e => e.text.toLowerCase() === extractConflict.text.toLowerCase())

        return (
            <div className="entity-extractor">
                <OF.Label className={`entity-extractor-help-text ${OF.FontClassNames.smallPlus} cl-label`}>
                    {Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_HELP)}
                    <HelpIcon tipType={ToolTips.TipType.ENTITY_EXTRACTOR_HELP} />
                </OF.Label>
                {extractResponsesForDisplay.map(({ isValid, duplicateEntityNames, extractResponse, isPickerVisible }, key) => {
                    return <div key={key} className={`editor-container ${OF.FontClassNames.mediumPlus}`}>
                        <ExtractorResponseEditor.EditorWrapper
                            render={(editorProps, onChangeCustomEntities) =>
                                <ExtractorResponseEditor.Editor
                                    readOnly={!canEdit}
                                    isPickerVisible={isPickerVisible}
                                    status={
                                        !isValid
                                            ? ExtractorResponseEditor.Models.ExtractorStatus.ERROR
                                            : duplicateEntityNames.length > 0
                                                ? ExtractorResponseEditor.Models.ExtractorStatus.WARNING
                                                : ExtractorResponseEditor.Models.ExtractorStatus.OK
                                    }
                                    entities={this.props.entities}
                                    {...editorProps}

                                    onChangeCustomEntities={onChangeCustomEntities}
                                    onClickNewEntity={this.onNewEntity}
                                    onOpenPicker={() => this.onOpenPicker(extractResponse)}
                                    onClosePicker={(onlyCloseOthers: boolean = false) => this.onClosePicker(extractResponse, onlyCloseOthers)}
                                />
                            }
                            entities={this.props.entities}
                            extractorResponse={extractResponse}
                            onChange={this.onUpdateExtractResponse}
                        />
                        {(key !== 0)
                            ? <div className="editor-container__icons">
                                <button
                                    type="button"
                                    className={`cl-icon-warning ${OF.FontClassNames.large}`}
                                    onClick={() => this.onRemoveExtractResponse(extractResponse)}
                                >
                                    <OF.Icon iconName="Delete" />
                                </button>
                            </div>
                            : <div />}
                        {!isValid &&
                            <div className="cl-error-message-label" data-testid="entity-extractor-match-warning">
                                {Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_MATCH_WARNING)}
                            </div>
                        }
                        {isValid && duplicateEntityNames.length > 0 &&
                            <div className='cl-label' data-testid="entity-extractor-duplicate-entity-warning">
                                <OF.Icon
                                    className={`cl-icon cl-color-warning`}
                                    iconName="IncidentTriangle"
                                />
                                <div className="cl-error-message-label cl-error-message-label--dark">
                                    {`${Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_DUPE_WARNING1)}${duplicateEntityNames.join(', ')}${Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_DUPE_WARNING2)}`}
                                </div>
                            </div>
                        }
                    </div>
                })}
                {canEdit &&
                    <div className='cl-textfield--withLeftButton editor-alt-offset'>
                        <OF.PrimaryButton
                            data-testid="entity-extractor-add-alternative-input-button"
                            className='cl-button--inline'
                            disabled={this.state.textVariationValue.trim().length === 0}
                            onClick={this.onSubmitTextVariation}
                            ariaDescription={'Add'}
                            text={'Add'}
                            componentRef={this.doneExtractingButtonRef}
                            iconProps={{ iconName: 'Add' }}
                        />
                        <OF.TextField
                            data-testid="entity-extractor-alternative-input-text"
                            value={this.state.textVariationValue}
                            onChange={this.onChangeTextVariation}
                            placeholder={Util.formatMessageId(this.props.intl, FM.TEXTVARIATION_PLACEHOLDER)}
                            onKeyPress={(event) => {
                                if (event.key === 'Enter') {
                                    void this.onSubmitTextVariation()
                                    event.preventDefault()
                                }
                            }}
                        />
                        <HelpIcon tipType={ToolTips.TipType.ENTITY_EXTRACTOR_TEXTVARIATION} />
                    </div>}

                <div className="cl-buttons-row">
                    {editingRound
                        ? <>
                            <OF.PrimaryButton
                                data-testid="submit-changes-button"
                                disabled={!this.state.isPendingSubmit
                                    || !allExtractResponsesValid
                                    || this.state.pendingVariationChange}
                                onClick={this.onClickSubmitExtractions}
                                ariaDescription={'Submit Changes'}
                                text={'Submit Changes'}
                                componentRef={this.doneExtractingButtonRef}
                                iconProps={{ iconName: 'Accept' }}
                            />
                            <OF.PrimaryButton
                                data-testid="undo-changes-button"
                                disabled={!this.state.isPendingSubmit}
                                onClick={this.onClickUndoChanges}
                                ariaDescription="Undo Changes"
                                text="Undo"
                                iconProps={{ iconName: 'Undo' }}
                            />
                        </>
                        : <OF.PrimaryButton
                            data-testid="score-actions-button"
                            disabled={!allExtractResponsesValid || this.state.pendingVariationChange || !canEdit}
                            onClick={this.onClickSubmitExtractions}
                            ariaDescription={'Score Actions'}
                            text={'Score Actions'}
                            componentRef={this.doneExtractingButtonRef}
                        />
                    }

                    <OF.DefaultButton
                        data-testid="entity-extractor-create-button"
                        disabled={!canEdit}
                        onClick={this.onClickCreateEntity}
                        ariaDescription={Util.formatMessageId(this.props.intl, FM.BUTTON_ENTITY)}
                        text={Util.formatMessageId(this.props.intl, FM.BUTTON_ENTITY)}
                        iconProps={{ iconName: 'Add' }}
                    />
                </div>

                <div className="cl-dialog-admin__dialogs">
                    <EntityCreatorEditor
                        data-testid="entity-extractor-editor"
                        app={this.props.app}
                        editingPackageId={this.props.editingPackageId}
                        open={this.state.entityModalOpen}
                        entity={null}
                        handleClose={this.entityEditorHandleClose}
                        handleDelete={() => { }}
                        entityTypeFilter={this.state.entityTypeFilter as any}
                    />
                    <OF.Dialog
                        data-testid="entity-extractor-dialog"
                        hidden={!this.state.warningOpen}
                        dialogContentProps={{
                            type: OF.DialogType.normal,
                            title: Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_DLG_SAMETAGGED)
                        }}
                        modalProps={{
                            isBlocking: false
                        }}
                    >
                        <OF.DialogFooter>
                            <OF.PrimaryButton onClick={() => this.handleCloseWarning()} text='Ok' />
                        </OF.DialogFooter>
                    </OF.Dialog>
                    <OF.Dialog
                        data-testid="entity-extractor-dialog-confirm"
                        hidden={this.state.savedExtractResponses.length === 0}
                        dialogContentProps={{
                            type: OF.DialogType.normal,
                            title: Util.formatMessageId(this.props.intl, FM.TOOLTIP_ENTITY_EXTRACTOR_DLG_SAVECHANGES)
                        }}
                        modalProps={{
                            isBlocking: true
                        }}
                    >
                        <OF.DialogFooter>
                            <OF.PrimaryButton onClick={() => this.onClickSaveCheckYes()} text='Yes' />
                            <OF.DefaultButton onClick={() => this.onClickSaveCheckNo()} text='No' />
                        </OF.DialogFooter>
                    </OF.Dialog>
                    {(this.props.extractConflict && attemptedExtractResponse)
                        && <ExtractConflictModal
                            open={true}
                            entities={this.props.entities}
                            attemptedExtractResponse={attemptedExtractResponse}
                            extractResponse={this.props.extractConflict}
                            onClose={this.onEntityConflictModalAbandon}
                            onAccept={this.onEntityConflictModalAccept}
                            trainDialogs={this.props.trainDialogs}
                        />
                    }
                </div>
            </div>
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        fetchTrainDialog: actions.train.fetchTrainDialogThunkAsync,
        updateExtractResponse: actions.teach.updateExtractResponse,
        removeExtractResponse: actions.teach.removeExtractResponse,
        runExtractorThunkAsync: actions.teach.runExtractorThunkAsync,
        clearExtractResponses: actions.teach.clearExtractResponses,
        clearExtractConflict: actions.teach.clearExtractConflict,
        editTrainDialogThunkAsync: actions.train.editTrainDialogThunkAsync,
    }, dispatch)
}
const mapStateToProps = (state: State, ownProps: any) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render TeachSessionAdmin but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        entities: state.entities,
        trainDialogs: state.trainDialogs,
        teachSession: state.teachSession.teach,
    }
}

export interface ReceivedProps {
    app: CLM.AppBase
    editingPackageId: string
    canEdit: boolean
    extractType: CLM.DialogType
    editType: EditDialogType
    // ID of running teach session
    teachId: string | null
    // ID of related trainDialog
    dialogId: string | null
    // Train Dialog that this originally came from
    originalTrainDialogId: string | null,
    roundIndex: number | null
    autoTeach: boolean
    dialogMode: CLM.DialogMode
    extractResponses: CLM.ExtractResponse[]
    extractConflict: CLM.ExtractResponse | null
    originalTextVariations: CLM.TextVariation[]
    onSubmitExtractions: (extractResponse: CLM.ExtractResponse, textVariations: CLM.TextVariation[], roundIndex: number | null) => void
    onPendingStatusChanged?: (hasChanged: boolean) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(EntityExtractor) as any)
