import * as React from 'react';
import { Activity, Message, User, CardActionTypes } from 'botframework-directlinejs';
import { ChatState, FormatState, SizeState } from './Store';
import { Dispatch, connect } from 'react-redux';
import { ActivityView } from './ActivityView';
import { konsole, classList, doCardAction, IDoCardAction, sendMessage } from './Chat';

export interface HistoryProps {
    format: FormatState,
    size: SizeState,
    activities: Activity[],

    setMeasurements: (carouselMargin: number) => void,
    onClickRetry: (activity: Activity) => void,
    onClickCardAction: () => void,
    setFocus: () => void,
    renderActivity?: (props: WrappedActivityProps, children: React.ReactNode, setRef: (div: HTMLDivElement | null) => void) => (JSX.Element | null) // BLIS addition
    onActivityHeight?: (index: number, height: number) => void
    onScrollChange?: (position: number) => void // BLIS ADD
    initialScrollPosition?: number // BLIS ADD
    forceScrollPosition?: number // BLIS ADD
    // Scroll immediately, not waiting for stop
    instantScroll?: boolean // BLIS ADD
    disableCardActions?: boolean // BLIS ADD
    isFromMe: (activity: Activity) => boolean,
    isSelected: (activity: Activity) => boolean,
    onClickActivity: (activity: Activity) => React.MouseEventHandler<HTMLDivElement>,
    doCardAction: IDoCardAction
}

export class HistoryView extends React.Component<HistoryProps, {}> {
    private scrollMe: HTMLDivElement
    private scrollContent: HTMLDivElement
    private scrollToBottom = false
    private scrollInitialized = false
    private scrollTimeout: any // BLIS ADD
    private lastForceScrollPosition: number | null

    private carouselActivity: WrappedActivity;
    private largeWidth: number;

    constructor(props: HistoryProps) {
        super(props);
        this.scrollHandler = this.scrollHandler.bind(this);  // BLIS add
    }

    componentWillReceiveProps(newProps: HistoryProps) {
        if ((this.scrollInitialized || newProps.initialScrollPosition === undefined)
            && this.props.activities.length < newProps.activities.length) {
            this.scrollToBottom = true
        }
        if (this.lastForceScrollPosition !== newProps.forceScrollPosition) {
            this.lastForceScrollPosition = newProps.forceScrollPosition
            if (this.lastForceScrollPosition !== null) {
                this.scrollMe.scrollTop = this.lastForceScrollPosition
            }
        }
    }

    componentDidUpdate() {
        if (this.props.format.carouselMargin == undefined) {
            // After our initial render we need to measure the carousel width

            // Measure the message padding by subtracting the known large width
            const paddedWidth = measurePaddedWidth(this.carouselActivity.messageDiv) - this.largeWidth;

            // Subtract the padding from the offsetParent's width to get the width of the content
            const maxContentWidth = (this.carouselActivity.messageDiv.offsetParent as HTMLElement).offsetWidth - paddedWidth;
            
            // Subtract the content width from the chat width to get the margin.
            // Next time we need to get the content width (on a resize) we can use this margin to get the maximum content width
            const carouselMargin = this.props.size.width - maxContentWidth;
            
            konsole.log('history measureMessage ' + carouselMargin);

            // Finally, save it away in the Store, which will force another re-render
            this.props.setMeasurements(carouselMargin)

            this.carouselActivity = null; // After the re-render this activity doesn't exist
        }

        this.autoscroll();
    }

    // BLIS addition
    componentDidMount() {
        if (this.props.onScrollChange) {
            const node = this.scrollMe;
            if (node) {
                node.addEventListener('scroll', this.scrollHandler)
            }
        }
    }
    
