import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js" 
import { ControllerPanel } from "./controller_panel.js"
import { CGControllerNode } from "./controller_node.js"
import { create } from "./elements.js"

app.registerExtension({
	name: "cg.controller",

    /*
    Called when the graph has been configured (page load, workflow load).
    Here we:
    - ensure we have exactly one CGControllerNode, and that it corresponds to this workflow
    - create the ControllerPanel (*after* sorting the node, so it can read any reloaded properties)
    */
    async afterConfigureGraph() {
        // Delete the CGControllerNode if it isn't the right one
        if (CGControllerNode.instance) {
            if (app.graph._nodes_by_id[CGControllerNode.instance.id] != CGControllerNode.instance) {
                CGControllerNode.instance = undefined
            }
        }

        // Create the CGControllerNode if there isn't one already
        if (!CGControllerNode.instance) {
            app.graph.add( LiteGraph.createNode("CGControllerNode") )
        }

        new ControllerPanel()

        if (ControllerPanel.showing()) {
            app.ui.menuContainer.style.display = "none";
            app.ui.menuHamburger.style.display = "flex";
        }
    },

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

        // Don't draw the CGControllerNode
        const original_drawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            if (node.type=="CGControllerNode") return
            original_drawNode.apply(this, arguments);
        }

        const draw = LGraphCanvas.prototype.draw;
        LGraphCanvas.prototype.draw = function() {
            ControllerPanel.update()
            draw.apply(this,arguments);
        }

        // when the graph is cleared, hide the control panel
        api.addEventListener('graphCleared', ControllerPanel.hide) 


        function onStatus(exec_info) {
            if (ControllerPanel?.instance?.submit_button) {
                if (exec_info?.detail?.exec_info?.queue_remaining) ControllerPanel.instance.submit_button.disabled = true;
                else ControllerPanel.instance.submit_button.disabled = false;
            }
        }
        api.addEventListener('status', onStatus)
    },

    registerCustomNodes() {
        LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    }
})