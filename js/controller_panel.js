import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { create } from "./elements.js";
import { InputSlider } from "./input_slider.js";
import { rounding, get_node } from "./utilities.js";
import { SliderOverrides } from "./input_slider.js";
import { GroupManager } from "./groups.js";

class UpdateRequestTracker {
    static request_count = 0
    static prevent_until = null
    static make_request() {
        UpdateRequestTracker.request_count += 1
        setTimeout( UpdateRequestTracker._consider_request, 100 )
    }
    static _consider_request() {
        UpdateRequestTracker.request_count -= 1
        if (UpdateRequestTracker.request_count == 0) {
            if (UpdateRequestTracker.prevent_until && new Date() < UpdateRequestTracker.prevent_until) { return }
            UpdateRequestTracker.prevent_until = null
            setTimeout( UpdateRequestTracker._if_showing_show, 10    )
            setTimeout( UpdateRequestTracker._if_showing_show, 1000  )
            setTimeout( UpdateRequestTracker._if_showing_show, 10000 )
        }
    }
    static _if_showing_show() {
        if (ControllerPanel.showing()) ControllerPanel.show()
    }

    static prevent_for(seconds) {
        UpdateRequestTracker.prevent_until = new Date() + seconds
    }
}

class Entry extends HTMLDivElement {
    /*
    Entry represents a single widget within a NodeBlock
    */
    constructor(node, target_widget) {
        super()
        this.classList.add('controller_entry')
        create('span','controller_item_label', this, {'innerText':target_widget.name} )  
        this.valid_entry = false

        this.input_element = undefined

        /* These all update the target on 'input' */
        if (target_widget.type=='text' || target_widget.type=='number' ) {
            if (target_widget.type=='number' && 
                InputSlider.can_be_slider(node, target_widget)) {
                this.input_element = new InputSlider(node, target_widget)
                this.appendChild(this.input_element)
            } else {
                this.input_element = create('input', 'controller_input', this)  
            }
        } else if (target_widget.type=="customtext") {
            this.input_element = create("textarea", 'controller_input', this)
            this.resizable = true  
        } else if (target_widget.type=="combo") {
            if ( target_widget.name=='control_after_generate' && !app.ui.settings.getSettingValue("Controller.extras.control_after_generate", false) ) {
                return
            }
            this.input_element = create("select", 'controller_input', this) 
            target_widget.options.values.forEach((o) => this.input_element.add(new Option(o,o)))
        }  

        if (target_widget.type=='number') {
            this.typecheck = (v) => {
                const vv = parseFloat(v)
                if (isNaN(vv)) return null
                return vv
            }
        } else {
            this.typecheck = (v) => {return v}
        }
        
        if (this.input_element) {
            this.input_element.addEventListener('input', (e) => {
                const v = this.typecheck(e.target.value)
                if (v != null) {
                    target_widget.value = v
                    target_widget.callback?.(v)
                    app.graph.setDirtyCanvas(true,true)
                }
            } )
            this.input_element.addEventListener('keydown', (e) => {
                if (e.key=="Enter") document.activeElement.blur();
            })
        }

        if (target_widget.type=="button") {
            this.input_element = create("button", 'controller_input', this, {"innerText":target_widget.label})
            this.input_element.addEventListener('click', (e)=>this.target_widget.callback())
        }

        if (this.input_element) {
            this.target_widget = target_widget
            this.display_value()
            this.valid_entry = true
        } 
    }

    display_value() {
        if (document.activeElement == this.input_element) return
        if (this.input_element.value == this.target_widget.value) return
        this.input_element.value = rounding(this.target_widget.value, this.target_widget.options)
    }
}

function is_single_image(data) {
    return (data && data.items && data.items.length==1 && data.items[0].type.includes("image"))
}

