import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";

/*
A custom node which just has properties that can be used to store anything the ControllerPanel wants, and which will be saved
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
}