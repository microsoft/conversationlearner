/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as CLM from '@conversationlearner/models'
import * as TC from '../../../components/tipComponents'
import * as ToolTip from '../../../components/ToolTips/ToolTips'
import * as Util from '../../../Utils/util'
import actions from '../../../actions'
import ExportChoice from '../../../components/modals/ExportChoice'
import FormattedMessageId from '../../../components/FormattedMessageId'
import HelpIcon from '../../../components/HelpIcon'
import { connect } from 'react-redux'
import { State, AppCreatorType } from '../../../types'
import { Expando, AppCreator, TextboxRestrictable, PackageCreator, ErrorInjectionEditor, PackageTable } from '../../../components/modals'
import { bindActionCreators } from 'redux'
import { FM } from '../../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import './Settings.css'
import { autobind } from 'core-decorators'

interface ComponentState {
    localeVal: string
    appIdVal: string
    appNameVal: string
    selectedEditingVersionOptionKey: string | number | undefined,
    selectedLiveVersionOptionKey: string | number | undefined,
    markdownVal: string
    videoVal: string
    edited: boolean
    botFrameworkAppsVal: any[],
    newBotVal: string,
    debugErrorsOpen: boolean
    isLoggingOnVal: boolean,
    isPackageExpandoOpen: boolean,
    isSettingsExpandoOpen: boolean,
    isAppCopyModalOpen: boolean
    isExportChoiceOpen: boolean
    isConfirmDeleteAppModalOpen: boolean
    isPackageCreatorOpen: boolean
}

class Settings extends React.Component<Props, ComponentState> {
    constructor(p: Props) {
        super(p)

        this.state = {
            localeVal: '',
            appIdVal: '',
            appNameVal: '',
            selectedEditingVersionOptionKey: undefined,
            selectedLiveVersionOptionKey: undefined,
            markdownVal: '',
            videoVal: '',
            edited: false,
            botFrameworkAppsVal: [],
            newBotVal: '',
            debugErrorsOpen: false,
            isLoggingOnVal: true,
            isPackageExpandoOpen: false,
            isSettingsExpandoOpen: false,
            isAppCopyModalOpen: false,
            isConfirmDeleteAppModalOpen: false,
            isExportChoiceOpen: false,
            isPackageCreatorOpen: false,
        }
    }

    updateAppState(app: CLM.AppBase) {
        this.setState({
            localeVal: app.locale,
            appIdVal: app.appId,
            appNameVal: app.appName,
            selectedEditingVersionOptionKey: this.props.editingPackageId,
            selectedLiveVersionOptionKey: app.livePackageId,
            markdownVal: app.metadata?.markdown ?? '',
            videoVal: app.metadata?.video ?? '',
            botFrameworkAppsVal: app.metadata.botFrameworkApps,
            // For backward compatibility to cover undefined
            isLoggingOnVal: (app.metadata.isLoggingOn !== false),
            newBotVal: ''
        })
    }
    componentDidMount() {
        this.updateAppState(this.props.app)
    }

    componentDidUpdate() {
        const app = this.props.app
        if (this.state.edited === false && (this.state.localeVal !== app.locale ||
            this.state.appIdVal !== app.appId ||
            this.state.appNameVal !== app.appName ||
            (app.metadata.markdown && this.state.markdownVal !== app.metadata.markdown) ||
            (app.metadata.video && this.state.videoVal !== app.metadata.video) ||
            this.state.botFrameworkAppsVal !== app.metadata.botFrameworkApps ||
            this.state.isLoggingOnVal !== (app.metadata.isLoggingOn !== false))) {  // For backward compatibility to cover undefined
            this.updateAppState(this.props.app)
        }
    }

    @autobind
    onChangeName(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) {
        this.setState({
            appNameVal: text,
            edited: true
        })
    }

    @autobind
    onChangeMarkdown(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) {
        this.setState({
            markdownVal: text,
            edited: true
        })
    }

    @autobind
    onChangeVideo(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) {
        this.setState({
            videoVal: text,
            edited: true
        })
    }

    @autobind
    onClickAddBot() {
        const newBotApps = this.state.botFrameworkAppsVal.concat(this.state.newBotVal)
        this.setState({
            botFrameworkAppsVal: newBotApps,
            newBotVal: ''
        })
    }

