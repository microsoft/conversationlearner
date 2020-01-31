/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../../Utils/util'
import * as DialogEditing from '../../Utils/dialogEditing'
import * as DialogUtils from '../../Utils/dialogUtils'
import actions from '../../actions'
import ConfirmCancelModal from './ConfirmCancelModal'
import { actionTypeRenderer, actionListViewRenderer } from '../ActionRenderers'
import EditApiPlaceholder from '../modals/EditApiPlaceholder'
import ActionCreatorEditor from './ActionCreatorEditor/ActionCreatorEditor'
import AdaptiveCardViewer, { getRawTemplateText } from './AdaptiveCardViewer/AdaptiveCardViewer'
import { ImportedAction, MockResultWithSource, MockResultSource } from '../../types/models'
import { compareTwoStrings } from 'string-similarity'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import { onRenderDetailsHeader } from '../ToolTips/ToolTips'
import { injectIntl, InjectedIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../../react-intl-messages'
import './ActionScorer.css'
import { autobind } from 'core-decorators'
import ActionCallbackResultDropdown from './ActionCallbackResultDropdown'
import { assignSourcesToMockResults } from 'src/Utils/mockResults'

const MISSING_ACTION = 'missing_action'

interface ActionForRender extends CLM.ScoredBase {
    similarityScore?: number
    score?: number
    reason?: CLM.ScoreReason | null
    repromptActionId?: string | undefined
    selectedCallbackResult?: MockResultWithSource
}

interface IRenderableColumn extends OF.IColumn {
    getSortValue: (actionForRender: ActionForRender, component: ActionScorer) => number | string
    render: (actionForRender: ActionForRender, component: ActionScorer, index: number) => React.ReactNode
}

function getColumns(intl: InjectedIntl): IRenderableColumn[] {
    return [
        {
            key: 'select',
            name: '',
            fieldName: 'actionId',
            minWidth: 80,
            maxWidth: 80,
            isResizable: true,
            getSortValue: action => action.actionId,
            render: (action, component, index) => {

                // If I'm not in Teach or clicked on activity item, highlight selected
                let selected = false
                if (component.props.dialogType !== CLM.DialogType.TEACH || component.props.historyItemSelected) {
                    const score: number | string = (action as CLM.ScoredAction).score
                    // If no selected actionId, first item is selected one
                    if (!component.props.selectedActionId && score === 1) {
                        selected = true
                    }
                    else if (component.props.selectedActionId === action.actionId) {
                        selected = true
                    }
                }

                const buttonText = Util.formatMessageId(intl, selected ? FM.BUTTON_SELECTED : FM.BUTTON_SELECT)
                if (!component.props.canEdit) {
                    return (
                        <OF.PrimaryButton
                            data-testid="action-scorer-button-no-click"
                            disabled={true}
                            ariaDescription={buttonText}
                            text={buttonText}
                        />
                    )
                }

                const isAvailable = component.isUnscoredActionAvailable(action as CLM.UnscoredAction)
                if (!isAvailable) {
                    return (
                        <OF.PrimaryButton
                            data-testid="action-scorer-button-no-click"
                            disabled={!isAvailable}
                            ariaDescription={buttonText}
                            text={buttonText}
                        />
                    )
                }
                else if (selected) {
                    return (
                        <OF.PrimaryButton
                            className="ms-Button--selected"
                            data-testid="action-scorer-button-selected"
                            disabled={!isAvailable}
                            ariaDescription={buttonText}
                            text={buttonText}
                            onClick={() => component.handleReselectAction(action)}
                        />
                    )
                }
                else {
                    const refFn = (index === 0)
                        ? component.primaryScoreButtonRef
                        : undefined
                    return (
                        <OF.PrimaryButton
                            data-testid="action-scorer-button-clickable"
                            onClick={() => component.handleActionSelection(action)}
                            ariaDescription={buttonText}
                            text={buttonText}
                            componentRef={refFn}
                        />
                    )
                }
            }
        },
        {
            key: 'actionResponse',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_RESPONSE),
            fieldName: 'actionResponse',
            minWidth: 100,
            maxWidth: 500,
            isMultiline: true,
            isResizable: true,
            getSortValue: () => '',
            render: (actionForRender, component) => {
                const action = actionForRender as CLM.ActionBase
                const actionResponseComponent = actionListViewRenderer(
                    action,
                    component.props.entities,
                    component.props.memories,
                    component.props.botInfo.callbacks,
                    component.onClickViewCard,
                )

                if (action.actionType === CLM.ActionTypes.API_LOCAL) {
                    const apiAction = new CLM.ApiAction(action)
                    if (apiAction.isPlaceholder !== true) {
                        const callback = component.props.botInfo.callbacks.find(c => c.name === apiAction.name)
                        const mockResultsFromBot = callback?.mockResults ?? []
                        const mockResultsFromModel = apiAction.clientData?.mockResults ?? []
                        const mockResultsWithSource = assignSourcesToMockResults(
                            { mockResults: mockResultsFromBot, source: MockResultSource.CODE },
                            { mockResults: mockResultsFromModel, source: MockResultSource.MODEL },
                        )

                        const callbackResultFromActivity = mockResultsWithSource.find(callbackResult => callbackResult.mockResult.name === component.props.selectedScorerStep?.stubName)

                        return <div className="cl-action-scorer-callback">
                            {actionResponseComponent}
                            <ActionCallbackResultDropdown
                                entities={component.props.entities}
                                action={apiAction}
                                callback={callback}
                                selectedCallbackResult={callbackResultFromActivity ?? actionForRender.selectedCallbackResult}
                                onChangeSelectedCallbackResult={selectedStub => component.onChangeSelectedStub(action, selectedStub)}
                            />
                        </div>
                    }
                }

                return actionResponseComponent
            }
        },
        {
            key: 'actionScore',
            name: Util.formatMessageId(intl, FM.ACTIONSCORER_COLUMNS_SCORE),
            fieldName: 'score',
            minWidth: 80,
            maxWidth: 80,
            isResizable: true,
            isSorted: true,
            isSortedDescending: true,
            getSortValue: (actionForRender, component) => {

                let score: number | undefined

                // If an import action, sort by string similarity to existing actions
                if (component.props.importedAction) {
                    score = actionForRender.similarityScore ?? 0
                }
                else {
                    score = actionForRender.score
                }

                // If score base does not have score it's either not scorable or not available
                // prioritize not scorable over not available but both at bottom of list
                if (!score) {
                    if (actionForRender.reason === CLM.ScoreReason.NotAvailable) {
                        return -100
                    } else {
                        const isAvailable = component.isUnscoredActionAvailable(actionForRender as CLM.UnscoredAction)
                        return isAvailable
                            ? -1
                            : -10
                    }
                }

                return score
            },
            render: (action, component) => {
                const fieldContent: number = (action as CLM.ScoredAction).score
                let fieldContentString: string
                if (fieldContent) {
                    fieldContentString = `${(fieldContent * 100).toFixed(1)}%`
                } else if (component.isMasked(action.actionId)) {
                    fieldContentString = "Masked"
                } else {
                    const isAvailable = component.isUnscoredActionAvailable(action as CLM.UnscoredAction)
                    if (isAvailable) {
                        fieldContentString = (component.props.dialogType !== CLM.DialogType.TEACH || component.props.historyItemSelected)
                            ? '-' : "Training..."
                    }
                    else {
                        fieldContentString = "Disqualified"
                    }
                }
                return <span className={OF.FontClassNames.mediumPlus} data-testid="action-scorer-score">{fieldContentString}</span>
            }
        },
        {
            key: 'actionEntities',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_CONDITIONS),
            fieldName: 'entities',
            minWidth: 100,
            maxWidth: 300,
            isResizable: true,
            getSortValue: () => '',
            render: (action, component) => component.renderEntityRequirements(action.actionId)
        },
        {
            key: 'isTerminal',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_ISTERMINAL),
            fieldName: 'isTerminal',
            minWidth: 50,
            maxWidth: 50,
            isResizable: true,
            getSortValue: action => action.isTerminal ? 1 : -1,
            render: action => <OF.Icon
                iconName={(action.isTerminal ? "CheckMark" : "Remove")}
                className={`cl-icon${action.isTerminal ? " checkIcon" : " notFoundIcon"}`}
                data-testid="action-scorer-wait"
            />
        },
        {
            key: 'actionReprompt',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_REPROMPT),
            fieldName: 'actionReprompt',
            minWidth: 70,
            isResizable: false,
            getSortValue: action => action.repromptActionId !== undefined ? 'a' : 'b',
            render: action => <OF.Icon iconName={action.repromptActionId !== undefined ? 'CheckMark' : 'Remove'} className="cl-icon" data-testid="action-details-wait" />
        },
        {
            key: 'actionType',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_TYPE),
            fieldName: 'actionType',
            minWidth: 80,
            maxWidth: 80,
            isResizable: true,
            getSortValue: action => action.actionType.toLowerCase(),
            render: (scoredBase, component) => {
                let action = component.props.actions.find(a => a.actionId === scoredBase.actionId)
                return actionTypeRenderer(action)
            }
        },
    ]
}

