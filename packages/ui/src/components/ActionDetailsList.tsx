/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as Util from '../Utils/util'
import * as ActionPayloadRenderers from './actionPayloadRenderers'
import * as moment from 'moment'
import * as CLM from '@conversationlearner/models'
import AdaptiveCardViewer from './modals/AdaptiveCardViewer/AdaptiveCardViewer'
import { actionTypeRenderer } from './ActionRenderers'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../types'
import { onRenderDetailsHeader } from './ToolTips/ToolTips'
import { injectIntl, InjectedIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../react-intl-messages'
import './ActionDetailsList.css'
import { autobind } from 'core-decorators'
import { getValueConditionName, getEnumConditionName, getStringConditionName } from '../Utils/actionCondition'
import * as MockResultUtil from '../Utils/mockResults'

interface ComponentState {
    columns: IRenderableColumn[]
    sortColumn: IRenderableColumn
    cardViewerAction: CLM.ActionBase | null
}

class ActionDetailsList extends React.Component<Props, ComponentState> {
    constructor(p: any) {
        super(p)
        const columns = getColumns(this.props.intl)
        const defaultSortColumnName = "actionResponse"
        const defaultSortColumn = columns.find(c => c.key === defaultSortColumnName)
        if (!defaultSortColumn) {
            throw new Error(`Could not find column by name: ${defaultSortColumnName}`)
        }

        columns.forEach(col => {
            col.isSorted = false
            col.isSortedDescending = false

            if (col === defaultSortColumn) {
                col.isSorted = true
            }
        })

        this.state = {
            columns,
            sortColumn: defaultSortColumn,
            cardViewerAction: null
        }
    }

    validationError(action: CLM.ActionBase): boolean {
        switch (action.actionType) {
            case CLM.ActionTypes.TEXT: {
                // Make sure it renders
                try {
                    const entityMap = Util.getDefaultEntityMap(this.props.entities)
                    const textAction = new CLM.TextAction(action)
                    textAction.renderValue(entityMap, { preserveOptionalNodeWrappingCharacters: true })
                    return false
                }
                catch (error) {
                    return true
                }
            }
            case CLM.ActionTypes.API_LOCAL: {
                const apiAction = new CLM.ApiAction(action)
                // If placeholder not expecting action to exist
                if (apiAction.isPlaceholder || apiAction.isCallbackUnassigned) {
                    return false
                }

                // Otherwise make sure callback exists
                const callback = this.props.botInfo.callbacks.find(t => t.name === apiAction.name)
                if (callback === undefined) {
                    return false
                }

                // If any of mock results have errors
                const mockResults = [
                    ...callback.mockResults,
                    ...(apiAction.clientData?.mockResults ?? [])
                ]

                const mockResultsHaveErrors = mockResults.some(mr => MockResultUtil.getMockResultErrors(mr, this.props.entities).length > 0)

                return mockResultsHaveErrors
            }
            case CLM.ActionTypes.CARD: {
                const cardAction = new CLM.CardAction(action)
                return !this.props.botInfo.templates.some(cb => cb.name === cardAction.templateName)
            }
            case CLM.ActionTypes.END_SESSION: {
                return false
            }
            case CLM.ActionTypes.SET_ENTITY: {
                const entity = this.props.entities.find(e => e.entityId === action.entityId)
                return !entity
                    ? true
                    : entity.entityType !== CLM.EntityType.ENUM
            }
            case CLM.ActionTypes.DISPATCH:
            case CLM.ActionTypes.CHANGE_MODEL: {
                // TODO: Could validate access to model, but don't have access to it within this model
                return false
            }
            default: {
                console.warn(`Could not get validation for unknown action type: ${action.actionType}`)
                return true
            }
        }
    }

    sortActions(): CLM.ActionBase[] {
        const actions = [...this.props.actions]
        // If column header selected sort the items
        if (this.state.sortColumn) {
            actions
                .sort((a, b) => {
                    const firstValue = this.state.sortColumn.getSortValue(a, this)
                    const secondValue = this.state.sortColumn.getSortValue(b, this)
                    const compareValue = firstValue.localeCompare(secondValue)
                    return this.state.sortColumn.isSortedDescending
                        ? compareValue
                        : compareValue * -1
                })
        }

        return actions
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

        // Reset the items and columns to match the state.
        this.setState({
            columns,
            sortColumn
        })
    }

    onClickViewCard(action: CLM.ActionBase) {
        this.setState({
            cardViewerAction: action
        })
    }

    onClickRow(item: any, index: number | undefined, event: Event | undefined) {
        // Don't response to row click if it's button that was clicked
        if ((event?.target as any).type === 'button') {
            return
        }

        const action = item as CLM.ActionBase
        this.props.onSelectAction(action)
    }

    onCloseCardViewer = () => {
        this.setState({
            cardViewerAction: null
        })
    }

    render() {
        const sortedActions = this.sortActions()

        let template: CLM.Template | undefined
        let renderedActionArguments: CLM.RenderedActionArgument[] = []
        if (this.state.cardViewerAction) {
            const cardAction = new CLM.CardAction(this.state.cardViewerAction)
            const entityMap = Util.getDefaultEntityMap(this.props.entities)
            template = this.props.botInfo.templates.find((t) => t.name === cardAction.templateName)
            // TODO: This is hack to make adaptive card viewer accept action arguments with pre-rendered values
            renderedActionArguments = cardAction.renderArguments(entityMap, { preserveOptionalNodeWrappingCharacters: true })
                .filter(aa => !Util.isNullOrWhiteSpace(aa.value))
        }

        return (
            <div>
                <OF.DetailsList
                    className={OF.FontClassNames.mediumPlus}
                    items={sortedActions}
                    columns={this.state.columns}
                    checkboxVisibility={OF.CheckboxVisibility.hidden}
                    onRenderRow={(props, defaultRender) => <div data-selection-invoke={true}>{defaultRender?.(props)}</div>}
                    onRenderItemColumn={(action: CLM.ActionBase, i, column: IRenderableColumn) => column.render(action, this)}
                    onItemInvoked={(item, index, ev) => this.onClickRow(item, index, ev)}
                    onColumnHeaderClick={this.onClickColumnHeader}
                    onRenderDetailsHeader={(detailsHeaderProps: OF.IDetailsHeaderProps,
                        defaultRender: OF.IRenderFunction<OF.IDetailsHeaderProps>) =>
                        onRenderDetailsHeader(detailsHeaderProps, defaultRender)}
                />
                <AdaptiveCardViewer
                    open={this.state.cardViewerAction !== null}
                    onDismiss={() => this.onCloseCardViewer()}
                    template={template}
                    actionArguments={renderedActionArguments}
                    hideUndefined={true}
                />
            </div>
        )
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
    }, dispatch)
}

