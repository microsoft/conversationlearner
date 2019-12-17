/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import * as OF from 'office-ui-fabric-react'
import './CardPayloadRenderer.css'
import { RenderedActionArgument } from '@conversationlearner/models'

interface ICombinedActionArgument {
    original: RenderedActionArgument
    substituted: RenderedActionArgument
}

interface ICombinedActionArguments {
    argumentPairs: ICombinedActionArgument[]
    argumentsDiffer: boolean
}

interface Props {
    isValidationError: boolean
    name: string
    onClickViewCard: (showOriginal: boolean) => void
    originalArguments: RenderedActionArgument[]
    substitutedArguments: RenderedActionArgument[] | null
}

interface State {
    isOriginalVisible: boolean
}

export default class Component extends React.Component<Props, State> {
    state: Readonly<State> = {
        isOriginalVisible: false
    }

    onChangeVisible = () => {
        this.setState(prevState => ({
            isOriginalVisible: !prevState.isOriginalVisible
        }))
    }

    render() {
        const substitutedArguments = this.props.substitutedArguments
        const pairedArguments = substitutedArguments === null
            ? {
                argumentPairs: this.props.originalArguments.map(oa => ({
                    original: oa,
                    substituted: oa
                })),
                argumentsDiffer: false
            }
            : this.props.originalArguments.reduce<ICombinedActionArguments>((combined, originalArgument) => {
                const matchingSubstitutedArgument = substitutedArguments.find(sa => sa.parameter === originalArgument.parameter)
                if (matchingSubstitutedArgument) {
                    combined.argumentPairs.push({
                        original: originalArgument,
                        substituted: matchingSubstitutedArgument
                    })

                    // If any of the arguments are different, set to true
                    combined.argumentsDiffer = combined.argumentsDiffer || (originalArgument.value !== matchingSubstitutedArgument.value)
                }

                return combined
            }, {
                argumentPairs: [],
                argumentsDiffer: false
            })

        const showToggle = pairedArguments.argumentsDiffer

        return <div className="cl-card-payload">
            <div data-testid="action-scorer-card">
                <div className={OF.FontClassNames.mediumPlus} data-testid="action-scorer-card-name">{this.props.name}</div>
                <div className="cl-card-payload__arguments ms-ListItem-primaryText">
                    {pairedArguments.argumentPairs.map((argument, i) =>
                        <React.Fragment key={i}>
                            <div>{argument.original.parameter}:</div>
                            <div>{`${(this.props.substitutedArguments === null || this.state.isOriginalVisible)
                                ? argument.original.value
                                : argument.substituted.value}`
                            }</div>
                        </React.Fragment>)}
                </div>
            </div>
            <div>
                {showToggle
                    && <OF.Toggle
                        data-testid="action-scorer-entity-toggle"
                        checked={this.state.isOriginalVisible}
                        onChange={this.onChangeVisible}
                    />}
                <OF.IconButton
                    disabled={this.props.isValidationError}
                    className="ms-Button--primary cl-button--viewCard"
                    onClick={() => this.props.onClickViewCard(this.state.isOriginalVisible)}
                    ariaDescription="ViewCard"
                    iconProps={{ iconName: 'RedEye' }}
                />
            </div>
        </div>
    }
}