const actionIdCallbackResultMap: { [actionId: string]: MockResultWithSource | undefined } = {}

interface ComponentState {
    isActionCreatorModalOpen: boolean
    apiPlaceholderName: string | null
    apiPlaceholderCreatorFilledEntityMap: CLM.FilledEntityMap | null
    columns: OF.IColumn[]
    actionsForRender: ActionForRender[]
    sortColumn: IRenderableColumn
    haveEdited: boolean
    cardViewerAction: CLM.ActionBase | null
    cardViewerShowOriginal: boolean
    isAlreadySelectedOpen: boolean
}

class ActionScorer extends React.Component<Props, ComponentState> {
    primaryScoreButtonRef = React.createRef<OF.IButton>()

    constructor(p: Props) {
        super(p)

        const columns = getColumns(this.props.intl)
        this.state = {
            isActionCreatorModalOpen: false,
            apiPlaceholderName: null,
            apiPlaceholderCreatorFilledEntityMap: null,
            columns,
            actionsForRender: [],
            sortColumn: columns[2], // "score"
            haveEdited: false,
            cardViewerAction: null,
            cardViewerShowOriginal: false,
            isAlreadySelectedOpen: false
        }
    }

    async componentDidUpdate(prevProps: Props) {
        if (this.props.scoreResponse !== prevProps.scoreResponse) {
            await this.autoSelect()
            this.setState({
                haveEdited: false,
                actionsForRender: this.getActionsForRender()
            })
        }

        // If new Entity was added (possibly Enum) recompute to generate new SET_ENTITY actions
        if (this.props.entities.length > prevProps.entities.length) {
            this.setState({
                actionsForRender: this.getActionsForRender()
            })
        }
    }

