/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import { FM } from '../../react-intl-messages'
import * as CLM from '@conversationlearner/models'
import * as ExtractorResponseEditor from '../ExtractorResponseEditor'
import { formatMessageId } from '../../Utils/util'
import { injectIntl, InjectedIntlProps } from 'react-intl'
import './LogConversionConflictModal.css'

interface ReceivedProps {
    onClose: Function
    onAccept: (conflictPairs: ConflictPair[]) => void
    open: boolean

    title: string
    entities: CLM.EntityBase[]
    conflictPairs: ConflictPair[]
}

type Props = ReceivedProps & InjectedIntlProps

export interface ConflictPair {
    roundIndex: number
    textVariationIndex: number
    conflicting: CLM.ExtractResponse
    previouslySubmitted: CLM.ExtractResponse
}

interface State {
    currentConflictPairIndex: number
}

class LogConversionConflictModal extends React.Component<Props, State> {
    state: Readonly<State> = {
        currentConflictPairIndex: 0
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        // Reset index when modal is opened
        if (nextProps.open && !this.props.open) {
            this.setState({
                currentConflictPairIndex: 0
            })
        }
    }

    onClickConflictButton(index: number) {
        this.setState({
            currentConflictPairIndex: index
        })
    }

    onClickPrevious = () => {
        this.setState(prevState => {
            const nextIndex = prevState.currentConflictPairIndex - 1
            const minIndex = 0
            const maxIndex = Math.max(0, this.props.conflictPairs.length - 1)

            return {
                currentConflictPairIndex: nextIndex < minIndex
                    ? maxIndex
                    : nextIndex
            }
        })
    }

    onClickNext = () => {
        this.setState(prevState => {
            const nextIndex = prevState.currentConflictPairIndex + 1
            const minIndex = 0
            const maxIndex = Math.max(0, this.props.conflictPairs.length - 1)

            return {
                currentConflictPairIndex: nextIndex > maxIndex
                    ? minIndex
                    : nextIndex
            }
        })
    }

