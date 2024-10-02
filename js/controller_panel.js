import { app } from "../../scripts/app.js";
import { CGControllerNode } from "./controller_node.js"
import { create } from "./elements.js";
import { api } from "../../scripts/api.js";

class Entry extends HTMLDivElement {
    constructor(node, target_widget) {
        super()
        this.classList.add('controller_entry')
        create('span','controller_item_label', this, {'innerText':target_widget.name} )  
        this.valid_entry = false

        this.input_element = undefined
        if (target_widget.type=='text' || target_widget.type=='number' ) {
            this.input_element = create('input', 'controller_input', this)  
        } else if (target_widget.type=="customtext") {
            this.input_element = create("textarea", 'controller_input', this)       
        } else if (target_widget.type=="combo") {
            this.input_element = create("select", 'controller_input', this) 
            target_widget.options.values.forEach((o) => this.input_element.add(new Option(o,o)))
        }  
        
        if (this.input_element) {
            this.input_element.addEventListener('input', (e) => {
                target_widget.value = e.target.value
                target_widget.callback?.()
                app.graph.setDirtyCanvas(true,true)
            } )
        }

        if (target_widget.type=="button") {
            this.input_element = create("button", 'controller_input', this, {"innerText":target_widget.label})
            this.input_element.addEventListener('click', (e)=>this.target_widget.callback())
        }

        if (this.input_element) {
            this.target_widget = target_widget
            this.update()
            this.valid_entry = true
        } 
    }

    update() {
        this.input_element.value = this.target_widget.value
    }
}

function is_image_node(node) {
    return (
        node.imgs ||
        ( node.widgets &&
          node.widgets.findIndex((obj) => obj.name === 'image') >= 0) ||
        node.title.indexOf('Image')>=0
      )
}

class NodeBlock extends HTMLSpanElement {
    constructor(node) { 
        super()
        this.node = node
        this.classList.add("controller_node")
        const up_arrow = create("span", 'node_up', this, {'innerHTML':"&uarr;"})
        create("span", 'controller_node_label', this, {"innerText":node.title})
        this.valid_nodeblock = false
        node.widgets?.forEach(w => {
            const e = new Entry(node, w)
            if (e.valid_entry) {
                this.appendChild(e)
                this.valid_nodeblock = true
            } 
        })
        if (is_image_node(node)) {
            this.image_panel = create("span", "controller_node_image no_image", this)
            node._imgs = node.imgs
            if (!Object.hasOwn(node, "imgs")) {
                Object.defineProperty(node, "imgs", {
                    get : () => { return node._imgs },
                    set : (v) => { node._imgs = v; this.show_image(v) }
                })
            }
            if (node._imgs) this.show_image(node._imgs)
            this.valid_nodeblock = true
        }

        const down_arrow = create("span", 'node_down', this, {'innerHTML':"&darr;"})

        up_arrow.addEventListener('click',(e)=> {
            if (this.previousSibling && this.previousSibling.valid_nodeblock) {
                this.parentElement.insertBefore(this, this.previousSibling)
                this.parentElement.save_node_order()
            }
        })
        down_arrow.addEventListener('click',(e)=> {
            if (this.nextSibling && this.nextSibling.valid_nodeblock) {
                this.parentElement.insertBefore(this.nextSibling, this)
                this.parentElement.save_node_order()
            }
        })
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

    update() { 
        // TODO check if the list of widgets has changed
        for (let element of this.children) { 
            if (element.update) element.update()
        }
    }
}

export class ControllerPanel extends HTMLDivElement {
    instance = undefined
    constructor() {
        super()
        if (ControllerPanel.instance) { ControllerPanel.instance.remove()}
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.body.appendChild(this);
        this.node_blocks = {}   // map from node.id to NodeBlock
        this.state = CGControllerNode.instance.properties
        
        if (ControllerPanel.showing()) ControllerPanel.show()
        else ControllerPanel.hide()
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

    static force_redraw() {
        const temp = create('span',null,ControllerPanel.instance)
        setTimeout(()=>{temp.remove()}, 100)
    }

    include_node_id(node_id) {
        return this.include_node(app.graph._nodes_by_id[node_id])
    }
    include_node(node) { 
        return (node && (node.color == '#322' || node.color == '#332922') && node.mode == 0) 
    }

    create_node_block_for_node_id(node_id) {
        return this.create_node_block_for_node( app.graph._nodes_by_id[node_id] )
    }
    create_node_block_for_node(node) {
        if (this.include_node(node)) {
            const node_block = new NodeBlock(node)
            if (node_block.valid_nodeblock) {
                this.node_blocks[node.id] = node_block
                return node_block
            }
        }
        return null
    }

    build() { 
        this.innerHTML = ""

        create('span', 'title_message', this, {'innerHTML':'Comfy Controller'})

        // restore existing node_blocks (in order)
        this.state.node_order?.forEach((node_id) => {
            if (this.include_node_id(node_id)) {             // is it still valid?
                if (!this.node_blocks[node_id]) {            // if we don't have it, try to create it
                    this.create_node_block_for_node_id(node_id) 
                }
                if (this.node_blocks[node_id]) {             // if it exists, add it
                    this.node_blocks[node_id].update()
                    this.append(this.node_blocks[node_id])
                }
            }
        })
        
        // now check all the nodes
        app.graph._nodes.forEach(node => {
            if (!this.node_blocks[node.id]) {                 // if we don't have it
                const nb = this.create_node_block_for_node(node) // try to create it
                if (nb) this.appendChild(nb)                  // and add it
            }
        })

        this.save_node_order()

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
            const add_span = create('span', 'advanced advanced_controls', this)
            this.show_advanced = create("input", "advanced_checkbox", add_span, {"type":"checkbox", "checked":(this.state?.advanced=='1')})
            create('span', 'advanced_label', add_span, {"innerHTML":"Show advanced controls"})
            this.show_advanced.addEventListener('input', function (e) {
                this.state.advanced = e.target.checked ? '1':'0'
                this.build()
            }.bind(this))
        }
    }

    save_node_order() {
        const node_id_list = []
        this.childNodes.forEach((child)=>{if (child?.node?.id) node_id_list.push(child.node.id)})
        this.state['node_order'] = node_id_list
    }

    static update() {
        for (let node of ControllerPanel.instance.children) { if (node.update) node.update() }
    }
}

function onStatus(exec_info) {
    if (ControllerPanel?.instance?.submit_button) {
        if (exec_info?.detail?.exec_info?.queue_remaining) ControllerPanel.instance.submit_button.disabled = true;
        else ControllerPanel.instance.submit_button.disabled = false;
    }
}
api.addEventListener('status', onStatus)

customElements.define('cp-div',    ControllerPanel, {extends: 'div'})
customElements.define('cp-span',   NodeBlock,       {extends: 'span'})
customElements.define('cp-input',  Entry,           {extends: 'div'})