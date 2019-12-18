/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as ValidityUtils from '../../../Utils/validityUtils'
import * as CLM from '@conversationlearner/models'
import * as Util from '../../../Utils/util'
import Entities from './Entities'
import TrainDialogs from './TrainDialogs'
import Actions from './Actions'
import Dashboard from './Dashboard'
import Settings from './Settings'
import Testing from './Testing'
import Review from './Review'
import LogDialogs from './LogDialogs'
import TrainingStatus from '../../../components/TrainingStatusContainer'
import actions from '../../../actions'
import FormattedMessageId from '../../../components/FormattedMessageId'
import { NavLink, Route, Switch } from 'react-router-dom'
import { RouteComponentProps, StaticContext } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { FM } from '../../../react-intl-messages'
import { State, FeatureStrings } from '../../../types'
import './Index.css'

// TODO: i18n support would be much easier after proper routing is implemented
// this would eliminate the use of page title strings as navigation keys and instead use the url

interface ComponentState {
    botValidationErrors: string[]
    packageId: string | null,
    modelLoaded: boolean
}

class Index extends React.Component<Props, ComponentState> {
    state: ComponentState = {
        botValidationErrors: [],
        packageId: null,
        modelLoaded: false
    }

    async loadApp(app: CLM.AppBase, packageId: string): Promise<void> {
        this.setState({ packageId })

        const infoThunk = this.props.fetchBotInfoThunkAsync(this.props.browserId, app.appId)
        const appThunk = this.props.setCurrentAppThunkAsync(this.props.user.id, app)
        // Fetch the first page of log dialogs 
        const logsThunk = this.props.fetchLogDialogsThunkAsync(app, packageId, true)
        const sourceThunk = this.props.fetchAppSourceThunkAsync(app.appId, packageId)

        await Promise.all([infoThunk, appThunk, logsThunk, sourceThunk])
        this.setState({ modelLoaded: true })
    }

    UNSAFE_componentWillMount() {
        const { match, location, history } = this.props
        const app = location.state?.app
        if (!app) {
            // TODO: Is there a way to recover getting appId from URL instead of router state
            const appId = match.params.appId
            console.warn(`${this.constructor.name} componentWillMount. location.state.app is for app ${appId}`)
            history.push('/home')
            return
        }

        const editPackageId = this.props.activeApps[app.appId] ?? app.devPackageId
        if (!editPackageId) {
            throw new Error(`You attempted to load an app, but editPackageId is not defined. This is likely a problem with the code. Please open an issue.`)
        }

        void this.loadApp(app, editPackageId)
    }

    componentWillReceiveProps(newProps: Props) {
        const app = newProps.location.state?.app
        if (!app) {
            throw new Error(`App/Index#componentWillReceiveProps: app could not be found in location state. This is likely a problem with the code. Please open an issue.`)
        }

        const editPackageId = newProps.activeApps[app.appId] ?? app.devPackageId
        if (!editPackageId) {
            throw new Error(`App/Index#componentWillReceiveProps: editPackageId is not defined. This is likely a problem with the code. Please open an issue.`)
        }

        if (this.state.packageId !== editPackageId) {
            this.loadApp(app, editPackageId)
        }

        if ((newProps.actions !== this.props.actions || newProps.botInfo !== this.props.botInfo) && newProps.botInfo) {
            const botValidationErrors = this.botValidationErrors(newProps.botInfo, newProps.actions)
            this.setState({ botValidationErrors })
        }
    }

    onCreateApp = async (appToCreate: CLM.AppBase, source: CLM.AppDefinition | null = null) => {
        const app = await (this.props.createApplicationThunkAsync(this.props.user.id, appToCreate, source) as any as Promise<CLM.AppBase>)
        const { history } = this.props
        history.push(`/home/${app.appId}`, { app })
    }

    onDeleteApp = async (appIdToDelete: string) => {
        await (this.props.deleteApplicationThunkAsync(appIdToDelete!) as any as Promise<CLM.AppBase>)
        const { history } = this.props
        history.push(`/home`)
    }

