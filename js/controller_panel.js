import { app } from "../../scripts/app.js";

import { create, get_node, add_tooltip, clamp, classSet, defineProperty, find_controller_parent, createBounds, title_if_overflowing } from "./utilities.js";
import { family_names, GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { observe_resizables, clear_resize_managers } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";
import { get_all_setting_indices, getSettingValue, global_settings, new_controller_setting_index, get_settings, delete_settings, initialise_settings, valid_settings } from "./settings.js";
import { update_node_order, add_missing_nodes } from "./settings.js"
import { SettingIds, Timings, Texts, Pixels } from "./constants.js";
import { FancySlider } from "./input_slider.js";
import { clear_widget_change_managers } from "./widget_change_manager.js";
import { clean_image_manager, ImageManager } from "./image_manager.js";
import { SnapManager } from "./snap_manager.js";
import { Highlighter } from "./highlighter.js";

export class ControllerPanel extends HTMLDivElement {
    static instances = {}
    static count = 0

    _remove() {
        Debug.trivia(`Removing ControllerPanel ${this.index}`)
        SnapManager.remove(this)
        if (this.node_blocks) Object.values(this.node_blocks).forEach((nb)=>{nb._remove()})
        this.node_blocks = {}
        this.remove()
        this.resize_observer?.disconnect()
        delete this.resize_observer
        delete this.main
        ControllerPanel.count -= 1
        Highlighter.group(null)
        Debug.trivia(`ControllerPanel _remove count now ${ControllerPanel.count}`)
    }

    constructor(index) {
        super()
        ControllerPanel.count += 1
        if (index == null) index = new_controller_setting_index()
        if (ControllerPanel.instances[index]) { ControllerPanel.instances[index]._remove(); Debug.essential(`removed index clash ${index}`) }
        Debug.trivia(`Creating ControllerPanel ${index}`)
        ControllerPanel.instances[index] = this
        this.index = index
        this.settings = get_settings(index)
        this.classList.add("controller")
        SnapManager.register(this)
        find_controller_parent().appendChild(this)

        this.header = create('span','header', this)
        this.main   = create('span','main', this)
        this.footer = create('span','footer', this)
        this.style.setProperty('--border_width',`${Pixels.BORDER_WIDTH}px`)
        
        this.node_blocks = {}   

        this.addEventListener('dragstart', (e) => { this.unrefreshable_because = 'drag happening' })
        this.addEventListener('dragend',   (e) => { 
            if (e.target.className == "nodeblock_draghandle") {
                update_node_order(this.settings.node_order, NodeBlock.last_dragged.node.id, NodeBlock.last_dragged.previousSibling?.node.id, NodeBlock.last_dragged.nextSibling?.node.id); 
                this.unrefreshable_because = null
            }
        } )
        this.addEventListener('dragover',  (e) => {
            if (NodeBlock.dragged) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.dropEffect = "move"
            } else {
                e.dataTransfer.effectAllowed = "copy" 
                e.dataTransfer.dropEffect = "copy"
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

        defineProperty(this, "footer_height", {
            get : () => { return this.footer.getBoundingClientRect().height },
            set : (v) => { this.footer.style.height = `${v}px`}
        })

        this.should_update_size = false
        this.addEventListener('mousedown', (e)=>{this.mouse_down(e)})
        
        this.resize_observer = new ResizeObserver((x) => this.on_size_change()).observe(this)
    }

    static on_group_details_change(oldname, changes) {
        ControllerPanel.updating_group_details = true
        try {
            Object.values(ControllerPanel.instances).forEach((cp)=>{cp.on_group_details_change(oldname,changes)})
        } finally { ControllerPanel.updating_group_details = false }
    }
    on_group_details_change(oldname, changes) {
        const idx = this.settings.groups.findIndex((el)=>(el==oldname))
        if (idx>=0) {
            if (changes.title) {
                this.settings.groups[idx] = changes.title
                if (this.settings.group_choice == oldname) this.settings.group_choice = changes.title
            }
            if (changes.removed) {
                this.settings.groups = this.settings.groups.filter((g)=>g!=oldname)
            }
            this.settings.groups = Array.from(new Set(this.settings.groups))
            UpdateController.make_request('group change', Timings.GROUP_CHANGE_DELAY, false, this)
        }
    }


    static on_progress(e) {
        const node_id = e.detail.node
        const value = e.detail.value
        const max = e.detail.max
        Object.values(ControllerPanel.instances).filter((cp)=>cp.have_node(node_id)).forEach((cp)=>cp.on_progress(node_id, value, max))
        ImageManager.send_progress_update(node_id, value, max)
    }

    on_progress(node_id, value, max) {
        this.node_blocks[node_id]?.on_progress(value, max)
    }

    static focus_mode_changed() {
        Object.values(ControllerPanel.instances).forEach((cp)=>{cp._remove()})
        ControllerPanel.instances = {}
        UpdateController.make_request('focus mode changed')
    }

    static on_executing(e) {
        const node_id = e.detail
        Debug.trivia(`ControllerPanel.on_executing ${node_id}`)
        Object.values(ControllerPanel.instances).forEach((cp)=>{
            Object.values(cp.node_blocks).forEach((nb)=>{
                try {
                    nb.on_progress()
                    classSet(nb, 'active', nb.node.id==node_id)
                } catch (e) {
                    Debug.error(`on_executing: controller ${cp.index}, node ${node_id}`, e)
                }
            })
        })
    }

    static handle_mouse_up() {
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            ControllerPanel.instances[k].mouse_up()
        })
    }

    static handle_mouse_move(e) {
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            ControllerPanel.instances[k].mouse_move(e)
        })
    } 

    mouse_down(e) {
        this.should_update_size = true
        if (e.target==this) {
            const box = this.getBoundingClientRect()
            if (e.layerX<5)                   this.x_click = "left"
            else if (e.layerX>(box.width-5))  this.x_click = "right"
            if (e.layerY<5)                   this.y_click = "top"
            else if (e.layerY>(box.height-5)) this.y_click = "bottom"

            if (this.x_click || this.y_click) {
                this.down_x = e.x
                this.down_y = e.y
            }
        }
    }

    mouse_up() {
        this.x_click = false
        this.y_click = false
        this.should_update_size = false; 
        this.classList.remove('grabbed')
        if (this.being_dragged || this.being_resized) {
            this.being_dragged = false;
            this.being_resized = false;
            this.classList.remove('being_dragged')
            this.set_position()
        }
    }

    redraw() {
        this.build_controllerPanel()
    }

    static new_workflow() {
        Debug.extended('new_workflow')
        Object.keys(ControllerPanel.instances).forEach((k)=>{ControllerPanel.instances[k]._remove()})
        ControllerPanel.instances = {}
        initialise_settings()
        ControllerPanel.add_controllers()
        if (ControllerPanel.menu_button) classSet(ControllerPanel.menu_button, 'litup', !global_settings.hidden) 
        if (!global_settings.hidden && Object.keys(ControllerPanel.instances).length==0 && find_controller_parent()) ControllerPanel.create_new()
        UpdateController.make_request('new workflow', 100)
        ControllerPanel.update_buttons()
    }

    static on_graphCleared() {
        UpdateController.make_request("graph_cleared")
    }

    static create_new(e) {
        const newcp = new ControllerPanel()
        if (e && e.layerX && e.layerY) newcp.settings.set_position(e.layerX,e.layerY,null,null)
        newcp.build_controllerPanel()
    }

    delete_controller() {
        delete_settings(this.settings.index)
        this._remove()
        delete ControllerPanel.instances[this.settings.index]
    }

    static add_controllers() {
        if (find_controller_parent()) {
            get_all_setting_indices().forEach((i)=>{
                new ControllerPanel(i).redraw()
            })
        }
        ControllerPanel.update_buttons()
    }

    static update_buttons() {
        if (ControllerPanel.buttons) {
            classSet(ControllerPanel.menu_button, 'litup', !global_settings.hidden)
            classSet(ControllerPanel.buttons, 'hide', (global_settings.hidden || Object.keys(ControllerPanel.instances).length==0))
        }
    }

    static create_menu_icon() {
        if (find_controller_parent()) {
            const comfy_menu = document.getElementsByClassName('comfyui-menu')[0]
            var spacer = null
            comfy_menu.childNodes.forEach((node)=>{if (node.classList.contains('flex-grow')) spacer = node})
            if (!spacer) spacer = comfy_menu.firstChild
            ControllerPanel.buttons = create('span', 'controller_menu_buttons')
            spacer.after(ControllerPanel.buttons)

            ControllerPanel.menu_button = create('i', 'pi pi-sliders-h controller_menu_button', ControllerPanel.buttons)
            add_tooltip(ControllerPanel.menu_button, 'Toggle controllers')
            classSet(ControllerPanel.menu_button, 'litup', !global_settings.hidden) 
            ControllerPanel.menu_button.addEventListener('click', ControllerPanel.toggle)

            ControllerPanel.search_button = create('i', 'pi pi-search controller_menu_button', ControllerPanel.buttons)
            add_tooltip(ControllerPanel.search_button, 'Highlight nodes in workflow')
            classSet(ControllerPanel.search_button, 'litup', global_settings.highlight) 
            ControllerPanel.search_button.addEventListener('click', ()=>{ 
                global_settings.highlight = !global_settings.highlight;
                classSet(ControllerPanel.search_button, 'litup', global_settings.highlight) 
             })

            const exit_focus_button = document.getElementsByTagName('main')[0].getElementsByTagName('button')[0]
            exit_focus_button.addEventListener('click', () => {
                UpdateController.make_request('exit focus', 10)
            })

            ControllerPanel.update_buttons()
            
        } else {
            setTimeout(ControllerPanel.create_menu_icon,100)
        }
    }

    static redraw(c) { 
        if (!valid_settings()) {
            ControllerPanel.new_workflow()
            return
        }
        if (Object.values(ControllerPanel.instances).length>0 && !document.body.contains(Object.values(ControllerPanel.instances)[0])) {
            // probably in focus mode
            ControllerPanel.instances = {}
        }
        if (Object.values(ControllerPanel.instances).length == 0) {
            ControllerPanel.add_controllers()
            return
        }
        if (c) {
            c.redraw()
        } else {
            clear_resize_managers()
            clear_widget_change_managers()
            clean_image_manager()
            Object.values(ControllerPanel.instances).forEach((cp)=>{cp.redraw()})
        }
        ControllerPanel.update_buttons()
    }

    static toggle() {
        global_settings.hidden = !global_settings.hidden
        if (global_settings.hidden) {
            Object.values(ControllerPanel.instances).forEach((cp)=>{cp._remove()})
            ControllerPanel.instances = {}
            SnapManager.gutter_overlay?.remove()
        }
        if (!global_settings.hidden && Object.keys(ControllerPanel.instances).length==0) {
            ControllerPanel.add_controllers()
            if (Object.keys(ControllerPanel.instances).length==0) ControllerPanel.create_new()
        }
        UpdateController.make_request('toggle')
        ControllerPanel.update_buttons()
    }

    static can_refresh(c) {  // returns -1 to say "no, and don't try again", 0 to mean "go ahead!", or n to mean "wait n ms then ask again" 
        if (app.configuringGraph) { Debug.trivia("configuring"); return -1 }
        if (global_settings.hidden) return -1
        if (ControllerPanel.updating_group_details) return -1
        GroupManager.check_for_changes()
        if (c) {
            return c._can_refresh()
        } else {
            var response = 0
            Object.keys(ControllerPanel.instances).forEach((k)=>{
                const r = ControllerPanel.instances[k]._can_refresh()
                if (r==-1 || response==-1) response = -1
                else response = Math.max(r, response)
            })
            return response
        }
    }

    static node_change(node_id, moreinfo) {
        setTimeout(ControllerPanel._node_change, Timings.GENERIC_SHORT_DELAY, node_id, moreinfo)
    }
    static _node_change(node_id, moreinfo) {
        Object.values(ControllerPanel.instances).forEach((cp)=>{cp._node_change(node_id, moreinfo)})
    }

    static group_change(group_name) {
        const names = family_names(group_name)
        Object.values(ControllerPanel.instances).filter((cp)=>(names.has(cp.settings.group_choice))).forEach((cp)=>{
            UpdateController.make_single_request(`group ${group_name} changed`,cp)
        })
    }

    have_node(nid) {
        return (this.node_blocks[nid] && this.node_blocks[nid].parentElement)
    }

    _node_change(node_id, moreinfo) {
        if (this.have_node(node_id)) UpdateController.make_single_request(`node ${node_id} changed ${moreinfo ?? ""}`,this)
    }

    choose_suitable_initial_group() {
        const all_options = GroupManager.list_group_names()
        const all_used = new Set()
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            ControllerPanel.instances[k].settings.groups.forEach((g)=>all_used.add(g))
        })
        const unused_options = all_options.filter((g)=>!(all_used.has(g)))
        return (unused_options.length) ? unused_options[0] : Texts.ALL_GROUPS
    }

    _can_refresh() {
        try {
            if (!find_controller_parent()?.contains(this)) { 
                Debug.trivia("not visible"); 
                return -1 
            }
            if (this.unrefreshable_because) { 
                Debug.trivia(this.unrefreshable_because); 
                return -1 
            }
            if (this.contains(document.activeElement) && !document.activeElement.doesntBlockRefresh) { 
                Debug.trivia("active element"); 
                return Timings.ACTIVE_ELEMENT_DELAY
            }
            
            if (FancySlider.currently_active && this.contains(FancySlider.currently_active)) {
                Debug.trivia(`sldier active`)
                return Timings.SLIDER_ACTIVE_DELAY
            } 
        } catch (e) {
            Debug.important(`exception`)
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
            if (this.node_blocks[nd.id]) {
                this.node_blocks[nd.id]._remove()
                delete this.node_blocks[nd.id]
            }
            const node_block = new NodeBlock(this, nd)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
            else node_block?._remove()
        }
    }

    on_child_height_change(element, delta) {
        if (delta != 0) {
            if ((this.footer_height - delta) > Pixels.FOOTER) {
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
            this.being_resized = true
            this.show_overlay(`${Math.round(this.getBoundingClientRect().width)} x ${Math.round(this.getBoundingClientRect().height)}px`, this)
            this.settings.set_position(null,null,this.getBoundingClientRect().width,this.getBoundingClientRect().height)
        }
    }

    consider_adding_node(node_or_node_id) {
        const node_id = node_or_node_id.id ?? node_or_node_id
        if (NodeInclusionManager.include_node(node_or_node_id) && GroupManager.is_node_in(this.settings.group_choice, node_id)) {  
            if (this.node_blocks[node_id] && this.node_blocks[node_id].can_reuse()) {     
                //we already have it - we will rebuild, if needed, in set_node_visibility instead
            } else {
                this.maybe_create_node_block_for_node(node_id) 
            }
            if (this.node_blocks[node_id]) {             // if it now exists, add it
                this._main.append(this.node_blocks[node_id])
            }
        }        
    }

    remove_absent_nodes() {
        Object.keys(this.node_blocks).forEach((node_id) => {
            if (!app.graph._nodes_by_id[node_id] || (app.graph._nodes_by_id[node_id] != this.node_blocks[node_id].node)) {
                this.node_blocks[node_id]._remove()
                delete this.node_blocks[node_id]
            }
        })
    }

    set_node_visibility() {
        this.showAdvancedCheckbox = false
        this.node_count = 0
        Object.keys(this.node_blocks).forEach((node_id) => {
            const node_block = this.node_blocks[node_id]
            if (NodeInclusionManager.include_node(node_block.node)) {
                var show = false;
                if (GroupManager.is_node_in(this.settings.group_choice, node_id)) {
                    this.node_count += 1
                    if (NodeInclusionManager.advanced_only(node_block.node)) {
                        this.showAdvancedCheckbox = true
                        if (this.settings.advanced) {
                            show = true;
                        }
                    } else {
                        show = true;
                    } 
                    classSet(node_block, 'hidden', (!show))
                    node_block.is_hidden = (!show)
                    if (show) node_block.build_nodeblock()
                } else {
                    node_block._remove()
                    delete this.node_blocks[node_id]
                }
            }
        })
    }

    set_position(skip_snapping) {
        if (!skip_snapping) SnapManager.apply_snapping(this)

        if (this.settings.collapsed) {
            this.style.left   = `${this.settings.position.x}px`
            this.style.top    = `${this.settings.position.y}px`
            this.style.width  = ``
            this.style.height = `42px`
            this.classList.add('collapsed')
        } else {
            this.style.left   = `${this.settings.position.x}px`
            this.style.top    = `${this.settings.position.y}px`
            this.style.width  = `${this.settings.position.w}px`
            this.style.height = `${this.settings.position.h}px`
            this.classList.remove('collapsed')
            this.footer.style.height = `${Pixels.FOOTER}px`
            this.footer_height = Pixels.FOOTER
        }
    }

    header_mouse_down(e) {
        if (app.canvas.read_only) return

        this.being_dragged = true
        this.drag_threshold = false
        this.classList.add('grabbed')
        this.offset_x = e.x - this.settings.position.x
        this.offset_y = e.y - this.settings.position.y
    }

    mouse_move(e) {
        if (app.canvas.read_only) return
        this.style.cursor = ''
        if (this.being_dragged) {
            if (e.currentTarget==window) {
                this.drag_threshold = this.drag_threshold || ((Math.abs(e.x - this.settings.position.x - this.offset_x) + Math.abs(e.y - this.settings.position.y - this.offset_y))>20) 
                if (this.drag_threshold) {
                    this.classList.add('being_dragged')
                    this.settings.set_position( e.x - this.offset_x, e.y - this.offset_y, null, null )
                    this.set_position()
                    this.offset_x = e.x - this.settings.position.x
                    this.offset_y = e.y - this.settings.position.y
                }
            }
        } else if (this.x_click || this.y_click) {
            if (this.x_click) {
                var delta_x = e.x - this.down_x
                this.down_x = e.x
                if (this.x_click == "left") {
                    if (this.settings.position.x + delta_x < 0) delta_x = -this.settings.position.x 
                    this.settings.set_position( this.settings.position.x + delta_x, null, this.settings.position.w - delta_x, null )
                } else {
                    this.settings.set_position( null, null, this.settings.position.w + delta_x, null )
                }
                this.set_position()
            } 
            if (this.y_click) {
                var delta_y = e.y - this.down_y
                this.down_y = e.y
                if (this.y_click == "top") {
                    if (this.settings.position.y + delta_y < 0) delta_y = -this.settings.position.y
                    this.settings.set_position( null, this.settings.position.y + delta_y, null, this.settings.position.h - delta_y )
                } else {
                    this.settings.set_position( null, null, null, this.settings.position.h + delta_y )
                }
                this.set_position()
            }
        } else {
            const box = this.getBoundingClientRect()
            const dx = e.x - box.x
            const dy = e.y - box.y
            const ew = ((dx>=0 && dx<4) || (dx>(box.width-4) && dx<=(box.width)))
            const ns = ((dy>=0 && dy<3) || (dy>(box.height-4) && dy<=(box.height)))
            if (ew && ns) {
                this.style.cursor = 'move'
            } else if (ew) {
                this.style.cursor = 'ew-resize'
            } else if (ns) {
                this.style.cursor = 'ns-resize'
            }
        }
    }

    build_controllerPanel() { 
        this.unrefreshable_because = 'already refreshing'
        try {
            this._build_controllerPanel()
        } finally {
            this.unrefreshable_because = null
        }
    }

    _build_controllerPanel() {
        classSet(this, 'hidden', global_settings.hidden)
        this.style.setProperty('--font-size',`${1.333*getSettingValue(SettingIds.FONT_SIZE, 12)}px`)
        classSet(this, 'read_only', app.canvas.read_only)
        add_missing_nodes(this.settings.node_order)

        /* 
        Create the top section
        */
        this._header = create('span','header')
        this._main   = create('span','main')
        this.header1 = create('span','subheader subheader1',this._header)
        this.header2 = create('span','subheader subheader2',this._header)

        this.header1_left  = create('span', 'left tabs group', this.header1)
        this.header1_right = create('span', 'right', this.header1)
        this.header2_left  = create('span', 'left', this.header2)
        this.header2_right = create('span', 'right', this.header2)

        this.header1.addEventListener('mousedown', (e) => this.header_mouse_down(e))
        this.header2.addEventListener('mousedown', (e) => this.header_mouse_down(e))

        if (this.settings.groups.length==0) this.settings.groups = [this.choose_suitable_initial_group(),]
        if (this.settings.group_choice == null || !this.settings.groups.includes(this.settings.group_choice)) {
            this.settings.group_choice = this.settings.groups[0]
        }
        
        this.find_groups_not_included()
        this.add_tabs()

        if (this.settings.collapsed) {
            this.minimise_button = create("i", `pi pi-minus header_button collapse_button`, this.header1_right)
            this.delete_button = create('i', 'pi pi-times header_button', this.header1_right)
        } else {
            this.add_group_button = create('i', 'pi pi-plus header_button last', this.header1_left)
            if (this.settings.group_choice != Texts.ALL_GROUPS && this.settings.group_choice != Texts.UNGROUPED) {
                this.group_mode_button = create('i', 'pi header_button mode', this.header2_left)
            }
            this.show_advanced_button = create('i', `pi pi-bolt header_button${this.settings.advanced ? " clicked":""}`, this.header2_left)
            if (this.settings.groups.length>1) {
                this.remove_group_button = create('i', 'pi pi-trash header_button', this.header2_right)
            }
            this.minimise_button = create("i", `pi pi-minus header_button collapse_button`, this.header1_right)
            this.delete_button = create('i', 'pi pi-times header_button', this.header1_right)
        }


        /*
        Node blocks
        */

        this.new_node_id_list = []
        this.remove_absent_nodes()
        this.settings.node_order.forEach( (n) => {this.consider_adding_node(n)} )
        this.set_node_visibility()

        if (this.node_count == 0) {
            const EMPTY_MESSAGE = 
                "<p>Add nodes to the controller<br/>by right-clicking the node<br/>and using the Controller Panel submenu</p>"
            create('span', 'empty_message', this._main, {"innerHTML":EMPTY_MESSAGE})
        }

        this.add_button_actions()

        const bars = getSettingValue(SettingIds.SHOW_SCROLLBARS, "thin")
        classSet(this, "hide_scrollbars", bars == "no")
        classSet(this, "small_scrollbars", bars == "thin")

        /*
        Finalise
        */
        this.replaceChild(this._main, this.main)
        this.replaceChild(this._header, this.header)
        this.header = this._header
        this.main = this._main
        
        this.set_position()
        observe_resizables( this, this.on_child_height_change.bind(this) )
    }

    find_groups_not_included() {
        const all_options = GroupManager.list_group_names()
        const all_used = new Set()
        this.settings.groups.forEach((g)=>all_used.add(g))
        this.groups_not_included = all_options.filter((g)=>!(all_used.has(g)))
    }

    add_tabs() {
        this.settings.groups.forEach((nm) => {
            const tab = create('span','tab',this.header1_left,{"innerHTML":nm.replaceAll(' ','&nbsp;')})
            classSet(tab,'selected',(this.settings.group_choice == nm))
            tab.style.setProperty('--base-color', GroupManager.group_color(nm))
            tab.addEventListener('mouseenter', ()=>{Highlighter.group(nm)})
            tab.addEventListener('mouseleave', ()=>{Highlighter.group(null)})
            tab.addEventListener('mousedown', (e) => {
                if (e.ctrlKey) return
                this.mouse_down_at_x = e.x
                this.mouse_down_at_y = e.y
                this.mouse_down_on = tab
                if (document.activeElement) document.activeElement.blur()
            })
            tab.addEventListener('mouseup', (e) => {
                if (this.mouse_down_on == tab && Math.abs(this.mouse_down_at_x - e.x) < 2 && Math.abs(this.mouse_down_at_y - e.y) < 2) {
                    if (this.settings.collapsed) {
                        this.settings.collapsed = false
                        UpdateController.make_single_request('uncollapse', this) 
                    } else {
                        if (this.settings.group_choice == nm) {
                            return
                        }
                        this.settings.group_choice = nm
                        UpdateController.make_single_request(`tab ${nm} clicked`, this) 
                    }
                    this.mouse_up()
                    e.preventDefault()
                    e.stopPropagation()
                }
                this.mouse_down_on = null
            })

            tab.addEventListener('click', (e)=>{
                e.preventDefault()
                e.stopPropagation()
                if (e.ctrlKey) {
                    app.canvas.animateToBounds(createBounds(app.graph._groups.filter((g)=>(g.title==nm))))
                } else {
                    if (this.settings.groups.length==1) this.show_group_select(e, true)
                }
            })

            title_if_overflowing(tab, nm)

        })
    }

    add_button_actions() {
        if (this.add_group_button) { 
            this.add_group_button.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (app.canvas.read_only) return
                this.show_group_select(e)
            })
            add_tooltip(this.add_group_button, 'Add new group tab', 'right')
            classSet(this.add_group_button, 'hidden', (this.groups_not_included.length==0))
        } 

        if (this.remove_group_button) {
            this.remove_group_button.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                if (app.canvas.read_only) return
                this.settings.groups = this.settings.groups.filter((g)=>g!=this.settings.group_choice)
                //if (this.settings.groups.length==0) {
                //    this.delete_controller()
                //}
                UpdateController.make_single_request('group removed', this)
            })
            add_tooltip(this.remove_group_button, 'Remove active group tab', 'right')
        }

        if (this.group_mode_button) {
            const node_mode = GroupManager.group_node_mode(this.settings.group_choice)
            this.group_mode_button.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                if (app.canvas.read_only) return
                GroupManager.change_group_mode(this.settings.group_choice, node_mode, e)
                app.canvas.setDirty(true,true)
                ControllerPanel.group_change(this.settings.group_choice)
            })
            add_tooltip(this.group_mode_button, Texts.MODE_TOOLTIP[node_mode], 'right')
            
            classSet(this.group_mode_button, 'mode_0', node_mode==0)
            classSet(this.group_mode_button, 'mode_2', node_mode==2)
            classSet(this.group_mode_button, 'mode_4', node_mode==4)
            classSet(this.group_mode_button, 'mode_9', node_mode==9)

        }

        if (this.show_advanced_button) {
            this.show_advanced_button.addEventListener('click', (e) => {
                if (app.canvas.read_only) return
                this.settings.advanced = !this.settings.advanced
                this.redraw()
                e.stopPropagation()    
            })
            add_tooltip(this.show_advanced_button, `${this.settings.advanced?"Hide":"Show"} advanced controls`, 'right')
            classSet(this.show_advanced_button, 'hidden', !this.showAdvancedCheckbox)
        }

        if (this.minimise_button) {
            this.minimise_button.addEventListener("click", (e)=>{ 
                e.preventDefault(); 
                e.stopPropagation(); 
                if (app.canvas.read_only) return
                this.settings.collapsed = !this.settings.collapsed
                UpdateController.make_single_request('collapse', this) 
            })
            classSet(this.minimise_button, 'hidden', this.settings.collapsed)
        }

        if (this.delete_button) {
            this.delete_button.addEventListener('click', (e) => {
                if (app.canvas.read_only) return
                this.delete_controller()    
            })
        }
    }

    show_group_select(e, replace) {
        const the_select = create('span','group_add_select', document.body)
        this.groups_not_included.forEach((g)=>{
            const the_choice = create('div', 'group_add_option', the_select, {"innerText":g})
            the_choice.style.backgroundColor = GroupManager.group_color(g)
            the_choice.addEventListener('click', (e)=> {
                if (replace) {
                    this.settings.groups = [g,]
                } else {
                    this.settings.groups.push(g)
                }
                this.settings.group_choice = g
                the_select.remove()
                UpdateController.make_single_request('group tab added', this)
            })
        })
        the_select.addEventListener('mouseleave', (e)=>{the_select.remove()})
        the_select.style.left = `${e.x - 8}px`
        the_select.style.top  = `${e.y - 8}px`
    }

}

customElements.define('cp-div',  ControllerPanel, {extends: 'div'})

