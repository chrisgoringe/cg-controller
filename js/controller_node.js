import { app } from "../../scripts/app.js"
/*
A custom node which doesn't do anything.
Exists as a repository for properties that will be saved with the graph.
*/

export class CGControllerNode extends LiteGraph.LGraphNode {
    isVirtualNode     = true
    serialize_widgets = true
    instance          = undefined
    constructor() {
        super("CGControllerNode")
        if (!this.properties) this.properties = { }
        CGControllerNode.instance = this
    }

    static create() {
        if (CGControllerNode.instance) {
            if (app.graph._nodes_by_id[CGControllerNode.instance.id] != CGControllerNode.instance) {
                CGControllerNode.instance = undefined
            }
        }
        if (!CGControllerNode.instance) { app.graph.add( LiteGraph.createNode("CGControllerNode") ) }
    }

    static on_setup() {
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            if (node.type=="CGControllerNode") return
            original_drawNode.apply(this, arguments);
        }
    }
}