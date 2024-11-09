import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js" 
import { ControllerPanel } from "./controller_panel.js"
//import { CGControllerNode } from "./controller_node.js"   
import { create, defineProperty } from "./utilities.js"
import { add_controls } from "./controller_controls.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { UpdateController } from "./update_controller.js"
import { Debug } from "./debug.js"
import { BASE_PATH } from "./constants.js"
import { ImageManager } from "./image_manager.js"
import { global_settings } from "./settings.js"
import { NodeBlock } from "./nodeblock.js"

const MINIMUM_UE = 500006
async function check_ue() {
    try {
        let ue = await import("../cg-use-everywhere/ue_debug.js")
        if (!ue.version || ue.version < MINIMUM_UE) {
            alert("A warning from Comfy Controller\n\n" + 
                  "The version of Use Everywhere nodes that you have installed is not compatible with Comfy Controller or newer version of the Comfy UI.\n\n"+
                  "You should update to the latest version of Use Everywhere (which is much improved anyway!) to avoid problems.\n\n" +
                  "You can do this through the manager, or manually by going into the custom_nodes/cg-use-everywhere directory and typing 'git pull'.")
        }
    } catch (e) {
        Debug.extended("Use Everywhere nodes not installed")
    }
}

function on_setup() {
    UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh)  
    NodeInclusionManager.node_change_callback = UpdateController.make_request
    api.addEventListener('graphCleared', ControllerPanel.graph_cleared) 

    api.addEventListener('executed', ImageManager.on_executed)
    api.addEventListener('execution_start', ImageManager.on_execution_start)
    api.addEventListener('executing', ImageManager.on_executing)
    api.addEventListener('b_preview', ImageManager.on_b_preview)

    api.addEventListener('progress', ControllerPanel.on_progress)
    api.addEventListener('executing', ControllerPanel.on_executing)

    window.addEventListener("resize", ControllerPanel.onWindowResize)
    window.addEventListener('mouseup', ControllerPanel.mouse_up_anywhere)
    window.addEventListener('mousemove', ControllerPanel.mouse_move_anywhere)


    const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        // get the basic options 
        const options = original_getCanvasMenuOptions.apply(this, arguments);
        if (!global_settings.hidden) {
            options.push(null); // inserts a divider
            options.push({
                content: "New Controller",
                callback: async (_, e) => {
                    ControllerPanel.create_new(e?.event)
                }
            })
        }
        return options;
    }
    ControllerPanel.create_menu_icon()
}

app.registerExtension({
	name: "cg.controller",

    async beforeConfigureGraph() {
        UpdateController.configuring(true)
    },

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        UpdateController.configuring(false)
        try {
            ImageManager.init()
            ControllerPanel.new_workflow()
        } catch (e) {
            console.error(e)
        } 
    },

    /* Called at the end of the application startup */
    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/controller.css` } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':`${BASE_PATH}/slider.css` } )

        // Allow our elements to do any setup they want
        try {
        on_setup()
        } except (e) { Debug.error("on setup");console.error(e) }

        // add to the canvas menu, and keyboard shortcuts
        try {
        add_controls()
        } except (e) { Debug.error("add controls");console.error(e) }

        try {
            const on_change = app.graph.on_change
            app.graph.on_change = function () {
                try {
                    on_change?.apply(this,arguments)
                    UpdateController.request_when_gap(100, 'on_change')
                } catch (e) {
                    Debug.error("*** EXCEPTION HANDLING on_change")
                    console.error(e)
                }
            }
            Debug.trivia("*** in setup, ADDED on_change")
        } catch (e) {
            Debug.error("*** EXCEPTION ADDING on_change")
            console.error(e)
        }

        const draw = app.canvas.onDrawForeground;
        app.canvas.onDrawForeground = function(ctx, visible) {
            draw?.apply(this,arguments);
            NodeBlock.on_draw(ctx);
        }

        try {
            app.canvas.__read_only = app.canvas.read_only
            defineProperty(app.canvas, "read_only", {
                get: ()=>{return app.canvas.__read_only},
                set: (v)=>{app.canvas.__read_only = v; UpdateController.make_request("read_only") }
            })
        } catch (e) {
            Debug.error("in setup")
            console.error(e)
        }

        /* look for dialog boxes appearing or disappearing */
        new MutationObserver((mutations)=>{
            var need_update = ""
            mutations.forEach((mutation)=>{
                mutation.addedNodes.forEach((n)=>{
                    if (n.classList?.contains?.('p-dialog-mask')) need_update = "dialog added"
                })
                mutation.removedNodes.forEach((n)=>{
                    if (n.classList?.contains?.('p-dialog-mask')) need_update = "dialog removed"
                })
            })
            if (need_update != "") UpdateController.make_request(`mutation: ${need_update}`)
        }).observe(document.body, {"childList":true})

        /* look for focus mode start or stop */
        new MutationObserver((mutations)=>{
            var focus_change = false 
            mutations.forEach((mutation)=>{
                mutation.addedNodes.forEach((n)=>{
                    if (n.$pc?.name == "Splitter") focus_change = true
                })
                mutation.removedNodes.forEach((n)=>{
                    if (n.$pc?.name == "Splitter") focus_change = true
                })
            })
            if (focus_change) ControllerPanel.focus_mode_changed()
        }).observe(document.getElementsByClassName('graph-canvas-container')[0], {"childList":true})

        check_ue()
    },

    async refreshComboInNodes() {
        UpdateController.make_request('refreshComboInNodes')
        UpdateController.make_request('refreshComboInNodes delayed',1000)        
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
            ControllerPanel.node_change(this.id)
        }
        const onInputAdded = nodeType.prototype.onInputAdded
        nodeType.prototype.onInputAdded = function () {
            onInputAdded?.apply(this,arguments)
            ControllerPanel.node_change(this.id)
        }
        const onModeChange = nodeType.prototype.onModeChange
        nodeType.prototype.onModeChange = function () {
            onModeChange?.apply(this,arguments)
            ControllerPanel.node_change(this.id)
        }
    },

    async nodeCreated(node) {
        
        const onRemoved = node.onRemoved
        node.onRemoved = function() {
            onRemoved?.apply(this, arguments)
            UpdateController.make_request("node_removed", 20)
        }

        const onDrawForeground = node.onDrawForeground
        node.onDrawForeground = function() {
            onDrawForeground?.apply(this,arguments)

            if (node._controller_imgs !== node.imgs && node.imgs && node.imgs.length>0) {
                ImageManager.node_img_change(node)
            }
            node._controller_imgs = node.imgs

            //bgcolor gets changed all the time
            //if (node._controller_bgcolor !== node.bgcolor) {
            //    ControllerPanel.node_change(node.id)
            //}
            //node._controller_bgcolor = node._controller_bgcolor

        }

        UpdateController.make_request_unless_configuring("node_created", 20)
    },

})