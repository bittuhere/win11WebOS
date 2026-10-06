import Card from "../card.js";
import { Command } from "../command.js";
import eventSystem from "../eventSystem.js";
import { Pile } from "../piles.js";

// Command to collect waste pile and turn back into deck
export default class CollectWastePileCommand extends Command {
    constructor(waste, deck) {
        super();
        this.waste = waste;
        this.deck = deck;
    }

    async execute() {
        const movedCards = new Pile();
        while (this.waste.stack.length) {
            const card = this.waste.removeTopCard();
            movedCards.addCard(Card.FromSnapshot(card.snapshot()));
            card.faceUp = false;
            this.deck.addCard(card);
        }
        await new Promise(res => eventSystem.trigger('move-cards', {
            action: "collect-waste",
            cardsPile: movedCards.snapshot(),
            fromPile: this.waste.snapshot(),
            toPile: this.deck.snapshot(),
            callback: res
        }))
            .then(async () => {
                await new Promise(res => eventSystem.trigger('flip-pile', {
                    action: "collect-waste",
                    pile: this.deck.snapshot(),
                    callback: res
                }))
            });
    }

    async undo() {
        const movedCards = new Pile();
        while (this.deck.stack.length) {
            const card = this.deck.removeTopCard();
            movedCards.addCard(Card.FromSnapshot(card.snapshot()));
            card.faceUp = true;
            this.waste.addCard(card);
        }
        await new Promise(res => eventSystem.trigger('move-cards', {
            action: "undo-collect-waste",
            cardsPile: movedCards.snapshot(),
            fromPile: this.deck.snapshot(),
            toPile: this.waste.snapshot(),
            callback: res
        }))
            .then(async () => {
                await new Promise(res => eventSystem.trigger('flip-pile', {
                    action: "undo-collect-waste",
                    pile: this.waste.snapshot(),
                    callback: res
                }))
            });
    }
}