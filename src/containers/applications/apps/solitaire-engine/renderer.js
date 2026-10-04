import Card from "./card.js";
import eventSystem from "./eventSystem.js";
import { Pile, Waste, Tableau, Foundation, Deck } from './piles.js'

// Define flipping animation duration in ms, should match CSS
let FLIP_DURATION = 150;
// Define card deal speed in px/sec
let MOVE_SPEED = 5000;
// Define how long it takes to move pile from waste to deck in ms
let DROP_SPEED = 2000;

export default class Renderer {
    constructor(settings = {}) {

        this.configureSettings(settings);
        this.gameDOM = {};
        this.gameDOM.tableauxElements = [];
        this.gameDOM.foundationElements = [];

        this.configureSettings = this.configureSettings.bind(this);
        this.removeAllChildren = this.removeAllChildren.bind(this);
        this.initializeGameDOM = this.initializeGameDOM.bind(this);
        this.clearDOM = this.clearDOM.bind(this);
        this.attachListeners = this.attachListeners.bind(this);
        this.renderInitialState = this.renderInitialState.bind(this);
        this.getDOM = this.getDOM.bind(this);
        this.renderMoveCard = this.renderMoveCard.bind(this);
        this.renderFlipNCardsAtPile = this.renderFlipNCardsAtPile.bind(this);
        this.renderFlipTopCardAtPile = this.renderFlipTopCardAtPile.bind(this);
        this.renderFlipPile = this.renderFlipPile.bind(this);
        this.renderMoveCards = this.renderMoveCards.bind(this);
        this.renderDragStartCard = this.renderDragStartCard.bind(this);
        this._renderDragStart = this._renderDragStart.bind(this);
        this._dragUpdate = this._dragUpdate.bind(this);
        this.renderValidDragOverPile = this.renderValidDragOverPile.bind(this);
        this.renderInvalidDragOverPile = this.renderInvalidDragOverPile.bind(this);
        this._removeDraggedFeedback = this._removeDraggedFeedback.bind(this);
        this._removeDragOverFeedback = this._removeDragOverFeedback.bind(this);
        this.removeAllFeedback = this.removeAllFeedback.bind(this);
        this.renderCancelDrag = this.renderCancelDrag.bind(this);
        this._renderLoadGameState = this._renderLoadGameState.bind(this);
        this._updateSettings = this._updateSettings.bind(this);
        this._paintItAllRed = this._paintItAllRed.bind(this);

    }

    _updateSettings({renderer}){
        if(renderer.redDeck !== this.redDeck){
            this._paintItAllRed(renderer.redDeck);
        }
        this.configureSettings(renderer);
    }

    configureSettings(
        {
            enableAnimations = true,
            feedbackDragged = true,
            feedbackDragOver = true,
            animationSpeeds = {} = {
                flipDuration: FLIP_DURATION,
                moveSpeed: MOVE_SPEED,
                dropSpeed: DROP_SPEED
            },
            redDeck = false
        } = {}) {
        this.enableAnimations = enableAnimations;
        this.animationSpeeds = animationSpeeds;
        this.feedbackDragOver = feedbackDragOver;
        this.feedbackDragged = feedbackDragged;
        this.redDeck = redDeck;
    }

    initializeGameDOM(
        {
            deckElement,
            wasteElement,
            foundationElements,
            tableauxElements,
            fakeDragDiv,
            dragHost

        } = {}) {
        this.gameDOM.deckElement = deckElement;
        this.gameDOM.wasteElement = wasteElement;
        this.gameDOM.foundationElements = foundationElements;
        this.gameDOM.tableauxElements = tableauxElements;
        this.gameDOM.fakeDragDiv = fakeDragDiv;
        /* WebOS note: upstream appends the drag proxy to <body>. In the OS the
           engine's stylesheet is scoped to #solitaireApp, so a proxy parked on
           the body would be invisible (zero-sized, unpainted). The host element
           is the game area by default, falling back to body so the engine still
           works when used standalone. */
        this.gameDOM.dragHost = dragHost || document.body;
        this.gameDOM.dragElement = null;
        this.gameDOM.lastPaintedFeedack = null;
        this.gameDOM.draggedFromPile = null;
    }

