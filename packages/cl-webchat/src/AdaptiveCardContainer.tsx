import * as React from 'react';
import * as AdaptiveCards from "adaptivecards";
import * as MarkdownIt from 'markdown-it'
import { CardAction } from "botframework-directlinejs/built/directLine";
import { classList, IDoCardAction, konsole } from "./Chat";

export interface Props {
    card: AdaptiveCards.AdaptiveCard,
    onImageLoad?: () => any,
    onClick?: (e: React.MouseEvent<HTMLElement>) => void,
    onCardAction: IDoCardAction,
    className?: string
}

export interface State {
    errors?: string[]
}

class LinkedAdaptiveCard extends AdaptiveCards.AdaptiveCard {
    constructor(public adaptiveCardContainer: AdaptiveCardContainer) {
        super();
    }
}

export interface BotFrameworkCardAction extends CardAction {
    __isBotFrameworkCardAction: boolean
}

function getLinkedAdaptiveCard(action: AdaptiveCards.Action) {
    let element = action.parent;
    while (element && !(element instanceof LinkedAdaptiveCard)) {
        element = element.parent;
    }
    return element as LinkedAdaptiveCard;
}

function stripSubmitAction(card) {
    if (!card.actions) {
        return card;
    }

    // Filter out HTTP action buttons
    const nextActions = card.actions
        .filter(action => action.type !== 'Action.Submit')
        .map(action => (action.type === 'Action.ShowCard' ? { ...action, card: stripSubmitAction(action.card) } : action));

    return { ...card, nextActions };
}

AdaptiveCards.AdaptiveCard.onExecuteAction = (action: AdaptiveCards.Action/*BLID   .ExternalAction*/) => {
    if (action instanceof AdaptiveCards.OpenUrlAction) {
        window.open(action.url);
    } else if (action instanceof AdaptiveCards.SubmitAction) {
        const linkedAdaptiveCard = getLinkedAdaptiveCard(action);
        if (linkedAdaptiveCard && action.data !== undefined) {
            if (typeof action.data === 'object' && (action.data as BotFrameworkCardAction).__isBotFrameworkCardAction) {
                const cardAction = (action.data as BotFrameworkCardAction);
                linkedAdaptiveCard.adaptiveCardContainer.onCardAction(cardAction.type, cardAction.value);
            } else {
                linkedAdaptiveCard.adaptiveCardContainer.onCardAction(typeof action.data === 'string' ? 'imBack' : 'postBack', action.data);
            }
        }
    }
}

let md = new MarkdownIt()
AdaptiveCards.AdaptiveCard.onProcessMarkdown = ((text, result) => {
    result.outputHtml = md.render(text)
    result.didProcess = true
})

export class AdaptiveCardContainer extends React.Component<Props, State> {
    private div: HTMLDivElement;

    constructor(props: Props) {
        super(props);
    }

    public onCardAction: IDoCardAction = (type, value) => {
        this.props.onCardAction(type, value);
    }

    private onClick(e: React.MouseEvent<HTMLElement>) {
        if (!this.props.onClick) return;
        //do not allow form elements to trigger a parent click event
        switch ((e.target as HTMLElement).tagName) {
            case 'A':
            case 'AUDIO':
            case 'VIDEO':
            case 'BUTTON':
            case 'INPUT':
            case 'LABEL':
            case 'TEXTAREA':
            case 'SELECT':
                break;
            default:
                this.props.onClick(e);
        }
    }

    // BLIS
    adaptiveCardHostConfig = {
        "supportsInteractivity": true,
        "strongSeparation": {
            "spacing": 40,
            "lineThickness": 1,
            "lineColor": "#eeeeee"
        },
        "fontFamily": "\"Segoe UI\", sans-serif",
        "fontSizes": {
            "small": 12,
            "normal": 13,
            "medium": 15,
            "large": 17,
            "extraLarge": 19
        },
        "fontWeights": {
            "lighter": 200,
            "normal": 400,
            "bolder": 700
        },
        "colors": {
            "dark": {
                "normal": "#000000",
                "subtle": "#808c95"
            },
            "light": {
                "normal": "#ffffff",
                "subtle": "#88ffff"
            },
            "accent": {
                "normal": "#2e89fc",
                "subtle": "#802E8901"
            },
            "attention": {
                "normal": "#ffd800",
                "subtle": "#CCFFD800"
            },
            "good": {
                "normal": "#00ff00",
                "subtle": "#CC00FF00"
            },
            "warning": {
                "normal": "#ff0000",
                "subtle": "#CCFF0000"
            }
        },
        "imageSizes": {
            "small": 40,
            "medium": 64,
            "large": 96
        },
        "actions": {
            "maxActions": 100,
            "separation": {
                "spacing": 8
            },
            "buttonSpacing": 8,
            "stretch": false,
            "showCard": {
                "actionMode": "inlineEdgeToEdge",
                "inlineTopMargin": 16,
                "backgroundColor": "#00000000",
                "padding": {
                    "top": 8,
                    "right": 8,
                    "bottom": 8,
                    "left": 8
                }
            },
            "actionsOrientation": "vertical",
            "actionAlignment": "left"
        },
        "adaptiveCard": {
            "backgroundColor": "#00000000",
            "padding": {
                "left": 8,
                "top": 8,
                "right": 8,
                "bottom": 8
            }
        },
        "container": {
            "separation": {
                "spacing": 8
            },
            "normal": {
                "backgroundColor": "#00000000"
            },
            "emphasis": {
                "backgroundColor": "#eeeeee",
                "borderColor": "#aaaaaa",
                "borderThickness": {
                    "top": 1,
                    "right": 1,
                    "bottom": 1,
                    "left": 1
                },
                "padding": {
                    "top": 8,
                    "right": 8,
                    "bottom": 8,
                    "left": 8
                }
            }
        },
        "textBlock": {
            "color": "dark",
            "separations": {
                "small": {
                    "spacing": 8
                },
                "normal": {
                    "spacing": 8
                },
                "medium": {
                    "spacing": 8
                },
                "large": {
                    "spacing": 8
                },
                "extraLarge": {
                    "spacing": 8
                }
            }
        },
        "image": {
            "size": "medium",
            "separation": {
                "spacing": 8
            }
        },
        "imageSet": {
            "imageSize": "medium",
            "separation": {
                "spacing": 8
            }
        },
        "factSet": {
            "separation": {
                "spacing": 8
            },
            "title": {
                "color": "dark",
                "size": "normal",
                "isSubtle": false,
                "weight": "bolder",
                "wrap": true,
                "maxWidth": 150
            },
            "value": {
                "color": "dark",
                "size": "normal",
                "isSubtle": false,
                "weight": "normal",
                "wrap": true
            },
            "spacing": 8
        },
        "input": {
            "separation": {
                "spacing": 8
            }
        },
        "columnSet": {
            "separation": {
                "spacing": 8
            }
        },
        "column": {
            "separation": {
                "spacing": 8
            }
        }
    }

