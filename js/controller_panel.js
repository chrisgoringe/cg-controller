import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js" 

import { create, get_node, add_tooltip } from "./utilities.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { observe_resizables } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";
import { settings } from "./settings.js";
import { SettingIds, Timings, Texts, BASE_PATH } from "./constants.js";

export class ControllerPanel extends HTMLDivElement {
    static instance = undefined
    static button = undefined
    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove() }
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.body.appendChild(this)

        this.header = create('span','header', this)
        this.main   = create('span','main', this)
        this.footer = create('span','footer', this)
        
        this.node_blocks = {}   

        this.addEventListener('dragstart', (e) => { this.classList.add('unrefreshable'); this.reason = 'drag happening' })
        this.addEventListener('dragend',   (e) => { this.save_node_order(); this.classList.remove('unrefreshable') } )
        this.addEventListener('dragover',  (e) => {
            if (NodeBlock.dragged) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.dropEffect = "move"
            } else {
                e.dataTransfer.effectAllowed = "none" 
                e.dataTransfer.dropEffect = "none"
            }
            e.preventDefault();
        })

        this.footer.drag_id = "footer"
        this.footer.addEventListener("dragover", (e) => {
            if (NodeBlock.dragged) {
                e.preventDefault()
                if (e.target==this.footer)  this.nodeblock_dragged_over_footer(e)
            }
        })

        this.drag_id = "footer"
        this.addEventListener("dragover", (e) => {
            if (NodeBlock.dragged) {
                e.preventDefault()
                if (e.target==this) {
                    if (!this.last_dragover) { this.last_dragover = { "timeStamp":e.timeStamp, "x":e.x, "y":e.y } }
                    else {
                        if (Math.abs(e.x-this.last_dragover.x) > 2 || Math.abs(e.y-this.last_dragover.y) > 2) { this.last_dragover = null }
                        else if ((e.timeStamp - this.last_dragover.timeStamp) > Timings.DRAG_PAUSE_OVER_BACKGROUND) this.nodeblock_dragged_over_footer(e)
                    }
                }
            }
        }) 
        this.hide()

        this.overlay = create('span', 'overlay', null, {'stack':0})

        Object.defineProperty(this, "footer_height", {
            get : () => { return this.footer.getBoundingClientRect().height },
            set : (v) => { this.footer.style.height = `${v}px`}
        })

        this.log_widths('in constructor before seting property')
        this.style.setProperty("--element_width", `${settings.element_width}px`)
        this.extra_space = null
        this.should_update_element_width = false
        this.addEventListener('mousedown', ()=>{this.should_update_element_width = true})
        window.addEventListener('mouseup', ()=>{this.should_update_element_width = false})
        
        new ResizeObserver((x) => this.on_width_change()).observe(this)

    }

    measure_extra_space() {
        if (this.getBoundingClientRect().width>0) {
            this.extra_space = this.getBoundingClientRect().width - settings.element_width
            this.log_widths('in measure extra space')
        } else {
            setTimeout(this.measure_extra_space.bind(this), 100)
        }
    }

    static toggle() {
        if (ControllerPanel.instance) {
            if (ControllerPanel.instance.showing) ControllerPanel.instance.hide()
            else ControllerPanel.instance.redraw()
        }
    }

    static showing() { 
        return (ControllerPanel.instance?.showing)
    }

    static overlapsWith(element) {
        if (ControllerPanel.showing()) {
            const bb1 = element.getBoundingClientRect()
            const bb2 = ControllerPanel.instance.getBoundingClientRect()
            return (bb1.left < bb2.right && bb1.right > bb2.left)
        } else { return false }
    }

    redraw() {
        Debug.trivia("In ControllerPanel.redraw")
        this.build_controllerPanel()
        this.classList.remove('hidden')
        if (ControllerPanel.button) ControllerPanel.button.classList.add('selected')
        this.showing = true
    }

    hide() {
        this.classList.add('hidden')
        if (ControllerPanel.button) ControllerPanel.button.classList.remove('selected')
        this.showing = false
    }

    static graph_cleared() {
        UpdateController.make_request("graph_cleared")
    }

    static on_setup() {
        settings.fix_backward_compatibility()

        UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh, (node_id)=>ControllerPanel.instance?.node_blocks[node_id])

        NodeInclusionManager.node_change_callback = UpdateController.make_request
        api.addEventListener('graphCleared', ControllerPanel.graph_cleared) 
    }

    static redraw() { ControllerPanel.instance.redraw() }

    static can_refresh() {  // returns -1 to say "no, and don't try again", 0 to mean "go ahead!", or n to mean "wait n ms then ask again"
        if (app.configuringGraph) { Debug.trivia("configuring"); return -1 }
        if (!ControllerPanel.instance) return -1;
        return ControllerPanel.instance._can_refresh()
    }

    _can_refresh() {
        try {        
            if (!this.showing) { return -1 }
            if (this.classList.contains('unrefreshable')) { Debug.trivia("already refreshing"); return -1 }
            if (this.contains(document.activeElement) && document.activeElement != this.group_select &&
                        document.activeElement.tagName != "BUTTON" ) { Debug.trivia("delay refresh because active element"); return 1 }
         
            const unrefreshables = this.getElementsByClassName('unrefreshable')
            if (unrefreshables.length > 0) {
                Debug.trivia(`Not refreshing because contains unrefreshable element because ${unrefreshables[0].reason}`)
                return Timings.UPDATE_GENERAL_WAITTIME
            } 
        } catch (e) {
            Debug.important(`Not refreshing because:`)
            console.error(e)
            return Timings.UPDATE_EXCEPTION_WAITTIME
        }
        return 0
    }

    nodeblock_dragged_over_footer(e) {
        NodeBlock.drag_over_me(e)
    }

    maybe_create_node_block_for_node(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        if (NodeInclusionManager.include_node(nd)) {
            const node_block = new NodeBlock(nd)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
        }
    }

    on_child_height_change(element, delta) {
        if (delta != 0) {
            if ((this.footer_height - delta) > 20) {
                this.footer_height -= delta
            }

            this.show_overlay(`${Math.round(element.getBoundingClientRect().height)}px`, element.parentElement)
            this.update_scrollbar()
        }
    }

    show_overlay(text, element) {
        this.overlay.innerText = text
        element.appendChild(this.overlay)
        this.overlay.stack += 1
        setTimeout( ()=>{
            this.overlay.stack -= 1
            if (this.overlay.stack==0) this.overlay.remove()
        }, 1000 )
    }

    log_widths(txt) {
        Debug.trivia(`${txt}   bounding width = ${this.getBoundingClientRect().width}  settings.element_width = ${settings.element_width}  ${settings.scrollbar_on} `)
    } 

    on_width_change() {
        if (this.getBoundingClientRect().width>0) {
            this.log_widths('in on_width_change')
            this.show_overlay(`${Math.round(this.getBoundingClientRect().width)}px`, this)
            if (this.extra_space != null && this.should_update_element_width) {
                settings.element_width = this.getBoundingClientRect().width - this.extra_space
                this.style.setProperty("--element_width", `${settings.element_width}px`)
            } else {
                this.extra_space = null
                setTimeout(this.measure_extra_space.bind(this), 100)
            }
            this.log_widths('end of on_width_change')
        }
    }

    consider_adding_node(node_or_node_id) {
        const node_id = node_or_node_id.id ?? node_or_node_id
        if (this.new_node_id_list.includes(node_id)) return   // already got it in the new list
        if (NodeInclusionManager.include_node(node_or_node_id)) {             // is it still valid?
            if (this.node_blocks[node_id]) {     
                this.node_blocks[node_id].build_nodeblock()
            } else {
                this.maybe_create_node_block_for_node(node_id) 
            }
            if (this.node_blocks[node_id]) {             // if it now exists, add it
                this.main.append(this.node_blocks[node_id])
                this.new_node_id_list.push(node_id)
            }
        }        
    }

    remove_absent_nodes() {
        Object.keys(this.node_blocks).forEach((node_id) => {
            if (!app.graph._nodes_by_id[node_id]) {
                delete this.node_blocks[node_id]
            }
        })
    }

    set_node_visibility() {
        this.showAdvancedCheckbox = false
        var count_included = 0
        var count_visible  = 0
        Object.keys(this.node_blocks).forEach((node_id) => {
            const node_block = this.node_blocks[node_id]
            if (NodeInclusionManager.include_node(node_block.node)) {
                if (GroupManager.is_node_in(settings.group_choice, node_id) || NodeInclusionManager.node_in_all_views(node_block.node)) {
                    count_included += 1
                    if (NodeInclusionManager.advanced_only(node_block.node)) {
                        this.showAdvancedCheckbox = true
                        if (settings.advanced) {
                            node_block.classList.remove('hidden')
                            count_visible += 1
                        } else node_block.classList.add('hidden')
                    } else {
                        node_block.classList.remove('hidden')
                        count_visible += 1
                    } 
                } else {
                    node_block.classList.add('hidden')
                }
            }
        })
        return { "nodes":count_included, "visible_nodes":count_visible }
    }

    set_position() {
        const style = {  }
        const top_element = document.getElementsByClassName('comfyui-body-top')[0].getBoundingClientRect()
        style["top"] = `${top_element.bottom}px`
        style["height"] = `calc(100vh - ${top_element.bottom}px)`

        if (settings.getSettingValue("Comfy.Sidebar.Location")=="left") {
            const left_element = document.getElementsByClassName('comfyui-body-left')[0].getBoundingClientRect()
            style["left"] = `${left_element.right}px`
            style["border-width"]  = "0 4px 0 0"
        } else {
            const right_element = document.getElementsByClassName('comfyui-body-right')[0].getBoundingClientRect()
            style["left"] = `${right_element.left - this.getBoundingClientRect().width}px`
            style["border-width"]  = "0 0 0 4px"
        }

        Object.assign(this.style, style)
        this.footer.style.height = '20px'
        this.footer_height = 20

        this.update_scrollbar()
    }

    update_scrollbar() {

    }

    set_element_width() {
        try {
            const x = document.getElementsByClassName('graph-canvas-container')[0].getBoundingClientRect().width
            /* 
            the sidebar panel requests (20%-4) with flex-grow and flex-shrink 1 
            the gutter insists on 4
            the main panel requests (100%-4) with flex-grow and flex-shrink 1 
            So (x-4) gets divided in ratio (0.2x-4):(x-4).
            The element size is 10 smaller (controller padding + nodeblock margin)
            */
            settings.element_width = ((x-4)*(0.2*x-4)/(1.2*x-8)) - 10
            this.style.setProperty("--element_width", `${settings.element_width}px`)
        } catch (e) {
            console.error(e)
        }
    }

    build_controllerPanel() { 
        this.classList.add('unrefreshable')
        this.reason = 'already refreshing'
        try {
            this._build_controllerPanel()
        } finally {
            this.classList.remove('unrefreshable')
        }
    }

    _build_controllerPanel() {
        this.style.fontSize = `${1.333*settings.getSettingValue(SettingIds.FONT_SIZE, 12)}px`
        if (settings.element_width==0) {
            this.set_element_width()
            this.style.width = ""
        }
        this.new_menu_position = settings.getSettingValue('Comfy.UseNewMenu', "Disabled")
        GroupManager.setup(  )

        /* 
        Create the top section
        */
        this.header.innerHTML = ""
        this.header1 = create('span','header1',this.header)
        this.header_title = create('span', 'header_title', this.header1, {"innerText":"CONTROLLER"})
        this.extra_controls = create('span', 'extra_controls', this.header1)
        this.header2 = create('span','header2', this.header)
        
        //this.header3 = create('span','header3',this.header)

        if (GroupManager.any_groups()) {
            this.group_select = create("select", 'header_select', this.header2) 
            GroupManager.list_group_names().forEach((nm) => {
                const o = new Option(nm,nm)
                o.style.backgroundColor = GroupManager.group_color(nm)
                this.group_select.add(o)
            })
            try { this.group_select.value = settings.group_choice }
            catch { this.group_select.value = Texts.ALL_GROUPS }
            this.group_select.style.backgroundColor = GroupManager.group_color(this.group_select.value)
            this.group_select.addEventListener('change', (e)=>{     
                this.group_select.classList.remove('unrefreshable')     
                if (settings.group_choice != e.target.value) {
                    settings.group_choice = e.target.value; 
                    UpdateController.make_request('group selection changed') 
                }
                this.group_select.classList.remove('unrefreshable')
            })
            this.group_select.addEventListener('mousedown', (e) => {
                this.group_select.classList.add('unrefreshable')
                setTimeout(()=>{this.group_select.classList.remove('unrefreshable')}, Timings.GROUP_SELECT_NOSELECT_WAIT)
            })

        }

        settings.group_choice = GroupManager.valid_option(settings.group_choice)

        this.main.innerHTML = ""

        this.new_node_id_list = []
        this.remove_absent_nodes()
        settings.node_order.forEach( (n) => {this.consider_adding_node(n)} )
        app.graph._nodes.forEach( (n) => {this.consider_adding_node(n)} )
        if (this.new_node_id_list.length>0) settings.node_order = this.new_node_id_list

        const node_count = this.set_node_visibility()
        observe_resizables( this, this.on_child_height_change.bind(this) )
        //if (settings.heights) restore_heights( this.node_blocks, settings.heights )

        if (node_count.nodes == 0) {
            var keystroke = settings.getSettingValue(SettingIds.KEYBOARD_TOGGLE,"C")
            if (keystroke.toUpperCase() == keystroke) keystroke = "Shift-" + keystroke
            const EMPTY_MESSAGE = 
                "<p>Add nodes to the controller<br/>by right-clicking the node<br/>and using the Controller Panel submenu</p>" + 
                `<p>Toggle controller visibility with ${keystroke}</p>`
            create('span', 'empty_message', this.main, {"innerHTML":EMPTY_MESSAGE})
        }

        /*
        Back to the header
        */
        if (this.showAdvancedCheckbox) {
            //this.show_advanced = create("input", "advanced_checkbox", this.extra_controls, {"type":"checkbox", "checked":settings.advanced})
            const icon = settings.advanced ? "advanced-options-on.png" : "advanced-options.png"
            this.show_advanced = create('img', 'advanced_label', this.extra_controls, {"src":`${BASE_PATH}/${icon}`})
            this.show_advanced_ = create('span', 'advanced_label_', this.extra_controls)
            const toggle = () => {
                settings.advanced = !settings.advanced
                this.redraw()                
            }
            this.show_advanced_.addEventListener('click', toggle)
            this.show_advanced.addEventListener('click', toggle)
            add_tooltip(this.show_advanced_, `${settings.advanced?"Hide":"Show"} advanced controls`)
        }
        this.refresh = create('span', 'refresh_button', this.extra_controls, {"innerHTML":"&#10227;"})
        this.refresh.addEventListener('click', (e) => {UpdateController.make_request("refresh_button")})
        add_tooltip(this.refresh, `Refresh controller`)

        /* 
        Footer 
        */

        this.footer.innerHTML = ""
        if (this.new_menu_position=="Disabled") {
            this.submit_button = create("button","submit_button",this.footer,{"innerText":"Submit"})
            this.submit_button.addEventListener('click', () => { document.getElementById('queue-button').click() } )
        }
        
        /*
        Finalise
        */

        /* let all the layout finish then position self */
        setTimeout( this.set_position.bind(this), 20 )
    }

    save_node_order() {
        const node_id_list = []
        this.main.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        settings.node_order = node_id_list
    }

}

customElements.define('cp-div',  ControllerPanel, {extends: 'div'})

