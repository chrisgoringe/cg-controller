import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js" 

import { create, get_node, add_tooltip, clamp } from "./utilities.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { observe_resizables } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";
import { settings } from "./settings.js";
import { SettingIds, Timings, Texts } from "./constants.js";

export class ControllerPanel extends HTMLDivElement {
    static instance = undefined
    static button = undefined
    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove() }
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.getElementsByClassName('graph-canvas-container')[0].appendChild(this)

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

        this.overlay = create('span', 'overlay', null, {'stack':0})

        Object.defineProperty(this, "footer_height", {
            get : () => { return this.footer.getBoundingClientRect().height },
            set : (v) => { this.footer.style.height = `${v}px`}
        })

        this.should_update_size = false
        this.addEventListener('mousedown', ()=>{this.should_update_size = true})
        window.addEventListener('mouseup', ()=>{this.mouse_up_anywhere()})
        
        new ResizeObserver((x) => this.on_size_change()).observe(this)

    }

    mouse_up_anywhere() {
        this.should_update_size = false; 
        this.being_dragged = false;
        this.classList.remove('being_dragged')
        this.set_position(true)
    }

    static overlapsWith(element) {
        try {
            const bb1 = element.getBoundingClientRect()
            const bb2 = ControllerPanel.instance.getBoundingClientRect()
            return (bb1.left < bb2.right && bb1.right > bb2.left)
        } catch { return false }
    }

    redraw() {
        this.build_controllerPanel()
    }

    static graph_cleared() {
        UpdateController.make_request("graph_cleared")
    }

    static onWindowResize() {
        ControllerPanel.instance.set_position(false)
    }

    static on_setup() {
        settings.fix_backward_compatibility()
        UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh, (node_id)=>ControllerPanel.instance?.node_blocks[node_id])
        NodeInclusionManager.node_change_callback = UpdateController.make_request
        api.addEventListener('graphCleared', ControllerPanel.graph_cleared) 
        ControllerPanel.create()
        window.addEventListener("resize", ControllerPanel.onWindowResize)
    }

    static create() {
        if (document.getElementsByClassName('graph-canvas-container').length>0) {
            new ControllerPanel()
        } else {
            setTimeout(ControllerPanel.create,100)
        }
    }

    static redraw() { ControllerPanel.instance.redraw() }

    static can_refresh() {  // returns -1 to say "no, and don't try again", 0 to mean "go ahead!", or n to mean "wait n ms then ask again"
        if (app.configuringGraph) { Debug.trivia("configuring"); return -1 }
        if (!ControllerPanel.instance) return -1;
        return ControllerPanel.instance._can_refresh()
    }

    _can_refresh() {
        try {        
            //if (!this.showing) { return -1 }
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

    on_size_change() {
        if (this.getBoundingClientRect().width>0 && this.should_update_size) {
            this.show_overlay(`${Math.round(this.getBoundingClientRect().width)} x ${Math.round(this.getBoundingClientRect().height)}px`, this)
            settings.position.w = this.getBoundingClientRect().width
            settings.position.h = this.getBoundingClientRect().height
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

    check_dimensions() {
        const box = this.parentElement.getBoundingClientRect()
        settings.position.x = clamp(settings.position.x, 0, box.width  - settings.position.w)
        settings.position.y = clamp(settings.position.y, 0, box.height - settings.position.h)
        settings.position.w = clamp(settings.position.w, 0, box.width  - settings.position.x)
        settings.position.h = clamp(settings.position.h, 0, box.height - settings.position.y)
    }

    set_position(set_by_user) {
        /* 
        if this change was user generated, the new positions are the desired ones.
        Otherwise, retrieve the desired positions
        */
        if (set_by_user) {
            Object.assign(settings.userposition, settings.position)
        } else {
            Object.assign(settings.position, settings.userposition)
        }

        this.check_dimensions()

        if (settings.collapsed) {
            this.style.left   = `${settings.position.x}px`
            this.style.top    = `${settings.position.y}px`
            this.style.width  = ``
            this.style.height = `42px`
            this.classList.add('collapsed')
        } else {
            this.style.left   = `${settings.position.x}px`
            this.style.top    = `${settings.position.y}px`
            this.style.width  = `${settings.position.w}px`
            this.style.height = `${settings.position.h}px`
            this.classList.remove('collapsed')
            this.footer.style.height = '20px'
            this.footer_height = 20
        }
    }

    header_mouse(e) {
        if (e.type=='mousedown') {
            if (e.target==this.header_title) {
                this.being_dragged = true
                this.offset_x = e.x - settings.position.x
                this.offset_y = e.y - settings.position.y
                this.classList.add('being_dragged')
                e.preventDefault()
                e.stopPropagation()
            }
        }
        if (e.type=='mousemove' && this.being_dragged && e.currentTarget==window) {
            settings.position.x = e.x - this.offset_x
            settings.position.y = e.y - this.offset_y
            this.set_position(true)
            this.offset_x = e.x - settings.position.x
            this.offset_y = e.y - settings.position.y
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
        this.style.setProperty('--font-size',`${1.333*settings.getSettingValue(SettingIds.FONT_SIZE, 12)}px`)

        this.new_menu_position = settings.getSettingValue('Comfy.UseNewMenu', "Disabled")
        GroupManager.setup(  )

        /* 
        Create the top section
        */
        this.header.innerHTML = ""
        this.header1 = create('span','subheader subheader1',this.header)
        this.minimisedot = create("i", `pi pi-sliders-h header_button collapse_button`, this.header1)
        this.minimisedot.addEventListener("click", (e)=>{ 
            e.preventDefault(); 
            e.stopPropagation(); 
            settings.collapsed = (!settings.collapsed)
            UpdateController.make_request('collapse') 
        })
        add_tooltip(this.minimisedot, `${settings.collapsed?"Open":"Collapse"} controller`, true)
        this.header_title = create('span', 'header_title', this.header1, {"innerText":"CONTROLLER"})
        this.header1.addEventListener('mousedown', (e) => this.header_mouse(e))
        window.addEventListener('mousemove', (e) => this.header_mouse(e))
        this.header2 = create('span','subheader subheader2', this.header)


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

        if (node_count.nodes == 0) {
            const EMPTY_MESSAGE = 
                "<p>Add nodes to the controller<br/>by right-clicking the node<br/>and using the Controller Panel submenu</p>"
            create('span', 'empty_message', this.main, {"innerHTML":EMPTY_MESSAGE})
        }

        /*
        Back to the header
        */
        if (!settings.collapsed) {
            if (this.showAdvancedCheckbox) {
                this.show_advanced = create('i', `pi pi-bolt header_button${settings.advanced ? " clicked":""}`, this.header1)
                this.show_advanced.addEventListener('click', (e) => {
                    settings.advanced = !settings.advanced
                    this.redraw()
                    e.stopPropagation()    
                })
                add_tooltip(this.show_advanced, `${settings.advanced?"Hide":"Show"} advanced controls`)
            }
            this.refresh = create('i', 'pi pi-sync header_button', this.header1)
            this.refresh.addEventListener('click', (e) => {
                UpdateController.make_request("refresh_button");
                this.refresh.classList.add("clicked");
                setTimeout(()=>{this.refresh.classList.remove("clicked")}, 200);
                e.stopPropagation()    
            })
            add_tooltip(this.refresh, `Refresh controller`)
        }
        
        /*
        Finalise
        */
        this.set_position(true)
    }

    save_node_order() {
        const node_id_list = []
        this.main.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        settings.node_order = node_id_list
    }

}

customElements.define('cp-div',  ControllerPanel, {extends: 'div'})

