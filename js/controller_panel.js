import { app } from "../../scripts/app.js";

import { create, get_node, add_tooltip, clamp, classSet } from "./utilities.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { observe_resizables } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";
import { get_all_setting_indices, getSettingValue, global_settings, new_controller_setting_index, get_settings, delete_settings, initialise_settings, valid_settings } from "./settings.js";
import { SettingIds, Timings, Texts } from "./constants.js";

export class ControllerPanel extends HTMLDivElement {
    static instances = {}
    static button = undefined
    constructor(index) {
        super()
        if (index == null) index = new_controller_setting_index()
        if (ControllerPanel.instances[index]) { ControllerPanel.instances[index].remove(); Debug.essential(`removed index clash ${index}`) }
        ControllerPanel.instances[index] = this
        this.index = index
        this.settings = get_settings(index)
        this.classList.add("controller")
        document.getElementsByClassName('graph-canvas-panel')[0].appendChild(this)

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
        
        new ResizeObserver((x) => this.on_size_change()).observe(this)
    }

    static mouse_up_anywhere() {
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            ControllerPanel.instances[k].mouse_up()
        })
    }

    static mouse_move_anywhere(e) {
        Object.keys(ControllerPanel.instances).forEach((k)=>{
            ControllerPanel.instances[k].mouse_move(e)
        })
    } 

    mouse_up() {
        this.should_update_size = false; 
        this.being_dragged = false;
        this.classList.remove('being_dragged')
        this.classList.remove('grabbed')
        this.set_position(true)
    }

    redraw() {
        this.build_controllerPanel()
    }

    static new_workflow() {
        Debug.extended('new_workflow')
        Object.keys(ControllerPanel.instances).forEach((k)=>{ControllerPanel.instances[k].remove()})
        ControllerPanel.instances = {}
        initialise_settings()
        ControllerPanel.add_controllers()
        if (ControllerPanel.menu_button) classSet(ControllerPanel.menu_button, 'showing', !global_settings.hidden) 
        if (!global_settings.hidden && Object.keys(ControllerPanel.instances).length==0) ControllerPanel.create_new()
        UpdateController.make_request('new workflow', 100)
    }

    static graph_cleared() {
        UpdateController.make_request("graph_cleared")
    }

    static create_new(e) {
        const newcp = new ControllerPanel()
        if (e && e.layerX && e.layerY) newcp.settings.set_position(e.layerX,e.layerY,null,null)
        newcp.build_controllerPanel()
    }

    delete_controller() {
        delete_settings(this.settings.index)
        this.remove()
        delete ControllerPanel.instances[this.settings.index]
    }

    static add_controllers() {
        get_all_setting_indices().forEach((i)=>{
            new ControllerPanel(i).redraw()
        })
    }

    static onWindowResize() {
        Object.keys(ControllerPanel.instances).forEach((k)=>ControllerPanel.instances[k].set_position(false))
    }

    static create_menu_icon() {
        if (document.getElementsByClassName('graph-canvas-panel').length>0) {
            const comfy_menu = document.getElementsByClassName('comfyui-menu')[0]
            var spacer = null
            comfy_menu.childNodes.forEach((node)=>{if (node.classList.contains('flex-grow')) spacer = node})
            if (!spacer) spacer = comfy_menu.firstChild
            const buttons = create('span', 'controller_menu_buttons')
            spacer.after(buttons)

            ControllerPanel.menu_button = create('i', 'pi pi-sliders-h controller_menu_button', buttons)
            add_tooltip(ControllerPanel.menu_button, 'Toggle controllers')
            classSet(ControllerPanel.menu_button, 'showing', !global_settings.hidden) 
            ControllerPanel.menu_button.addEventListener('click', ControllerPanel.toggle)

            ControllerPanel.refresh_button = create('i', 'pi pi-sync controller_menu_button', buttons)
            add_tooltip(ControllerPanel.refresh_button, `Refresh controllers`)
            ControllerPanel.refresh_button.addEventListener('click', (e) => {
                UpdateController.make_request("refresh_button");
                ControllerPanel.refresh_button.classList.add("clicked");
                setTimeout(()=>{ControllerPanel.refresh_button.classList.remove("clicked")}, 200);
            })
            
        } else {
            setTimeout(ControllerPanel.create_menu_icon,100)
        }
    }

    static redraw(c) { 
        if (!valid_settings()) {
            ControllerPanel.new_workflow()
            return
        }
        if (c) {
            c.redraw()
        } else {
            Object.values(ControllerPanel.instances).forEach((cp)=>{cp.redraw()})
        }
    }

    static toggle() {
        global_settings.hidden = !global_settings.hidden
        if (ControllerPanel.menu_button) classSet(ControllerPanel.menu_button, 'showing', !global_settings.hidden)
        if (!global_settings.hidden && Object.keys(ControllerPanel.instances).length==0) ControllerPanel.create_new()
        UpdateController.make_request('toggle')
    }

    static can_refresh(c) {  // returns -1 to say "no, and don't try again", 0 to mean "go ahead!", or n to mean "wait n ms then ask again" 
        if (app.configuringGraph) { Debug.trivia("configuring"); return -1 }
        
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
        Object.values(ControllerPanel.instances).forEach((cp)=>{cp._node_change(node_id, moreinfo)})
    }

    _node_change(node_id, moreinfo) {
        if (this.node_blocks[node_id] && this.node_blocks[node_id].parentElement) UpdateController.make_single_request(`node ${node_id} changed ${moreinfo ?? ""}`,this)
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
            if (this.classList.contains('unrefreshable')) { Debug.trivia("already refreshing"); return -1 }
            if (this.contains(document.activeElement) && !document.activeElement.doesntBlockRefresh) { Debug.trivia("delay refresh because active element"); return 1 }
         
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
            const node_block = new NodeBlock(this, nd)
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
            this.settings.set_position(null,null,this.getBoundingClientRect().width,this.getBoundingClientRect().height)
        }
    }

    consider_adding_node(node_or_node_id) {
        const node_id = node_or_node_id.id ?? node_or_node_id
        if (this.new_node_id_list.includes(node_id)) return   // already got it in the new list
        if (NodeInclusionManager.include_node(node_or_node_id)) {             // is it still valid?
            if (this.node_blocks[node_id] && this.node_blocks[node_id].can_reuse()) {     
                //this.node_blocks[node_id].build_nodeblock() do this in set_node_visibility instead
            } else {
                this.maybe_create_node_block_for_node(node_id) 
            }
            if (this.node_blocks[node_id]) {             // if it now exists, add it
                this._main.append(this.node_blocks[node_id])
                this.new_node_id_list.push(node_id)
            }
        }        
    }

    remove_absent_nodes() {
        Object.keys(this.node_blocks).forEach((node_id) => {
            if (!app.graph._nodes_by_id[node_id] || (app.graph._nodes_by_id[node_id] != this.node_blocks[node_id].node)) {
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
                    node_block.remove()
                }
            }
        })
    }

    check_dimensions() {
        if (this.being_dragged) return;
        const box = this.parentElement.getBoundingClientRect()
        this.settings.set_position(
            clamp(this.settings.position.x, 0, box.width  - this.settings.position.w),
            clamp(this.settings.position.y, 0, box.height - this.settings.position.h),
            null, null 
        )
        this.settings.set_position( 
            null, null, 
            clamp(this.settings.position.w, 0, box.width  - this.settings.position.x),
            clamp(this.settings.position.h, 0, box.height - this.settings.position.y)
        )
    }

    set_position(set_by_user) {
        /* 
        if this change was user generated, the new positions are the desired ones.
        Otherwise, retrieve the desired positions
        */
        if (set_by_user) {
            this.settings.store_position()
        } else {
            this.settings.retreive_position()
        }

        //this.check_dimensions()

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
            this.footer.style.height = '20px'
            this.footer_height = 20
        }
    }

    header_mouse_down(e) {
        //if (e.target==this.header_tabs || e.target.parentElement==this.header_tabs) {
            this.being_dragged = true
            this.classList.add('grabbed')
            this.offset_x = e.x - this.settings.position.x
            this.offset_y = e.y - this.settings.position.y
            e.preventDefault()
            e.stopPropagation()
        //}
    }
    mouse_move(e) {
        if (this.being_dragged) {
            if (e.currentTarget==window) {
                this.classList.add('being_dragged')
                this.settings.set_position( e.x - this.offset_x, e.y - this.offset_y, null, null )
                this.set_position(true)
                this.offset_x = e.x - this.settings.position.x
                this.offset_y = e.y - this.settings.position.y
            }
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
        classSet(this, 'hidden', global_settings.hidden)
        this.style.setProperty('--font-size',`${1.333*getSettingValue(SettingIds.FONT_SIZE, 12)}px`)
        GroupManager.setup( )

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
            this.remove_group_button = create('i', 'pi pi-trash header_button', this.header2_left)
            if (this.settings.group_choice != Texts.ALL_GROUPS && this.settings.group_choice != Texts.UNGROUPED) {
                this.bypass_group_button = create('i', 'pi pi-ban header_button', this.header2_left)
            }
            this.show_advanced_button = create('i', `pi pi-bolt header_button${this.settings.advanced ? " clicked":""}`, this.header2_left)
            this.minimise_button = create("i", `pi pi-minus header_button collapse_button`, this.header1_right)
            this.delete_button = create('i', 'pi pi-times header_button', this.header1_right)
        }


        /*
        Node blocks
        */

        this.new_node_id_list = []
        this.remove_absent_nodes()
        this.settings.node_order.forEach( (n) => {this.consider_adding_node(n)} )
        app.graph._nodes.forEach( (n) => {this.consider_adding_node(n)} )
        if (this.new_node_id_list.length>0) this.settings.node_order = this.new_node_id_list

        this.set_node_visibility()

        if (this.node_count == 0) {
            const EMPTY_MESSAGE = 
                "<p>Add nodes to the controller<br/>by right-clicking the node<br/>and using the Controller Panel submenu</p>"
            create('span', 'empty_message', this._main, {"innerHTML":EMPTY_MESSAGE})
        }

        this.add_button_actions()
        
        /*
        Finalise
        */
        this.replaceChild(this._main, this.main)
        this.replaceChild(this._header, this.header)
        this.header = this._header
        this.main = this._main
        
        this.set_position(true)
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
            tab.addEventListener('mousedown', (e) => {
                this.mouse_down_at_x = e.x
                this.mouse_down_at_y = e.y
                this.mouse_down_on = tab
                if (document.activeElement) document.activeElement.blur()
            })
            tab.addEventListener('mouseup', (e) => {
                if (this.mouse_down_on == tab && Math.abs(this.mouse_down_at_x - e.x) < 2 && Math.abs(this.mouse_down_at_y - e.y) < 2) {
                    if (this.settings.collapsed) {
                        this.settings.collapsed = false;
                        UpdateController.make_single_request('uncollapse', this) 
                    } else {
                        if (tab.only_tab) {
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
            if (this.settings.groups.length==1) {
                tab.only_tab = true
                tab.addEventListener('click', (e)=>{
                    e.preventDefault()
                    e.stopPropagation()
                    this.show_group_select(e, true)                    
                })
            }
        })
    }

    add_button_actions() {
        if (this.add_group_button) { 
            this.add_group_button.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                this.show_group_select(e)
            })
            add_tooltip(this.add_group_button, 'Add new group tab', 'right')
            classSet(this.add_group_button, 'hidden', (this.groups_not_included.length==0))
        } 

        if (this.remove_group_button) {
            this.remove_group_button.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                this.settings.groups = this.settings.groups.filter((g)=>g!=this.settings.group_choice)
                if (this.settings.groups.length==0) {
                    this.delete_controller()
                }
                UpdateController.make_single_request('group removed', this)
            })
            add_tooltip(this.remove_group_button, 'Remove active group tab', 'right')
        }

        if (this.bypass_group_button) {
            const bypass = GroupManager.bypassed(this.settings.group_choice)
            this.bypass_group_button.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                GroupManager.toggle_bypass(this.settings.group_choice)
                app.canvas.setDirty(true,true)
            })
            add_tooltip(this.bypass_group_button, `${bypass.all ? 'enable' : 'bypass'} group nodes`, 'right')
            
            classSet(this.bypass_group_button, 'all_bypassed', bypass.any && bypass.all)
            classSet(this.bypass_group_button, 'some_bypassed', bypass.any && !bypass.all)
            classSet(this.bypass_group_button, 'none_bypassed', !bypass.any)
        }

        if (this.show_advanced_button) {
            this.show_advanced_button.addEventListener('click', (e) => {
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
                this.settings.collapsed = (!this.settings.collapsed)
                UpdateController.make_single_request('collapse', this) 
            })
            classSet(this.minimise_button, 'hidden', this.settings.collapsed)
        }

        if (this.delete_button) {
            this.delete_button.addEventListener('click', (e) => {
                this.delete_controller()    
            })
        }
    }

    save_node_order() {
        const node_id_list = []
        this.main.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        this.settings.node_order = node_id_list
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

