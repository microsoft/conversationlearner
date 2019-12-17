/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import {
  BrowserRouter as Router, Redirect, Route, NavLink, Switch
} from 'react-router-dom'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { State } from '../types'
import AppsIndex from './Apps/AppsIndex'
import Settings from './Settings'
import NoMatch from './NoMatch'
import { Banner } from '@conversationlearner/models'
import HelpPanel from '../components/HelpPanel'
import * as OF from 'office-ui-fabric-react'
import { SpinnerWindow, ErrorPanel } from '../components/modals'
import './App.css'
import FormattedMessageId from '../components/FormattedMessageId'
import { FM } from '../react-intl-messages'
import { fetchBotInfoThunkAsync } from '../actions/botActions'
import { clearBanner } from '../actions/displayActions'

enum LoadingState {
  NEUTRAL,
  LOADING,
  SUCCEEDED,
  FAILED
}

interface ComponentState {
  loadingState: LoadingState
}

const initialState: ComponentState = {
  loadingState: LoadingState.NEUTRAL
}

class App extends React.Component<Props, ComponentState> {
  state = initialState

  componentDidMount() {
    void this.loadBotInfo()
  }

  loadBotInfo = async () => {
    try {
      this.setState({
        loadingState: LoadingState.LOADING
      })
      await (this.props.fetchBotInfoThunkAsync(this.props.browserId) as any as Promise<void>)
      this.setState({
        loadingState: LoadingState.SUCCEEDED
      })
    }
    catch (e) {
      this.setState({
        loadingState: LoadingState.FAILED
      })
    }
  }

  dismissBanner(banner: Banner) {
    // Can't clear error banners
    const bannerType = this.getMessageBarType(banner.type)
    if (bannerType !== OF.MessageBarType.error) {
      this.props.clearBanner(banner)
    }
  }

  shouldShowBanner(banner: Banner) {
    if (!banner.message) {
      return false
    }

    if (!this.props.clearedBanner) {
      return true
    }

    if (JSON.stringify(banner) === JSON.stringify(this.props.clearedBanner)) {
      return false
    }
    return true
  }

  getMessageBarType(type: string | undefined) {
    if (type) {
      if (type.toLowerCase() === "error") {
        return OF.MessageBarType.error
      }
      if (type.toLowerCase() === "warning") {
        return OF.MessageBarType.warning
      }
    }
    return OF.MessageBarType.success
  }

  render() {
    const banner = this.props.botInfo ? this.props.botInfo.banner : null
    return (
      <Router basename={process.env.PUBLIC_URL}>
        <>
          <div className="cl-o-app-columns">
            <div className="cl-app_header-placeholder" />
            <header className={`cl-app_header cl-header`}>
              <nav className="cl-header_links">
                <img className="cl-header-logo" src="Microsoft-logo_rgb_c-wht.png" alt="Microsoft Logo" />
                <span className="cl-header-text">
                  <img className="cl-header-icon" src="icon.svg" alt="ConversationLearner Logo" />
                  Project Conversation Learner
              </span>
                <NavLink to="/home">
                  <FormattedMessageId id={FM.APP_HEADER_MODELS} />
                </NavLink>
                <a href="https://labs.cognitive.microsoft.com/en-us/project-conversation-learner" target="_blank" rel="noopener noreferrer">Documentation</a>
                <a href="https://cognitive.uservoice.com/forums/912199-project-conversation-learner" target="_blank" rel="noopener noreferrer">Feedback</a>
              </nav>
              <NavLink className="cl-header_user" to="/settings"><OF.Icon className="cl-header-office-icon" iconName="Settings" /> Settings</NavLink>
            </header>

            <div className="cl-app_header-placeholder" />
          </div>

          {banner && this.shouldShowBanner(banner) &&
            <OF.MessageBar
              className="cl-messagebar"
              isMultiline={true}
              onDismiss={() => this.dismissBanner(banner)}
              dismissButtonAriaLabel='Close'
              messageBarType={this.getMessageBarType(banner.type)}
            >
              {banner.message}
              {banner.link && banner.linktext &&
                <OF.Link href={banner.link}>{banner.linktext}</OF.Link>
              }
              {banner.datestring &&
                <div>
                  <span className="cl-font--demphasis">{banner.datestring}</span>
                </div>
              }
            </OF.MessageBar>
          }
          <Switch>
            <Route exact={true} path="/" render={() => <Redirect to="/home" />} />
            <Route
              path="/home"
              render={props =>
                <React.Fragment>
                  {this.state.loadingState === LoadingState.LOADING &&
                    <div className="cl-o-app-columns">
                      <div className="cl-app_content">
                        <p>Loading...</p>
                      </div>
                    </div>
                  }
                  {this.state.loadingState === LoadingState.FAILED &&
                    <div className="cl-o-app-columns">
                      <div className="cl-app_content">
                        <div>
                          <p>Loading Failed.</p>
                          <div>
                            <OF.PrimaryButton
                              onClick={this.loadBotInfo}
                              iconProps={{ iconName: 'Refresh' }}
                            >
                              Retry
                            </OF.PrimaryButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                  {this.state.loadingState === LoadingState.SUCCEEDED && this.props.botInfo !== null &&
                    <AppsIndex
                      {...props}
                    />
                  }
                </React.Fragment>
              }
            />
            <Route path="/settings" component={Settings} />
            <Route component={NoMatch} />
          </Switch>
          <ErrorPanel />
          <HelpPanel />
          <SpinnerWindow />
        </>
      </Router>
    )
  }
}

const mapDispatchToProps = (dispatch: any) => {
  return bindActionCreators({
    fetchBotInfoThunkAsync,
    clearBanner
  }, dispatch)
}

const mapStateToProps = (state: State) => {
  return {
    browserId: state.bot.browserId,
    botInfo: state.bot.botInfo,
    clearedBanner: state.display.clearedBanner
  }
}

// Props types inferred from mapStateToProps & dispatchToProps
type stateProps = ReturnType<typeof mapStateToProps>
type dispatchProps = ReturnType<typeof mapDispatchToProps>
type Props = stateProps & dispatchProps

export default connect<stateProps, dispatchProps>(mapStateToProps, mapDispatchToProps)(App)