const mapStateToProps = (state: State) => {
    if (!state.bot.botInfo) {
        throw new Error(`You attempted to render the ActionDetailsList which requires botInfo, but botInfo was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        entities: state.entities,
        botInfo: state.bot.botInfo
    }
}

export interface ReceivedProps {
    actions: CLM.ActionBase[]
    onSelectAction: (action: CLM.ActionBase) => void
}

// Props types inferred from mapStateToProps
type stateProps = ReturnType<typeof mapStateToProps>
type Props = stateProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, {}, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(ActionDetailsList) as any)

function getActionPayloadRenderer(action: CLM.ActionBase, component: ActionDetailsList, isValidationError: boolean) {
    if (action.actionType === CLM.ActionTypes.TEXT) {
        const textAction = new CLM.TextAction(action)
        return (<ActionPayloadRenderers.TextPayloadRendererWithHighlights
            textAction={textAction}
            entities={component.props.entities}
            showMissingEntities={false}
        />)
    }
    else if (action.actionType === CLM.ActionTypes.API_LOCAL) {
        const apiAction = new CLM.ApiAction(action)
        const callback = component.props.botInfo.callbacks.find(t => t.name === apiAction.name)
        return (<ActionPayloadRenderers.ApiPayloadRendererWithHighlights
            apiAction={apiAction}
            entities={component.props.entities}
            callback={callback}
            showMissingEntities={false}
        />)
    }
    else if (action.actionType === CLM.ActionTypes.CARD) {
        const cardAction = new CLM.CardAction(action)
        return (<ActionPayloadRenderers.CardPayloadRendererWithHighlights
            isValidationError={isValidationError}
            cardAction={cardAction}
            entities={component.props.entities}
            onClickViewCard={() => component.onClickViewCard(action)}
            showMissingEntities={false}
        />)
    }
    else if (action.actionType === CLM.ActionTypes.END_SESSION) {
        const sessionAction = new CLM.SessionAction(action)
        return (<ActionPayloadRenderers.SessionPayloadRendererWithHighlights
            sessionAction={sessionAction}
            entities={component.props.entities}
            showMissingEntities={false}
        />)
    }
    else if (action.actionType === CLM.ActionTypes.SET_ENTITY) {
        const [name, value] = Util.setEntityActionDisplay(action, component.props.entities)
        return <span data-testid="actions-list-set-entity" className={OF.FontClassNames.mediumPlus}>{name}: {value}</span>
    }
    else if (action.actionType === CLM.ActionTypes.DISPATCH) {
        // TODO: Mismatch between fields in payload and actionBase (modelId and modelName vs only modelId)
        // Need to be able to load model by id to get name but need asynchronous functions etc
        const dispatchAction = new CLM.DispatchAction(action)
        return <span data-testid="actions-list-dispatch" className={OF.FontClassNames.mediumPlus}>Dispatch to model: {dispatchAction.modelName}</span>
    }
    else if (action.actionType === CLM.ActionTypes.CHANGE_MODEL) {
        const changeModelAction = new CLM.ChangeModelAction(action)
        return <span data-testid="actions-list-change-model" className={OF.FontClassNames.mediumPlus}>Change to model: {changeModelAction.modelName}</span>
    }

    return <span className={OF.FontClassNames.mediumPlus}>Unknown Action Type</span>
}

function renderCondition(text: string, isRequired: boolean): JSX.Element {
    return (
        <div
            className='ms-ListItem is-selectable ms-ListItem-primaryText'
            key={text}
            data-testid={isRequired ? "action-details-required-entities" : "action-details-disqualifying-entities"}
        >
            {text}
        </div>
    )
}
function renderConditions(entityIds: string[], conditions: CLM.Condition[], allEntities: CLM.EntityBase[], isRequired: boolean): JSX.Element[] {
    if (entityIds.length === 0 && (!conditions || conditions.length === 0)) {
        return ([
            <OF.Icon
                key="empty"
                iconName="Remove"
                className="cl-icon"
                data-testid={isRequired ? "action-details-empty-required-entities" : "action-details-empty-disqualifying-entities"}
            />
        ])
    }

    const elementsForEntityIds = entityIds.map(entityId => {
        const entity = allEntities.find(e => e.entityId === entityId)
        const name = !entity
            ? `Error - Missing Entity ID: ${entityId}`
            : entity.entityName

        return renderCondition(name, isRequired)
    })

    const elementsFromConditions = conditions
        .map(condition => {
            const entity = allEntities.find(e => e.entityId === condition.entityId)

            let name: string
            if (!entity) {
                name = `Error - Missing Entity ID: ${condition.entityId}`
            }
            else if (condition.valueId) {
                const enumValue = entity.enumValues ? entity.enumValues.find(eid => eid.enumValueId === condition.valueId) : undefined
                name = !enumValue
                    ? `Error - Missing Enum: ${condition.valueId}`
                    : getEnumConditionName(entity, enumValue)
            }
            else if (condition.stringValue) {
                name = getStringConditionName(entity, condition)
            }
            else {
                name = getValueConditionName(entity, condition)
            }

            return renderCondition(name, isRequired)
        })

    return [...elementsForEntityIds, ...elementsFromConditions]
}

function getColumns(intl: InjectedIntl): IRenderableColumn[] {
    return [
        {
            key: 'actionResponse',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_RESPONSE),
            fieldName: 'actionResponse',
            minWidth: 200,
            maxWidth: 400,
            isResizable: true,
            isMultiline: true,
            isSortedDescending: true,
            getSortValue: (action, component) => {
                const entityMap = Util.getDefaultEntityMap(component.props.entities)

                try {
                    switch (action.actionType) {
                        case CLM.ActionTypes.TEXT: {
                            const textAction = new CLM.TextAction(action)
                            return textAction.renderValue(entityMap, { preserveOptionalNodeWrappingCharacters: true })
                        }
                        case CLM.ActionTypes.API_LOCAL: {
                            const apiAction = new CLM.ApiAction(action)
                            return apiAction.name
                        }
                        case CLM.ActionTypes.CARD: {
                            const cardAction = new CLM.CardAction(action)
                            return cardAction.templateName
                        }
                        case CLM.ActionTypes.END_SESSION: {
                            const sessionAction = new CLM.SessionAction(action)
                            return sessionAction.renderValue(entityMap, { preserveOptionalNodeWrappingCharacters: true })
                        }
                        case CLM.ActionTypes.SET_ENTITY: {
                            return `set-${action.entityId}-${action.enumValueId}`
                        }
                        case CLM.ActionTypes.DISPATCH: {
                            const dispatchAction = new CLM.DispatchAction(action)
                            return dispatchAction.modelName
                        }
                        case CLM.ActionTypes.CHANGE_MODEL: {
                            const changeModelAction = new CLM.ChangeModelAction(action)
                            return changeModelAction.modelName
                        }
                        default: {
                            console.warn(`Could not get sort value for unknown action type: ${action.actionType}`)
                            return ''
                        }
                    }
                }
                catch (error) {
                    // Action has errors
                    return ''
                }
            },
            render: (action, component) => {
                const isValidationError = component.validationError(action)
                const payloadRenderer = getActionPayloadRenderer(action, component, isValidationError)
                return (
                    <span>
                        {isValidationError &&
                            <OF.Icon
                                data-testid="actions-error"
                                className={`cl-icon cl-color-error`}
                                iconName="IncidentTriangle"
                            />
                        }
                        {payloadRenderer}
                    </span>
                )
            }
        },
        {
            key: 'actionType',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_TYPE),
            fieldName: 'metadata',
            minWidth: 100,
            maxWidth: 100,
            isResizable: true,
            getSortValue: action => action.actionType.toLowerCase(),
            render: action => actionTypeRenderer(action)
        },
        {
            key: 'requiredEntities',
            name: Util.formatMessageId(intl, FM.ACTIONDETAILSLIST_COLUMNS_REQUIREDENTITIES),
            fieldName: 'requiredEntities',
            minWidth: 100,
            maxWidth: 200,
            isResizable: true,
            // TODO: Previous implementation returned arrays for these which is incorrect.
            // Should be action.negativeEntities.join('').toLowerCase(), but need entity names which requires lookup
            // This lookup should be done ahead of time instead of on every render
            getSortValue: action => '',
            render: (action, component) => renderConditions(action.requiredEntities, action.requiredConditions, component.props.entities, true)
        },
        {
            key: 'negativeEntities',
            name: Util.formatMessageId(intl, FM.ACTIONDETAILSLIST_COLUMNS_DISQUALIFYINGENTITIES),
            fieldName: 'negativeEntities',
            minWidth: 100,
            maxWidth: 200,
            isResizable: true,
            // TODO: Previous implementation returned arrays for these which is incorrect.
            // Should be action.negativeEntities.join('').toLowerCase(), but need entity names which requires lookup
            // This lookup should be done ahead of time instead of on every render
            getSortValue: action => '',
            render: (action, component) => renderConditions(action.negativeEntities, action.negativeConditions, component.props.entities, false)
        },
        {
            key: 'suggestedEntity',
            name: Util.formatMessageId(intl, FM.ACTIONDETAILSLIST_COLUMNS_SUGGESTEDENTITY),
            fieldName: 'suggestedEntity',
            minWidth: 100,
            maxWidth: 100,
            isResizable: true,
            getSortValue: action => '',
            render: (action, component) => {
                if (!action.suggestedEntity) {
                    return <OF.Icon iconName="Remove" className="cl-icon" data-testid="action-details-empty-expected-entity" />
                }

                const entityId = action.suggestedEntity
                const entity = component.props.entities.find(e => e.entityId === entityId)
                return (
                    <div className='ms-ListItem is-selectable ms-ListItem-primaryText' data-testid="action-details-expected-entity">
                        {entity
                            ? entity.entityName
                            : `Error - Entity ID: ${entityId}`}
                    </div>
                )
            }
        },
        {
            key: 'isTerminal',
            name: Util.formatMessageId(intl, FM.ACTIONLIST_COLUMNS_ISTERMINAL),
            fieldName: 'isTerminal',
            minWidth: 50,
            maxWidth: 50,
            isResizable: false,
            getSortValue: action => action.isTerminal ? 'a' : 'b',
            render: action => <OF.Icon iconName={action.isTerminal ? 'CheckMark' : 'Remove'} className="cl-icon" data-testid="action-details-wait" />
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
            key: 'createdDateTime',
            name: Util.formatMessageId(intl, FM.ACTIONDETAILSLIST_COLUMNS_CREATED_DATE_TIME),
            fieldName: 'createdDateTime',
            minWidth: 100,
            isResizable: false,
            getSortValue: action => moment(action.createdDateTime).valueOf().toString(),
            render: action => <span className={OF.FontClassNames.mediumPlus}>{Util.earlierDateOrTimeToday(action.createdDateTime)}</span>
        }
    ]
}

interface IRenderableColumn extends OF.IColumn {
    render: (action: CLM.ActionBase, component: ActionDetailsList) => JSX.Element | JSX.Element[]
    getSortValue: (action: CLM.ActionBase, component: ActionDetailsList) => string
}
