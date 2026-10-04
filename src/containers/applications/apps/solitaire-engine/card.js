import DataObject from "./dataObject.js";

// Define the suits
export const SUITS = {
    CLUBS: { name: 'clubs', value: 0, symbol: '♣' },
    HEARTS: { name: 'hearts', value: 1, symbol: '♥' },
    SPADES: { name: 'spades', value: 2, symbol: '♠' },
    DIAMONDS: { name: 'diamonds', value: 3, symbol: '♦' }
};

// Define the face values as a simple object
export const FACE_VALUES = {
    1: 'A',
    11: 'J',
    12: 'Q',
    13: 'K'
};

export default class Card extends DataObject{
    isDraggable;
    constructor(value, suit, faceUp = false) {
        super();
        // Check for valid value
        if (value < 1 || value > 13)
            throw new Error(`Invalid card value: ${value}`);

        // Check for valid suit
        suit = suit.toUpperCase();
        if (!SUITS.hasOwnProperty(suit)) {
            suit = Object.keys(SUITS).find(el => el.startsWith(suit));
            if (!SUITS.hasOwnProperty(suit))
                throw new Error(`Invalid suit: ${suit}`);
        }

        this.value = value;
        this.suit = SUITS[suit];
        this.faceUp = !!faceUp;
        this.snapshot = this.snapshot.bind(this);
    }

    snapshot(){
        return Card.toInteger(this);
    }

    static FromSnapshot(value){
        return Card.fromInteger(value);
    }

    // Static methods to create Card objects in different ways than the constructor, also to convert back
    static fromInteger(val) {
        if (val < 0 || val > 127)
            throw new Error(`To create Card from a single integer, value(${val}) must be between 0 and 127`);
        return new Card((val >> 3) + 1, Object.keys(SUITS)[(val>>1) & 3],val & 1);
    }

    static toInteger(card) {
        return ((card.value - 1) << 3 | card.suit.value << 1 | card.faceUp);
    }

    static fromCssClass(cssClass) {
        let suit = cssClass.substring(0, 1);
        let val = cssClass.substring(1);
        val = Number.isNaN(parseInt(val)) ? Object.keys(FACE_VALUES).find(key => FACE_VALUES[key] === val.toUpperCase()) : parseInt(val);
        return new Card(val, suit,true);
    }

    static toCssClass(card) {
        return `${card.suit.name[0]}${card.value in FACE_VALUES ? FACE_VALUES[card.value] : `${card.value}`.padStart(2, '0')}`;
    }

     toString() {
         let valString = this.value in FACE_VALUES ? FACE_VALUES[this.value] : `${this.value}`.padStart(2, '0');
         return `${this.suit.symbol}${valString}`;
     }

    get cssClass() {
        return Card.toCssClass(this);
    }

    flip() {
        this.faceUp = !this.faceUp;
    }
}