    /* put the source pile's opacity back and forget it — safe to call twice,
       and safe when there was no source (interrupted drag) */
    _restoreSourcePile() {
        const pile = this.gameDOM.draggedFromPile;
        if (pile) {
            for (let child of pile.children) child.style.opacity = 1;
        }
        this.gameDOM.draggedFromPile = null;
    }

    /* remove the drag proxy wherever it actually lives */
    _removeDragElement() {
        const el = this.gameDOM.dragElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
        document.querySelectorAll('#solitaireApp .clone-pile, .game-container .clone-pile').forEach(el => el.remove());
    }

    startRendering() {
        this.clearDOM();
        this.clearListeners();
        this.attachListeners();
        this.removeAllFeedback();
    }

    removeAllChildren(element) {
        for (const child of element.children) {
            child.remove;
        }
        element.innerHTML = "";
    }

    clearDOM() {
        this.removeAllChildren(this.gameDOM.deckElement);
        this.removeAllChildren(this.gameDOM.wasteElement);
        this.gameDOM.tableauxElements.forEach(tabEl => this.removeAllChildren(tabEl));
        this.gameDOM.foundationElements.forEach(foundEl => this.removeAllChildren(foundEl));
        this.dragElement = null;
        this.lastPaintedFeedack =null;
        this.draggedFromPile = null;
    }

    clearListeners() {
        eventSystem.remove('game-initialized', this.renderInitialState);
        eventSystem.remove('move-card', this.renderMoveCard);
        eventSystem.remove('move-cards', this.renderMoveCards);
        eventSystem.remove('flip-top-card-at-pile', this.renderFlipTopCardAtPile);
        eventSystem.remove('flip-top-n-cards-at-pile', this.renderFlipNCardsAtPile);
        eventSystem.remove('flip-pile', this.renderFlipPile);
        eventSystem.remove('validated-drag-start-card', this.renderDragStartCard);
        eventSystem.remove('validated-drag-start-pile', this.renderDragStartPile);
        eventSystem.remove('valid-drag-over-pile', this.renderValidDragOverPile);
        eventSystem.remove('invalid-drag-over-pile', this.renderInvalidDragOverPile);
        eventSystem.remove('drag-update', this._dragUpdate);
        eventSystem.remove('drag-over-bg', this.removeAllFeedback)
        eventSystem.remove('drop-over-bg', this.renderCancelDrag);
        eventSystem.remove('invalid-drop-over-pile', this.renderCancelDrag);
        eventSystem.remove('game-data-loaded',this._renderLoadGameState);
        eventSystem.remove('av-settings-changed',this._updateSettings);
        eventSystem.remove('game-settings-changed',this._updateSettings);

    }

    attachListeners() {
        eventSystem.listen('game-initialized', this.renderInitialState);
        eventSystem.listen('move-card', this.renderMoveCard);
        eventSystem.listen('move-cards', this.renderMoveCards);
        eventSystem.listen('flip-top-card-at-pile', this.renderFlipTopCardAtPile);
        eventSystem.listen('flip-top-n-cards-at-pile', this.renderFlipNCardsAtPile);
        eventSystem.listen('flip-pile', this.renderFlipPile);
        eventSystem.listen('validated-drag-start-card', this.renderDragStartCard);
        eventSystem.listen('validated-drag-start-pile', this.renderDragStartPile);
        eventSystem.listen('valid-drag-over-pile', this.renderValidDragOverPile);
        eventSystem.listen('invalid-drag-over-pile', this.renderInvalidDragOverPile);
        eventSystem.listen('drag-update', this._dragUpdate);
        eventSystem.listen('drag-over-bg', this.removeAllFeedback)
        eventSystem.listen('drop-over-bg', this.renderCancelDrag);
        eventSystem.listen('invalid-drop-over-pile', this.renderCancelDrag);
        eventSystem.listen('game-data-loaded',this._renderLoadGameState);
        eventSystem.listen('av-settings-changed',this._updateSettings);
        eventSystem.listen('game-settings-changed',this._updateSettings);
    }

    renderInitialState({ deck, callback }) {
        return new Promise(res => {
            this.clearDOM();
            const reconstructedDeck = Deck.FromSnapshot(deck);
            for (const card of reconstructedDeck.stack) {
                const classes = ['deck'];
                if(this.redDeck) classes.push('red');
                this._addCard(this.gameDOM.deckElement, card, ...classes);
            }
            if (callback) callback();
            res();
        });
    }

