import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js" 
import { ControllerPanel } from "./controller_panel.js"
import { CGControllerNode } from "./controller_node.js"   // TODO42
import { create } from "./elements.js"
import { add_controls } from "./controller_controls.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { UpdateController } from "./update_controller.js"

app.registerExtension({
	name: "cg.controller",

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        /* create a CGController node unless one has been loaded with the workflow, and then create the panel */
        /* This is now just for backward compatibility - we *remove* the ControllerNode and put the data in app.graph.extras */
        CGControllerNode.create()  // TODO42
        new ControllerPanel()

        /* If the panel is showing (because we reloaded a workflow in which it was), and in the old style, hide the main menu */
        if (ControllerPanel.showing() && app.ui.settings.getSettingValue('Comfy.UseNewMenu', "Disabled")=="Disabled") {
            app.ui.menuContainer.style.display = "none";
            app.ui.menuHamburger.style.display = "flex";
        }
    },

    /* Called at the end of the application startup */
    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':'extensions/cg-controller/controller.css' } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':'extensions/cg-controller/slider.css' } )

        // Allow our elements to do any setup they want
        ControllerPanel.on_setup()

        // when the graph is cleared, hide the control panel
        api.addEventListener('graphCleared', ControllerPanel.hide) 

        // add to the canvas menu, and keyboard shortcuts
        add_controls()

    },

    async nodeCreated(node) {
        const original_onDrawTitleBar = node.onDrawTitleBar;
        node.onDrawTitleBar = function(ctx, title_height, node_size) {
            original_onDrawTitleBar?.apply(this, arguments);
            NodeInclusionManager.visual(ctx, node, title_height, node_size)
        }
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            getExtraMenuOptions?.apply(this, arguments);
            add_control_panel_options(options)
        }

        // request an update if an input is added or removed 
        const onInputRemoved = nodeType.prototype.onInputRemoved
        nodeType.prototype.onInputRemoved = function () {
            onInputRemoved?.apply(this,arguments)
            UpdateController.make_request()
        }
        const onInputAdded = nodeType.prototype.onInputAdded
        nodeType.prototype.onInputAdded = function () {
            onInputAdded?.apply(this,arguments)
            UpdateController.make_request()
        }

    },

/* remove in TODO42 */
    registerCustomNodes() {
        LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    }
})