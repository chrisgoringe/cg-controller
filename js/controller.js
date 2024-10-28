import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"
import { CGControllerNode } from "./controller_node.js"   
import { create, create_deep } from "./utilities.js"
import { add_controls } from "./controller_controls.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { UpdateController } from "./update_controller.js"
import { Debug } from "./debug.js"
import { settings } from "./settings.js"
import { BASE_PATH } from "./constants.js"

app.registerExtension({
	name: "cg.controller",

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        /* This is now just for backward compatibility - we *remove* the ControllerNode and put the data in app.graph.extras */
        CGControllerNode.remove()  
        //new ControllerPanel()
        //ControllerPanel.instance.hide()

        app.graph._nodes.forEach((node)=>{
            node.widgets?.forEach((widget)=>{
                if (widget.type=='customtext') {
                    const ondraw = widget.options.onDraw
                    widget.options.onDraw = function (widget) {
                        if (ControllerPanel.overlapsWith(widget.element)) {
                            widget.element.style.setProperty("z-index", "auto", "important")
                        } 
                        ondraw?.apply(this, arguments)
                    }
                }
            })
        })
    },

    /* Called at the end of the application startup */
    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/controller.css` } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/slider.css` } )

       

        // Allow our elements to do any setup they want
        ControllerPanel.on_setup()

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

    registerCustomNodes() {
        LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    }
})