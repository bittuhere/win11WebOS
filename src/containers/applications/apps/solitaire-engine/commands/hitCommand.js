import { Command } from "../command.js";
import { Pile } from "../piles.js";
import eventSystem from "../eventSystem.js";
import Card from "../card.js";
// Command to 'hit' card(s) from deck to waste pile
export default class HitCommand extends Command {
    constructor(deck, waste, numHit) {
        super();
        this.deck = deck;
        this.waste = waste;
        this.numHit = numHit;
    }

    async execute() {
        let numToRemove = this.numHit;
        const movedCards = new Pile();
        while (numToRemove) {
            let card = this.deck.removeTopCard();
            movedCards.addCard(Card.FromSnapshot(card.snapshot()));
            card.faceUp = true;
            this.waste.addCard(card);
            numToRemove--;
        }
        return new Promise(res => eventSystem.trigger('move-cards', {
            action: "hit",
            cardsPile: movedCards.snapshot(),
            fromPile: this.deck.snapshot(),
            toPile: this.waste.snapshot(),
            callback: res
        }))
            .then(async () => {
                await new Promise(res => eventSystem.trigger('flip-top-n-cards-at-pile', {
                    action: "hit",
                    pile: this.waste.snapshot(),
                    numCards: this.numHit,
                    callback: res
                }));
            });
    }

    async undo() {
        let numToRemove = this.numHit;
        const movedCards = new Pile();
        while (numToRemove) {
            let card = this.waste.removeTopCard();
            movedCards.addCard(Card.FromSnapshot(card.snapshot()));
            card.faceUp = false;
            this.deck.addCard(card);
            numToRemove--;
        }
        return new Promise(res => eventSystem.trigger('move-cards',
            {
                action: "undo-hit",
                cardsPile: movedCards.snapshot(),
                fromPile: this.waste.snapshot(),
                toPile: this.deck.snapshot(),
                callback: res
            }))
            .then(async () => {
                await new Promise(res => eventSystem.trigger('flip-top-n-cards-at-pile', {
                    action: "undo-hit",
                    pile: this.deck.snapshot(),
                    numCards: this.numHit,
                    callback: res
                }))
            });
    }
}