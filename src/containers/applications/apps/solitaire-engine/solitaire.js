import CollectWastePileCommand from "./commands/collectWastePileCommand.js";
import HitCommand from "./commands/hitCommand.js";
import MoveToTableauCommand from "./commands/moveToTableauCommand.js";
import eventSystem from "./eventSystem.js";
import { Pile, Waste, Deck, Tableau, Foundation } from "./piles.js";
import Card from "./card.js";
import MoveToFoundationCommand from "./commands/moveToFoundationCommand.js";

export default class Solitaire {
    acceptInput;
    constructor() {
        this.gameSettings = {};
        this.buildDataObjects = this.buildDataObjects.bind(this);
        this.clearHistory = this.clearHistory.bind(this);
        this.onDeckHit = this.onDeckHit.bind(this);
        this.undo = this.undo.bind(this);
        this.executeCommand = this.executeCommand.bind(this);
        this.onDragStartCard = this.onDragStartCard.bind(this);
        this.onDragOverPile = this.onDragOverPile.bind(this);
        this._dragStart = this._dragStart.bind(this);
        this._dragOver = this._dragOver.bind(this);
        this._getFoundationWithId = this._getFoundationWithId.bind(this);
        this._getTableauWithId = this._getTableauWithId.bind(this);
        this._canFoundationAccept = this._canFoundationAccept.bind(this);
        this._getValidFoundationToCollect = this._getValidFoundationToCollect.bind(this);
        this.onCancelDrag = this.onCancelDrag.bind(this);
        this.onDropOverPile = this.onDropOverPile.bind(this);
        this.onTryCollectCard = this.onTryCollectCard.bind(this);
        this.checkCertainWin = this.checkCertainWin.bind(this);
        this._serializeState = this._serializeState.bind(this);
        this._loadState = this._loadState.bind(this);
        this.onLoadGame = this.onLoadGame.bind(this);
        this.onRequestSaveData = this.onRequestSaveData.bind(this);
        this.restart = this.restart.bind(this);
        this.onFastForward = this.onFastForward.bind(this);
        this.onUndo = this.onUndo.bind(this);
        this.onRedo = this.onRedo.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.onScoreUpdated = this.onScoreUpdated.bind(this);
    }

    initialize(
        {
            difficulty = 3,
            timerMode = false,
            scoring = false,
            thoughtfulSol = false,  // Allowing unlimited undo's is akin to a version of Solitaire called Thoughtful Solitaire
            passes = 0
        } = {}) {

        this.gameSettings.difficulty = difficulty;
        this.gameSettings.timerMode = timerMode;
        this.gameSettings.scoring = scoring;
        this.gameSettings.thoughtfulSol = thoughtfulSol;
        this.gameSettings.passes = passes;

        this.clearHistory();
        this.buildDataObjects();
        this.deck.generateCards();
        this.deck.shuffle();

        //clear & register event listeners
        eventSystem.remove('deck-hit', this.onDeckHit);
        eventSystem.remove('drag-start-card', this.onDragStartCard);
        eventSystem.remove('drag-over-pile', this.onDragOverPile);
        eventSystem.remove('drop-over-bg', this.onCancelDrag);
        eventSystem.remove('drop-over-pile', this.onDropOverPile);
        eventSystem.remove('try-collect-card', this.onTryCollectCard);
        eventSystem.remove('new-game', this.restart);
        eventSystem.remove('game-settings-changed',this.restart);
        eventSystem.remove('fast-forward', this.onFastForward);
        eventSystem.remove('undo-clicked',this.onUndo);
        eventSystem.remove('redo-clicked',this.onRedo);
        eventSystem.remove('score-updated',this.onScoreUpdated);


        eventSystem.listen('deck-hit', this.onDeckHit);
        eventSystem.listen('drag-start-card', this.onDragStartCard)
        eventSystem.listen('drag-over-pile', this.onDragOverPile);
        eventSystem.listen('drop-over-bg', this.onCancelDrag);
        eventSystem.listen('drop-over-pile', this.onDropOverPile);
        eventSystem.listen('try-collect-card', this.onTryCollectCard);
        eventSystem.listen('new-game', this.restart);
        eventSystem.listen('game-settings-changed',this.restart);
        eventSystem.listen('fast-forward', this.onFastForward);
        eventSystem.listen('undo-clicked',this.onUndo);
        eventSystem.listen('redo-clicked',this.onRedo);
        eventSystem.listen('score-updated',this.onScoreUpdated);

        eventSystem.trigger('game-initialized', {
            settings: this.gameSettings,
            deck: this.deck.snapshot()
        });
        this._enableInputs();
    }

