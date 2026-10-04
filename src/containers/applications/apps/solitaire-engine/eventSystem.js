/** Singleton
 * 
 * EventSystem is used to decouple game-logic from DOM manipulation. 
 * Commands should notify the event system by triggering relevant events.
 * DOM manipulators should add listeners for their relevant events, perform DOM manipulation then callback. 
 * Commands should use Promises to ensure DOM manipulation is complete before proceeding (i.e. provide their resolve as callback when triggering events).
 */
class EventSystem {
    constructor(saveHistory=false) {
        if (EventSystem.instance) {
            return EventSystem.instance;
        }
        this.listeners = {};
        this.eventDataHistory={};
        this.saveHistory = saveHistory;
        EventSystem.instance = this;
    }

    listen(eventName, callback) {
        if (!this.listeners[eventName])
            this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    }

    trigger(eventName, eventData) {
        if (this.listeners[eventName])
            for (let callback of this.listeners[eventName]) {
                callback(eventData);
            }
        if(this.saveHistory){
            if(!this.eventDataHistory[eventName])
                this.eventDataHistory[eventName] = [];
            this.eventDataHistory[eventName].push({
                eventData,
                time:Date.now()
            })
        }
    }
    remove(eventName, cb) {
        if (this.listeners[eventName])
            try {
                const idx = this.listeners[eventName].findIndex((c) => c === cb);
                if(idx >=0){
                    this.listeners[eventName].splice(idx, 1);
                }
            } catch (e) {
                console.log(e);
            }
    }

}

const eventSystem = new EventSystem();
export default eventSystem;