    @autobind
    onClickCopyApp() {
        this.setState({
            isAppCopyModalOpen: true
        })
    }

    @autobind
    onCancelAppCopyModal() {
        this.setState({
            isAppCopyModalOpen: false
        })
    }

    @autobind
    async onSubmitAppCopyModal(app: CLM.AppBase) {
        const appDefinition = await (this.props.fetchAppSourceThunkAsync(this.props.app.appId, this.props.editingPackageId, false) as any as Promise<CLM.AppDefinition>)
        this.setState({
            isAppCopyModalOpen: false
        }, () => this.props.onCreateApp(app, appDefinition))
    }

    @autobind
    onToggleLoggingOn() {
        this.setState({
            isLoggingOnVal: !this.state.isLoggingOnVal,
            edited: true
        })
    }

    @autobind
    onRenderBotListRow(item?: any, index?: number) {
        return (
            <div>
                <OF.TextField className={OF.FontClassNames.mediumPlus} disabled={true} value={item} />
            </div>
        )
    }

    @autobind
    onClickDiscard() {
        const app = this.props.app
        this.setState({
            localeVal: app.locale,
            appIdVal: app.appId,
            appNameVal: app.appName,
            markdownVal: app.metadata?.markdown ? app.metadata.markdown : '',
            videoVal: app.metadata?.video ? app.metadata.video : '',
            botFrameworkAppsVal: app.metadata.botFrameworkApps,
            isLoggingOnVal: app.metadata.isLoggingOn,
            edited: false,
            newBotVal: ''
        })
    }

    @autobind
    onClickSave() {
        const app = this.props.app
        const modifiedApp: CLM.AppBase = {
            ...app,
            appName: this.state.appNameVal,
            metadata: {
                botFrameworkApps: this.state.botFrameworkAppsVal,
                markdown: this.state.markdownVal,
                video: this.state.videoVal,
                isLoggingOn: this.state.isLoggingOnVal
            },
            // packageVersions: DON'T SEND
            // devPackageId: DON'T SEND
            trainingFailureMessage: null,
            trainingStatus: CLM.TrainingStatusCode.Completed
        }
        this.props.editApplicationThunkAsync(modifiedApp)
    }

