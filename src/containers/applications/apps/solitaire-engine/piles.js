import Card from "./card.js";
import DataObject from "./dataObject.js";

export class Pile extends DataObject {
    constructor() {
        super();
        this.stack = [];
        this.snapshot = this.snapshot.bind(this);
        this.mayAcceptDrop = false;
        this.idx = null;
    }
    get topCard() {
        if (this.stack.length)
            return this.stack[this.stack.length - 1];
    }

    get bottomCard() {
        if (this.stack.length)
            return this.stack[0];
    }

    getCardAt(idx) {
        if (this.stack.length > idx && idx > -1)
            return this.stack[idx];
        return null;
    }

    getCardIdx(card) {
        if (!card instanceof Card)
            return null;
        return this.stack.findIndex(c => c.value == card.value && c.suit.value == card.suit.value);
    }

    get isEmpty() {
        return !this.stack.length;
    }

    removeTopCard() {
        if (this.topCard) {
            if(this.topCard.isDraggable){
                return this.stack.pop();
            }
            this.topCard.isDraggable = false;
            return this.stack.pop();
        }

    }

    addCard(card) {
        card.isDraggable = true;
        this.stack.push(card);
    }

    allowDrop() {
        return false;
    }

    empty() {
        this.stack = [];
    }

    snapshot() {
        return {
            stack: this.stack.map(card => card.snapshot()),
            idx: this.idx,
            name: Pile.name
        };
    }

    static FromSnapshot(snapshot) {
        const pile = new this();    // yep... that's js alright...
        pile.stack = snapshot.stack.map(value => {
            const c = Card.FromSnapshot(value)
            c.isDraggable = false;
            return c;
        });
        pile.idx = snapshot.idx;
        pile.name = snapshot.name;
        return pile;
    }
}

export class Tableau extends Pile {
    constructor(i) {
        super();
        this.mayAcceptDrop = true;
        this.idx = i;
    }

    addCard(card) {
        card.isDraggable = !!card.faceUp;
        this.stack.push(card);
    }

    static FromSnapshot(snapshot) {
        const pile = new this();
        pile.stack = super.FromSnapshot(snapshot).stack.map(card => (card.isDraggable = !!card.faceUp, card));
        pile.idx = snapshot.idx;
        return pile;
    }

    snapshot() {
        const snap = super.snapshot();
        snap.name = Tableau.name;
        return snap;
    }

    revealTopCard() {
        if (this.topCard) {
            this.topCard.faceUp = true;
            this.topCard.isDraggable = true;
        }
    }

    hideTopCard() {
        if(this.topCard){
            this.topCard.faceUp = false;
            this.topCard.isDraggable = false;
        }
    }

    allowDrop(pileOrCard) {
        if (pileOrCard instanceof Card) {
            if (!this.stack.length) return pileOrCard.value == 13 && pileOrCard.faceUp;
            return !!((Card.toInteger(pileOrCard) ^ Card.toInteger(this.topCard)) >> 1 & 1)
                && this.topCard.value - pileOrCard.value === 1
                && !!this.topCard.faceUp
                && !!pileOrCard.faceUp;
        } else {
            if (!this.stack.length) return pileOrCard.bottomCard.value == 13 && pileOrCard.bottomCard.faceUp;
            const bottomCard = pileOrCard.bottomCard;
            return !!((Card.toInteger(bottomCard) ^ Card.toInteger(this.topCard)) >> 1 & 1)
                && (this.topCard.value - bottomCard.value == 1)
                && !!this.topCard.faceUp
                && !!bottomCard.faceUp;
        }
    }
}

export class Waste extends Pile {
    static FromSnapshot(snapshot) {
        const waste = new this();
        waste.stack = super.FromSnapshot(snapshot).stack;
        if (waste.topCard) waste.topCard.isDraggable = true;
        return waste;
    }

    snapshot() {
        const snap = super.snapshot();
        snap.name = Waste.name;
        return snap;
    }

    addCard(card) {
        if (this.stack.length)
            this.topCard.isDraggable = false;
        card.isDraggable = true;
        card.faceUp = true;
        this.stack.push(card);
    }

    removeTopCard() {
        const card = this.stack.pop();
        if (this.stack.length)
            this.topCard.isDraggable = true;
        return card;
    }
}

export class Foundation extends Pile {
    constructor(i) {
        super();
        this.mayAcceptDrop = true;
        this.idx = i;
    }

    static FromSnapshot(snapshot) {
        const pile = new this();
        pile.stack = super.FromSnapshot(snapshot).stack;
        if (pile.topCard)
            pile.topCard.isDraggable = true;
        pile.idx = snapshot.idx;
        return pile;
    }

    snapshot() {
        const snap = super.snapshot();
        snap.name = Foundation.name;
        return snap;
    }

    addCard(card) {
        if (this.stack.length)
            this.topCard.isDraggable = false;
        card.isDraggable = true;
        card.faceUp = true;
        this.stack.push(card);
    }

    removeTopCard() {
        const card = this.stack.pop();
        if (this.stack.length) {
            this.topCard.isDraggable = true;
            this.topCard.faceUp = true;
        }
        return card;
    }

    allowDrop(pile) {
        if (pile.stack.length > 1)
            return false;
        if (this.isEmpty && pile.topCard.value == 1)
            return true;
        if (!this.isEmpty && pile.topCard.value == this.topCard.value + 1)
            return !!(this.topCard.suit.value == pile.topCard.suit.value);
    }

    get isFull() {
        return this.stack.length === 13;
    }
}

export class Deck extends Pile {
    constructor() {
        super();
        this.shuffle = this.shuffle.bind(this);
    }

    generateCards() {
        // create 52 cards and store them
        for (let i = 0; i < 52; i++) {
            this.addCard(Card.fromInteger(((i % 13) << 3) | (i % 4) << 1));
        }
        this.isShuffled = false;
    }

    addCard(card) {
        card.faceUp = false;
        super.addCard(card);
    }

    snapshot() {
        const snap = super.snapshot();
        snap.isShuffled = this.isShuffled;
        snap.name = Deck.name;
        return snap;
    }

    static FromSnapshot(snapshot) {
        const deck = new this();
        deck.stack = super.FromSnapshot(snapshot).stack;
        deck.isShuffled = snapshot.isShuffled;
        return deck;
    }

    shuffle() {
        let currentIndex = this.stack.length, tempValue, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            tempValue = this.stack[currentIndex];
            this.stack[currentIndex] = this.stack[randomIndex];
            this.stack[randomIndex] = tempValue;
        }
        this.isShuffled = true;
    }

    get isFull() {
        return this.stack.length === 52;
    }
}