    async componentDidMount() {
        await this.autoSelect()
        this.setState({
            actionsForRender: this.getActionsForRender()
        })
    }

    onClickViewCard(action: CLM.ActionBase, cardViewerShowOriginal: boolean) {
        this.setState({
            cardViewerAction: action,
            cardViewerShowOriginal
        })
    }
    onCloseCardViewer = () => {
        this.setState({
            cardViewerAction: null,
            cardViewerShowOriginal: true
        })
    }

    async autoSelect() {
        // If not in interactive mode select action automatically
        if (this.props.autoTeach && this.props.dialogMode === CLM.DialogMode.Scorer) {
            // We assume if DialogMode is Scorer, then we must have ScoreResponse
            // TODO: Fix this with better types
            const scoreResponse = this.props.scoreResponse
            const allActions = [...scoreResponse.scoredActions as CLM.ScoredBase[], ...scoreResponse.unscoredActions]
            // Since actions are sorted by score descending (max first), assume first scored action is the "best" action
            const bestAction = allActions[0]

            // Make sure there is an available action
            if ((bestAction as CLM.UnscoredAction).reason === CLM.ScoreReason.NotAvailable) {
                // If none available auto teach isn't possible.  User must create a new action
                this.props.toggleAutoTeach(false)
                return
            }

            await this.handleActionSelection(bestAction)
        } else if (!this.state.isActionCreatorModalOpen) {
            setTimeout(this.focusPrimaryButton, 100)
        }
    }

    @autobind
    focusPrimaryButton(): void {
        if (this.primaryScoreButtonRef.current) {
            this.primaryScoreButtonRef.current.focus()
        }
        else {
            setTimeout(this.focusPrimaryButton, 100)
        }
    }

    @autobind
    onChangeSelectedStub(action: CLM.ActionBase, callbackResult: MockResultWithSource) {
        actionIdCallbackResultMap[action.actionId] = callbackResult
    }

    //-------------------
    // Action Creator
    //-------------------
    onClickCancelActionEditor() {
        this.setState({
            isActionCreatorModalOpen: false,
        })
        this.props.onActionCreatorClosed()
    }

    @autobind
    async onClickSubmitActionEditor(action: CLM.ActionBase) {
        await Util.setStateAsync(this, { isActionCreatorModalOpen: false })
        this.props.onActionCreatorClosed()

        const newAction = await ((this.props.createActionThunkAsync(this.props.app.appId, action) as any) as Promise<CLM.ActionBase>)
        if (newAction
            && (
                (newAction.actionType === CLM.ActionTypes.END_SESSION
                    || newAction.actionType === CLM.ActionTypes.CHANGE_MODEL)
                    ? this.props.isEndSessionAvailable
                    : true
            )
        ) {
            // See if new action is available, then take it
            const isAvailable = DialogUtils.isActionAvailable(newAction, this.props.entities, this.props.memories)
            if (isAvailable) {
                await this.handleActionSelection(newAction)
            }
        }
    }

