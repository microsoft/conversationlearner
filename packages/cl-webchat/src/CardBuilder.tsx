import { Attachment, CardAction, HeroCard, Thumbnail } from 'botframework-directlinejs';
import { BotFrameworkCardAction } from './AdaptiveCardContainer';

export class AdaptiveCardBuilder {
    public container: any
    public card: any

    constructor() {
        this.container = {
            type: "Container",
            items: []
        };

        this.card = {
            type: "AdaptiveCard",
            version: "0.5",
            body: [this.container]
        }
    }

    addColumnSet(sizes: number[], container = this.container) {
        const columnSet = {
            type: 'ColumnSet',
            columns: sizes.map((size) => {
                return {
                    type: 'Column',
                    size: size.toString(),
                    items: []
                }
            })
        };
        container.items.push(columnSet);
        return columnSet.columns;
    }

    addItems(elements: any, container = this.container) {
        container.items.push.apply(container.items, elements);
    }

    addTextBlock(text: string, template: Partial<any>, container = this.container) {
        if (typeof text !== 'undefined') {
            const textblock  = {
                type: "TextBlock",
                text: text,
                ...template
            };
            container.items.push(textblock);
        }
    }

    addButtons(buttons: CardAction[]) {
        if (buttons) {
            this.card.actions = buttons.map((button) => {
                const cardAction: BotFrameworkCardAction = { __isBotFrameworkCardAction: true, ...button };
                return {
                    title: button.title,
                    type: "Action.Submit",
                    data: cardAction
                };
            });
        }
    }

    addCommon(content: ICommonContent) {
        this.addTextBlock(content.title, { size: "medium", weight: "bolder" });
        this.addTextBlock(content.subtitle, { isSubtle: true, wrap: true, separation: "none" } as any); //TODO remove "as any" because separation is not defined
        this.addTextBlock(content.text, { wrap: true });
        this.addButtons(content.buttons);
    }

    addImage(url: string, container = this.container) {
        var image = {
            type: "Image",
            url: url,
            size: "stretch"
        };
        container.items.push(image);
    }

}

export interface ICommonContent {
    title?: string,
    subtitle?: string,
    text?: string,
    buttons?: CardAction[]
}

export const buildCommonCard = (content: ICommonContent): any => {
    if (!content) return null;

    const cardBuilder = new AdaptiveCardBuilder();
    cardBuilder.addCommon(content)
    return cardBuilder.card;
};