    // BLIS addition
    componentWillUnmount() {
        if (this.props.onScrollChange) {
            this.scrollMe.removeEventListener('scroll', this.scrollHandler)
        }
    }

    
    // BLIS addition
    scrollHandler() {
        
        if (this.props.instantScroll) {
            this.props.onScrollChange(this.scrollMe.scrollTop)
            return
        }

        // Clear timeout as scrollbar is still moving
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout)
        }

        // Set another timer
        this.scrollTimeout = setTimeout(
            // Call callback after delay
            () => this.props.onScrollChange(this.scrollMe.scrollTop), 100)
    }

    private autoscroll() {
        const vAlignBottomPadding = Math.max(0, measurePaddedHeight(this.scrollMe) - this.scrollContent.offsetHeight);
        this.scrollContent.style.marginTop = vAlignBottomPadding + 'px';

        /*
        // BLIS removed - should only scroll to bottom on receiving a new activity from me
        // otherwise history can make it pop down
        const lastActivity = this.props.activities[this.props.activities.length - 1];
        const lastActivityFromMe = lastActivity && this.props.isFromMe && this.props.isFromMe(lastActivity);
        */
        if (!this.scrollInitialized)
        {
            if (this.props.initialScrollPosition !== undefined) {
                this.scrollMe.scrollTop = this.props.initialScrollPosition
                if (this.scrollMe.scrollTop === this.props.initialScrollPosition) {
                    this.scrollInitialized = true
                }
            }
            else {
                this.scrollInitialized = true
            }
        }
        // Validating if we are at the bottom of the list or the last activity was triggered by the user.
        else if (this.scrollToBottom && this.scrollInitialized) {
            const newScroll = this.scrollMe.scrollHeight - this.scrollMe.offsetHeight;
            this.scrollToBottom = false
            if (Math.abs(newScroll - this.scrollMe.scrollTop) > 1) {
                this.scrollMe.scrollTop = newScroll

                // BLIS add
                if (this.props.onScrollChange) {
                    this.scrollHandler()
                }
            }
        }
    }

    // In order to do their cool horizontal scrolling thing, Carousels need to know how wide they can be.
    // So, at startup, we create this mock Carousel activity and measure it. 
    private measurableCarousel = () =>
        // find the largest possible message size by forcing a width larger than the chat itself
        <WrappedActivity 
            ref={ x => this.carouselActivity = x }
            activity={ {
                type: 'message',
                id: '',
                from: { id: '' },
                attachmentLayout: 'carousel'
            } }
            format={ null }
            fromMe={ false }
            onClickActivity={ null }
            onClickRetry={ null }
            selected={ false }
            showTimestamp={ false }
        >
            <div style={ { width: this.largeWidth } }>&nbsp;</div>
        </WrappedActivity>;

    // At startup we do three render passes:
    // 1. To determine the dimensions of the chat panel (not much needs to actually render here)
    // 2. To determine the margins of any given carousel (we just render one mock activity so that we can measure it)
    // 3. (this is also the normal re-render case) To render without the mock activity

    private doCardAction(type: CardActionTypes, value: string | object) {
        if (this.props.disableCardActions) {
            return
        }
        this.props.setFocus();
        this.props.onClickCardAction();
        return this.props.doCardAction(type, value);
    }

    onHeightChanged(index: number, height: number) {
        if (this.props.onActivityHeight) {
            this.props.onActivityHeight(index, height)
        }
    }

    render() {
        konsole.log("History props", this);
        let content;
        if (this.props.size.width !== undefined) {
            if (this.props.format.carouselMargin === undefined) {
                // For measuring carousels we need a width known to be larger than the chat itself
                this.largeWidth = this.props.size.width * 2;
                content = <this.measurableCarousel/>;
            } else {
                content = this.props.activities.map((activity, index) =>
                    <WrappedActivity
                        format={ this.props.format }
                        key={ 'message' + index }
                        activity={ activity }
                        showTimestamp={ index === this.props.activities.length - 1 || (index + 1 < this.props.activities.length && suitableInterval(activity, this.props.activities[index + 1])) }
                        selected={ this.props.isSelected(activity) }
                        fromMe={ this.props.isFromMe(activity) }
                        renderActivity={this.props.renderActivity}
                        onClickActivity={ this.props.onClickActivity(activity) }
                        onClickRetry={ e => {
                            // Since this is a click on an anchor, we need to stop it
                            // from trying to actually follow a (nonexistant) link
                            e.preventDefault();
                            e.stopPropagation();
                            this.props.onClickRetry(activity)
                        } }
                        // BLIS callback when height has been determined
                        onHeightChanged={(height) => this.onHeightChanged(index, height)}
                    >
                        <ActivityView
                            format={ this.props.format }
                            size={ this.props.size }
                            activity={ activity }
                            onCardAction={ (type: CardActionTypes, value: string | object) => this.doCardAction(type, value) }
                            onImageLoad={ () => this.autoscroll() }
                        />
                    </WrappedActivity>
                );
            }
        }

        const groupsClassName = classList('wc-message-groups', !this.props.format.options.showHeader && 'no-header');

        return (
            <div className={ groupsClassName } ref={ div => this.scrollMe = div || this.scrollMe }>
                <div className="wc-message-group-content" ref={ div => { if (div) this.scrollContent = div }}>
                    { content }
                </div>
            </div>
        );
    }
}

export const History = connect(
    (state: ChatState) => ({
        // passed down to HistoryView
        format: state.format,
        size: state.size,
        activities: state.history.activities,
        // only used to create helper functions below 
        connectionSelectedActivity: state.connection.selectedActivity,
        selectedActivity: state.history.selectedActivity,
        botConnection: state.connection.botConnection,
        user: state.connection.user
    }), {
        setMeasurements: (carouselMargin: number) => ({ type: 'Set_Measurements', carouselMargin }),
        onClickRetry: (activity: Activity) => ({ type: 'Send_Message_Retry', clientActivityId: activity.channelData.clientActivityId }),
        onClickCardAction: () => ({ type: 'Card_Action_Clicked'}),
        // only used to create helper functions below 
        sendMessage
    }, (stateProps: any, dispatchProps: any, ownProps: any): HistoryProps => ({
        // from stateProps
        format: stateProps.format,
        size: stateProps.size,
        activities: stateProps.activities,
        // from dispatchProps
        setMeasurements: dispatchProps.setMeasurements,
        onClickRetry: dispatchProps.onClickRetry,
        onClickCardAction: dispatchProps.onClickCardAction,
        // from ownProps
        setFocus: ownProps.setFocus,
        renderActivity: ownProps.renderActivity,  // BLIS ADD
        onActivityHeight: ownProps.onActivityHeight, // BLIS ADD
        onScrollChange: ownProps.onScrollChange, // BLIS ADD
        initialScrollPosition: ownProps.initialScrollPosition, // BLIS ADD
        forceScrollPosition: ownProps.forceScrollPosition, // BLIS ADD
        instantScroll: ownProps.instantScroll, // BLIS ADD
        disableCardActions: ownProps.disableCardActions, // BLIS ADD
        // helper functions
        doCardAction: doCardAction(stateProps.botConnection, stateProps.user, stateProps.format.locale, dispatchProps.sendMessage),
        isFromMe: (activity: Activity) => activity.from.id === stateProps.user.id,
        isSelected: (activity: Activity) => activity === stateProps.selectedActivity,
        onClickActivity: (activity: Activity) => stateProps.connectionSelectedActivity && (() => stateProps.connectionSelectedActivity.next({ activity }))
    })
)(HistoryView);