    restart(evt){
        this.initialize(evt);
    }

    buildDataObjects() {
        this.deck = new Deck();
        this.waste = new Waste();
        this.tableaux = [];
        this.foundations = [];
        for (let i = 0; i < 7; i++) {
            if (i < 4)
                this.foundations.push(new Foundation(i));
            this.tableaux.push(new Tableau(i));
        }
        this.foundationSuits = {
            0: null,
            1: null,
            2: null,
            3: null
        };
        this.draggedPile = null;
        this.draggedFromPile = null;
        this.currentPasses = 0;
        this.currentScore = 0;
    }

    async executeCommand(command) {
        await new Promise(res => {
            command.execute();
            res();
        }).then(() => this._updateFoundationSuits());
        this.history.push(command);
        this.undoStack = [];
        eventSystem.trigger('history-update', { action: 'executeCommand', history: this.history, undo: this.undoStack });
    }

    async undo() {
        if (this.history.length) {
            let command = this.history.pop();
            if(command instanceof CollectWastePileCommand)
                this.currentPasses--;
            await command.undo().then(() => this._updateFoundationSuits());
            this.undoStack.push(command);
            eventSystem.trigger('history-update', { action: 'undo', history: this.history, undo: this.undoStack });
        }
    }

    async redo() {
        if (this.undoStack.length) {
            let command = this.undoStack.pop();
            await command.execute().then(() => this._updateFoundationSuits());
            this.history.push(command);
            eventSystem.trigger('history-update', { action: 'redo', history: this.history, undo: this.undoStack })
        }
    }

    async onUndo() {
        if (this.gameSettings.thoughtfulSol) {
            this._disableInputs();
            await this.undo();
            this._enableInputs();
        }
    }

    async onRedo() {
        if (this.gameSettings.thoughtfulSol) {
            this._disableInputs();
            await this.redo();
            this._enableInputs();
        }
    }

    clearHistory() {
        this.history = [];
        this.undoStack = [];
    }

    async onLoadGame(save) {
        this._disableInputs();
        // take a backup of current state
        const currentState = this._serializeState();
        try {
            await this._loadState(save);
        }
        catch (e) {
            console.error(`Couldn't load the save:`, e);
            console.log('Reverting to previous state');
            this._loadState(currentState);
        }
    }

    onRequestSaveData() {
        const state = this._serializeState();
        eventSystem.trigger('game-save-data', state);
    }

    //---- GAME EVENT HANDLING ----//

    onDropOverPile(data) {
        if (!this.acceptInput) return;
        this._disableInputs();
        this._dropOverPile(data);
        this._enableInputs();
        if (this.winState) this.onWinGame();
        if (this.checkCertainWin()) {
            eventSystem.trigger('fast-forward-possible');
        }
    }

    onDragOverPile(data) {
        if (!this.acceptInput) return;
        this._disableInputs();
        this._dragOver(data);
        this._enableInputs();
    }


    onDragStartCard(data) {
        if (!this.acceptInput) return;
        this._disableInputs();
        this._dragStart(data);
        this._enableInputs();
    }

    onCancelDrag() {
        this.draggedPile = null;
    }

