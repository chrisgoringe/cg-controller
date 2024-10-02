import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";

/*
A custom node which just has properties that can be used to store anything the ControllerPanel wants
*/

export class CGControllerNode extends LiteGraph.LGraphNode {
    isVirtualNode     = true
    serialize_widgets = true
    instance = undefined
    constructor() {
      super("CGControllerNode")
      if (!this.properties) this.properties = { }
      //ComfyWidgets.STRING( this, '', ['', { default: this.properties.text, multiline: true }], app )
      CGControllerNode.instance = this
    }
}