    getDOM(pile) {
        const reconst = Pile.FromSnapshot(pile);
        switch (reconst.name) {
            case Deck.name:
                return this.gameDOM.deckElement;
            case Waste.name:
                return this.gameDOM.wasteElement;
            case Tableau.name:
                return this.gameDOM.tableauxElements[reconst.idx];
            case Foundation.name:
                return this.gameDOM.foundationElements[reconst.idx];
            default:
                throw new Error(`Invalid Pile name: ${reconst.name}, DOM element not found`);
        }
    }

    decorateCardWithPile(cardElement, pile, ...extraClasses) {
        let classDecoration;
        switch (Pile.FromSnapshot(pile).name) {
            case Deck.name:
                classDecoration = 'deck';
                break;
            case Waste.name:
                classDecoration = 'on-waste';
                break;
            case Tableau.name:
                classDecoration = 'on-tableau';
                break;
            case Foundation.name:
                classDecoration = 'on-foundation';
                break;
            default:
                classDecoration = '';
                break;
        }

        const classArray = Array.from(cardElement.classList);
        const removeArray = ['on-foundation', 'on-tableau', 'deck', 'on-waste'];
        if (classDecoration)
            removeArray.splice(removeArray.findIndex(cls => cls === classDecoration), 1);
        const classDecorations = classArray.filter(cls => !removeArray.includes(cls));
        if (classDecoration && !classDecorations.includes(classDecoration))
            classDecorations.push(classDecoration);
        cardElement.className = '';
        if (classDecorations.length || extraClasses.length)
            cardElement.classList.add(...classDecorations, ...extraClasses);
        this._paintItRed(cardElement);
        return cardElement;
    }

    removeAllFeedback() {
        this._removeDragOverFeedback();
        this._removeDraggedFeedback();
    }

    renderValidDragOverPile(data) {
        this._repaintDraggedImage('valid');
        this._repaintDragoverPiles('valid', data);
    }

    renderInvalidDragOverPile(data) {
        this._repaintDraggedImage('invalid');
        this._repaintDragoverPiles('invalid', data);
    }

    renderDragStartCard(data) {
        this._renderDragStart(data);
    }

    renderDragStartPile(data) {
        this._renderDragStart(data);
    }

    async renderCancelDrag() {
        this.removeAllFeedback();
        this.gameDOM.lastPaintedFeedack = null;
        /* WebOS guard: a dragend/cancel can arrive after the proxy is already
           gone (window closed mid-drag, or a drag that never validated).
           Upstream would dereference a null dragElement here. */
        if (!this.gameDOM.dragElement) {
            this._restoreSourcePile();
            return;
        }
        if (this.enableAnimations) {
            // capture our visual div and moveElement to original pile
            this._animateMoveElement(this.gameDOM.dragElement, null, this.gameDOM.draggedFromPile, this.animationSpeeds.dropSpeed)
                .then(() => {
                    this._removeDragElement();
                    this.gameDOM.dragElement = null;
                    this.gameDOM.fakeDragDiv.draggable = false;
                    this._restoreSourcePile();
                    this._removeDragElement();
                });

        } else {
            this._removeDragElement();
            this.gameDOM.dragElement = null;
            this.gameDOM.fakeDragDiv.draggable = false;
            this._restoreSourcePile();
            this._removeDragElement();
        }

    }

    async renderFinishDrop({ fromPile, toPile }) {
        if (!this.gameDOM.dragElement) {
            /* nothing to animate — just rebuild both piles truthfully */
            this._rebuildPileDOM(fromPile);
            this._rebuildPileDOM(toPile);
            return;
        }
        if (this.enableAnimations) {
            const toElement = this.getDOM(toPile);
            await new Promise(res => {
                this._animateMoveElement(this.gameDOM.dragElement, null, toElement, this.animationSpeeds.dropSpeed)
                    .then(() => {
                        this._rebuildPileDOM(fromPile);
                        this._rebuildPileDOM(toPile);
                        this._removeDragElement();
                        this.gameDOM.dragElement = null;
                        this.gameDOM.fakeDragDiv.draggable = false;
                        this._restoreSourcePile();
                        this._removeDragElement();
                        res()
                    });
            });
        } else {
            await new Promise(res => {
                // we need to wait slightly before removing our elements,
                // otherwise 'dragend' won't fire
                setTimeout(() => {
                    this._rebuildPileDOM(fromPile);
                    this._rebuildPileDOM(toPile);
                    this._removeDragElement();
                    this.gameDOM.dragElement = null;
                    this.gameDOM.fakeDragDiv.draggable = false;
                    this._restoreSourcePile();
                    this._removeDragElement();
                    res();
                }, 15);
            });
        }
    }

