import { app } from "../../scripts/app.js";
import { ControllerPanel } from "./controller_panel.js"
import { CGControllerNode } from "./controller_node.js"
import { create } from "./elements.js";

app.registerExtension({
	name: "cg.controller",

    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':'extensions/cg-controller/controller.css' } )

        // Add our items to the canvas menu
        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null);
            options.push({
                content: ControllerPanel.showing() ? "Update Controller Panel" : "Show Controller Panel",
                callback: () => ControllerPanel.show()
            })
            if (ControllerPanel.showing()) {
                options.push({
                    content: "Hide Controller Panel",
                    callback: () => ControllerPanel.hide()
                })                
            }
            return options
        }

        // Create the panel
        if (!ControllerPanel.instance) new ControllerPanel()

        // Create the CGControllerNode if there isn't one already
        if (!CGControllerNode.instance) {
            app.graph.add( LiteGraph.createNode("CGControllerNode") )
        }
        
        // Don't draw the CGControllerNode - instead, update the ControllerPanel
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            if (node.type=="CGControllerNode") { 
                ControllerPanel.update()
                return
            }
            original_drawNode.apply(this, arguments);
        }
    },

    registerCustomNodes() {
        LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    }
})