/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as CLM from '@conversationlearner/models'
import * as OF from 'office-ui-fabric-react'
import AppsListComponent from './AppsListComponent'
import { withRouter } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { OBIImportData } from '../../Utils/obiUtils'
import { fetchTutorialsThunkAsync } from '../../actions/appActions'
import { CL_IMPORT_TUTORIALS_USER_ID, State, AppCreatorType } from '../../types'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { autobind } from 'core-decorators'
import { DispatcherAlgorithmType } from '../../components/modals/DispatcherCreator'

interface ComponentState {
    isDispatcherCreateModalOpen: boolean
    isAppCreateModalOpen: boolean
    appCreatorType: AppCreatorType
    isImportTutorialsOpen: boolean
    appToDelete: CLM.AppBase | null
    tutorials: CLM.AppBase[] | null
    selectionCount: number
}

class AppsList extends React.Component<Props, ComponentState> {

    state: Readonly<ComponentState> = {
        isDispatcherCreateModalOpen: false,
        isAppCreateModalOpen: false,
        appCreatorType: AppCreatorType.NEW,
        isImportTutorialsOpen: false,
        appToDelete: null,
        tutorials: null,
        selectionCount: 0,
    }

    private selection: OF.ISelection = new OF.Selection({
        getKey: (app) => (app as CLM.AppBase).appId,
        onSelectionChanged: this.onSelectionChanged
    })

    @autobind
    onClickApp(app: CLM.AppBase) {
        const { match, history } = this.props
        history.push(`${match.url}/${app.appId}`, { app })
    }

    @autobind
    onClickImportApp() {
        this.setState({
            isAppCreateModalOpen: true,
            appCreatorType: AppCreatorType.IMPORT
        })
    }

    //------------------
    // Import Tutorials
    //------------------
    @autobind
    async onClickImportDemoApps() {
        const tutorials = this.state.tutorials !== null
            ? this.state.tutorials
            : await ((this.props.fetchTutorialsThunkAsync(CL_IMPORT_TUTORIALS_USER_ID) as any) as Promise<CLM.AppBase[]>)

        this.setState({
            tutorials: tutorials,
            isImportTutorialsOpen: true
        })
    }

    @autobind
    onCloseImportNotification() {
        this.setState({
            isImportTutorialsOpen: false
        })
    }

    //------------------
    // App Create
    //------------------
    @autobind
    onClickCreateNewApp() {
        this.setState({
            isAppCreateModalOpen: true,
            appCreatorType: AppCreatorType.NEW
        })
    }

    @autobind
    onSubmitAppCreateModal(app: Partial<CLM.AppBase>, source: CLM.AppDefinition | null = null) {
        this.setState({
            isAppCreateModalOpen: false
        }, () => {
            this.props.onCreateApp(app, source)
        })
    }

    @autobind
    onCancelAppCreateModal() {
        this.setState({
            isAppCreateModalOpen: false
        })
    }

    @autobind
    onSubmitDispatcherCreateModal(app: Partial<CLM.AppBase>, algorithmType: DispatcherAlgorithmType) {
        this.setState({
            isDispatcherCreateModalOpen: false
        }, () => {
            const selectedModels = this.selection.getSelection() as CLM.AppBase[]
            this.props.onCreateDispatchModel(app, selectedModels, algorithmType)
        })
    }

    @autobind
    onCancelDispatcherCreateModal() {
        this.setState({
            isDispatcherCreateModalOpen: false
        })
    }

    //------------------
    // OBI Import
    //------------------
    @autobind
    onClickImportOBI(): void {
        this.setState({
            isAppCreateModalOpen: true,
            appCreatorType: AppCreatorType.OBI
        })
    }

    @autobind
    async onSubmitImportOBI(app: CLM.AppBase, obiImportData: OBIImportData): Promise<void> {
        this.setState({
            isAppCreateModalOpen: false
        }, () => this.props.onCreateApp(app, null, obiImportData))
    }

    @autobind
    onClickCreateNewDispatcherModel() {
        this.setState({
            isDispatcherCreateModalOpen: true,
        })
    }

    @autobind
    onSelectionChanged() {
        const selectionCount = this.selection.getSelectedCount()
        this.setState({
            selectionCount
        })
    }

    render() {
        return <AppsListComponent
            intl={this.props.intl}

            user={this.props.user}
            apps={this.props.apps}
            activeApps={this.props.activeApps}
            onClickApp={this.onClickApp}
            selection={this.selection}
            featuresString={this.props.settings.features}
            selectionCount={this.state.selectionCount}

            isAppCreateModalOpen={this.state.isAppCreateModalOpen}
            onSubmitAppCreateModal={this.onSubmitAppCreateModal}
            onCancelAppCreateModal={this.onCancelAppCreateModal}
            appCreatorType={this.state.appCreatorType}

            isDispatcherCreateModalOpen={this.state.isDispatcherCreateModalOpen}
            onSubmitDispatcherCreateModal={this.onSubmitDispatcherCreateModal}
            onCancelDispatcherCreateModal={this.onCancelDispatcherCreateModal}

            onClickCreateNewApp={this.onClickCreateNewApp}
            onClickImportApp={this.onClickImportApp}
            onClickImportDemoApps={this.onClickImportDemoApps}
            onClickCreateNewDispatcherModel={this.onClickCreateNewDispatcherModel}

            onClickImportOBI={this.onClickImportOBI}
            onSubmitImportOBI={this.onSubmitImportOBI}

            isImportTutorialsOpen={this.state.isImportTutorialsOpen}
            tutorials={this.state.tutorials!}
            onCloseImportNotification={this.onCloseImportNotification}
            onImportTutorial={this.props.onImportTutorial}
        />
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        fetchTutorialsThunkAsync
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render AppsList but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        activeApps: state.apps.activeApps,
        settings: state.settings,
    }
}

export interface ReceivedProps {
    apps: CLM.AppBase[]
    onCreateApp: (app: Partial<CLM.AppBase>, source: CLM.AppDefinition | null, obiImportData?: OBIImportData) => void
    onClickDeleteApp: (app: CLM.AppBase) => void
    onImportTutorial: (tutorial: CLM.AppBase) => void
    onCreateDispatchModel: (model: Partial<CLM.AppBase>, models: CLM.AppBase[], algorithmType: DispatcherAlgorithmType) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps & RouteComponentProps<any>

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(withRouter(injectIntl(AppsList)))