    @autobind
    handleOpenActionModal() {
        this.setState({
            isActionCreatorModalOpen: true
        })
    }

    //-------------------
    // API Placeholder Creator
    //-------------------
    @autobind
    onOpenAPIPlaceholderCreator(placeholder: string | null = null) {
        this.setState({
            apiPlaceholderName: placeholder,
            apiPlaceholderCreatorFilledEntityMap: CLM.FilledEntityMap.FromFilledEntities(this.props.scoreInput.filledEntities, this.props.entities)
        })
    }

    @autobind
    async onCloseCreateAPIPlaceholder(filledEntityMap: CLM.FilledEntityMap | null, apiName: string, isTerminal: boolean) {
        this.setState({
            apiPlaceholderName: null,
            apiPlaceholderCreatorFilledEntityMap: null
        })
        // If user cancelled
        if (!filledEntityMap) {
            return
        }
        const trainScorerStep = await DialogEditing.getAPIPlaceholderScorerStep(apiName, isTerminal, this.props.app.appId, this.props.actions, filledEntityMap, this.props.createActionThunkAsync as any)
        this.setState({ haveEdited: true })
        this.props.onActionSelected(trainScorerStep)
    }

    @autobind
    onColumnClick(event: any, column: any) {
        const { columns } = this.state
        let isSortedDescending = column.isSortedDescending

        // If we've sorted this column, flip it.
        if (column.isSorted) {
            isSortedDescending = !isSortedDescending
        }

        // Reset the items and columns to match the state.
        this.setState({
            columns: columns.map((col: any) => {
                col.isSorted = (col.key === column.key)

                if (col.isSorted) {
                    col.isSortedDescending = isSortedDescending
                }

                return col
            }),
            sortColumn: column
        })
    }

    @autobind
    async handleDefaultSelection() {
        // Look for a valid action
        let scoredBase: CLM.ScoredBase | null = null
        const scoreResponse = this.props.scoreResponse
        if (scoreResponse.scoredActions?.length > 0) {
            scoredBase = scoreResponse.scoredActions[0]
        } else if (scoreResponse.unscoredActions) {
            for (const unscoredAction of scoreResponse.unscoredActions) {
                if (unscoredAction.reason === CLM.ScoreReason.NotScorable) {
                    scoredBase = unscoredAction
                    break
                }
            }
        }
        if (scoredBase) {
            await this.handleActionSelection(scoredBase)
        }
    }

    @autobind
    async handleReselectAction(scoredBase: CLM.ScoredBase) {
        // If placeholder let user reselect memory values
        const isPlaceholder = CLM.ActionBase.isPlaceholderAPI(scoredBase)
        // Or stub in dropdown is different than stub from scorer step
        let dropdownStubName = undefined
        if (scoredBase.actionType === CLM.ActionTypes.API_LOCAL) {
            const apiAction = new CLM.ApiAction(scoredBase as CLM.ActionBase)
            dropdownStubName = actionIdCallbackResultMap[apiAction.actionId]?.mockResult.name
        }

        const isStubChanged = dropdownStubName !== this.props.selectedScorerStep?.stubName
        if (isPlaceholder || isStubChanged) {
            await this.handleActionSelection(scoredBase)
        }
        // Otherwise tell them it has already been selected
        else {
            this.showAlreadySelectedPopUp()
        }
    }
    @autobind
    async handleActionSelection(scoredBase: CLM.ScoredBase) {
        // If placeholder get data before selecting
        if (CLM.ActionBase.isPlaceholderAPI(scoredBase)) {
            this.onOpenAPIPlaceholderCreator(new CLM.ApiAction(scoredBase as CLM.ActionBase).name)
            return
        }
        let scoredAction: CLM.ScoredAction | undefined
        if (scoredBase.actionId === Util.PLACEHOLDER_SET_ENTITY_ACTION_ID) {
            // TODO: Schema refactor
            const setEntityAction = new CLM.SetEntityAction(scoredBase as CLM.ActionBase)
            const action = Util.getSetEntityActionForEnumValue(setEntityAction.entityId, setEntityAction.enumValueId)
            const newAction = await ((this.props.createActionThunkAsync(this.props.app.appId, action) as any) as Promise<CLM.ActionBase>)

            scoredAction = {
                actionId: newAction.actionId,
                payload: newAction.payload,
                isTerminal: newAction.isTerminal,
                actionType: newAction.actionType,
                score: undefined!
            }
        }
        else {
            scoredAction = {
                ...scoredBase,
                score: undefined!
            }
        }

        if (!scoredAction) {
            throw new Error(`Scored action could not be found in list of available actions`)
        }

        let callbackResultName = undefined
        if (scoredBase.actionType === CLM.ActionTypes.API_LOCAL) {
            const apiAction = new CLM.ApiAction(scoredBase as CLM.ActionBase)
            const selectedMockResultName = actionIdCallbackResultMap[apiAction.actionId]?.mockResult.name

            const combinedMockResults = []
            if (apiAction.clientData?.mockResults) {
                combinedMockResults.push(...apiAction.clientData.mockResults)
            }
            // If action has callback, action name is callback name, find and add mock results from callback definition
            if (apiAction.isCallbackUnassigned !== true) {
                const callback = this.props.botInfo.callbacks.find(c => c.name === apiAction.name)
                if (callback) {
                    combinedMockResults.push(...callback.mockResults)
                }
            }

            const mockResult = combinedMockResults.find(mr => mr.name === selectedMockResultName)
            callbackResultName = mockResult?.name
        }

        const trainScorerStep: CLM.TrainScorerStep = {
            input: this.props.scoreInput,
            labelAction: scoredAction.actionId,
            logicResult: undefined,
            scoredAction,
            stubName: callbackResultName,
        }

        this.setState({ haveEdited: true })
        this.props.onActionSelected(trainScorerStep)
    }

