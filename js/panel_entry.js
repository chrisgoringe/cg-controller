import { app } from "../../scripts/app.js";
import { create } from "./elements.js";
import { InputSlider } from "./input_slider.js";
import { rounding } from "./utilities.js";

export class Entry extends HTMLDivElement {
    /*
    Entry represents a single widget within a NodeBlock
    */
    constructor(node, target_widget) {
        super()
        this.classList.add('entry')
        create('span','entry_label', this, {'innerText':target_widget.name} )  
        this.valid_entry = false

        this.input_element = undefined

        /* These all update the target on 'input' */
        if (target_widget.type=='text' || target_widget.type=='number' ) {
            if (target_widget.type=='number' && 
                InputSlider.can_be_slider(node, target_widget)) {
                this.input_element = new InputSlider(node, target_widget)
                this.appendChild(this.input_element)
            } else {
                this.input_element = create('input', 'input', this)  
            }
        } else if (target_widget.type=="customtext") {
            this.input_element = create("textarea", 'input', this)
            this.resizable = true  
        } else if (target_widget.type=="combo") {
            if ( target_widget.name=='control_after_generate' && !app.ui.settings.getSettingValue("Controller.extras.control_after_generate", false) ) {
                return
            }
            this.input_element = create("select", 'input', this) 
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
            this.input_element = create("button", 'input', this, {"innerText":target_widget.label})
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

customElements.define('cp-input',  Entry, {extends: 'div'})