const getComputedStyleValues = (el: HTMLElement, stylePropertyNames: string[]) => {
    const s = window.getComputedStyle(el);
    const result: { [key: string]: number } = {};
    stylePropertyNames.forEach(name => result[name] = parseInt(s.getPropertyValue(name)));
    return result;
}

const measurePaddedHeight = (el: HTMLElement): number => {
    const paddingTop = 'padding-top', paddingBottom = 'padding-bottom';
    const values = getComputedStyleValues(el, [paddingTop, paddingBottom]);
    return el.offsetHeight - values[paddingTop] - values[paddingBottom];
}

const measurePaddedWidth = (el: HTMLElement): number => {
    const paddingLeft = 'padding-left', paddingRight = 'padding-right';
    const values = getComputedStyleValues(el, [paddingLeft, paddingRight]);
    return el.offsetWidth + values[paddingLeft] + values[paddingRight];
}

const suitableInterval = (current: Activity, next: Activity) =>
    Date.parse(next.timestamp) - Date.parse(current.timestamp) > 5 * 60 * 1000;

export interface WrappedActivityProps {
    activity: Activity,
    showTimestamp: boolean,
    selected: boolean,
    fromMe: boolean,
    format: FormatState,
    onClickActivity: React.MouseEventHandler<HTMLDivElement>,
    onClickRetry: React.MouseEventHandler<HTMLAnchorElement>,
    renderActivity?: (props: WrappedActivityProps, children: React.ReactNode, setRef: (div: HTMLDivElement | null) => void) => (JSX.Element | null)     // BLIS ADD
    onHeightChanged?: (height: number) => void // BLIS add
}

export class WrappedActivity extends React.Component<WrappedActivityProps, {}> {
    public messageDiv: HTMLDivElement;

    constructor(props: WrappedActivityProps) {
        super(props);
    }

    // BLIS inform of height of element
    componentDidMount() {
        if (this.props.onHeightChanged) {
            const height = this.messageDiv.clientHeight
            this.props.onHeightChanged(height)
        }
    }

    // BLIS inform of height of element
    componentDidUpdate() {
        if (this.props.onHeightChanged) {
            const height = this.messageDiv.clientHeight
            this.props.onHeightChanged(height)
        }
    }

    render () {
        if (this.props.renderActivity) {
            return this.props.renderActivity(this.props, this.props.children, (div) => this.messageDiv = div )
        }
        let timeLine: JSX.Element;
        switch (this.props.activity.id) {
            case undefined:
                timeLine = <span>{ this.props.format.strings.messageSending }</span>;
                break;
            case null:
                timeLine = <span>{ this.props.format.strings.messageFailed }</span>;
                break;
            case "retry":
                timeLine =
                    <span>
                        { this.props.format.strings.messageFailed }
                        { ' ' }
                        <a href="." onClick={ this.props.onClickRetry }>{ this.props.format.strings.messageRetry }</a>
                    </span>;
                break;
            default:
                let sent: string;
                if (this.props.showTimestamp)
                    sent = this.props.format.strings.timeSent.replace('%1', (new Date(this.props.activity.timestamp)).toLocaleTimeString());
                timeLine = <span>{ this.props.activity.from.name || this.props.activity.from.id }{ sent }</span>;
                break;
        }

        const who = this.props.fromMe ? 'me' : 'bot';

        let wrapperClassName = classList(
            'wc-message-wrapper',
            (this.props.activity as Message).attachmentLayout || 'list',
            this.props.onClickActivity && 'clickable'
        );

        return (
            <div data-activity-id={ this.props.activity.id } className={ wrapperClassName } onClick={ this.props.onClickActivity }>
                <div className={ 'wc-message wc-message-from-' + who } ref={ div => this.messageDiv = div }>
                    <div className={ 'wc-message-content' }>
                        <svg className="wc-message-callout">
                            <path className="point-left" d="m0,6 l6 6 v-12 z" />
                            <path className="point-right" d="m6,6 l-6 6 v-12 z" />
                        </svg>
                        { this.props.children }
                    </div>
                </div>
            </div>
        );
    }
}