    renderEntityRequirements(actionId: string) {
        if (actionId === Util.PLACEHOLDER_SET_ENTITY_ACTION_ID) {
            return null
        }

        const action = this.props.actions.find(a => a.actionId === actionId)

        // If action is null - there's a bug somewhere
        if (!action) {
            return <div className={OF.FontClassNames.mediumPlus}>ERROR: Missing Action</div>
        }

        const items = []
        for (const entityId of action.requiredEntities) {
            const found = DialogUtils.entityInMemory(entityId, this.props.entities, this.props.memories)
            items.push({
                name: found.name,
                neg: false,
                type: found.match
                    ? 'cl-entity cl-entity--match'
                    : 'cl-entity cl-entity--mismatch',
            })
        }
        for (const entityId of action.negativeEntities) {
            const found = DialogUtils.entityInMemory(entityId, this.props.entities, this.props.memories)
            items.push({
                name: found.name,
                neg: true,
                type: found.match
                    ? 'cl-entity cl-entity--mismatch'
                    : 'cl-entity cl-entity--match',
            })
        }
        if (action.requiredConditions) {
            for (const condition of action.requiredConditions) {
                const result = DialogUtils.convertToScorerCondition(condition, this.props.entities, this.props.memories)
                items.push({
                    name: result.name,
                    neg: false,
                    type: result.match
                        ? 'cl-entity cl-entity--match'
                        : 'cl-entity cl-entity--mismatch',
                })
            }
        }
        if (action.negativeConditions) {
            for (const condition of action.negativeConditions) {
                const result = DialogUtils.convertToScorerCondition(condition, this.props.entities, this.props.memories)
                items.push({
                    name: result.name,
                    neg: true,
                    type: result.match
                        ? 'cl-entity cl-entity--mismatch'
                        : 'cl-entity cl-entity--match',
                })
            }
        }
        return (
            <OF.List
                items={items}
                onRenderCell={(item, index) => {
                    if (!item) {
                        return null
                    }

                    return <span className={item.type} data-testid="action-scorer-entities">{item.neg ? (<del>{item.name}</del>) : item.name}</span>
                }}
            />
        )
    }

    isUnscoredActionAvailable(action: CLM.UnscoredAction): boolean {
        // Can't add an end session action if one has already been added
        if (action.actionType === CLM.ActionTypes.END_SESSION && !this.props.isEndSessionAvailable) {

            // If selected action is EndSession, it's ok to replace it with another EndSession
            // If no selected actionId, first item is selected one
            const selectedActionId = this.props.selectedActionId || (this.state.actionsForRender.length > 0 ? this.state.actionsForRender[0].actionId : null)
            if (selectedActionId) {
                let selectedAction = this.props.actions.find(a => a.actionId === selectedActionId)
                if (selectedAction?.actionType === CLM.ActionTypes.END_SESSION) {
                    return true
                }

            }
            return false
        }
        else if (action.reason === CLM.ScoreReason.NotAvailable) {
            return false
        }
        // actionId can be undefined for "fake" actions injected in the list
        // even though it was casted to UnscoredAction to lose type information
        else if (action.actionId === Util.PLACEHOLDER_SET_ENTITY_ACTION_ID) {
            return true
        } else {
            return DialogUtils.isActionIdAvailable(action.actionId, this.props.actions, this.props.entities, this.props.memories)
        }
    }

