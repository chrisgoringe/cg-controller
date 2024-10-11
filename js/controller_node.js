import { app } from "../../scripts/app.js"
/*
A custom node which doesn't do anything. Only still here for backward compatibility with workflows saved before v0.6
*/

export class CGControllerNode extends LiteGraph.LGraphNode {
    instance = undefined
    constructor() {
        super("CGControllerNode")
        CGControllerNode.instance = this
    }

    static remove() {
        if (CGControllerNode.instance) {
            app.graph.remove(CGControllerNode.instance)
            CGControllerNode.instance = undefined
        }
    }

}