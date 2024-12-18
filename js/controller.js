import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js" 
import { ControllerPanel } from "./controller_panel.js"
import { create, mouse_change, send_graph_changed } from "./utilities.js"
import { OPTIONS } from "./options.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { OnChangeController, UpdateController } from "./update_controller.js"
import { Debug } from "./debug.js"
import { BASE_PATH, SettingIds, Timings } from "./constants.js"
import { ImageManager } from "./image_manager.js"
import { global_settings } from "./settings.js"
import { FancySlider } from "./input_slider.js"
import { WindowResizeManager } from "./snap_manager.js"
import { Highlighter } from "./highlighter.js"
import { GroupManager } from "./groups.js"
import { NodeBlock } from "./nodeblock.js"
import { ImagePopup } from "./image_popup.js"
import { pim } from "./prompt_id_manager.js"

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

function stop_event(e) {
    e.preventDefault()
    e.stopImmediatePropagation()
    return false
}

function on_setup() {
    UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh, ControllerPanel.node_change)
    NodeInclusionManager.node_change_callback = UpdateController.make_request
    GroupManager.change_callback = ControllerPanel.on_group_details_change
    ImageManager.node_image_change = ControllerPanel.node_image_change
    
    api.addEventListener('graphCleared', ControllerPanel.on_graphCleared) 

    api.addEventListener('executed', ImageManager.on_executed)
    api.addEventListener('executed', pim.on_executed)
    api.addEventListener('execution_start', ImageManager.on_execution_start)
    api.addEventListener('executing', ImageManager.on_executing)
    api.addEventListener('b_preview', ImageManager.on_b_preview)

    api.addEventListener('progress', ControllerPanel.on_progress)
    api.addEventListener('executing', ControllerPanel.on_executing)

    api.addEventListener('executing', OnChangeController.on_executing)

    window.addEventListener("resize", WindowResizeManager.onWindowResize)
    window.addEventListener('mousedown', (e)=>{
        mouse_change(true)
        if (e.button==2) e.target.handle_right_click?.(e)
    })
    window.addEventListener('mouseup', (e)=>{
        mouse_change(false)
        ControllerPanel.handle_mouse_up(e)
        FancySlider.handle_mouse_up(e)
    })
    window.addEventListener('click', (e)=>{
        ImagePopup.handle_click(e)
    })
    window.addEventListener('mousemove', (e)=>{
        ControllerPanel.handle_mouse_move(e)
        FancySlider.handle_mouse_move(e)
        NodeBlock.handle_mouse_move(e)
    })
    window.addEventListener('contextmenu', (e)=>{
        if (e.target.handle_right_click) return stop_event(e);
    })
    window.addEventListener('keypress', (e) => {
        if (e.target.tagName=="CANVAS" || e.target.tagName=="BODY") {
            const keysetting = app.ui.settings.getSettingValue(SettingIds.KEYBOARD_TOGGLE, "C") 
            if (keysetting==e.key) {
                ControllerPanel.toggle()
                e.preventDefault()
                e.stopImmediatePropagation()
                return false
            }
        }
    })


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

const active = true
if (active) {

app.registerExtension({
	name: "cg.controller",
    settings: OPTIONS,

    async beforeConfigureGraph() {
        UpdateController.configuring(true)
    },

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        UpdateController.configuring(false)
        try {
            ControllerPanel.new_workflow()
            ImageManager.analyse_graph()
            ImageManager.send_all()
            send_graph_changed(true)
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
        } catch (e) { Debug.error("on setup", e) }

        try {
            const onAfterChange = app.graph.onAfterChange
            app.graph.onAfterChange = function () {
                try {
                    onAfterChange?.apply(this,arguments)
                    OnChangeController.on_change('graph.onAfterChange')
                } catch (e) {
                    Debug.error("onAfterChange", e)
                }
            }
        } catch (e) {
            Debug.error("ADDING onAfterChange", e)
        }

        const draw = app.canvas.onDrawForeground;
        app.canvas.onDrawForeground = function(ctx, visible) {
            draw?.apply(this,arguments);
            try {
                Highlighter.on_draw(ctx);
            } catch (e) {
                Debug.error('onDrawForeground', e)
            }
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

        const queuePrompt = api.queuePrompt
        api.queuePrompt = async function() {
            const r = await queuePrompt.apply(api, arguments)
            pim.add(r.prompt_id)
            return r
        }

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
        nodeType.prototype.__controller_tooltips = {}
        Object.values(nodeData.input).forEach((list)=>{
            Object.keys(list).filter((k)=>(list[k].length>1 && list[k][1].tooltip)).forEach((k)=>{
                nodeType.prototype.__controller_tooltips[k] = list[k][1].tooltip
            })
        })

        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            getExtraMenuOptions?.apply(this, arguments);
            add_control_panel_options(options)
        }

        // request an update if an input is added or removed 
        const onInputRemoved = nodeType.prototype.onInputRemoved
        nodeType.prototype.onInputRemoved = function () {
            onInputRemoved?.apply(this,arguments)
            ControllerPanel.node_change(this.id, "onInputRemoved")
        }
        const onInputAdded = nodeType.prototype.onInputAdded
        nodeType.prototype.onInputAdded = function () {
            onInputAdded?.apply(this,arguments)
            ControllerPanel.node_change(this.id, "onInputAdded")
            app.graph.afterChange()
        }
        const onOutputRemoved = nodeType.prototype.onOutputRemoved
        nodeType.prototype.onOutputRemoved = function () {
            onOutputRemoved?.apply(this,arguments)
            ControllerPanel.node_change(this.id, "onOutputRemoved")
        }
        const onOutputAdded = nodeType.prototype.onOutputAdded
        nodeType.prototype.onOutputAdded = function () {
            onOutputAdded?.apply(this,arguments)
            ControllerPanel.node_change(this.id, "onOutputAdded")
        }

        const onModeChange = nodeType.prototype.onModeChange
        nodeType.prototype.onModeChange = function () {
            onModeChange?.apply(this,arguments)
            ControllerPanel.node_change(this.id, "onModeChange")
        }
    },

    async nodeCreated(node) {
        
        const onRemoved = node.onRemoved
        node.onRemoved = function() {
            onRemoved?.apply(this, arguments)
            UpdateController.make_request_unless_configuring("node_removed", Timings.GENERIC_SHORT_DELAY)
        }

        const onDrawForeground = node.onDrawForeground
        node.onDrawForeground = function() {
            onDrawForeground?.apply(this,arguments)
            if (node.imgs) ImageManager.node_reported_images(node.id, node.imgs)
        }

        UpdateController.make_request_unless_configuring("node_created", Timings.GENERIC_SHORT_DELAY)
    },

})

}