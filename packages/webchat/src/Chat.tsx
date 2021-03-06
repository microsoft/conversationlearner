import * as React from 'react';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { WrappedActivityProps } from './History'
import { Activity, Media, IBotConnection, User, MediaType, DirectLine, DirectLineOptions, CardActionTypes } from 'botframework-directlinejs';
import { createStore, ChatActions, HistoryAction } from './Store';
import { Provider } from 'react-redux';

// Comment to test publishing
export interface FormatOptions {
    showHeader?: boolean
}

export type ActivityOrID = {
    activity?: Activity
    id?: string
}

export interface ChatProps {
    user: User,
    bot: User,
    botConnection?: IBotConnection,
    directLine?: DirectLineOptions,
    locale?: string,
    history?: Activity[],
    selectedActivity?: BehaviorSubject<ActivityOrID>,
    sendTyping?: boolean,
    formatOptions?: FormatOptions,
    resize?: 'none' | 'window' | 'detect',
    hideInput: boolean,  //BLIS addition
    focusInput: boolean, //BLIS addition
    disableUpload: boolean, //BLIS addition
    renderActivity?: ((props: WrappedActivityProps, children: React.ReactNode, setRef: (div: HTMLDivElement | null) => void) => (JSX.Element | null)) // BLIS addition
    onActivityHeight?: (index: number, height: number) => void // BLIS ADDITION
    renderInput?: () => JSX.Element | null // BLIS addition
    onScrollChange?: ((position: number) => void)
    initialScrollPosition?: number,
    forceScrollPosition?: number | null // BLIS addition
    instantScroll?: boolean // BLIS addition
    disableCardActions?: boolean // BLIS addition
    selectedActivityIndex?: number | null // BLIS addition
    replaceActivityText?: string | null // BLIS addition
    replaceActivityIndex?: number | null // BLIS addition
}

// BLIS added channeldata so know if came from imBack
export const sendMessage = (text: string, from: User, locale: string, channelData?: string | undefined) => ({
    type: 'Send_Message',
    activity: {
        type: "message",
        text,
        from,
        locale,
        textFormat: 'plain',
        timestamp: (new Date()).toISOString(),
        channelData
    }} as ChatActions);

export const sendFiles = (files: FileList, from: User, locale: string) => ({
    type: 'Send_Message',
    activity: {
        type: "message",
        attachments: attachmentsFromFiles(files),
        from,
        locale
    }} as ChatActions);

import { History } from './History';
import { MessagePane } from './MessagePane';
import { Shell } from './Shell';

export class Chat extends React.Component<ChatProps, {}> {

    private store = createStore();

    private botConnection: IBotConnection;

    private activitySubscription: Subscription;
    private connectionStatusSubscription: Subscription;
    private selectedActivitySubscription: Subscription;

    private chatviewPanel: HTMLElement;
    private resizeListener = () => this.setSize();

    constructor(props: ChatProps) {
        super(props);

        konsole.log("BotChat.Chat props", props);

        if (props.history) {
            this.store.dispatch<HistoryAction>({
                type: 'Set_History',
                activities: props.history
            });

            // BLIS add
            if (props.selectedActivityIndex) {
                this.store.dispatch<ChatActions>({
                    type: 'Select_Activity',
                    selectedActivity: props.history[this.props.selectedActivityIndex]
                });
            }
        }

        this.store.dispatch<ChatActions>({
            type: 'Set_Locale',
            locale: props.locale || (window.navigator as any)["userLanguage"] || window.navigator.language || 'en'
        });

        if (props.formatOptions)
            this.store.dispatch<ChatActions>({ type: 'Set_Format_Options', options: props.formatOptions });

        if (props.sendTyping)
            this.store.dispatch<ChatActions>({ type: 'Set_Send_Typing', sendTyping: props.sendTyping });
    }

