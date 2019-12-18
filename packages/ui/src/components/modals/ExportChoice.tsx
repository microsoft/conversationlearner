/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import * as CLM from '@conversationlearner/models'
import * as Util from '../../Utils/util'
import * as AdmZip from 'adm-zip'
import * as OBIUtil from '../../Utils/obiUtils'
import actions from '../../actions'
import FormattedMessageId from '../FormattedMessageId'
import HelpIcon from '../HelpIcon'
import { saveAs } from 'file-saver'
import { TipType } from '../ToolTips/ToolTips'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../../types'
import { FM } from '../../react-intl-messages'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import { autobind } from 'core-decorators'

enum ExportType {
    CL = ".cl",
    TRANSCRIPT = '.transcript'
}

interface ComponentState {
    exportType: ExportType
}

class ExportChoice extends React.Component<Props, ComponentState> {
    state: ComponentState = {
        exportType: ExportType.CL
    }

    @autobind
    async onClickExport() {
        switch (this.state.exportType) {
            case ExportType.TRANSCRIPT:
                await this.onExportTranscripts()
                break
            case ExportType.CL:
                await this.onExportCL()
                break
            default:
        }
        this.props.onClose()
    }

    async onExportCL() {
        const appDefinition = await (this.props.fetchAppSourceThunkAsync(this.props.app.appId, this.props.editingPackageId, false) as any as Promise<CLM.AppDefinition>)
        const blob = new Blob([JSON.stringify(appDefinition)], { type: "text/plain;charset=utf-8" })
        saveAs(blob, `${this.props.app.appName}.cl`)
        this.props.onClose()
    }

    async onExportTranscripts() {
        const appDefinition = await (this.props.fetchAppSourceThunkAsync(this.props.app.appId, this.props.editingPackageId, false) as any as Promise<CLM.AppDefinition>)

        const transcripts = await OBIUtil.toTranscripts(appDefinition, this.props.app.appId, this.props.user, this.props.fetchActivitiesThunkAsync as any)

        const zip = new AdmZip()
        transcripts.forEach(t => {
            const content = JSON.stringify(t.activities)
            // const blob = new Blob([JSON.stringify(t.activities)], { type: "text/plain;charset=utf-8" })
            zip.addFile(`${CLM.ModelUtils.generateGUID()}.transcript`, Buffer.alloc(content.length, content))
        })
        const zipBuffer = zip.toBuffer()
        const zipBlob = new Blob([zipBuffer])

        saveAs(zipBlob, `${this.props.app.appName}.zip`)
    }

    @autobind
    onChoiceChange(ev: React.FormEvent<HTMLInputElement>, option: any) {
        this.setState({ exportType: option.key })
    }

    render() {
        return (
            <OF.Modal
                isOpen={true}
                onDismiss={this.props.onClose}
                isBlocking={false}
                containerClassName='cl-modal cl-modal--small'
            >
                <div className='cl-modal_header' data-testid="export-choice-title">
                    <span className={OF.FontClassNames.xxLarge}>
                        <FormattedMessageId id={FM.EXPORT_CHOICE_TITLE} />
                    </span>
                    <div className={OF.FontClassNames.medium}>
                        <FormattedMessageId id={FM.EXPORT_CHOICE_DESCRIPTION} />
                        <HelpIcon tipType={TipType.TRANSCRIPT_IMPORTER} />
                    </div>
                </div>
                <div className="cl-action-creator-fieldset">
                    <div className={OF.FontClassNames.medium}>
                        <FormattedMessageId id={FM.EXPORT_CHOICE_LABEL} />
                        <HelpIcon tipType={TipType.EXPORT_CHOICE} />
                    </div>
                    <OF.ChoiceGroup
                        className="defaultChoiceGroup"
                        defaultSelectedKey={ExportType.CL}
                        options={[
                            {
                                key: ExportType.CL,
                                text: ExportType.CL
                            },
                            {
                                key: ExportType.TRANSCRIPT,
                                text: ExportType.TRANSCRIPT
                            }
                        ]}
                        selectedKey={this.state.exportType}
                        onChange={this.onChoiceChange}
                        required={false}
                    />

                </div>
                <div className='cl-modal_footer'>
                    <div className="cl-modal-buttons">
                        <div className="cl-modal-buttons_secondary" />
                        <div className="cl-modal-buttons_primary">
                            <OF.PrimaryButton
                                data-testid="model-creator-submit-button"
                                onClick={this.onClickExport}
                                ariaDescription={Util.formatMessageId(this.props.intl, FM.BUTTON_EXPORT)}
                                text={Util.formatMessageId(this.props.intl, FM.BUTTON_EXPORT)}
                            />
                            <OF.DefaultButton
                                data-testid="model-creator-cancel-button"
                                onClick={this.props.onClose}
                                ariaDescription={Util.formatMessageId(this.props.intl, FM.BUTTON_CANCEL)}
                                text={Util.formatMessageId(this.props.intl, FM.BUTTON_CANCEL)}
                            />
                        </div>
                    </div>
                </div>
            </OF.Modal>
        )
    }
}

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        fetchAppSourceThunkAsync: actions.app.fetchAppSourceThunkAsync,
        fetchActivitiesThunkAsync: actions.train.fetchActivitiesThunkAsync
    }, dispatch)
}
const mapStateToProps = (state: State) => {
    if (!state.user.user) {
        throw new Error(`You attempted to render ExportChoice but the user was not defined. This is likely a problem with higher level component. Please open an issue.`)
    }

    return {
        user: state.user.user,
        apps: state.apps.all,
        actions: state.actions,
        entities: state.entities
    }
}

export interface ReceivedProps {
    app: CLM.AppBase
    editingPackageId: string,
    onClose: () => void
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps & InjectedIntlProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(injectIntl(ExportChoice))