    // Returns any incompatibilities between the running Bot and the selected Model
    botValidationErrors(botInfo: CLM.BotInfo, actionList: CLM.ActionBase[]): string[] {
        // Check for missing APIs
        const actionsMissingCallbacks = actionList
            .filter(a => a.actionType === CLM.ActionTypes.API_LOCAL && !CLM.ActionBase.isPlaceholderAPI(a))
            .map(a => new CLM.ApiAction(a))
            .filter(a => !botInfo.callbacks || !botInfo.callbacks.some(cb => cb.name === a.name))

        // Make unique list of missing APIs
        const uniqueCallbackNames = actionsMissingCallbacks
            .map(a => a.name)
            .filter((item, i, ar) => ar.indexOf(item) === i)

        const apiActionErrors = uniqueCallbackNames.map(api => `Action references callback "${api}" not contained by running Bot.`)

        // Check for bad templates
        const badTemplateErrors = botInfo.templates
            .filter(t => t.validationError !== null)
            .map(t => t.validationError!)

        // Check for missing templates
        const actionsMissingTemplates = actionList
            .filter(a => a.actionType === CLM.ActionTypes.CARD)
            .map(a => new CLM.CardAction(a))
            .filter(a => !botInfo.templates || !botInfo.templates.some(cb => cb.name === a.templateName))

        // Make unique list of missing templates
        const uniqueTemplateNames = actionsMissingTemplates
            .map(a => a.templateName)
            .filter((item, i, ar) => ar.indexOf(item) === i)

        const missingTemplateErrors = uniqueTemplateNames.map(template => `Action references Template "${template}" not contained by running Bot`)

        return [
            ...apiActionErrors,
            ...badTemplateErrors,
            ...missingTemplateErrors
        ]
    }

    getTrainDialogValidity(): CLM.Validity {
        let validity = CLM.Validity.VALID
        for (const trainDialog of this.props.trainDialogs) {
            if (trainDialog.validity === CLM.Validity.INVALID) {
                return CLM.Validity.INVALID
            }
            // WARNING & UNKNOWN are equivalent from a display perspective
            else if (trainDialog.validity === CLM.Validity.WARNING) {
                validity = CLM.Validity.WARNING
            }
            else if (trainDialog.validity === CLM.Validity.UNKNOWN) {
                validity = CLM.Validity.UNKNOWN
            }
        }
        return validity
    }

