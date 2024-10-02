import { app } from "../../scripts/app.js";
import { CGControllerNode } from "./controller_node.js"
import { create } from "./elements.js";

class Entry extends HTMLDivElement {
    constructor(node, target_widget) {
        super()
        this.classList.add('controller_entry')
        create('span','controller_item_label', this, {'innerText':target_widget.name} )  
        this.valid = false

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
                app.graph.setDirtyCanvas(true,true)
            } )
            this.target_widget = target_widget
            this.update()
            this.valid = true
        } 
    }

    update() {
        this.input_element.value = this.target_widget.value
    }
}

class NodeBlock extends HTMLSpanElement {
    constructor(node) { 
        super()
        this.node = node
        this.classList.add("controller_node")
        const up_arrow = create("span", 'node_up', this, {'innerHTML':"&uarr;"})
        create("span", 'controller_node_label', this, {"innerText":node.title})
        this.valid = false
        node.widgets.forEach(w => {
            const e = new Entry(node, w)
            if (e.valid) {
                this.appendChild(e)
                this.valid = true
            } 
        })
        const down_arrow = create("span", 'node_down', this, {'innerHTML':"&darr;"})

        up_arrow.addEventListener('click',(e)=> {
            if (this.previousSibling) {
                this.parentElement.insertBefore(this, this.previousSibling)
                this.parentElement.save_node_order()
            }
        })
        down_arrow.addEventListener('click',(e)=> {
            if (this.nextSibling) {
                this.parentElement.insertBefore(this.nextSibling, this)
                this.parentElement.save_node_order()
            }
        })
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
        ControllerPanel.instance = this
        this.classList.add("controller")
        document.body.appendChild(this);
        this.node_blocks = {}   // map from node.id to NodeBlock
        this.state = CGControllerNode.instance.properties
        
        if (ControllerPanel.showing()) ControllerPanel.show()
        else ControllerPanel.hide()
    }

    static showing() { 
        return (ControllerPanel.instance?.state['showing'] == '1')
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

    include_node_id(node_id) {
        return this.include_node(app.graph._nodes_by_id[node_id])
    }
    include_node(node) { 
        return (node && node.color == '#322'  && node.mode == 0) 
    }

    create_node_block_for_node_id(node_id) {
        return this.create_node_block_for_node( app.graph._nodes_by_id[node_id] )
    }
    create_node_block_for_node(node) {
        if (this.include_node(node)) {
            const node_block = new NodeBlock(node)
            if (node_block.valid) {
                this.node_blocks[node.id] = node_block
                return node_block
            }
        }
        return null
    }

    build() { 
        this.innerHTML = ""

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

customElements.define('cp-div',    ControllerPanel, {extends: 'div'})
customElements.define('cp-span',   NodeBlock,       {extends: 'span'})
customElements.define('cp-input',  Entry,           {extends: 'div'})