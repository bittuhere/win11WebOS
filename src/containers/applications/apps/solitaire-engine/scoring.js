import eventSystem from './eventSystem.js';
import { Foundation, Tableau } from './piles.js';


export default class Scoring {
    constructor(scoringSchema = {}) {
        
        this.configureScoring = this.configureScoring.bind(this);
        this.onGameInitialized = this.onGameInitialized.bind(this);
        this.onGameEnded = this.onGameEnded.bind(this);
        this.attachListeners = this.attachListeners.bind(this);
        this.removeListeners = this.removeListeners.bind(this);
        this.onFlipCard = this.onFlipCard.bind(this);
        this.onMoveCards = this.onMoveCards.bind(this);
        this._updateScore = this._updateScore.bind(this);

        // we'll always listen to these 2 to set a flag according to game settings and either attach or remove the other listeners
        eventSystem.listen('game-initialized', this.onGameInitialized);
        eventSystem.listen('game-ended', this.onGameEnded);

        this.configureScoring(scoringSchema);
    }

    configureScoring({
        moveToFoundation = 10,
        wasteToTableau = 5,
        flippedAtTableau = 5,
        foundationToTableau = -15,
        passThruDeck = {} = {
            1: {} = {
                after: 1,
                score: -100
            },
            3: {} = {
                after: 4,
                score: -20
            }
        }
    } = {}) {
        this.schema = {};
        this.schema.moveToFoundation = moveToFoundation;
        this.schema.wasteToTableau = wasteToTableau;
        this.schema.flippedAtTableau = flippedAtTableau;
        this.schema.foundationToTableau = foundationToTableau;
        this.schema.passThruDeck = passThruDeck;
    }

    attachListeners() {
        eventSystem.listen('move-cards', this.onMoveCards);
        eventSystem.listen('flip-top-card-at-pile',this.onFlipCard);
    }

    removeListeners() {
        eventSystem.remove('move-cards', this.onMoveCards);
        eventSystem.remove('flip-top-card-at-pile',this.onFlipCard);
    }

    onGameInitialized(data) {
        // We'll not allow for scoring if undo's are turned on
        this.keepScore = data.settings.thoughtfulSol ? false : data.settings.scoring;
        this.removeListeners();
        if (this.keepScore) {
            this.attachListeners();
        }
        this.currentPassThru = 0;
        this.difficultyKey = data.settings.difficulty;
        this.score = 0;
    }



    onGameEnded(data) {

    }

    onMoveCards({ action, cardsPile, fromPile, toPile }) {
        let updateScore = false;
        let previousScore = this.score;
        switch (action.toLowerCase()) {
            case 'collect-waste':
                this.currentPassThru++;
                if (this.currentPassThru >= this.schema.passThruDeck[this.difficultyKey].after) {
                    this._updateScore(this.schema.passThruDeck[this.difficultyKey].score);
                    updateScore = true;
                }
                break;
            case 'user-action':
                // we need to discriminate: waste-to-tableau, any-to-foundation, foundation-to-tableau
                if (toPile.name === Foundation.name) {
                    this._updateScore(this.schema.moveToFoundation);
                    updateScore = true;
                } else if (toPile.name === Tableau.name) {
                    if (fromPile.name === Waste.name) {
                        this._updateScore(this.schema.wasteToTableau);
                        updateScore = true;
                    } else if (fromPile.name === Foundation.name) {
                        this._updateScore(this.schema.foundationToTableau);
                        updateScore = true;
                    }
                }
                break;
        }
        if (updateScore) {
            eventSystem.trigger('score-updated', {
                action: 'scoring-system',
                currentScore: this.score,
                prevScore: previousScore,
            });
        }
    }

    onFlipCard({ action, pile }) {
        if (action.toLowerCase() === "user-action"
            && pile.name === Tableau.name) {
            const previousScore = this.score;
            this._updateScore(this.schema.flippedAtTableau);
            eventSystem.trigger('score-updated', {
                action: 'scoring-system',
                currentScore: this.score,
                prevScore: previousScore,
            });
        }
    }

    _updateScore(value) {
        this.score  = Math.max(0, this.score + Number(value));
    }

}