    _renderDragStart({  fromPile, cardIdx, evt }) {
        this._removeDragElement();
        const pileDOM = this.getDOM(fromPile);
        this.gameDOM.draggedFromPile = pileDOM;
        this.gameDOM.fakeDragDiv.draggable = true;
        evt.dataTransfer.setDragImage(this.gameDOM.fakeDragDiv, 0, 0);
        const pileContainer = document.createElement('div');
        pileContainer.draggable = false;
        pileContainer.style.position = 'fixed';
        pileContainer.style.transition = 'none';
        pileContainer.className = 'clone-pile';
        pileContainer.style.left = `${evt.clientX - 65}px`;
        pileContainer.style.top = `${evt.clientY - 59}px`;
        const pileOfCards = Array.from(pileDOM.children).slice(cardIdx);
        pileOfCards.forEach((c, idx) => {
            const clone = c.cloneNode(true);
            if (this.feedbackDragged) {
                clone.classList.add('dragged');
                if (idx === 0)
                    clone.classList.add('pile-head');
                if (idx === pileOfCards.length - 1)
                    clone.classList.add('pile-end');
            }
            c.style.opacity = 0;
            clone.classList.remove('on-tableau');
            clone.classList.remove('on-waste');
            clone.classList.remove('on-foundation');
            clone.classList.add('on-tableau');
            clone.draggable = false;
            pileContainer.appendChild(clone);
        });
        this.gameDOM.dragHost.appendChild(pileContainer);
        this.gameDOM.dragElement = pileContainer;
    }

    renderMoveCard({ card, fromPile, toPile, callback }) {
        const pile = this._getCorrectPileState(fromPile);
        pile.addCard(Card.FromSnapshot(card));
        pile.stack = pile.stack.slice(-1);
        return this.renderMoveCards({ cardsPile: pile.snapshot(), fromPile, toPile, callback });
    }

    renderMoveCards({ cardsPile, fromPile, toPile, callback }) {
        if (this.gameDOM.dragElement) {
            if (this.getDOM(fromPile) === this.gameDOM.draggedFromPile) {
                return new Promise(async res => {
                    await this.renderFinishDrop({ cardsPile, fromPile, toPile })
                        .then(() => {
                            if (callback) callback();
                            res();
                        });
                });
            } else {
                console.error('Something went wrong with drag&drop operation');
            }
        }
        if (this.enableAnimations) {
            return new Promise(async res => {
                const source = this._rebuildPileDOM(fromPile);
                const moveStack = this._getCorrectPileState(cardsPile).stack.map(card => this.decorateCardWithPile(this._makeCardElement(card), fromPile));
                moveStack.forEach(cardEl => source.appendChild(cardEl));
                const animations = moveStack.map(cardEl => this._animateMoveElement(cardEl, null, this.getDOM(toPile), this.animationSpeeds.moveSpeed));
                await Promise.all(animations)
                    .then(() => {
                        this._rebuildPileDOM(fromPile);
                        this._rebuildPileDOM(toPile);
                        if (callback) callback();
                        res();
                    });
            });
        } else {
            this._rebuildPileDOM(fromPile);
            this._rebuildPileDOM(toPile);
            if (callback) callback();
        }

    }

    renderFlipPile({ pile, callback }) {
        let numCards = pile.stack.length;
        return this.renderFlipNCardsAtPile({ pile, numCards, callback });
    }


    renderFlipTopCardAtPile({ pile, callback }) {
        return this.renderFlipNCardsAtPile({ pile, numCards: 1, callback });
    }

