/** 
 * abstract class for undoable actions. Actions that can be undone should be encapsulated as commands
**/
export class Command {
    async execute() {
        throw new Error("Method 'execute' must be implemented");
    }
    async undo() {
        throw new Error("Method 'undo' must be implemented");
    }
}