    calculateReason(unscoredAction: CLM.UnscoredAction): CLM.ScoreReason {

        if (this.props.dialogType !== CLM.DialogType.TEACH
            || !unscoredAction.reason
            || unscoredAction.reason === CLM.ScoreReason.NotCalculated) {

            const action = this.props.actions.find(a => a.actionId === unscoredAction.actionId)

            // If action is null - there's a bug somewhere
            if (!action) {
                return CLM.ScoreReason.NotAvailable
            }

            const isAvailable = DialogUtils.isActionAvailable(action, this.props.entities, this.props.memories)
            return isAvailable ? CLM.ScoreReason.NotScorable : CLM.ScoreReason.NotAvailable
        }
        return unscoredAction.reason as CLM.ScoreReason
    }

    isMasked(actionId: string): boolean {
        return this.props.scoreInput.maskedActions.includes(actionId)
    }

    @autobind
    renderItemColumn(action: ActionForRender, index: number, column: IRenderableColumn) {

        // Handle deleted actions
        if (action.actionId === MISSING_ACTION) {
            if (column.key === 'select') {

                const buttonText = (this.props.dialogType !== CLM.DialogType.TEACH && action.score === 1) ? "Selected" : "Select"
                return (
                    <OF.PrimaryButton
                        disabled={true}
                        ariaDescription={buttonText}
                        text={buttonText}
                    />
                )
            } else if (column.key === 'actionResponse') {
                if (this.props.importedAction) {
                    return <span className="cl-font--warning cl-action-scorer-warning">IMPORTED ACTION</span>
                }
                else {
                    return <span className="cl-font--warning cl-action-scorer-warning">MISSING ACTION</span>
                }
            }
            else if (column.key === 'actionScore') {
                return column.render(action, this, index)
            }
            else {
                return ''
            }
        }

        return column.render(action, this, index)
    }

    // Create dummy item for injecting non-actions into list
    makeDummyItem(dummyType: string, score: number): CLM.ScoredAction {
        return {
            actionId: dummyType,
            payload: dummyType,
            score: score,
            isTerminal: false,
            actionType: CLM.ActionTypes.TEXT
        }
    }

    // Calculate distance between imported bot action and given action
    calcSimilarity(scoredBase: CLM.ScoredBase): number {
        if (!this.props.importedAction || scoredBase.actionId === MISSING_ACTION) {
            return 0
        }
        const defaultEntityMap = Util.getDefaultEntityMap(this.props.entities)
        let actionText = ""
        if (scoredBase.actionType === CLM.ActionTypes.TEXT) {
            actionText = CLM.ActionBase.GetPayload(scoredBase, defaultEntityMap)
        }
        else if (scoredBase.actionType === CLM.ActionTypes.CARD) {
            const cardAction = new CLM.CardAction(scoredBase as any)
            const template = this.props.botInfo.templates.find((t) => t.name === cardAction.templateName)
            if (template) {
                const renderedActionArguments = cardAction.renderArguments(defaultEntityMap, { fallbackToOriginal: true })
                actionText = getRawTemplateText(template, renderedActionArguments)
            }
        }
        return compareTwoStrings(actionText, this.props.importedAction.text)
    }