    onWinGame() {
        this._disableInputs();
        eventSystem.trigger('game-ended', {
            action: "system-message",
            victoryStatus: true,
            score: this.currentScore,
        });
    }
    
    onLoseGame(){
        this._disableInputs();
        eventSystem.trigger('game-ended',{
            action: "system-message",
            victoryStatus: false,
            score: 0,
        });
    }

    async onFastForward() {
        if(!this.checkCertainWin()) return;
        while (!this.winState) {
            await new Promise(r => setTimeout(r, 50));
            for (let i = 0; i < this.tableaux.length; i++) {
                const tableau = this.tableaux[i];
                if (!tableau.topCard)
                    continue;
                let found;
                do {
                    const pile = new Pile();
                    pile.addCard(tableau.topCard);
                    found = this._getValidFoundationToCollect(pile);
                    if (found) {
                        await this.executeCommand(new MoveToFoundationCommand(pile, tableau, found));
                        await new Promise(r => setTimeout(r, 100));
                    }
                } while (found && tableau.topCard);
            }
        }
        this.onWinGame();
    }

    checkCertainWin() {
        // check all cards on tableaux are face-up
        // If not, there may be a small card hidden behind a bigger one, possibly preventing win
        const allfaceUp = this.tableaux.every(tableau => {
            return tableau.stack.every(card => !!card.faceUp);
        });
        return allfaceUp && this.waste.isEmpty && this.deck.isEmpty;
    }

    async onTryCollectCard({ pileId }) {
        if (!this.acceptInput) return;
        let pile;
        if (pileId.startsWith('t')) {
            pile = this._getTableauWithId(pileId);
        } else if (pileId.startsWith('w')) {
            pile = this.waste;
        }
        if (!pile) return;

        const card = pile.topCard;
        if (card) {
            this._disableInputs();
            const cardPile = new Pile();
            cardPile.addCard(card);
            const foundation = this._getValidFoundationToCollect(cardPile);
            if (foundation) {
                await this.executeCommand(new MoveToFoundationCommand(cardPile, pile, foundation))
                    .then(() => {
                        if (this.winState) this.onWinGame();
                        if (this.checkCertainWin()) {
                            eventSystem.trigger('fast-forward-possible');
                            this._enableInputs();
                        }
                    });
            } else {
                eventSystem.trigger('reject-collect-card', {});
            }
            this._enableInputs();
        }
    }

    async onDeckHit() {
        if (!this.acceptInput) return
        // if deck is full, it means we deal
        if (this.deck.isFull) {
            this._disableInputs();
            eventSystem.trigger('dealing')
            await this._deal().then(() => {
                eventSystem.trigger('dealing-finished');
                this._enableInputs();
            });
            // if deck is not empty, it means we hit to waste pile
        } else if (!this.deck.isEmpty) {
            this._disableInputs();
            const numToHit = Math.min(this.deck.stack.length, this.gameSettings.difficulty);
            const hitCmd = new HitCommand(this.deck, this.waste, numToHit);
            await this.executeCommand(hitCmd).then(() => this._enableInputs());
        } else if (!this.deck.stack.length && this.waste.stack.length) {
            this._disableInputs();
            this.currentPasses++;
            if(this.lossState){
                return this.onLoseGame();
            }
            const collectCmd = new CollectWastePileCommand(this.waste, this.deck);
            await this.executeCommand(collectCmd).then(() => this._enableInputs());
        }
    }

    async _deal() {
        for (let i = 0; i < this.tableaux.length; i++) {
            const t = this.tableaux.slice(i);
            for (const tableau of t) {
                tableau.addCard(this.deck.removeTopCard());
                await new Promise(res => eventSystem.trigger('move-card',
                    {
                        action: 'deal',
                        card: tableau.topCard.snapshot(),
                        fromPile: this.deck.snapshot(),
                        toPile: tableau.snapshot(),
                        callback: res
                    }));
            }
            this.tableaux[i].revealTopCard();
            await new Promise(res => eventSystem.trigger('flip-top-card-at-pile',
                {
                    action: 'deal',
                    pile: this.tableaux[i].snapshot(),
                    callback: res
                }));
        }
    }