    componentWillReceiveProps(newProps: ChatProps) {
        if (this.props.selectedActivityIndex !== null && newProps.selectedActivityIndex === null) {
            this.store.dispatch<ChatActions>({
                type: 'Deselect_Activity'
            });
        }
        if (newProps.replaceActivityText !== null && newProps.replaceActivityIndex !== null && newProps.replaceActivityText !== this.props.replaceActivityText) {
            this.store.dispatch<ChatActions>({
                type: 'Replace_Activity_Text',
                index: newProps.replaceActivityIndex,
                text: newProps.replaceActivityText
            });
        }
    }
    private handleIncomingActivity(activity: Activity) {
        let state = this.store.getState();
        switch (activity.type) {
            case "message":
                this.store.dispatch<ChatActions>({ type: activity.from.id === state.connection.user.id ? 'Receive_Sent_Message' : 'Receive_Message', activity });
                break;

            case "typing":
                if (activity.from.id !== state.connection.user.id)
                    this.store.dispatch<ChatActions>({ type: 'Show_Typing', activity });
                break;
        }
    }

    private setSize() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Size',
            width: this.chatviewPanel.offsetWidth,
            height: this.chatviewPanel.offsetHeight
        });
    }

    componentDidMount() {
        // Now that we're mounted, we know our dimensions. Put them in the store (this will force a re-render)
        this.setSize();

        const botConnection = this.props.directLine
            ? (this.botConnection = new DirectLine(this.props.directLine))
            : this.props.botConnection
            ;

        if (this.props.resize === 'window')
            window.addEventListener('resize', this.resizeListener);

        this.store.dispatch<ChatActions>({ type: 'Start_Connection', user: this.props.user, bot: this.props.bot, botConnection, selectedActivity: this.props.selectedActivity });

        this.connectionStatusSubscription = botConnection.connectionStatus$.subscribe(connectionStatus =>{
                this.store.dispatch<ChatActions>({ type: 'Connection_Change', connectionStatus })
            }
        );

        this.activitySubscription = botConnection.activity$.subscribe(
            activity => this.handleIncomingActivity(activity),
            error => konsole.log("activity$ error", error)
        );

        if (this.props.selectedActivity) {
            this.selectedActivitySubscription = this.props.selectedActivity.subscribe(activityOrID => {
                // BLIS - bug fixed: activity.id can be null, resulting first activity being incorrectly selected
                let selectedActivity = activityOrID.activity
                if (!selectedActivity && activityOrID.id) {
                    selectedActivity = this.store.getState().history.activities.find(activity => activity.id === activityOrID.id)
                }
                if (selectedActivity) {
                    this.store.dispatch<ChatActions>({
                        type: 'Select_Activity',
                        selectedActivity
                    });
                }
            });
        }
        // BLIS add
        // Null value will clear the selected activity
        if (this.props.selectedActivityIndex != null) {
            this.store.dispatch<ChatActions>({
                type: 'Select_Activity',
                selectedActivity: this.store.getState().history.activities[this.props.selectedActivityIndex]
            });
        }
    }

    componentWillUnmount() {
        this.connectionStatusSubscription.unsubscribe();
        this.activitySubscription.unsubscribe();
        if (this.selectedActivitySubscription)
            this.selectedActivitySubscription.unsubscribe();
        if (this.botConnection)
            this.botConnection.end();
        window.removeEventListener('resize', this.resizeListener);
    }

    // At startup we do three render passes:
    // 1. To determine the dimensions of the chat panel (nothing needs to actually render here, so we don't)
    // 2. To determine the margins of any given carousel (we just render one mock activity so that we can measure it)
    // 3. (this is also the normal re-render case) To render without the mock activity

    //BLIS CHANGE - make public, check of shell not present 
    public setFocus() {
        // HUGE HACK - set focus back to input after clicking on an action
        // React makes this hard to do well, so we just do an end run around them
        const inputPanel = this.chatviewPanel.querySelector(".wc-shellinput") as HTMLInputElement
        if (inputPanel) {
            inputPanel.focus();
        }
    }

    render() {
        const state = this.store.getState();
        konsole.log("BotChat.Chat state", state);

        // only render real stuff after we know our dimensions
        let header: JSX.Element;
        if (state.format.options.showHeader) header =
            <div className="wc-header">
                <span>{ state.format.strings.title }</span>
            </div>;

        let resize: JSX.Element;
        if (this.props.resize === 'detect') resize =
            <ResizeDetector onresize={ this.resizeListener } />;

        const renderedInput = this.props.renderInput ? this.props.renderInput() : null

        // BLIS - added hideInput & focusInput below below
        return (
            <Provider store={ this.store }>
                <div className="wc-chatview-panel" ref={ div => this.chatviewPanel = div }>
                    { header }
                    <MessagePane setFocus={ () => this.setFocus() }>
                        <History 
                            setFocus={ () => this.setFocus()}
                            renderActivity={this.props.renderActivity}
                            onActivityHeight={this.props.onActivityHeight}
                            onScrollChange={this.props.onScrollChange}
                            initialScrollPosition={this.props.initialScrollPosition}
                            forceScrollPosition={this.props.forceScrollPosition}
                            instantScroll={this.props.instantScroll}
                            disableCardActions={this.props.disableCardActions}
                        />
                    </MessagePane>
                    {renderedInput ||
                        (!this.props.hideInput && 
                            <Shell  
                                focusInput={this.props.focusInput}  // BLIS addition
                                disableUpload={this.props.disableUpload}  // BLIS addition
                            />
                        )
                    }  
                    { resize }
                </div>
            </Provider>
        );
    }
}

