import { Command } from "../command.js";
import eventSystem from "../eventSystem.js";
import Card from "../card.js";

export default class MoveToTableauCommand extends Command {
    constructor(cardsPile, fromPile, toPile) {
        super();
        this.cardsPile = cardsPile;
        this.fromPile = fromPile;
        this.toPile = toPile;
        this.flipTableauOnUndoFlag = false;
        this.count = cardsPile.stack.length; 
    }

    async execute() {
        // find idx of first card of cardsPile in fromPile
        let firstCard = this.cardsPile.bottomCard;
        let idx = this.fromPile.stack.findIndex((elem) => elem.value == firstCard.value && elem.suit.value == firstCard.suit.value);
        while (idx < this.fromPile.stack.length) {
            this.toPile.addCard(this.cardsPile.stack.shift());
            this.fromPile.removeTopCard();
        }
        new Promise(res => eventSystem.trigger('move-cards', {
            action: "user-action",
            cardsPile: this.cardsPile.snapshot(),
            fromPile: this.fromPile.snapshot(),
            toPile: this.toPile.snapshot(),
            callback: res

        })).then(async () => {
            if (!this.fromPile.isEmpty && !this.fromPile.topCard.faceUp) {
                this.flipTableauOnUndoFlag = true;
                this.fromPile.revealTopCard();
                await new Promise(res => eventSystem.trigger('flip-top-card-at-pile', {
                    action: 'user-action',
                    pile: this.fromPile.snapshot(),
                    callback: res
                }));
            }
        });
    }
    async undo() {
        new Promise(async res => {
            if (this.flipTableauOnUndoFlag) {
                this.fromPile.hideTopCard();
                await new Promise(resolve => eventSystem.trigger('flip-top-card-at-pile', {
                    action: 'undo-user-action',
                    pile: this.fromPile.snapshot(),
                    callback: resolve
                }));
                this.flipTableauOnUndoFlag != this.flipTableauOnUndoFlag
            }
            res();
        }).then(async ()=>{
            let beginIdx = this.toPile.stack.length - this.count;
            let endIdx = this.toPile.stack.length;
            for(let i =beginIdx; i<endIdx;i++){
                const card = this.toPile.stack.splice(beginIdx,1)[0];
                this.cardsPile.addCard(Card.FromSnapshot(card.snapshot()));
                this.fromPile.addCard(card);
            }
            await new Promise(res => eventSystem.trigger('move-cards', {
                action: "undo-user-action",
                cardsPile: this.cardsPile.snapshot(),
                fromPile: this.toPile.snapshot(),
                toPile: this.fromPile.snapshot(),
                callback: res
            }));
        });
    }
}