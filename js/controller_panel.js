import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js" 

import { create } from "./elements.js";
import { get_node } from "./utilities.js";
import { SliderOverrides } from "./input_slider.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";
import { get_resizable_heights, observe_resizables, restore_heights } from "./resize_manager.js";
import { Debug } from "./debug.js";

import { NodeInclusionManager } from "./node_inclusion.js";
import { settings } from "./settings.js";
import { SettingIds, Timings, Texts } from "./constants.js";

export class ControllerPanel extends HTMLDivElement {
    static instance = undefined
    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove() }
        ControllerPanel.instance = this
        this.classList.add("controller")

        this.holder = document.getElementById('controller_holder')
        if (!this.holder) {
            this.holder = create('span','controller_holder',document.body,{'id':'controller_holder'})
        }

        this.holder.appendChild(this);
        
        this.node_blocks = {}   // map from node.id to NodeBlock

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
        this.updating_heights = 0

        /*
        Full width footer
        */
        if (document.getElementsByClassName('footer').length>0) {
            this.footer = document.getElementsByClassName('footer')[0]
            if (document.getElementsByClassName('footer').length>1) Debug.error("Too many footers")
        } else {
            this.footer = create('span','footer',this.holder)
        }
        this.holder.appendChild(this.footer) // move to the end
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

        if (ControllerPanel.showing()) ControllerPanel.redraw()
        else ControllerPanel.hide()

    }

    static toggle() {
        if (ControllerPanel.instance) {
            if (ControllerPanel.showing()) ControllerPanel.hide()
            else ControllerPanel.redraw()
        }
    }

    static showing() { 
        try { return (settings.showing) }
        catch { return false; }// graph not loaded, so settings unavailable, so don't show
    }

    static redraw() {
        Debug.trivia("In ControllerPanel.redraw")
        ControllerPanel.instance.build_controllerPanel()
        ControllerPanel.instance.holder.classList.remove('hidden')
        settings.showing = true
    }

    static hide() {
        ControllerPanel.instance.holder.classList.add('hidden')
        try { settings.showing = false } catch { Debug.trivia("settings exception in hide") }
    }

    static graph_cleared() {
        UpdateController.make_request("graph_cleared")
    }

    static on_setup() {
        settings.fix_backward_compatibility()

        const draw = LGraphCanvas.prototype.draw;
        LGraphCanvas.prototype.draw = function() {
            if (ControllerPanel.instance) ControllerPanel.instance.on_update()
            draw.apply(this,arguments);
        }

        UpdateController.setup(ControllerPanel.redraw, ControllerPanel.can_refresh, (node_id)=>ControllerPanel.instance?.node_blocks[node_id])

        NodeInclusionManager.node_change_callback = UpdateController.make_request
        api.addEventListener('graphCleared', ControllerPanel.graph_cleared) 
    }

    static can_refresh() {  // returns -1 to say "no, and don't try again", 0 to mean "go ahead!", or n to mean "wait n ms then ask again"
        try {
            if (app.configuringGraph) {  Debug.trivia("configuring"); return -1 }
            if (!ControllerPanel.showing()) { return -1 }
            if (ControllerPanel.instance.classList.contains('unrefreshable')) { Debug.trivia("already refreshing"); return -1 }
            if (ControllerPanel.instance.updating_heights > 0) { Debug.trivia("no refresh because updating heights"); return -1 }
            if (ControllerPanel.instance.contains(document.activeElement) &&
                        document.activeElement != ControllerPanel.instance.group_select ) { Debug.trivia("delay refresh because active element"); return 1 }
         
            const unrefreshables = ControllerPanel.instance.getElementsByClassName('unrefreshable')
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
        try {
            const column_width = this.firstChild.getBoundingClientRect().width
            const abs_left = this.footer.getBoundingClientRect().x - 1
            const column_number = (x) => { return Math.floor((x-abs_left) / column_width) }
            const column = column_number(e.pageX)
            var pretend_over = null

            Array.from(this.holder.firstChild.childNodes).every((nodeblock) => {
                if (column_number(nodeblock.getBoundingClientRect().x) > column) pretend_over = nodeblock
                return (pretend_over == null)
            })
            
            NodeBlock.drag_over_me(e, pretend_over, true)
        } catch (e) {
            Debug.error("Something wrong in nodeblock_dragged_over_footer:")
            console.error(e)
        }
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
            const node_block = new NodeBlock(nd)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
        }
    }

    on_height_change() {
        /*
        this.updating_heights tracks how many times we've been told in the last RESIZE_DELAY_BEFORE_REDRAW ms.
        When that count gets to zero, we have paused for that long, so save and update.
        */
       if (app.configuringGraph) { Debug.extended("height change whiel configuring graph"); return}
        this.updating_heights += 1 
        setTimeout( ()=>{
            this.updating_heights -= 1
            Debug.trivia(`updating_heights stack ${this.updating_heights}`)
            if (this.updating_heights==0) {
                settings.heights = get_resizable_heights(this)
                UpdateController.make_request("heights changed", Timings.END_HEIGHT_CHANGE_PAUSE)
            }
        }, Timings.RESIZE_DELAY_BEFORE_REDRAW )
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
                //this.node_blocks[node_id].on_update()
                this.append(this.node_blocks[node_id])
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
        const style = { "top":"2vh", "bottom":"", "left":"10px", "justify-content":"", "border":"thin solid white", "border-radius":"4px", "border-width":"thin" }
        if (this.new_menu_position=="Top") {
            const top_element = document.getElementsByClassName('comfyui-body-top')[0].getBoundingClientRect()
            style["top"] = `${top_element.bottom}px`
            const left_element = document.getElementsByClassName('comfyui-body-left')[0].getBoundingClientRect()
            style["left"] = `${left_element.right}px`
            style["border-color"]  = "#353535"
            style["border-radius"] = "0px"
            style["border-width"]  = "0 thick thick 0"
            style["max-height"] = `calc(100vh - ${top_element.bottom}px)`
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
            style["max-height"] = `calc(100vh - ${bottom_element.height}px)`
        }
        Object.assign(this.holder.style, style)
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
            this.holder.style.zIndex = app.graph.nodes.length + 1
        } catch {
            this.holder.style.zIndex = 1000000
        }
        this.new_menu_position = settings.getSettingValue('Comfy.UseNewMenu', "Disabled")
        SliderOverrides.setup()
        GroupManager.setup(  )

        /* 
        Create the top section
        */
        this.header_span = create('span', 'header', this)
        this.refresh = create('span', 'refresh_button', this.header_span, {"innerHTML":"&#10227;"})
        this.refresh.addEventListener('click', (e) => {UpdateController.make_request("refresh_button")})
        create('span', 'header_title', this.header_span, {"innerText":"Controller"})

        this.extra_controls = create('span', 'extra_controls', this)

        if (GroupManager.any_groups()) {
            this.group_select = create("select", 'header_select', this.header_span) 
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

        var gc = ""
        try {
            gc = GroupManager.valid_option(settings.group_choice)
            if (gc != settings.group_choice) settings.group_choice = gc
        } catch {
            gc = Texts.ALL_GROUPS
            setTimeout(settings.initialise.bind(settings), Timings.SETTINGS_TRY_RELOAD)

        }

        /*
        Add the nodes
        */

        this.new_node_id_list = []
        this.remove_absent_nodes()
        settings.node_order.forEach( (n) => {this.consider_adding_node(n)} )
        app.graph._nodes.forEach( (n) => {this.consider_adding_node(n)} )
        if (this.new_node_id_list.length>0) settings.node_order = this.new_node_id_list

        const node_count = this.set_node_visibility()
        observe_resizables( this, this.on_height_change.bind(this) )
        if (settings.heights) restore_heights( this.node_blocks, settings.heights )

        if (node_count.nodes == 0) {
            var keystroke = settings.getSettingValue(SettingIds.KEYBOARD_TOGGLE,"C")
            if (keystroke.toUpperCase() == keystroke) keystroke = "Shift-" + keystroke
            const EMPTY_MESSAGE = 
                "<p>Add nodes to the controller by right-clicking the node<br/>and using the Controller Panel submenu</p>" + 
                `<p>Toggle controller visibility with ${keystroke}</p>`
            create('span', 'empty_message', this, {"innerHTML":EMPTY_MESSAGE})
        }

        if (this.showAdvancedCheckbox) {
            const add_div = create('div', 'advanced_controls', this.extra_controls)
            this.show_advanced = create("input", "advanced_checkbox", add_div, {"type":"checkbox", "checked":settings.advanced})
            create('span', 'advanced_label', add_div, {"innerText":"Show advanced controls"})
            this.show_advanced.addEventListener('input', function (e) {
                settings.advanced = e.target.checked
                ControllerPanel.redraw()
            }.bind(this))
            this.in
        }

        if (this.new_menu_position=="Disabled") {
            this.submit_button = create("button","submit_button",this.footer,{"innerText":"Submit"})
            this.submit_button.addEventListener('click', () => { document.getElementById('queue-button').click() } )
        }
        
        if (settings.holder_height) { this.holder.style.height = `${settings.holder_height}px` }
        this.style.setProperty('--actual-height', `${this.holder.getBoundingClientRect().height}px`);

        new ResizeObserver( () => { 
            const actual = this.holder.getBoundingClientRect().height
            const [bottom_of_children, tallest_child] = this.bottom_of_tallest_child()
            const bottom_of_me = this.holder.getBoundingClientRect().bottom - 15
            if (bottom_of_children > bottom_of_me) tallest_child.require_shrink( bottom_of_children - bottom_of_me )
            if (settings.holder_height == actual) return
            settings.holder_height = actual; 
            this.style.setProperty('--actual-height', `${actual}px`);
        } ).observe(this.holder)

        setTimeout( this.set_position.bind(this), 20 )
    }

    bottom_of_tallest_child() {
        var bottom_of_tallest_so_far = 0
        var the_tallest_child = null
        this.childNodes.forEach((child) => { 
            if (child.bottom_of_lowest_element) {
                const bottom_of_this_child = child.bottom_of_lowest_element()
                if (bottom_of_this_child > bottom_of_tallest_so_far) {
                    the_tallest_child = child
                    bottom_of_tallest_so_far = bottom_of_this_child
                }
            } 
        })
        return [bottom_of_tallest_so_far, the_tallest_child]
    }

    save_node_order() {
        const node_id_list = []
        this.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        settings.node_order = node_id_list
    }

}

customElements.define('cp-div',  ControllerPanel, {extends: 'div'})