    renderFlipNCardsAtPile({ pile, numCards, callback }) {
        const pileElem = this.getDOM(pile);
        const stack = this._getCorrectPileState(pile).stack;
        const stackEl = pileElem.querySelectorAll(`.card:nth-last-child(-n+${numCards})`);
        const slice = stack.slice(-numCards);
        if (this.enableAnimations) {
            // use .map to  _animateFlipCard on all nodes of stackEl, creating an array of Promises
            // return a promise that resolves when all _animateFlipCard promises are resolved
            const animations = Array.from(stackEl).map((element, index) => {
                return this._animateFlipCard(element, slice[index], this.animationSpeeds.flipDuration);
            });
            return new Promise(async resolve => {
                await Promise.all(animations).then(() => {
                    if (callback) callback();
                    resolve();
                });
            });
        } else {
            Array.from(stackEl).forEach((card, idx) => {
                if (slice[idx].faceUp) {
                    card.classList.remove('back');
                    card.classList.add(slice[idx].cssClass);
                } else {
                    card.classList.add('back');
                    this._paintItRed(card);
                    card.classList.remove(slice[idx].cssClass);
                }
                card.draggable = !!slice[idx].isDraggable
            });
            if (callback) callback();
        }
    }

    _animateFlipCard(element, card, speed) {
        // 2 stages: first just rotate 90deg's
        // then rotate from -90 to 0 (because the cards are asymettrical, doing a 180deg turn creates a mirroring effect)
        let stage1 = [
            { transform: 'rotateY(0deg)' },
            { transform: 'rotateY(90deg)' }
        ];
        let stage2 = [
            { transform: 'rotateY(-90deg)' },
            { transform: 'rotateY(0deg)' },
        ];
        let duration = speed / 2;
        let options = { duration };
        return new Promise(res => {
            element.animate(stage1, options).onfinish = () => {
                if (card.faceUp) {
                    element.classList.remove('back');
                    element.classList.add(card.cssClass);
                } else {
                    element.classList.add('back');
                    this._paintItRed(element);
                    element.classList.remove(card.cssClass);
                }
                element.draggable = !!card.isDraggable;
                element.animate(stage2, options).onfinish = () => res();
            }
        });
    }

    _rebuildPileDOM(pile) {
        if (!pile) return;
        const pileDOM = this.getDOM(pile);
        /* WebOS guard: a drop can name a pile this renderer has no element
           for (window closed, state out of sync) — skip rather than throw
           inside an animation callback. */
        if (!pileDOM) return;
        const truthPile = this._getCorrectPileState(pile);
        this.removeAllChildren(pileDOM);
        if (!truthPile.isEmpty) {
            truthPile.stack.forEach(card => {
                pileDOM.append(this.decorateCardWithPile(this._makeCardElement(card), pile));
            });
        }
        return pileDOM;
    }

    _getCorrectPileState(pile) {
        switch (Pile.FromSnapshot(pile).name) {
            case Deck.name:
                return Deck.FromSnapshot(pile);
            case Tableau.name:
                return Tableau.FromSnapshot(pile);
            case Foundation.name:
                return Foundation.FromSnapshot(pile);
            case Waste.name:
                return Waste.FromSnapshot(pile);
            default:
                return Pile.FromSnapshot(pile);
        }
    }

    _addCard(toElem, card, ...additional_class) {
        const cardEl = this._makeCardElement(card, ...additional_class);
        toElem.append(cardEl);
        return cardEl;
    }

    async _animateMoveElement(element, fromElement, toElement, speed) {
        const elementRect = element.getBoundingClientRect();
        const fromRect = fromElement ? fromElement.getBoundingClientRect() : elementRect;
        const toRect = toElement.getBoundingClientRect();
        let initialTop = fromRect.top;
        let initialLeft = fromRect.left;
        element.style.zIndex = 50;
        const deltaX = toRect.left - initialLeft;
        const deltaY = toRect.top - initialTop;
        let keyframes = [
            { transform: 'translate(0,0)' },
            { transform: `translate(${deltaX}px, ${deltaY}px)` }
        ];
        const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
        const duration = (distance / speed) * 1000; // convert to ms
        let options = { duration, fill: 'forwards' };
        return await new Promise(res => {
            element.animate(keyframes, options).onfinish = () => {
                element.style = '';
                res();
            };
        });
    };