    _disableInputs() {
        this.acceptInput = false;
    }
    _enableInputs() {
        this.acceptInput = true;
    }

    _dragStart({ cardIdx, fromPile, eventData }) {
        let card;
        const pile = new Pile();
        switch (fromPile.substring(0, 1).toLowerCase()) {
            case 'w':
                card = this.waste.getCardAt(cardIdx);
                if (!card) break;
                if (card.isDraggable) {
                    eventSystem.trigger('validated-drag-start-card', {
                        action: "drag-start",
                        card: card.snapshot(),
                        fromPile: this.waste.snapshot(),
                        cardIdx,
                        evt: eventData
                    });
                    pile.stack = [Card.FromSnapshot(card.snapshot())];
                    this.draggedFromPile = this.waste;
                }
                break;
            case 'f':
                const foundation = this._getFoundationWithId(fromPile)
                card = foundation.getCardAt(cardIdx);
                if (!card) break;
                if (card.isDraggable) {
                    eventSystem.trigger('validated-drag-start-card', {
                        action: "drag-start",
                        card: card.snapshot(),
                        fromPile: foundation.snapshot(),
                        cardIdx,
                        foundationIdx: foundation.idx,
                        evt: eventData
                    });
                    pile.stack = [Card.FromSnapshot(card.snapshot())];
                    this.draggedFromPile = foundation;
                }
                break;
            case 't':
                const tableau = this._getTableauWithId(fromPile);
                card = tableau.getCardAt(cardIdx);
                if (!card) break;
                if (card.isDraggable) {
                    eventSystem.trigger('validated-drag-start-card', {
                        action: "drag-start",
                        card: card.snapshot(),
                        fromPile: tableau.snapshot(),
                        cardIdx,
                        tableauIdx: tableau.idx,
                        evt: eventData
                    });
                    pile.stack = tableau.stack.slice(cardIdx).map(card => Card.FromSnapshot(card.snapshot()));
                    this.draggedFromPile = tableau;
                }
                break;
            default:
                console.error('An error occured at drag-start-card event handler');
                break;
        }
        if (!pile.isEmpty)
            this.draggedPile = pile;
        else
            throw new Error(`Can't start drag`);
    }

    _dragOver({ overPile, eventData }) {
        if (!this.draggedPile) return;
        if (overPile.startsWith('t')) {
            const tableau = this._getTableauWithId(overPile);
            let eventName = tableau.allowDrop(this.draggedPile) ? 'valid-drag-over-pile' : 'invalid-drag-over-pile';
            eventSystem.trigger(eventName, {
                action: "drag-over",
                overPile: tableau.snapshot(),
                evt: eventData
            });
        } else if (overPile.startsWith('f')) {
            const foundation = this._getFoundationWithId(overPile);
            let eventName = this._canFoundationAccept(foundation, this.draggedPile) ? 'valid-drag-over-pile' : 'invalid-drag-over-pile';
            eventSystem.trigger(eventName, {
                action: "drag-over",
                overPile: foundation.snapshot(),
                evt: eventData
            });
        }
    }

    async _dropOverPile({ onPile, eventData }) {
        if (!this.draggedPile) return;
        if (onPile.startsWith('t')) {
            const tableau = this._getTableauWithId(onPile);
            if (tableau.allowDrop(this.draggedPile)) {
                await this.executeCommand(new MoveToTableauCommand(this.draggedPile, this.draggedFromPile, tableau));
            } else {
                eventSystem.trigger('invalid-drop-over-pile', {
                    action: "drop",
                    onPile: tableau.snapshot(),
                    evt: eventData
                });
            }
        } else if (onPile.startsWith('f')) {
            const foundation = this._getFoundationWithId(onPile);
            if (this._canFoundationAccept(foundation, this.draggedPile)) {
                await this.executeCommand(new MoveToFoundationCommand(this.draggedPile, this.draggedFromPile, foundation));
            } else {
                eventSystem.trigger('invalid-drop-over-pile', {
                    action: "drop",
                    onPile: foundation.snapshot(),
                    evt: eventData
                });
            }
        }
    }