    getActionsForRender(): ActionForRender[] {
        if (!this.props.scoreResponse) {
            return []
        }

        let actionsForRender = [...this.props.scoreResponse.scoredActions as ActionForRender[], ...this.props.scoreResponse.unscoredActions as ActionForRender[]]

        // Need to reassemble to scored item has full action info and reason
        actionsForRender = actionsForRender.map(scoredBase => {
            const action = this.props.actions.find(a => a.actionId === scoredBase.actionId)
            const score = (scoredBase as CLM.ScoredAction).score
            const reason = score ? null : this.calculateReason(scoredBase as CLM.UnscoredAction)
            if (action) {
                return {
                    ...action,
                    reason,
                    score,
                }
            }
            else {
                // Action that no longer exists (was deleted)
                return this.makeDummyItem(MISSING_ACTION, score)
            }
        })

        // Add any new actions that weren't included in scores
        // NOTE: This will go away when we always rescore the step
        const missingActions = this.props.actions.filter(a => actionsForRender.find(si => si.actionId === a.actionId) == null)
        const missingItems = missingActions.map<ActionForRender>(action =>
            ({
                ...action,
                reason: CLM.ScoreReason.NotCalculated,
                score: 0,
                repromptActionId: action.repromptActionId
            }))

        actionsForRender = [...actionsForRender, ...missingItems]

        // Add any actions to set enum values that weren't already generated
        // Note: These actions don't have ID's because they don't exist
        const setEntityActions = this.props.entities
            .filter(e => e.entityType === CLM.EntityType.ENUM)
            .map(e => Util.getSetEntityActionsFromEnumEntity(e))
            .reduce((a, b) => [...a, ...b], [])

        // TODO: Schema Refactor
        // Need to convert these to access entityId and enumValueId
        const existingSetEntityActions = actionsForRender
            .filter(si => si.actionType === CLM.ActionTypes.SET_ENTITY)
            .map(a => new CLM.SetEntityAction(a as CLM.ActionBase))

        const missingSetEntityActions = setEntityActions
            .filter(possibleAction => !existingSetEntityActions.find(existingAction =>
                existingAction.entityId === possibleAction.entityId
                && existingAction.enumValueId === possibleAction.enumValueId
            ))

        const missingSetEntityItems = missingSetEntityActions
            .map<ActionForRender>(action =>
                ({
                    ...action,
                    reason: CLM.ScoreReason.NotCalculated,
                    score: 0
                }))

        actionsForRender = [...actionsForRender, ...missingSetEntityItems]

        // If imported action selected, pre-calculate sort scores
        if (this.props.importedAction) {
            actionsForRender = actionsForRender.map(si => ({
                ...si,
                similarityScore: this.calcSimilarity(si),
            }))
        }

        if (this.state.sortColumn) {
            const sortColumn = this.state.sortColumn
            // Sort the items.
            actionsForRender = actionsForRender.sort((a, b) => {
                const firstValue = sortColumn.getSortValue(a, this)
                const secondValue = sortColumn.getSortValue(b, this)

                let isFirstGreaterThanSecond = 0

                if (typeof firstValue === 'string' && typeof secondValue === 'string') {
                    isFirstGreaterThanSecond = firstValue.localeCompare(secondValue)
                }
                else if (typeof firstValue === 'number' && typeof secondValue === 'number') {
                    isFirstGreaterThanSecond = firstValue - secondValue
                }

                return sortColumn.isSortedDescending
                    ? isFirstGreaterThanSecond * -1
                    : isFirstGreaterThanSecond
            })
        }

        actionsForRender.forEach(actionForRender => {
            if (actionForRender.actionType === CLM.ActionTypes.API_LOCAL) {
                actionForRender.selectedCallbackResult = actionIdCallbackResultMap[actionForRender.actionId]
            }
        })

        return actionsForRender
    }