    render() {
        const { match, location, intl } = this.props

        if (!location.state) {
            return null
        }

        const app: CLM.AppBase = location.state.app!
        // TODO: There is an assumption that by the time render is called, componentWillMount has called loadApp and set the packageId
        const editPackageId = this.state.packageId!

        // TODO: Why is this hard coded to Master? If there is no packageVersions we default back to Master but this seems incorrect
        let tag = 'Master'
        if (editPackageId !== app.devPackageId) {
            const packageReference = app.packageVersions.find(pv => pv.packageId === editPackageId)
            if (!packageReference) {
                throw new Error(`editPackageId did not equal devPackageId, but could not find a packageVersion using the editPackageId: ${editPackageId}. This should not be possible. Please open an issue.`)
            }

            tag = packageReference.packageVersion
        }

        const trainDialogValidity = this.getTrainDialogValidity()
        const invalidBot = this.state.botValidationErrors && this.state.botValidationErrors.length > 0
        const filteredLogDialogs = this.props.logDialogs.filter(l => !l.targetTrainDialogIds || l.targetTrainDialogIds.length === 0)
        const logDialogCount = `${filteredLogDialogs.length}${this.props.logContinuationToken ? "+" : ""}`

        return (
            <>
                <div className="cl-o-app-columns cl-model-banner">
                    <div className="cl-model-banner_content">
                        <div
                            data-testid="app-index-model-name"
                            className={OF.FontClassNames.xLarge}
                        >
                            {app.appName}
                        </div>
                    </div>
                </div>
                <div className="cl-o-app-columns">
                    <div className="cl-app_content">
                        <div className="cl-app-page">
                            <div>
                                <div className={`cl-app-tag-status ${OF.FontClassNames.mediumPlus}`}>
                                    <FormattedMessageId id={FM.APP_VERSION} /> {tag}
                                    {editPackageId === app.livePackageId &&
                                        <span className="cl-font--warning">LIVE</span>
                                    }
                                </div>
                                <TrainingStatus
                                    app={app}
                                />
                                <div className={`cl-nav ${OF.FontClassNames.mediumPlus}`}>
                                    <div className="cl-nav_section">
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-home" exact={true} to={{ pathname: `${match.url}`, state: { app } }}>
                                            <OF.Icon iconName="Home" />
                                            <span className={(this.state.modelLoaded && invalidBot) ? 'cl-font--highlight' : ''}>Home
                                        {this.state.modelLoaded && invalidBot &&
                                                    <OF.TooltipHost
                                                        content={intl.formatMessage({
                                                            id: FM.TOOLTIP_BOTINFO_INVALID,
                                                            defaultMessage: 'Bot not compatible'
                                                        })}
                                                        calloutProps={{ gapSpace: 0 }}
                                                    >
                                                        <OF.IconButton
                                                            className="ms-Button--transparent cl-icon--short"
                                                            iconProps={{ iconName: 'IncidentTriangle' }}
                                                            title="Error Alert"
                                                        />
                                                    </OF.TooltipHost>
                                                }</span>
                                        </NavLink>
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-entities" to={{ pathname: `${match.url}/entities`, state: { app } }}>
                                            <OF.Icon iconName="List" /><span>Entities</span><span className="count">{this.state.modelLoaded ? this.props.entities.filter(e => typeof e.positiveId === 'undefined' || e.positiveId === null).filter(e => !e.doNotMemorize).length : ''}</span>
                                        </NavLink>
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-actions" to={{ pathname: `${match.url}/actions`, state: { app } }}>
                                            <OF.Icon iconName="List" /><span>Actions</span>
                                            <span className="count">
                                                {this.state.modelLoaded ? this.props.actions.length : ''}
                                            </span>
                                        </NavLink>
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-train-dialogs" to={{ pathname: `${match.url}/trainDialogs`, state: { app } }}>
                                            <OF.Icon iconName="List" />
                                            <span
                                                className={(this.state.modelLoaded && trainDialogValidity !== CLM.Validity.VALID) ? 'cl-font--highlight' : ''}
                                            >
                                                Train Dialogs
                                                {this.state.modelLoaded && trainDialogValidity !== CLM.Validity.VALID &&
                                                    <OF.TooltipHost
                                                        content={intl.formatMessage({
                                                            id: ValidityUtils.validityToolTip(trainDialogValidity),
                                                            defaultMessage: 'Contains Invalid Train Dialogs'
                                                        })}
                                                        calloutProps={{ gapSpace: 0 }}
                                                    >
                                                        <OF.Icon
                                                            className={`cl-icon ${ValidityUtils.validityColorClassName(trainDialogValidity)}`}
                                                            iconName="IncidentTriangle"
                                                        />
                                                    </OF.TooltipHost>
                                                }
                                            </span>
                                            <span className="count">{this.state.modelLoaded ? this.props.trainDialogs.length : ''}</span>
                                        </NavLink>
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-log-dialogs" to={{ pathname: `${match.url}/logDialogs`, state: { app } }}>
                                            <OF.Icon iconName="List" /><span>Log Dialogs</span>
                                            <span className="count">{this.state.modelLoaded ? logDialogCount : ""}</span>
                                        </NavLink>
                                        {Util.isFeatureEnabled(this.props.settings.features, FeatureStrings.CCI) &&
                                            <NavLink className="cl-nav-link" data-testid="app-index-nav-link-testing" to={{ pathname: `${match.url}/testing`, state: { app } }}>
                                                <OF.Icon iconName="TestPlan" /><span>Testing</span>
                                            </NavLink>
                                        }
                                        {Util.isFeatureEnabled(this.props.settings.features, FeatureStrings.CCI) &&
                                            <NavLink className="cl-nav-link" data-testid="app-index-nav-link-review" to={{ pathname: `${match.url}/review`, state: { app } }}>
                                                <OF.Icon iconName="D365TalentLearn" /><span>Review</span>
                                            </NavLink>
                                        }
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-settings" to={{ pathname: `${match.url}/settings`, state: { app } }}>
                                            <OF.Icon iconName="Settings" /><span>Settings</span>
                                        </NavLink>
                                    </div>
                                    <div className="cl-nav_section">
                                        <NavLink className="cl-nav-link" data-testid="app-index-nav-link-my-models" exact={true} to="/home">
                                            <OF.Icon iconName="Back" /><span>My Models</span>
                                        </NavLink>
                                    </div>
                                </div>
                            </div>
                            <Switch>
                                <Route
                                    path={`${match.url}/settings`}
                                    render={props => <Settings {...props} app={app} editingPackageId={editPackageId} onCreateApp={this.onCreateApp} onDeleteApp={this.onDeleteApp} />}
                                />
                                <Route
                                    path={`${match.url}/entities`}
                                    render={props => <Entities {...props} app={app} editingPackageId={editPackageId} />}
                                />
                                <Route
                                    path={`${match.url}/actions`}
                                    render={props => <Actions {...props} app={app} editingPackageId={editPackageId} />}
                                />
                                <Route
                                    path={`${match.url}/trainDialogs`}
                                    render={props => <TrainDialogs {...props} app={app} editingPackageId={editPackageId} invalidBot={invalidBot} filteredAction={location.state.actionFilter} filteredEntity={location.state.entityFilter} onDeleteApp={this.onDeleteApp} />}
                                />
                                <Route
                                    path={`${match.url}/logDialogs`}
                                    render={props => <LogDialogs {...props} app={app} editingPackageId={editPackageId} invalidBot={invalidBot} />}
                                />
                                <Route
                                    path={`${match.url}/testing`}
                                    render={props => <Testing {...props} app={app} editingPackageId={editPackageId} />}
                                />
                                <Route
                                    path={`${match.url}/review`}
                                    render={props => <Review {...props} app={app} editingPackageId={editPackageId} invalidBot={invalidBot} />}
                                />
                                <Route
                                    exact={true}
                                    path={match.url}
                                    render={props => <Dashboard {...props} app={app} modelLoaded={this.state.modelLoaded} validationErrors={this.state.botValidationErrors} />}
                                />
                            </Switch>
                        </div>
                    </div>
                </div>
            </>
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        setCurrentAppThunkAsync: actions.display.setCurrentAppThunkAsync,
        createApplicationThunkAsync: actions.app.createApplicationThunkAsync,
        fetchAppSourceThunkAsync: actions.app.fetchAppSourceThunkAsync,
        fetchLogDialogsThunkAsync: actions.log.fetchLogDialogsThunkAsync,
        fetchBotInfoThunkAsync: actions.bot.fetchBotInfoThunkAsync,
        deleteApplicationThunkAsync: actions.app.deleteApplicationThunkAsync
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render App/Index but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        entities: state.entities,
        actions: state.actions,
        trainDialogs: state.trainDialogs,
        display: state.display,
        botInfo: state.bot.botInfo,
        user: state.user.user,
        browserId: state.bot.browserId,
        activeApps: state.apps.activeApps,
        logDialogs: state.logDialogState.logDialogs,
        logContinuationToken: state.logDialogState.continuationToken,
        settings: state.settings
    }
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
interface MatchParams {
    appId: string
}
type LocationState = {
    app?: CLM.AppBase
    actionFilter?: CLM.ActionBase
    entityFilter?: CLM.EntityBase
}
type Props = stateProps & dispatchProps & RouteComponentProps<MatchParams, StaticContext, LocationState> & InjectedIntlProps

export default connect<stateProps, dispatchProps, RouteComponentProps<MatchParams, StaticContext, LocationState>>(mapStateToProps, mapDispatchToProps)(injectIntl(Index))
