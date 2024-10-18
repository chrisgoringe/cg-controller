import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"
import { CGControllerNode } from "./controller_node.js"   
import { create, create_deep } from "./utilities.js"
import { add_controls } from "./controller_controls.js"
import { add_control_panel_options, NodeInclusionManager,  } from "./node_inclusion.js"
import { UpdateController } from "./update_controller.js"
import { Debug } from "./debug.js"
import { settings } from "./settings.js"

app.registerExtension({
	name: "cg.controller",

    /* Called when the graph has been configured (page load, workflow load) */
    async afterConfigureGraph() {
        /* This is now just for backward compatibility - we *remove* the ControllerNode and put the data in app.graph.extras */
        CGControllerNode.remove()  
        new ControllerPanel()

        /* If the panel is showing (because we reloaded a workflow in which it was), and in the old style, hide the main menu 
        if (ControllerPanel.showing() && app.ui.settings.getSettingValue('Comfy.UseNewMenu', "Disabled")=="Disabled") {
            app.ui.menuContainer.style.display = "none";
            app.ui.menuHamburger.style.display = "flex";
        } */
       ControllerPanel.instance.hide()
    },

    /* Called at the end of the application startup */
    async setup() {
        // Add the css call to the document
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':'extensions/cg-controller/controller.css' } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href':'extensions/cg-controller/slider.css' } )

        try {
            if (settings.button_position=='top') {
                const top_menu = document.getElementsByClassName('p-menubar-root-list')[0]
                const span = create_deep([  {'tag':'li', 'clss':'p-menubar-item relative _controller'}, 
                                            {'tag':'div', 'clss':'p-menubar-item-link _controller'},  
                                            {'tag':'span', 'clss':'p-menubar-item-link _controller', 'properties':{"innerText":"Controller"}}
                                        ], top_menu)
                span.addEventListener('click', ()=>{ControllerPanel.toggle()})
            } else {
                const side_menu = document.getElementsByClassName('side-tool-bar-container')[0]
                const datanames = new Set()
                side_menu.childNodes.forEach((b)=>{
                    if (b.type=='button') {
                        b.addEventListener('click', ()=>{ControllerPanel.instance.hide();})
                        Array.from(b.attributes).forEach((att) => {
                            if (att.name.startsWith('data')) datanames.add(att.name)
                        })
                    }
                })

                ControllerPanel.button = create('button', 'p-button p-component p-button-icon-only p-button-text controller-tab-button side-bar-button p-button-secondary', null,
                    {"ariaLabel":"Controller"})
                datanames.forEach((d)=>{ ControllerPanel.button.setAttribute(d, "")})

                side_menu.insertBefore(ControllerPanel.button, side_menu.lastChild)
                const icon = create('i', 'pi pi-sliders-h side-bar-button-icon', ControllerPanel.button)
                //const label = create('span', 'p-button-label', button)
                ControllerPanel.button.addEventListener('click', ()=>{
                    const active = document.getElementsByClassName('side-bar-button-selected')
                    if (active.length==1 && active[0]!=ControllerPanel.button) active[0].click()
                    ControllerPanel.toggle()
                })


            }
        } catch (e) {
            Debug.error("Failed to add to top menu because...")
            console.error(e)
        }

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

    registerCustomNodes() {
        LiteGraph.registerNodeType("CGControllerNode", CGControllerNode)
    }
})