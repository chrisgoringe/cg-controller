import { app } from "../../scripts/app.js";

import { create } from "./elements.js";
import { get_node } from "./utilities.js";
import { SliderOverrides } from "./input_slider.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { get_resizable_heights, observe_resizables, restore_heights } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";

export class ControllerPanel extends HTMLDivElement {
    instance = undefined

    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove() }
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.body.appendChild(this);
        
        this.node_blocks = {}   // map from node.id to NodeBlock
        if (!app.graph.extra.controller_panel) app.graph.extra.controller_panel = {}
        this.state = app.graph.extra.controller_panel
        
        if (ControllerPanel.showing()) ControllerPanel.redraw()
        else ControllerPanel.hide()

        this.addEventListener('dragstart', (e) => { this.classList.add('unrefreshable'); this.reason = 'drag happening' })
        this.addEventListener('dragend',   (e) => { this.save_node_order(); this.classList.remove('unrefreshable') } )
        this.addEventListener('dragover',  (e) => {
            if (NodeBlock.dragged) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.dropEffect = "move"
            }
        })
    }

    static toggle() {
        if (ControllerPanel.instance) {
            if (ControllerPanel.showing()) ControllerPanel.hide()
            else ControllerPanel.redraw()
        }
    }

    static showing() { 
        return (ControllerPanel.instance?.state?.showing == '1')
    }

    static redraw() {
        Debug.trivia("In ControllerPanel.show", Debug.EXTENDED)
        ControllerPanel.instance.build_controllerPanel()
        ControllerPanel.instance.classList.remove('hidden')
        ControllerPanel.instance.state['showing'] = '1'
    }

    static hide() {
        ControllerPanel.instance.classList.add('hidden')
        ControllerPanel.instance.state['showing'] = '0'
    }

    static force_redraw() {
        const temp = create('span',null,ControllerPanel.instance.main_container)
        setTimeout(()=>{temp.remove()}, 100)
    }

    static update() {
        if (ControllerPanel.instance) ControllerPanel.instance.on_update()
    }

    static on_setup() {
        const draw = LGraphCanvas.prototype.draw;
        LGraphCanvas.prototype.draw = function() {
            ControllerPanel.update()
            draw.apply(this,arguments);
        }

        UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh)
        const change = app.graph.change
        app.graph.change = function() {
            UpdateController.make_request()
            change.apply(this, arguments)
        }

        NodeInclusionManager.node_change_callback = UpdateController.make_request
    }

    static can_refresh() {
        const unrefreshables = ControllerPanel.instance.getElementsByClassName('unrefreshable')
        if (ControllerPanel.instance.contains( document.activeElement )) {
            Debug.extended(`Not refreshing because contain active element ${document.activeElement}`)
        } else if (ControllerPanel.instance.classList.contains('unrefreshable')) {
            Debug.extended(`Not refreshing because ControlPanel is marked as unrefreshable because ${ControllerPanel.instance.reason}`)          
        } else if (unrefreshables.length == 1) {
            Debug.extended(`Not refreshing because contains unrefreshable element because ${unrefreshables[0].reason}`)
        } else if (unrefreshables.length > 1) {
            Debug.extended(`Not refreshing because contains ${unrefreshables.length} unrefreshable elements`)
        } else if (!ControllerPanel.showing()) {
            Debug.extended(`Not refreshing because not visible`)
        } else {
            return true
        }
        return false
    }

    on_update() {
        const qt = document.getElementsByClassName('comfy-menu-queue-size')
        if (this.submit_button) {
            this.submit_button.disabled = ( qt && qt.length>0 && !(qt[0].innerText.includes(' 0')) )
        }
    }

    maybe_create_node_block_for_node(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        if (NodeInclusionManager.include_node(nd)) {
            const node_block = new NodeBlock(nd, this.force_redraw)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
        }
    }

    on_height_change() {
        if (this.updating_heights) return
        Debug.trivia("on_height_change")
        this.updating_heights = true
        this.state.heights = get_resizable_heights(this); 
        ControllerPanel.force_redraw();
        setTimeout( ()=>{this.updating_heights=false}, 100 )
    }

    consider_adding_node(node_or_node_id) {
        const node_id = (node_or_node_id.id) ? node_or_node_id.id : node_or_node_id
        if (this.new_node_id_list.includes(node_id)) return   // already got it in the new list
        if (NodeInclusionManager.include_node(node_or_node_id)) {             // is it still valid?
            if (this.node_blocks[node_id]) {     
                this.node_blocks[node_id].build_nodeblock()
            } else {
                this.maybe_create_node_block_for_node(node_id) 
            }
            if (this.node_blocks[node_id]) {             // if it now exists, add it
                //this.node_blocks[node_id].on_update()
                this.main_container.append(this.node_blocks[node_id])
                this.new_node_id_list.push(node_id)
            }
        }        
    }

    set_node_visibility() {
        this.showAdvancedCheckbox = false
        Object.keys(this.node_blocks).forEach((node_id) => {
            const node_block = this.node_blocks[node_id]
            if (GroupManager.is_node_in(this.state.group_choice, node_id)) {
                if (NodeInclusionManager.advanced_only(node_block.node)) {
                    this.showAdvancedCheckbox = true
                    if (this.state?.advanced=='1') node_block.classList.remove('hidden')
                    else node_block.classList.add('hidden')
                } else {
                    node_block.classList.remove('hidden')
                } 
            } else {
                node_block.classList.add('hidden')
            }
        })
    }

    set_position() {
        const style = { "top":"2vh", "bottom":"", "left":"10px", "justify-content":"", "border":"thin solid white", "border-radius":"4px", "border-width":"thin" }
        if (this.new_menu_position=="Top") {
            const top_element = document.getElementsByClassName('comfyui-body-top')[0].getBoundingClientRect()
            style["top"] = `${top_element.bottom}px`
            const left_element = document.getElementsByClassName('comfyui-body-left')[0].getBoundingClientRect()
            style["left"] = `${left_element.right}px`
            style["border-color"]  = "#353535"
            style["border-radius"] = "0px"
            style["border-width"]  = "0 thick thick 0"
        }
        if (this.new_menu_position=="Bottom") {
            const left_element = document.getElementsByClassName('comfyui-body-left')[0].getBoundingClientRect()
            style["left"] = `${left_element.right}px`
            const bottom_element = document.getElementsByClassName('comfyui-body-bottom')[0].getBoundingClientRect()
            style["bottom"] = `${bottom_element.height}px`
            style["top"] = ""
            style["border-color"]  = "#353535"
            style["border-radius"] = "0px"
            style["border-width"]  = "thick thick 0 0"
            style["justify-content"] = "flex-end"
        }
        Object.assign(this.style, style)
    }

    build_controllerPanel() { 
        this.innerHTML = ""
        this.classList.add('unrefreshable')
        this.reason = 'already refreshing'
        try {
            this._build_controllerPanel()
        } finally {
            this.classList.remove('unrefreshable')
        }
    }

    _build_controllerPanel() {
        try {
            this.style.zIndex = app.graph.nodes.length + 1
        } catch {
            this.style.zIndex = 1000000
        }
        this.new_menu_position = app.ui.settings.getSettingValue('Comfy.UseNewMenu', "Disabled")
        SliderOverrides.setup()
        GroupManager.setup(  )

        /* 
        Create the top section
        */
        this.header_span = create('span', 'header', this)
        create('span', 'header_title', this.header_span, {"innerText":"Comfy Controller"})
        this.header_span.addEventListener('dragover', function (e) { NodeBlock.drag_over_me(e) } )
        this.header_span.drag_id = "header"

        if (GroupManager.any_groups()) {
            this.group_select = create("select", 'header_select', this.header_span) 
            GroupManager.list_group_names().forEach((nm) => this.group_select.add(new Option(nm,nm)))
            if (this.state.group_choice) { this.group_select.value = this.state.group_choice }
            this.group_select.addEventListener('input', (e)=>{ this.state.group_choice = e.target.value; ControllerPanel.redraw() })
        }

        this.state.group_choice = GroupManager.valid_option(this.state.group_choice)

        /*
        Create the main container
        */
        this.main_container = create('span','controller_main',this)

        this.new_node_id_list = []
        this.state.node_order?.forEach( (n) => {this.consider_adding_node(n)} )
        app.graph._nodes.forEach( (n) => {this.consider_adding_node(n)} )
        this.state['node_order'] = this.new_node_id_list

        this.set_node_visibility()
        observe_resizables( this, this.on_height_change.bind(this) )
        if (this.state.heights) restore_heights( this.node_blocks, this.state.heights )

        this.main_container.drag_id = "footer"
        this.main_container.addEventListener("dragover", (e) => {
            if (NodeBlock.dragged) {
                e.preventDefault()
                if (e.target==this.main_container) {
                    if (!this.last_dragover) { this.last_dragover = { "timeStamp":e.timeStamp, "x":e.x, "y":e.y } }
                    else {
                        if (Math.abs(e.x-this.last_dragover.x) > 2 || Math.abs(e.y-this.last_dragover.y) > 2) { this.last_dragover = null }
                        else if ((e.timeStamp - this.last_dragover.timeStamp) > 250) NodeBlock.drag_over_me(e)
                    }
                }
            }
        })

        /*
        Create the bottom section
        */
        this.footer = create("span","controller_footer",this)
        this.footer.addEventListener('dragover', function (e) { NodeBlock.drag_over_me(e) } )
        this.footer.drag_id = "footer"

        if (this.showAdvancedCheckbox) {
            const add_div = create('div', 'advanced_controls', this.footer)
            this.show_advanced = create("input", "advanced_checkbox", add_div, {"type":"checkbox", "checked":(this.state?.advanced=='1')})
            create('span', 'advanced_label', add_div, {"innerText":"Show advanced controls"})
            this.show_advanced.addEventListener('input', function (e) {
                this.state.advanced = e.target.checked ? '1':'0'
                ControllerPanel.redraw()
            }.bind(this))
        }

        if (this.new_menu_position=="Disabled") {
            this.submit_button = create("button","submit_button",this.footer,{"innerText":"Submit"})
            this.submit_button.addEventListener('click', () => { document.getElementById('queue-button').click() } )
        }

        /*
        Finalise
        */
        setTimeout( this.set_position.bind(this), 20 )
    }

    save_node_order() {
        const node_id_list = []
        this.main_container.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        this.state['node_order'] = node_id_list
    }

}

customElements.define('cp-div',  ControllerPanel, {extends: 'div'})