    render() {
        const currentConflictPair = this.props.conflictPairs[this.state.currentConflictPairIndex]
        const { intl } = this.props
        return (
            <OF.Modal
                isOpen={this.props.open}
                className={OF.FontClassNames.mediumPlus}
                containerClassName="cl-modal cl-modal--medium"
                onDismiss={() => this.props.onClose()}
            >
                <div
                    className={`cl-modal_header cl-text--error ${OF.FontClassNames.xxLarge} `}
                    data-testid="log-conversion-conflicts-modal"
                >
                    <OF.Icon iconName="Warning" />&nbsp;{formatMessageId(intl, FM.LOGCONVERSIONCONFLICTMODAL_TITLE)}
                </div>

                <div className="cl-modal_body">
                    <div>
                        <p>{this.props.title}</p>
                        <div>{formatMessageId(intl, FM.LOGCONVERSIONCONFLICTMODAL_REVIEW, { conflictCount: this.props.conflictPairs.length })}</div>

                        <div className="cl-logconversion-conflicts">
                            <div className="cl-logconversion-conflicts__buttons">
                                {this.props.conflictPairs.map((_, i) =>
                                    <button
                                        key={i}
                                        onClick={() => this.onClickConflictButton(i)}
                                        className={`cl-logconversion-conflicts__button-selection ${OF.FontClassNames.xLarge} ${i === this.state.currentConflictPairIndex ? 'active' : ''}`}
                                        data-testid={`log-conversion-conflicts-conflict-${i + 1}`}
                                    >
                                        {i + 1}
                                    </button>)}
                            </div>
                            <div className="cl-logconversion-conflicts__current">
                                {!currentConflictPair
                                    ? <p>Please select a conflict</p> // Shouldn't happen but need for control flow
                                    : <>
                                        <div
                                            className="cl-inconsistent-entity-modal-header cl-text--error"
                                            data-testid="log-conversion-conflicts-inconsistent-labels"
                                        >
                                            <OF.Icon iconName="ChromeClose" />&nbsp;{formatMessageId(intl, FM.EXTRACTCONFLICTMODAL_ATTEMPTED_LABELS_TITLE)}
                                        </div>
                                        <ExtractorResponseEditor.EditorWrapper
                                            render={(editorProps, onChangeCustomEntities) =>
                                                <ExtractorResponseEditor.Editor
                                                    readOnly={true}
                                                    status={ExtractorResponseEditor.Models.ExtractorStatus.OK}
                                                    entities={this.props.entities}
                                                    {...editorProps}

                                                    onChangeCustomEntities={onChangeCustomEntities}
                                                    onClickNewEntity={() => { }}
                                                    isPickerVisible={false}
                                                    onOpenPicker={() => { }}
                                                    onClosePicker={() => { }}
                                                />
                                            }
                                            entities={this.props.entities}
                                            extractorResponse={currentConflictPair.conflicting}
                                            onChange={() => { }}
                                        />

                                        <div
                                            className="cl-inconsistent-entity-modal-header cl-text--success"
                                            data-testid="log-conversion-conflicts-consistent-labels"
                                        >
                                            <OF.Icon iconName="Accept" />&nbsp;{formatMessageId(intl, FM.EXTRACTCONFLICTMODAL_EXISTING_LABELS_TITLE)}
                                        </div>
                                        <ExtractorResponseEditor.EditorWrapper
                                            render={(editorProps, onChangeCustomEntities) =>
                                                <ExtractorResponseEditor.Editor
                                                    readOnly={true}
                                                    status={ExtractorResponseEditor.Models.ExtractorStatus.OK}
                                                    entities={this.props.entities}
                                                    {...editorProps}

                                                    onChangeCustomEntities={onChangeCustomEntities}
                                                    onClickNewEntity={() => { }}
                                                    isPickerVisible={false}
                                                    onOpenPicker={() => { }}
                                                    onClosePicker={() => { }}
                                                />
                                            }
                                            entities={this.props.entities}
                                            extractorResponse={currentConflictPair.previouslySubmitted}
                                            onChange={() => { }}
                                        />
                                    </>}
                            </div>
                            <div className="cl-logconversion-conflicts__navigation">
                                <OF.DefaultButton
                                    disabled={this.props.conflictPairs.length === 1}
                                    iconProps={{
                                        iconName: "Back"
                                    }}
                                    onClick={this.onClickPrevious}
                                    text={formatMessageId(intl, FM.BUTTON_PREVIOUS)}
                                    data-testid="log-conversion-conflicts-modal-previous"
                                />
                                <OF.DefaultButton
                                    disabled={this.props.conflictPairs.length === 1}
                                    iconProps={{
                                        iconName: "Forward"
                                    }}
                                    onClick={this.onClickNext}
                                    text={formatMessageId(intl, FM.BUTTON_NEXT)}
                                    data-testid="log-conversion-conflicts-modal-next"
                                />
                            </div>
                        </div>

                        <p>{formatMessageId(intl, FM.LOGCONVERSIONCONFLICTMODAL_BUTTON_EXPLANATION)}</p>
                    </div>
                </div>

                <div className="cl-modal_footer cl-modal-buttons">
                    <div className="cl-modal-buttons_secondary" />
                    <div className="cl-modal-buttons_primary">
                        <OF.PrimaryButton
                            data-testid="log-conversion-conflicts-modal-accept"
                            iconProps={{ iconName: 'Accept' }}
                            onClick={() => this.props.onAccept(this.props.conflictPairs)}
                            text={formatMessageId(intl, FM.LOGCONVERSIONCONFLICTMODAL_ACCEPT)}
                        />
                        <OF.DefaultButton
                            data-testid="log-conversion-conflicts-modal-cancel"
                            iconProps={{ iconName: 'Cancel' }}
                            onClick={() => this.props.onClose()}
                            text={formatMessageId(intl, FM.LOGCONVERSIONCONFLICTMODAL_ABORT)}
                        />
                    </div>
                </div>
            </OF.Modal>
        )
    }
}

export default injectIntl(LogConversionConflictModal)