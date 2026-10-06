/**
 * Abstract class for all game objects that contain data.
 * snapshot() -> must be implemented to properly serialize the state of data at the time of invoking
 * FromSnapshot() -> must return a valid instance of the object from the serialized snapshot
 */
export default class DataObject{
    snapshot(){
        throw new Error(`snapshot() method must be implemented`);
    }

    static FromSnapshot(snapshot){
        throw new Error(`static FromSnapshot(snapshot) method must be implemented`);
    }
}