    onGetNameErrorMessage(value: string): string {
        const MAX_NAME_LENGTH = 30

        if (value.length === 0) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_REQUIREDVALUE)
        }

        if (value.length > MAX_NAME_LENGTH) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_MAX_30)
        }

        if (!/^[a-zA-Z0-9- ]+$/.test(value)) {
            return Util.formatMessageId(this.props.intl, FM.SETTINGS_FIELDERROR_ALPHANUMERIC)
        }

        // Check that name isn't in use
        const foundApp = this.props.apps.find(a => (a.appName === value && a.appId !== this.props.app.appId))
        if (foundApp) {
            return Util.formatMessageId(this.props.intl, FM.FIELDERROR_DISTINCT)
        }

        return ''
    }

    onCloseDebugErrors() {
        this.setState({
            debugErrorsOpen: false
        })
    }

    onOpenDebugErrors() {
        this.setState({
            debugErrorsOpen: true
        })
    }

    @autobind
    onChangeEditingVersion(event: React.FormEvent<HTMLDivElement>, editingOption: OF.IDropdownOption) {
        this.props.editAppEditingTagThunkAsync(this.props.app.appId, editingOption.key as string)
        this.setState({
            selectedEditingVersionOptionKey: editingOption.key,
        })
    }

    @autobind
    onChangeLiveVersion(event: React.FormEvent<HTMLDivElement>, liveOption: OF.IDropdownOption) {
        this.props.editAppLiveTagThunkAsync(this.props.app, liveOption.key as string)
        this.setState({
            selectedLiveVersionOptionKey: liveOption.key,
        })
    }

    @autobind
    onClickCopy() {
        this.setState({
            isAppCopyModalOpen: true
        })
    }

    //--- EXPORT ------
    @autobind
    onClickExport() {
        this.setState({
            isExportChoiceOpen: true
        })
    }

    @autobind
    onCloseExportModal() {
        this.setState({
            isExportChoiceOpen: false
        })
    }

    //--- DELETE ------
    @autobind
    onClickDelete() {
        this.setState({
            isConfirmDeleteAppModalOpen: true
        })
    }

    @autobind
    onConfirmDeleteApp() {
        this.props.onDeleteApp(this.props.app.appId)
        this.setState({
            isConfirmDeleteAppModalOpen: false
        })
    }

    @autobind
    onCancelDeleteModal() {
        this.setState({
            isConfirmDeleteAppModalOpen: false
        })
    }

    getDeleteDialogBoxText = (modelName: string) => {
        return (
            <div>
                <h1 className={`${OF.FontClassNames.xxLarge} cl-text--error`} style={{ fontWeight: 100 }} data-testid="settings-delete-model-title">{Util.formatMessageId(this.props.intl, FM.SETTINGS_DELETEISPERMANENT)}</h1>
                <p>Confirm permanent deletion of the <strong>{modelName}</strong> Model by entering its name.</p>
            </div>
        )
    }

    packageOptions() {
        const packageReferences = Util.packageReferences(this.props.app)

        return Object.values(packageReferences)
            .map<OF.IDropdownOption>(pr => {
                return {
                    key: pr.packageId,
                    text: pr.packageVersion
                }
            })
    }

    @autobind
    onClickNewTag() {
        this.setState({
            isPackageCreatorOpen: true
        })
    }

    @autobind
    onSubmitPackageCreator(tagName: string, setLive: boolean) {
        this.props.createAppTagThunkAsync(this.props.app.appId, tagName, setLive)
        this.setState({
            isPackageCreatorOpen: false
        })
    }

    @autobind
    onCancelPackageCreator() {
        this.setState({
            isPackageCreatorOpen: false
        })
    }

    render() {
        const { intl } = this.props
        const options = [{
            key: this.state.localeVal,
            text: this.state.localeVal,
        }]
        const packageOptions = this.packageOptions()
        return (
            <div className="cl-page">
                <span data-testid="settings-title" className={OF.FontClassNames.xxLarge}>
                    <FormattedMessageId id={FM.SETTINGS_TITLE} />
                </span>
                <span className={OF.FontClassNames.mediumPlus}>
                    <FormattedMessageId id={FM.SETTINGS_SUBTITLE} />
                </span>
                <div className="cl-settings-fields">
                    <OF.TextField
                        data-testid="settings-input-model-name"
                        className={OF.FontClassNames.mediumPlus}
                        onChange={this.onChangeName}
                        label={Util.formatMessageId(intl, FM.SETTINGS_FIELDS_NAMELABEL)}
                        onGetErrorMessage={value => this.onGetNameErrorMessage(value)}
                        value={this.state.appNameVal}
                    />
                    <div className="cl-buttons-row">
                        <OF.DefaultButton
                            data-testid="settings-export-model-button"
                            onClick={this.onClickExport}
                            ariaDescription={Util.formatMessageId(intl, FM.BUTTON_EXPORT)}
                            text={Util.formatMessageId(intl, FM.BUTTON_EXPORT)}
                            iconProps={{ iconName: 'CloudDownload' }}
                        />
                        <OF.DefaultButton
                            data-testid="settings-copy-model-button"
                            onClick={this.onClickCopy}
                            ariaDescription={Util.formatMessageId(intl, FM.SETTINGS_COPYBUTTONARIALDESCRIPTION)}
                            text={Util.formatMessageId(intl, FM.SETTINGS_COPYBUTTONTEXT)}
                            iconProps={{ iconName: 'Copy' }}
                        />
                        <OF.DefaultButton
                            data-testid="settings-delete-model-button"
                            className="cl-button-delete"
                            onClick={this.onClickDelete}
                            ariaDescription={Util.formatMessageId(intl, FM.ACTIONCREATOREDITOR_DELETEBUTTON_ARIADESCRIPTION)}
                            text={Util.formatMessageId(intl, FM.ACTIONCREATOREDITOR_DELETEBUTTON_TEXT)}
                            iconProps={{ iconName: 'Delete' }}
                        />
                    </div>
                    <OF.TextField
                        className={OF.FontClassNames.mediumPlus}
                        disabled={true}
                        label='CONVERSATION_LEARNER_MODEL_ID'
                        value={this.state.appIdVal}
                        readOnly={true}
                    />
                    <div>
                        <OF.Label className={`${OF.FontClassNames.mediumPlus} cl-label`}>
                            LUIS_SUBSCRIPTION_KEY
                            <HelpIcon
                                tipType={ToolTip.TipType.LUIS_SUBSCRIPTION_KEY}
                            />
                        </OF.Label>
                        <div>
                            <a
                                href={`https://www.luis.ai/applications/${this.props.app.luisAppId}/versions/0.1/manage/endpoints`}
                                rel="noopener noreferrer"
                                target="_blank"
                                role="button"
                            >
                                <OF.DefaultButton
                                    iconProps={{ iconName: "OpenInNewWindow" }}
                                    ariaDescription={Util.formatMessageId(this.props.intl, FM.SETTINGS_LUIS_LINK)}
                                    text={Util.formatMessageId(this.props.intl, FM.SETTINGS_LUIS_LINK)}
                                />
                            </a>
                        </div>
                    </div>
                    <section>
                        <header className="cl-settings-header">Model Versions</header>
                        <p>{Util.formatMessageId(this.props.intl, FM.SETTINGS_MODEL_VERSIONS_DESCRIPTION)}</p>
                        <div className="cl-command-bar">
                            <TC.Dropdown
                                label={Util.formatMessageId(this.props.intl, FM.SETTINGS_MODEL_VERSION_EDITING)}
                                options={packageOptions}
                                onChange={this.onChangeEditingVersion}
                                selectedKey={this.state.selectedEditingVersionOptionKey}
                                tipType={ToolTip.TipType.MODEL_VERSION_EDITING}
                            />
                            <TC.Dropdown
                                label={Util.formatMessageId(this.props.intl, FM.SETTINGS_MODEL_VERSION_LIVE)}
                                options={packageOptions}
                                onChange={this.onChangeLiveVersion}
                                selectedKey={this.state.selectedLiveVersionOptionKey}
                                tipType={ToolTip.TipType.MODEL_VERSION_LIVE}
                            />
                            <div>
                                <OF.PrimaryButton
                                    data-testid="settings-button-new-version"
                                    onClick={this.onClickNewTag}
                                    ariaDescription={Util.formatMessageId(this.props.intl, FM.SETTINGS_MODEL_VERSIONS_CREATE)}
                                    text={Util.formatMessageId(this.props.intl, FM.SETTINGS_MODEL_VERSIONS_CREATE)}
                                    iconProps={{ iconName: 'Add' }}
                                />
                            </div>
                        </div>
                    </section>

                    <Expando
                        className={'cl-settings-container-header'}
                        isOpen={this.state.isPackageExpandoOpen}
                        text="View All Versions"
                        onToggle={() => this.setState({ isPackageExpandoOpen: !this.state.isPackageExpandoOpen })}
                    />
                    {this.state.isPackageExpandoOpen &&
                        <PackageTable
                            app={this.props.app}
                            editingPackageId={this.props.editingPackageId}
                        />
                    }

                    <div>
                        <OF.Label className={OF.FontClassNames.mediumPlus} htmlFor="settings-dropdown-locale">
                            <FormattedMessageId id={FM.SETTINGS_BOTFRAMEWORKLOCALELABEL} />
                        </OF.Label>
                        <OF.Dropdown
                            id="settings-dropdown-locale"
                            className={OF.FontClassNames.mediumPlus}
                            options={options}
                            selectedKey={this.state.localeVal}
                            disabled={true}
                        />
                    </div>
                    <div className="cl-entity-creator-checkbox" data-testid="settings-log-conversations-checkbox">
                        <TC.Checkbox
                            label={Util.formatMessageId(intl, FM.SETTINGS_LOGGINGON_LABEL)}
                            checked={this.state.isLoggingOnVal}
                            onChange={this.onToggleLoggingOn}
                            tipType={ToolTip.TipType.LOGGING_TOGGLE}
                        />
                    </div>

                    {Util.isDemoAccount(this.props.user.id) &&
                        <React.Fragment>
                            <div>
                                <OF.TextField
                                    className={OF.FontClassNames.mediumPlus}
                                    onChange={this.onChangeMarkdown}
                                    label={Util.formatMessageId(intl, FM.SETTINGS_FIELDS_MARKDOWNLABEL)}
                                    value={this.state.markdownVal}
                                    multiline={true}
                                    rows={5}
                                />
                                <OF.TextField
                                    className={OF.FontClassNames.mediumPlus}
                                    onChange={this.onChangeVideo}
                                    label={Util.formatMessageId(intl, FM.SETTINGS_FIELDS_VIDEOLABEL)}
                                    value={this.state.videoVal}
                                />
                            </div>
                            <div>
                                <OF.DefaultButton
                                    onClick={() => this.onOpenDebugErrors()}
                                    ariaDescription={Util.formatMessageId(intl, FM.SETTINGS_DISCARD)}
                                    text={'Inject Errors'}
                                />
                            </div>
                        </React.Fragment>
                    }

                    <div className="cl-buttons-row">
                        <OF.PrimaryButton
                            data-testid="settings-button-save"
                            disabled={this.state.edited === false || this.onGetNameErrorMessage(this.state.appNameVal) !== ''}
                            onClick={this.onClickSave}
                            ariaDescription={Util.formatMessageId(intl, FM.SETTINGS_SAVECHANGES)}
                            text={Util.formatMessageId(intl, FM.SETTINGS_SAVECHANGES)}
                            iconProps={{ iconName: 'Accept' }}
                        />
                        <OF.DefaultButton
                            data-testid="settings-button-discard"
                            disabled={this.state.edited === false}
                            onClick={this.onClickDiscard}
                            ariaDescription={Util.formatMessageId(intl, FM.SETTINGS_DISCARD)}
                            text={Util.formatMessageId(intl, FM.SETTINGS_DISCARD)}
                            iconProps={{ iconName: 'Undo' }}
                        />
                    </div>

                    <ErrorInjectionEditor
                        open={this.state.debugErrorsOpen}
                        onClose={() => this.onCloseDebugErrors()}
                    />
                </div>
                <AppCreator
                    open={this.state.isAppCopyModalOpen}
                    onSubmit={this.onSubmitAppCopyModal}
                    onCancel={this.onCancelAppCopyModal}
                    creatorType={AppCreatorType.COPY}
                />
                <PackageCreator
                    open={this.state.isPackageCreatorOpen}
                    onSubmit={this.onSubmitPackageCreator}
                    onCancel={this.onCancelPackageCreator}
                    packageReferences={this.props.app.packageVersions}
                />
                <TextboxRestrictable
                    open={this.state.isConfirmDeleteAppModalOpen}
                    message={this.getDeleteDialogBoxText(this.props.app.appName)}
                    placeholder={""}
                    matchedText={this.props.app.appName}
                    buttonOk={Util.getDefaultText(FM.ACTIONCREATOREDITOR_DELETEBUTTON_TEXT)}
                    buttonCancel={Util.getDefaultText(FM.ACTIONCREATOREDITOR_CANCELBUTTON_TEXT)}
                    onOK={this.onConfirmDeleteApp}
                    onCancel={this.onCancelDeleteModal}
                />
                {this.state.isExportChoiceOpen &&
                    <ExportChoice
                        app={this.props.app}
                        editingPackageId={this.props.editingPackageId}
                        onClose={this.onCloseExportModal}
                    />
                }
            </div>
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        editApplicationThunkAsync: actions.app.editApplicationThunkAsync,
        editAppEditingTagThunkAsync: actions.app.editAppEditingTagThunkAsync,
        editAppLiveTagThunkAsync: actions.app.editAppLiveTagThunkAsync,
        fetchAppSourceThunkAsync: actions.app.fetchAppSourceThunkAsync,
        createAppTagThunkAsync: actions.app.createAppTagThunkAsync,
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render App/Settings but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        apps: state.apps.all,
        trainDialogs: state.trainDialogs,
        entities: state.entities,
        actions: state.actions
    }
}

export interface ReceivedProps {
    app: CLM.AppBase,
    editingPackageId: string,
    onCreateApp: (app: CLM.AppBase, source: CLM.AppDefinition) => void
    onDeleteApp: (id: string) => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(Settings))