import { app } from "../../scripts/app.js";

import { create } from "./elements.js";
import { get_node } from "./utilities.js";
import { SliderOverrides } from "./input_slider.js";
import { GroupManager } from "./groups.js";

import { UpdateController } from "./update_controller.js";
import { NodeBlock } from "./nodeblock.js";



export class ControllerPanel extends HTMLDivElement {
    instance = undefined
    static drag_happening = false
    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove() }
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.body.appendChild(this);
        
        this.node_blocks = {}   // map from node.id to NodeBlock
        if (!app.graph.extra.controller_panel) app.graph.extra.controller_panel = {}
        this.state = app.graph.extra.controller_panel
        
        if (ControllerPanel.showing()) ControllerPanel.show()
        else ControllerPanel.hide()

        this.addEventListener('dragstart', (e) => { ControllerPanel.drag_happening = true })
        this.addEventListener('dragend',   (e) => { this.save_node_order(); ControllerPanel.drag_happening = false } )
    }

    static toggle() {
        if (ControllerPanel.instance) {
            if (ControllerPanel.showing()) ControllerPanel.hide()
            else ControllerPanel.show()
        }
    }

    static showing() { 
        return (ControllerPanel.instance?.state?.showing == '1')
    }

    static show() {
        console.log("In ControllerPanel.show")
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
        ControllerPanel.instance.restore_heights()
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

        UpdateController.setup(ControllerPanel.refresh_unless_active, 100, [10, 1000, 4000])
        const change = app.graph.change
        app.graph.change = function() {
            UpdateController.instance.make_request()
            change.apply(this, arguments)
        }
    }

    static refresh_unless_active() {
        if (! ControllerPanel.instance.contains( document.activeElement ) && 
            ! ControllerPanel.drag_happening && 
              ControllerPanel.showing())    {
                                                ControllerPanel.show()
                                            }
    }

    on_update() {
        const qt = document.getElementsByClassName('comfy-menu-queue-size')
        if (this.submit_button) {
            this.submit_button.disabled = ( qt && qt.length>0 && !(qt[0].innerText.includes(' 0')) )
        }
    }

    include_node(node_or_node_id) { 
        const nd = get_node(node_or_node_id)
        return (nd && (nd.color == this.main_color || nd.color == this.advn_color) && nd.mode == 0) 
    }

    maybe_create_node_block_for_node(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        if (this.include_node(nd)) {
            const node_block = new NodeBlock(nd, this.force_redraw)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
        }
    }

    setup_resize_observer() {
        this.resize_observer = new ResizeObserver( (entries) => {this.save_heights(); ControllerPanel.force_redraw();} )
        function recursive_observe(node) {
            if (node.resizable) this.resize_observer.observe(node.input_element)
            node.childNodes.forEach((child) => { recursive_observe.apply(this, [child]) })
        }
        recursive_observe.apply(this,[this])
    }

    consider_adding_node(node_or_node_id) {
        const node_id = (node_or_node_id.id) ? node_or_node_id.id : node_or_node_id
        if (this.new_node_id_list.includes(node_id)) return   // already got it in the new list
        if (this.include_node(node_or_node_id)) {             // is it still valid?
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
                if (node_block.node.color == this.advn_color) {
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

    set_colors() {
        const main_color_name = app.ui.settings.getSettingValue("Controller.color", "red")
        const advn_color_name = app.ui.settings.getSettingValue("Controller.color.advanced", "brown")
        this.main_color = LGraphCanvas.node_colors[main_color_name].color
        this.advn_color = LGraphCanvas.node_colors[advn_color_name].color
        this.advn_bgcolor = LGraphCanvas.node_colors[advn_color_name].bgcolor
    }

    build_controllerPanel() { 
        this.innerHTML = ""
        this.style.zIndex = app.graph.nodes.length + 1
        this.new_menu_position = app.ui.settings.getSettingValue('Comfy.UseNewMenu', "Disabled")
        SliderOverrides.setup()
        this.set_colors()
        GroupManager.setup( this.main_color, this.advn_color )

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
            this.group_select.addEventListener('input', (e)=>{ this.state.group_choice = e.target.value; ControllerPanel.show() })
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
        this.setup_resize_observer()
        this.restore_heights()

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
            add_div.style.background = this.advn_bgcolor
            this.show_advanced.addEventListener('input', function (e) {
                this.state.advanced = e.target.checked ? '1':'0'
                ControllerPanel.show()
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

    save_heights() {
        this.state.heights = []
        this.main_container.childNodes.forEach((child)=>{
            child.childNodes.forEach((grandchild) => {
                if (grandchild.resizable) {
                    this.state.heights.push( [child.node.id, grandchild.target_widget.name, grandchild.input_element.style.height] )
                }
            })
        })  
    }

    restore_heights() {
        this.state?.heights?.forEach((id_name_height) => {
            if (this.node_blocks[id_name_height[0]]) {
                const nb = this.node_blocks[id_name_height[0]]
                nb.childNodes.forEach((grandchild) => {
                    if (grandchild?.target_widget?.name==id_name_height[1]) {
                        grandchild.input_element.style.height = id_name_height[2]
                    }
                })
            }
        })
    }

    save_node_order() {
        const node_id_list = []
        this.main_container.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        this.state['node_order'] = node_id_list
    }


}

customElements.define('cp-div',    ControllerPanel, {extends: 'div'})

