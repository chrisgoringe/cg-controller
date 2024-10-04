import { app } from "../../scripts/app.js";
import { CGControllerNode } from "./controller_node.js"
import { create } from "./elements.js";
import { InputSlider } from "./input_slider.js";
import { rounding } from "./utilities.js";

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
                InputSlider.can_be_slider(target_widget.options, app.ui.settings.getSettingValue('Controller.sliders', 1), target_widget.name)) {
                this.input_element = new InputSlider(target_widget.value, target_widget.options, target_widget.name)
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
            this.on_update()
            this.valid_entry = true
        } 
    }

    on_update() {
        if (document.activeElement == this.input_element) return
        if (this.input_element.value == this.target_widget.value) return
        this.input_element.value = rounding(this.target_widget.value, this.target_widget.options)
    }
}

class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    constructor(node) { 
        super()
        this.node = node
        this.classList.add("controller_node")
        this.build()
    }

    build() {
        this.innerHTML = ""
        const up_arrow = create("span", 'node_up', this, {'innerHTML':"&uarr;"})
        this.label = create("span", 'controller_node_label', this, {"innerText":this.node.title})
        this.valid_nodeblock = false
        this.node.widgets?.forEach(w => {
            const e = new Entry(this.node, w)
            if (e.valid_entry) {
                this.appendChild(e)
                this.valid_nodeblock = true
            } 
        })
        if (this.is_image_node()) {
            this.image_panel = create("span", "controller_node_image no_image", this)
            this.node._imgs = this.node.imgs
            if (!Object.hasOwn(this.node, "imgs")) {
                Object.defineProperty(this.node, "imgs", {
                    get : () => { return this.node._imgs },
                    set : (v) => { this.node._imgs = v; this.show_image(v) }
                })
            }
            if (this.node._imgs) this.show_image(this.node._imgs)
            this.valid_nodeblock = true
        }

        const down_arrow = create("span", 'node_down', this, {'innerHTML':"&darr;"})

        up_arrow.addEventListener('click',(e)=> {
            if (this.previousSibling && this.previousSibling.valid_nodeblock) {
                this.parentElement.insertBefore(this, this.previousSibling)
                this.parentElement.parentElement.save_node_order()
            }
        })
        down_arrow.addEventListener('click',(e)=> {
            if (this.nextSibling && this.nextSibling.valid_nodeblock) {
                this.parentElement.insertBefore(this.nextSibling, this)
                this.parentElement.parentElement.save_node_order()
            }
        })
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
            create('img', 'controller_node_image', this.image_panel, {'src':v[0].src})
            //this.image_panel.src = v[0].src
        } else {
            this.image_panel.classList.add('no_image')
        }    
        // some browsers the flex doesn't update when the image is changed!
        ControllerPanel.force_redraw()
    }

    on_update() { 
        this.label.innerText = this.node.title
    }
}

function get_node(node_or_node_id) {
    if (node_or_node_id.id) return node_or_node_id
    return app.graph._nodes_by_id[node_or_node_id]
}

function recursive_update(node) {
    if (node.on_update) node.on_update()
    node.childNodes.forEach( recursive_update )
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
        this.state = CGControllerNode.instance.properties
        this.main_color = '#322'
        this.advn_color = '#332922'
        
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
        ControllerPanel.instance.build()
        ControllerPanel.instance.classList.remove('hidden')
        ControllerPanel.instance.state['showing'] = '1'
    }

    static hide() {
        ControllerPanel.instance.classList.add('hidden')
        ControllerPanel.instance.state['showing'] = '0'
    }

    //last_redraw_request = undefined
    static force_redraw() {
        //const time_now = new Date()
        //if (!ControllerPanel.last_redraw_request || (time_now-ControllerPanel.last_redraw_request)>100) {
        //    ControllerPanel.last_redraw_request = time_now
            const temp = create('span',null,ControllerPanel.instance.main_container)
            ControllerPanel.instance.restore_heights()
            setTimeout(()=>{temp.remove()}, 100)
        //}
    }

    static update() {
        if (ControllerPanel.instance) recursive_update(ControllerPanel.instance)
    }

    static on_setup() {
        const draw = LGraphCanvas.prototype.draw;
        LGraphCanvas.prototype.draw = function() {
            ControllerPanel.update()
            draw.apply(this,arguments);
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
                this.node_blocks[node_id].build()
            } else {
                this.maybe_create_node_block_for_node(node_id) 
            }
            if (this.node_blocks[node_id]) {             // if it now exists, add it
                this.node_blocks[node_id].on_update()
                this.main_container.append(this.node_blocks[node_id])
                this.new_node_id_list.push(node_id)
            }
        }        
    }

    build() { 
        this.innerHTML = ""

        create('span', 'title_message', this, {'innerHTML':'Comfy Controller'})
        this.main_container = create('span','controller_main',this)

        this.new_node_id_list = []
        // restore existing node_blocks (in order)
        this.state.node_order?.forEach( (n) => {this.consider_adding_node(n)} )
        // now check all the nodes
        app.graph._nodes.forEach( (n) => {this.consider_adding_node(n)} )
        this.state['node_order'] = this.new_node_id_list

        this.setup_resize_observer()
        this.restore_heights()

        if (this.state['node_order'].length == 0) {
            create('span', 'empty_message', this, {'innerText':'Nothing to control'})
        }

        this.submit_button = create("button","submit_button",this,{"innerText":"Submit"})
        this.submit_button.addEventListener('click', () => { document.getElementById('queue-button').click() } )

        // show or hide advanced nodes
        var anyAdvancedNodes = false
        this.state.node_order.forEach((node_id) => {
            const node_block = this.node_blocks[node_id]
            if (node_block.node.color == '#332922') {
                anyAdvancedNodes = true
                node_block.classList.add('advanced')
                if (this.state?.advanced=='1') node_block.classList.remove('hidden')
                else node_block.classList.add('hidden')
            }
        })

        if (anyAdvancedNodes) {
            const add_span = create('span', 'advanced advanced_controls', this.main_container)
            this.show_advanced = create("input", "advanced_checkbox", add_span, {"type":"checkbox", "checked":(this.state?.advanced=='1')})
            create('span', 'advanced_label', add_span, {"innerHTML":"Show advanced controls"})
            this.show_advanced.addEventListener('input', function (e) {
                this.state.advanced = e.target.checked ? '1':'0'
                this.build()
            }.bind(this))
        }
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