    _makeCardElement(card, ...additional_class) {
        const cardEl = document.createElement('div');
        cardEl.classList.add('card', 'large');
        if (card.faceUp) {
            cardEl.classList.add(card.cssClass);
        } else {
            cardEl.classList.add('back');
            this._paintItRed(cardEl)
        }

        if (card.isDraggable) {
            cardEl.draggable = true;
        } else {
            cardEl.draggable = false;
        }
        if (additional_class.length) {
            cardEl.classList.add(...additional_class);
        }
        return cardEl;
    }

    _repaintDraggedImage(cls) {
        if (!this.gameDOM.dragElement) console.error('Drag element not found');
        for (let child of this.gameDOM.dragElement.children) {
            child.classList.remove('invalid');
            child.classList.remove('valid');
            child.classList.add(cls);
        }
    }

    _repaintDragoverPiles(cls, { overPile }) {
        //if (!this.gameDOM.dragElement) return;
        if (!this.feedbackDragOver) return;
        const pileElement = this.getDOM(overPile);
        if (this.gameDOM.lastPaintedFeedack && this.gameDOM.lastPaintedFeedack !== pileElement) {
            this._removeDragOverFeedback();
        }

        if (pileElement.childElementCount) {
            const firstFaceUpCard = Card.FromSnapshot(overPile.stack.find(card => !!(card & 1)));
            for (let child of pileElement.children) {
                child.classList.add('feedback', cls);
                if (child === pileElement.lastElementChild) child.classList.add('pile-end');
                if (child.classList.contains(firstFaceUpCard.cssClass)) child.classList.add('pile-head');
            }
        } else {
            pileElement.classList.add(cls, 'feedback')
        }
        this.gameDOM.lastPaintedFeedack = pileElement;
    }

    _dragUpdate({ x, y }) {
        if (!this.gameDOM.dragElement) return;
        this.gameDOM.dragElement.style.left = `${x - 65}px`;
        this.gameDOM.dragElement.style.top = `${y - 59}px`;
    }

    _removeDragOverFeedback() {
        if (this.feedbackDragOver) {
            // remove all feedback classes from standing piles
            this.gameDOM.tableauxElements.forEach(tableau => {
                tableau.classList.remove('feedback', 'valid', 'invalid');
                if (tableau.childElementCount) {
                    for (let child of tableau.children) {
                        child.classList.remove('feedback', 'valid', 'invalid');
                    }
                }
            });
            this.gameDOM.foundationElements.forEach(foundation => {
                foundation.classList.remove('feedback', 'valid', 'invalid');
                if (foundation.childElementCount) {
                    for (let child of foundation.children) {
                        child.classList.remove('feedback', 'valid', 'invalid');
                    }
                }
            })
            if (this.gameDOM.lastPaintedFeedack) {
                this.gameDOM.lastPaintedFeedack.classList.remove('feedback', 'valid', 'invalid');
            }
        }
    }

    _removeDraggedFeedback() {
        if (this.feedbackDragged) {
            if (!this.gameDOM.dragElement) return;
            // remove all valid/invalid classes from the dragged pile
            for (let child of this.gameDOM.dragElement.children) {
                child.classList.remove('valid');
                child.classList.remove('invalid');
            }
        }
    }

    _paintItRed(elem){
        if(this.redDeck){
            elem.classList.add('red');
        }else{
            elem.classList.remove('red');
        }
    }

    _paintItAllRed(value=true){
        const backCards = document.querySelectorAll('.back');
        for(let elem of backCards){
            if(value)
                elem.classList.add('red');
            else
                elem.classList.remove('red');
        }
    }

    _renderLoadGameState({callback, ...piles}){
        this.startRendering();
        this.gameDOM.tableauxElements = piles.tableaux.map(tableau=>this._rebuildPileDOM(tableau));
        this.gameDOM.foundationElements = piles.foundations.map(foundation=>this._rebuildPileDOM(foundation));
        this.gameDOM.deckElement = this._rebuildPileDOM(piles.deck);
        this.gameDOM.wasteElement = this._rebuildPileDOM(piles.waste);
        if(callback) callback();
    }
}