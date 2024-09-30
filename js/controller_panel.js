import { app } from "../../scripts/app.js";

function create( tag, clss, parent ) {
    const nd = document.createElement(tag);
    nd.classList.add(clss);
    if (parent) parent.appendChild(nd)
    return nd;
}

class Entry extends HTMLDivElement {
    constructor(node, target_widget) {
        super()
        this.classList.add('controller-entry')
        const label = create('span','controller_item_label', this )  
        label.innerText = `${target_widget.name}`
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


export class ControllerPanel extends HTMLDivElement {
    instance = undefined
    constructor() {
        super()
        ControllerPanel.remove()
        this.classList.add("controller")
        document.body.appendChild(this);
        ControllerPanel.instance = this
        this.build() 
    }

    static showing() { return ControllerPanel.instance }
    static remove() { 
        if (ControllerPanel.instance) document.body.removeChild(ControllerPanel.instance) 
        ControllerPanel.instance = undefined
    }

    build() { 
        this.innerHTML = ""
        app.graph._nodes.forEach(node => {
            if (node.color == '#322'  && node.mode == 0) {
                var valid = false
                const nd = create("span", "controller_node")
                nd.update = function () { this.children.forEach((node) => node?.update()) }.bind(nd)
                const nd_title = create("span", 'controller_node_label', nd)
                nd_title.innerText = node.title
                node.widgets.forEach(w => {
                    const e = new Entry(node, w)
                    if (e.valid) {
                        nd.appendChild(e)
                        valid = true
                    } 
                })
                if (valid) this.appendChild(nd)
            }
        });
    }

    static update() {
        if (ControllerPanel.instance) {
            ControllerPanel.instance.children.forEach((node) => node?.update())
        }
    }
}

customElements.define('cp-div',    ControllerPanel, {extends: 'div'})
customElements.define('cp-input',  Entry,           {extends: 'div'})