class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    constructor(node) { 
        super()
        this.node = node
        this.classList.add("controller_main_nodeblock")
        this.draggable = "true"
        this.addEventListener('dragstart', function (e) { NodeBlock.drag_me(e)      } )
        this.addEventListener('dragover',  function (e) { NodeBlock.drag_over_me(e) } )
        this.addEventListener('drop',      function (e) { NodeBlock.drop_on_me(e)   } )
        this.addEventListener('dragend',   function (e) { NodeBlock.drag_end(e)     } )
        this.build_nodeblock()
    }

    dragged = null

    static drag_me(e) {
        NodeBlock.dragged = e.currentTarget
        NodeBlock.dragged.classList.add("being_dragged")
        ControllerPanel.instance.drag_happening = true
    }

    static drag_over_me(e) {
        if (NodeBlock.dragged && e.currentTarget!=NodeBlock.dragged) { 
            if (e.currentTarget != NodeBlock.last_swap) {
                if (e.currentTarget.drag_id=='header') {
                    NodeBlock.dragged.parentElement.insertBefore(NodeBlock.dragged, NodeBlock.dragged.parentElement.firstChild)
                } else if (e.currentTarget.drag_id=='footer') {
                    NodeBlock.dragged.parentElement.appendChild(NodeBlock.dragged)
                } else {
                    if (e.currentTarget.previousSibling == NodeBlock.dragged) {
                        e.currentTarget.parentElement.insertBefore(e.currentTarget, NodeBlock.dragged)
                    } else {
                        e.currentTarget.parentElement.insertBefore(NodeBlock.dragged, e.currentTarget)
                    }
                }
                NodeBlock.last_swap = e.currentTarget
            }
            e.preventDefault(); 
        }
        if (e.currentTarget?.is_image_node && e.currentTarget.is_image_node() && is_single_image(e.dataTransfer)) {
            e.preventDefault(); 
        }
    }

    static async drop_on_me(e) {
        if (NodeBlock.dragged) {
            e.preventDefault(); 
        } else {
            if (e.currentTarget.is_image_node() && is_single_image(e.dataTransfer)) {
                const node = e.currentTarget.node
                e.preventDefault(); 

                /*
                When an IMAGEUPLOAD gets created, it adds an input node to the body. 
                That'll be the last element added, so give it the files, 
                tell it that it has changed and wait for it to do the upload,
                then remove it from the node and the document.
                */
                ComfyWidgets.IMAGEUPLOAD(node, "image", node, app)
                document.body.lastChild.files = e.dataTransfer.files
                await document.body.lastChild.onchange()
                node.widgets.pop()
                document.body.lastChild.remove()

                node.setSizeForImage()
            }
        }
    }

    static drag_end(e) {
        ControllerPanel.instance.save_node_order()
        NodeBlock.dragged.classList.remove("being_dragged")
        NodeBlock.dragged = null
        NodeBlock.last_swap = null
        ControllerPanel.instance.drag_happening = false
    }

    build_nodeblock() {
        this.innerHTML = ""
        this.label = create("span", 'controller_main_nodeblock_label', this, {"innerText":this.node.title})
        this.valid_nodeblock = false
        this.node.widgets?.forEach(w => {
            const e = new Entry(this.node, w)
            if (e.valid_entry) {
                this.appendChild(e)
                this.valid_nodeblock = true
            } 
        })
        if (this.is_image_node()) {
            this.image_panel = create("div", "controller_nodeblock_image_panel no_image", this)
            this.node._imgs = this.node.imgs
            try {
                delete this.node.imgs
                Object.defineProperty(this.node, "imgs", {
                    get : () => { return this.node._imgs },
                    set : (v) => { this.node._imgs = v; this.show_image(v) }
                })               
            } catch { }
            if (this.node._imgs) this.show_image(this.node._imgs)
            this.valid_nodeblock = true
        }

        this.style.backgroundColor = this.node.bgcolor
    }

    is_image_node() {
        return (
            this.node.imgs ||
            ( this.node.widgets &&
              this.node.widgets.findIndex((obj) => obj.name === 'image') >= 0) ||
            this.node.title.indexOf('Image')>=0
          )
    }

    show_image(v) {
        if (this.image_panel.firstChild) this.image_panel.firstChild.remove()
        if (v.length>0) {
            this.image_panel.classList.remove('no_image')
            create('img', 'controller_nodeblock_image', this.image_panel, {'src':v[0].src})
        } else {
            this.image_panel.classList.add('no_image')
        }    
        // some browsers the flex doesn't update when the image is changed!
        ControllerPanel.force_redraw()
    }

}

function recursive_observe(node, observer) {
    if (node.resizable) observer.observe(node.input_element)
    node.childNodes.forEach((child) => {
        recursive_observe(child, observer);           
    })
}

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
        
        if (ControllerPanel.showing()) ControllerPanel.show()
        else ControllerPanel.hide()
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
        if (ControllerPanel.instance.drag_happening) {
            console.log("Drag! Not rebuilding!")
            return
        }
        ControllerPanel.instance.build_controllerPanel()
        ControllerPanel.instance.classList.remove('hidden')
        ControllerPanel.instance.state['showing'] = '1'
    }

    static hide() {
        ControllerPanel.instance.classList.add('hidden')
        ControllerPanel.instance.state['showing'] = '0'
    }

    //last_redraw_request = undefined
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

        const change = app.graph.change
        app.graph.change = function() {
            UpdateRequestTracker.make_request()
            change.apply(this, arguments)
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
            const node_block = new NodeBlock(nd)
            if (node_block.valid_nodeblock) this.node_blocks[nd.id] = node_block
        }
    }

    setup_resize_observer() {
        this.resize_observer = new ResizeObserver( (entries) => {this.save_heights(); ControllerPanel.force_redraw();} )
        recursive_observe(this, this.resize_observer)
    }

    consider_adding_node(node_or_node_id) {
        const node_id = (node_or_node_id.id) ? node_or_node_id.id : node_or_node_id
        if (this.new_node_id_list.includes(node_id)) return   // already got it in the new list
        if (this.include_node(node_or_node_id)) {             // is it still valid?
            if (this.node_blocks[node_id]) {     
        //        this.node_blocks[node_id].build_nodeblock()
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
        this.style.background = LGraphCanvas.node_colors[main_color_name].bgcolor
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
        this.header_span = create('span', 'controller_header_span', this)
        create('span', 'controller_header_title', this.header_span, {"innerText":"Comfy Controller"})
        this.header_span.addEventListener('dragover', function (e) { NodeBlock.drag_over_me(e) } )
        this.header_span.drag_id = "header"

        if (GroupManager.any_groups()) {
            this.group_select = create("select", 'controller_header_select', this.header_span) 
            GroupManager.list_group_names().forEach((nm) => this.group_select.add(new Option(nm,nm)))
            if (this.state.group_choice) { this.group_select.value = this.state.group_choice }
            this.group_select.addEventListener('input', (e)=>{ this.state.group_choice = e.target.value; ControllerPanel.show() })
            this.group_select.addEventListener('click', (e) => UpdateRequestTracker.prevent_for(5) )
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
customElements.define('cp-span',   NodeBlock,       {extends: 'span'})
customElements.define('cp-input',  Entry,           {extends: 'div'})