export interface IDoCardAction {
    (type: CardActionTypes, value: string | object): void;
}

export const doCardAction = (
    botConnection: IBotConnection,
    from: User,
    locale: string,
    // BLIS added channel data so know response came from button
    sendMessage: (value: string, user: User, locale: string, channelData?: any) => void,
): IDoCardAction => (
    type,
    actionValue
) => {

    const text = (typeof actionValue === 'string') ? actionValue as string : undefined;
    const value = (typeof actionValue === 'object')? actionValue as object : undefined;

    switch (type) {
        case "imBack":
            if (typeof text === 'string')
                sendMessage(text, from, locale, {imback: true});
            break;

        case "postBack":
            sendPostBack(botConnection, text, value, from, locale);
            break;

        case "call":
        case "openUrl":
        case "playAudio":
        case "playVideo":
        case "showImage":
        case "downloadFile":
        case "signin":
            window.open(text);
            break;

        default:
            konsole.log("unknown button type", type);
        }
}

export const sendPostBack = (botConnection: IBotConnection, text: string, value: object, from: User, locale: string) => {
    botConnection.postActivity({
        type: "message",
        text,
        value,
        from,
        locale
    })
    .subscribe(id => {
        konsole.log("success sending postBack", id)
    }, error => {
        konsole.log("failed to send postBack", error);
    });
}

const attachmentsFromFiles = (files: FileList) => {
    const attachments: Media[] = [];
    for (let i = 0, numFiles = files.length; i < numFiles; i++) {
        const file = files[i];
        attachments.push({
            contentType: file.type as MediaType,
            contentUrl: window.URL.createObjectURL(file),
            name: file.name
        });
    }
    return attachments;
}

export const renderIfNonempty = (value: any, renderer: (value: any) => JSX.Element ) => {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 0))
        return renderer(value);
}

export const classList = (...args:(string | boolean)[]) => {
    return args.filter(Boolean).join(' ');
}

export const konsole = {
    log: (message?: any, ... optionalParams: any[]) => {
        if (typeof(window) !== 'undefined' && (window as any)["botchatDebug"] && message)
            console.log(message, ... optionalParams);
    }
}

// note: container of this element must have CSS position of either absolute or relative
const ResizeDetector = (props: {
    onresize: () => void
}) =>
    // adapted to React from https://github.com/developit/simple-element-resize-detector
    <iframe
        style={ { position: 'absolute', left: '0', top: '-100%', width: '100%', height: '100%', margin: '1px 0 0', border: 'none', opacity: 0, visibility: 'hidden', pointerEvents: 'none' } }
        ref={ frame => {
            if (frame)
                frame.contentWindow.onresize = props.onresize;
        } }
    />;