    render() {
        // In teach mode, hide scores after selection
        // so they can't be re-selected for non-terminal actions
        if (this.props.dialogType === CLM.DialogType.TEACH && this.state.haveEdited) {
            return null
        }

        const { intl } = this.props
        let template: CLM.Template | undefined
        let renderedActionArguments: CLM.RenderedActionArgument[] = []
        if (this.state.cardViewerAction) {
            const cardAction = new CLM.CardAction(this.state.cardViewerAction)
            const entityMap = Util.getDefaultEntityMap(this.props.entities)
            template = this.props.botInfo.templates.find((t) => t.name === cardAction.templateName)
            renderedActionArguments = this.state.cardViewerShowOriginal
                ? cardAction.renderArguments(entityMap, { preserveOptionalNodeWrappingCharacters: true })
                : cardAction.renderArguments(Util.createEntityMapFromMemories(this.props.entities, this.props.memories), { fallbackToOriginal: true })
        }

        return (
            <div>
                {this.state.actionsForRender.length === 0 && (!this.props.autoTeach && this.props.canEdit)
                    ? <div className="cl-action-scorer-placeholder">
                        <div className={`cl-action-scorer-placeholder__description`}>
                            <h1 className={OF.FontClassNames.xxLarge}>Create an Action</h1>
                            <p>You're bot does not have any actions.<br />It needs at least one action to continue building this training dialog.</p>
                        </div>
                        <div>
                            <OF.PrimaryButton
                                data-testid="action-scorer-add-action-button"
                                text="Create Action"
                                iconProps={{ iconName: 'Add' }}
                                onClick={this.handleOpenActionModal}
                            />
                        </div>
                    </div>
                    :
                    <div>
                        <div className="cl-modal-buttons_primary">
                            <OF.DefaultButton
                                data-testid="action-scorer-add-action-button"
                                disabled={!this.props.canEdit}
                                onClick={this.handleOpenActionModal}
                                ariaDescription='Create Action'
                                text='Action'
                                iconProps={{ iconName: 'CirclePlus' }}
                            />
                            <OF.DefaultButton
                                data-testid="action-scorer-add-apistub-button"
                                disabled={!this.props.canEdit}
                                onClick={() => this.onOpenAPIPlaceholderCreator()}
                                ariaDescription='Create API Placeholder'
                                text='API Placeholder'
                                iconProps={{ iconName: 'Handwriting' }}
                            />
                        </div>
                        <OF.DetailsList
                            className={OF.FontClassNames.mediumPlus}
                            items={this.state.actionsForRender}
                            columns={this.state.columns}
                            checkboxVisibility={OF.CheckboxVisibility.hidden}
                            onRenderItemColumn={this.renderItemColumn}
                            onColumnHeaderClick={this.onColumnClick}
                            onRenderDetailsHeader={(
                                detailsHeaderProps: OF.IDetailsHeaderProps,
                                defaultRender: OF.IRenderFunction<OF.IDetailsHeaderProps>) =>
                                onRenderDetailsHeader(detailsHeaderProps, defaultRender)}
                        />
                    </div>
                }

                {this.state.isActionCreatorModalOpen &&
                    <ActionCreatorEditor
                        app={this.props.app}
                        editingPackageId={this.props.editingPackageId}
                        open={true}
                        action={null}
                        actions={this.props.actions}
                        importedAction={this.props.importedAction}
                        handleClose={() => this.onClickCancelActionEditor()}
                        // It is not possible to delete from this modal since you cannot select existing action so disregard implementation of delete
                        handleDelete={action => { }}
                        handleEdit={action => this.onClickSubmitActionEditor(action)}
                    />
                }
                <AdaptiveCardViewer
                    open={this.state.cardViewerAction != null}
                    onDismiss={() => this.onCloseCardViewer()}
                    template={template}
                    actionArguments={renderedActionArguments}
                    hideUndefined={true}
                />
                <ConfirmCancelModal
                    data-testid="popup-already-selected"
                    open={this.state.isAlreadySelectedOpen}
                    onOk={this.onCloseAlreadySelectedPopUp}
                    title={Util.formatMessageId(intl, FM.ACTIONSCORER_ALREADYSELECTED)}
                />
                <EditApiPlaceholder
                    isOpen={this.state.apiPlaceholderCreatorFilledEntityMap != null}
                    app={this.props.app}
                    actions={this.props.actions}
                    editingPackageId={this.props.editingPackageId}
                    placeholderName={this.state.apiPlaceholderName}
                    initMemories={this.state.apiPlaceholderCreatorFilledEntityMap}
                    handleClose={this.onCloseCreateAPIPlaceholder}
                />
            </div>
        )
    }

    @autobind
    showAlreadySelectedPopUp() {
        this.setState({ isAlreadySelectedOpen: true })
    }

    @autobind
    onCloseAlreadySelectedPopUp() {
        this.setState({ isAlreadySelectedOpen: false })
    }
}

export interface ReceivedProps {
    app: CLM.AppBase
    editingPackageId: string,
    historyItemSelected: boolean,
    dialogType: CLM.DialogType,  // TODO = make this not train dialog specific
    autoTeach: boolean,
    dialogMode: CLM.DialogMode,
    scoreResponse: CLM.ScoreResponse,
    scoreInput: CLM.ScoreInput,
    selectedActionId: string | undefined,
    memories: CLM.Memory[],
    canEdit: boolean,
    isEndSessionAvailable: boolean,
    importedAction?: ImportedAction
    onActionSelected: (trainScorerStep: CLM.TrainScorerStep) => void,
    onActionCreatorClosed: () => void
    selectedScorerStep?: CLM.TrainScorerStep
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        createActionThunkAsync: actions.action.createActionThunkAsync,
        toggleAutoTeach: actions.teach.toggleAutoTeach,
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.bot.botInfo) {
        throw new Error(`You attempted to render the ActionScorer which requires botInfo, but botInfo was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        entities: state.entities,
        actions: state.actions,
        botInfo: state.bot.botInfo
    }
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(ActionScorer))