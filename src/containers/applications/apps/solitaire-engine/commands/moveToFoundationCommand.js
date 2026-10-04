import { Command } from "../command.js";
import eventSystem from "../eventSystem.js";

export default class MoveToFoundationCommand extends Command{
    constructor(dragPile, fromPile,toPile){
        super();
        this.dragPile = dragPile;
        this.fromPile = fromPile;
        this.toPile = toPile;
        this.flipTableauOnUndoFlag = false;
    }

    async execute(){
        this.toPile.addCard(this.fromPile.removeTopCard());
        new Promise(res => eventSystem.trigger('move-cards', {
            action: "user-action",
            cardsPile: this.dragPile.snapshot(),
            fromPile: this.fromPile.snapshot(),
            toPile: this.toPile.snapshot(),
            callback: res

        })).then(async ()=>{
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

    async undo(){
        new Promise(async res=>{
            if(this.flipTableauOnUndoFlag){
                this.fromPile.hideTopCard();
                await new Promise(resolve=>eventSystem.trigger('flip-top-card-at-pile', {
                    action: 'undo-user-action',
                    pile: this.fromPile.snapshot(),
                    callback: resolve
                }));
                this.flipTableauOnUndoFlag != this.flipTableauOnUndoFlag;
            }
            res();
        }).then(async ()=>{
            this.fromPile.addCard(this.toPile.removeTopCard());
            new Promise(res=>eventSystem.trigger('move-cards', {
                action: "undo-user-action",
                cardsPile: this.dragPile.snapshot(),
                fromPile: this.toPile.snapshot(),
                toPile: this.fromPile.snapshot(),
                callback: res
            }));
        });
    }
}