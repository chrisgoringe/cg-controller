import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js" 
import { ControllerPanel } from "./controller_panel.js"
//import { CGControllerNode } from "./controller_node.js"   
import { create } from "./utilities.js"
import { add_controls } from "./controller_controls.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { UpdateController } from "./update_controller.js"
import { Debug } from "./debug.js"
import { BASE_PATH } from "./constants.js"
import { OnExecutedManager } from "./widget_change_manager.js"


function on_setup() {
    UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh, (node_id)=>{
        var interest = false
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            if (ControllerPanel.instances[k].node_blocks[node_id]) interest = true
        })
        return interest
    })  
    NodeInclusionManager.node_change_callback = UpdateController.make_request
    api.addEventListener('graphCleared', ControllerPanel.graph_cleared) 
    api.addEventListener('executed', OnExecutedManager.on_executed)
    api.addEventListener('executing', OnExecutedManager.on_executing)
    api.addEventListener('b_preview', OnExecutedManager.on_b_preview)
    window.addEventListener("resize", ControllerPanel.onWindowResize)
    window.addEventListener('mouseup', ControllerPanel.mouse_up_anywhere)


    const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        // get the basic options 
        const options = original_getCanvasMenuOptions.apply(this, arguments);
        options.push(null); // inserts a divider
        options.push({
            content: "New Controller",
            callback: async (_, e) => {
                ControllerPanel.create_new(e?.event)
            }
        })
        return options;
    }
    ControllerPanel.create_menu_icon()
}

app.registerExtension({
	name: "cg.controller",

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        /* This is now just for backward compatibility - we *remove* the ControllerNode and put the data in app.graph.extras */
        //CGControllerNode.remove()  

        ControllerPanel.new_workflow()
    },

    /* Called at the end of the application startup */
    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/controller.css` } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/slider.css` } )

        // Allow our elements to do any setup they want
        on_setup()

        // add to the canvas menu, and keyboard shortcuts
        add_controls()
    },

    async init() {
        const getExtraMenuOptions = LGraphNode.prototype.getExtraMenuOptions
        LGraphNode.prototype.getExtraMenuOptions = function(_, options) {
            getExtraMenuOptions?.apply(this, arguments);
            add_control_panel_options(options)
        }

        const onDrawTitle = LGraphNode.prototype.onDrawTitle
        LGraphNode.prototype.onDrawTitle = function (ctx) { 
            onDrawTitle?.apply(this,arguments)
            NodeInclusionManager.visual(ctx, this)
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
            UpdateController.node_change(this.id)
        }
        const onInputAdded = nodeType.prototype.onInputAdded
        nodeType.prototype.onInputAdded = function () {
            onInputAdded?.apply(this,arguments)
            UpdateController.node_change(this.id)
        }
        const onModeChange = nodeType.prototype.onModeChange
        nodeType.prototype.onModeChange = function () {
            onModeChange?.apply(this,arguments)
            UpdateController.node_change(this.id)
        }
    },

    async nodeCreated(node) {
        UpdateController.make_request("node_created", 20)
        const onRemoved = node.onRemoved
        node.onRemoved = function() {
            onRemoved?.apply(this, arguments)
            UpdateController.make_request("node_removed", 20)
        }

    },

    //registerCustomNodes() {
    //    LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    //}
})