    // BLIS
    getAdaptiveCardHostConfig(): any {
        return new AdaptiveCards.HostConfig(this.adaptiveCardHostConfig)
    }

    // BLIS
    componentDidMount() {
        const adaptiveCard = new LinkedAdaptiveCard(this);
        adaptiveCard.hostConfig = this.getAdaptiveCardHostConfig()
        adaptiveCard.parse(stripSubmitAction(this.props.card));
        const errors = adaptiveCard.validate();
        if (errors.length === 0) {
            let renderedCard: HTMLElement;
            try {
                renderedCard = adaptiveCard.render();
            }
            catch (e) {
                const ve: AdaptiveCards.IValidationError = {
                    error: -1,
                    message: e
                };
                errors.push(ve);

                if (e.stack) {
                    ve.message += '\n' + e.stack;
                }
            }
            if (renderedCard) {
                if (this.props.onImageLoad) {
                    var imgs = renderedCard.querySelectorAll('img');
                    if (imgs && imgs.length > 0) {
                        Array.prototype.forEach.call(imgs, (img: HTMLImageElement) => {
                            img.addEventListener('load', this.props.onImageLoad);
                        });
                    }
                }
                this.div.appendChild(renderedCard);
                return;
            }
        }
        if (errors.length > 0) {
            console.log('Error(s) rendering AdaptiveCard:');
            errors.forEach(e => console.log(e.message));
            this.setState({ errors: errors.map(e => e.message) });
        }
    }

    render() {
        let wrappedChildren: JSX.Element;
        const hasErrors = this.state && this.state.errors && this.state.errors.length > 0;
        if (hasErrors) {
            wrappedChildren = (
                <div>
                    <svg className="error-icon" viewBox="0 0 15 12.01">
                        <path d="M7.62 8.63v-.38H.94a.18.18 0 0 1-.19-.19V.94A.18.18 0 0 1 .94.75h10.12a.18.18 0 0 1 .19.19v3.73H12V.94a.91.91 0 0 0-.07-.36 1 1 0 0 0-.5-.5.91.91 0 0 0-.37-.08H.94a.91.91 0 0 0-.37.07 1 1 0 0 0-.5.5.91.91 0 0 0-.07.37v7.12a.91.91 0 0 0 .07.36 1 1 0 0 0 .5.5.91.91 0 0 0 .37.08h6.72c-.01-.12-.04-.24-.04-.37z M11.62 5.26a3.27 3.27 0 0 1 1.31.27 3.39 3.39 0 0 1 1.8 1.8 3.36 3.36 0 0 1 0 2.63 3.39 3.39 0 0 1-1.8 1.8 3.36 3.36 0 0 1-2.62 0 3.39 3.39 0 0 1-1.8-1.8 3.36 3.36 0 0 1 0-2.63 3.39 3.39 0 0 1 1.8-1.8 3.27 3.27 0 0 1 1.31-.27zm0 6a2.53 2.53 0 0 0 1-.21A2.65 2.65 0 0 0 14 9.65a2.62 2.62 0 0 0 0-2 2.65 2.65 0 0 0-1.39-1.39 2.62 2.62 0 0 0-2 0A2.65 2.65 0 0 0 9.2 7.61a2.62 2.62 0 0 0 0 2A2.65 2.65 0 0 0 10.6 11a2.53 2.53 0 0 0 1.02.26zM13 7.77l-.86.86.86.86-.53.53-.86-.86-.86.86-.53-.53.86-.86-.86-.86.53-.53.86.86.86-.86zM1.88 7.13h2.25V4.88H1.88zm.75-1.5h.75v.75h-.75zM5.63 2.63h4.5v.75h-4.5zM1.88 4.13h2.25V1.88H1.88zm.75-1.5h.75v.75h-.75zM9 5.63H5.63v.75h2.64A4 4 0 0 1 9 5.63z" />
                    </svg>
                    <div className="error-text">Can't render card</div>
                </div>
            );
        } else if (this.props.children) {
            wrappedChildren = (
                <div className="non-adaptive-content">
                    {this.props.children}
                </div>
            );
        } else {
            wrappedChildren = null;
        }
        return (
            <div className={classList('wc-card', 'wc-adaptive-card', this.props.className, hasErrors && 'error')} ref={div => this.div = div} onClick={e => this.onClick(e)}>
                {wrappedChildren}
            </div>
        )
    }

    componentDidUpdate() {
        if (this.props.onImageLoad) this.props.onImageLoad();
    }
}