    _getTableauWithId(strId) {
        if (!strId.toLowerCase().startsWith('t')) throw new Error(`Invalid tableau string ID: ${strId}`);
        const tableauIdx = Number(strId.substring(strId.length - 1)) - 1;
        return this.tableaux[tableauIdx];
    }

    _getFoundationWithId(strId) {
        if (!strId.toLowerCase().startsWith('f')) throw new Error(`Invalid foundation string ID: ${strId}`);
        const foundationIdx = Number(strId.substring(strId.length - 1)) - 1;
        return this.foundations[foundationIdx];
    }

    _canFoundationAccept(foundation, pile) {
        const suit = pile.topCard.suit;
        const idx = foundation.idx;
        let existingFoundationIdx = Object.values(this.foundationSuits).findIndex(val => {
            return val && val.value == suit.value;
        });
        if (existingFoundationIdx >= 0) {
            if (existingFoundationIdx === idx) {
                return foundation.allowDrop(pile);
            }
            return false;
        } else {
            return foundation.allowDrop(pile);
        }
    }

    _getValidFoundationToCollect(pile) {
        return this.foundations.find(foundation => this._canFoundationAccept(foundation, pile));
    }

    _updateFoundationSuits() {
        this.foundations.forEach((foundation, idx) => {
            this.foundationSuits[idx] = foundation.isEmpty ? null : foundation.topCard.suit;
        })
    }

    get winState() {
        return this.foundations.every(foundation => foundation.isFull);
    }

    get lossState(){
        if(this.gameSettings.passes>0){
            return this.currentPasses >= this.gameSettings.passes;
        }
        return false;
    }

    _serializeState() {
        const tableauxSnaps = this.tableaux.map(tableau => tableau.snapshot());
        const foundationSnaps = this.foundations.map(foundation => foundation.snapshot());
        return JSON.stringify({
            settings: this.gameSettings,
            piles: {
                deck: this.deck.snapshot(),
                waste: this.waste.snapshot(),
                tableaux: tableauxSnaps,
                foundations: foundationSnaps,
            },
            foundationSuits: this.foundationSuits,
            currentPasses: this.currentPasses,
            currentScore: this.currentScore
        });
    }

    async _loadState(state) {
        this._disableInputs();
        this.buildDataObjects();
        const load = JSON.parse(state);
        this.gameSettings = load.settings;
        const piles = load.piles;
        this.deck = Deck.FromSnapshot(piles.deck);
        this.waste = Waste.FromSnapshot(piles.waste);
        this.foundations = piles.foundations.map(snap => Foundation.FromSnapshot(snap));
        this.tableaux = piles.tableaux.map(snap => Tableau.FromSnapshot(snap));
        this.foundationSuits = load.foundationSuits;
        this.currentPasses = load.currentPasses;

        // if the save was from before we had passes, gracefully load and assume unlimited passess
        if(!this.gameSettings.hasOwnProperty('passes')){
            this.gameSettings.passes = 0;
            this.currentPasses = 0;
        }
        // similarly scoring is a post-mvp addition
        if(load.currentScore){
            this.currentScore = load.currentScore;
        }

        new Promise(res => {
            eventSystem.trigger('game-data-loaded', {
                ...piles,
                callback: () => {
                    this._enableInputs();
                    eventSystem.trigger('game-load-finished');
                    res();
                }
            });
        });
    }

    onScoreUpdated({currentScore}){
        if(this.gameSettings.scoring){
            this.currentScore = currentScore;
        }
        
    }
}