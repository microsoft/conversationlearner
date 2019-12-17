/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { State } from '../types'
import { AppBase, TrainingStatusCode } from '@conversationlearner/models'
import { fetchApplicationTrainingStatusThunkAsync } from '../actions/appActions'
import { InternalTrainingStatus, default as TrainingStatus } from './TrainingStatus'
import { App } from '../types/models'

const externalStatusToInternalStatusMap = new Map<TrainingStatusCode, InternalTrainingStatus>([
    [TrainingStatusCode.Queued, InternalTrainingStatus.Queued],
    [TrainingStatusCode.Running, InternalTrainingStatus.Running],
    [TrainingStatusCode.Completed, InternalTrainingStatus.Completed],
    [TrainingStatusCode.Failed, InternalTrainingStatus.Failed],
])

interface ComponentState {
    status: InternalTrainingStatus
}

class TrainingStatusContainer extends React.Component<Props, ComponentState> {
    state: ComponentState = {
        status: InternalTrainingStatus.Unknown
    }

    constructor(props: Props) {
        super(props)
        this.state.status = externalStatusToInternalStatusMap.get(props.app.trainingStatus) || InternalTrainingStatus.Unknown
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        this.setState({
            status: externalStatusToInternalStatusMap.get(nextProps.app.trainingStatus) || InternalTrainingStatus.Unknown,
        })
    }

    onClickRefresh = () => {
        this.props.fetchApplicationTrainingStatusThunkAsync(this.props.app.appId)
    }

    render() {
        return (
            <TrainingStatus
                data-testid="trainingstatus-container-status"
                status={this.state.status}
                failureMessage={this.props.app.trainingFailureMessage}
                lastUpdatedDatetime={this.props.app.datetime}
                onClickRefresh={this.onClickRefresh}
                didPollingExpire={(this.props.app as App).didPollingExpire === true}
            />
        )
    }
}
const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        fetchApplicationTrainingStatusThunkAsync
    }, dispatch)
}
const mapStateToProps = (state: State, ownProps: any) => {
    return {
    }
}

export interface ReceivedProps {
    app: AppBase
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps & ReceivedProps

export default connect<stateProps, dispatchProps, ReceivedProps>(mapStateToProps, mapDispatchToProps)(TrainingStatusContainer)