import { app } from "../../scripts/app.js";
import { create } from "./elements.js";
import { FancySlider } from "./input_slider.js";
import { rounding } from "./utilities.js";
import { make_resizable } from "./resize_manager.js";
import { UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";

function typecheck_number(v) {
    const vv = parseFloat(v)
    if (isNaN(vv)) return null
    return vv
}

function typecheck_other(v) { return v }

export class Entry extends HTMLDivElement {
    /*
    Entry represents a single widget within a NodeBlock
    */
    constructor(node, target_widget) {
        super()
        if (target_widget.disabled) return
        if (target_widget.name=='control_after_generate' && !app.ui.settings.getSettingValue("Controller.extras.control_after_generate", false)) return

        this.classList.add('entry')
        this.entry_label = create('span','entry_label', this, {'innerText':target_widget.name, 'draggable':false} )  
        this.target_widget = target_widget
        this.input_element = null

        switch (target_widget.type) {
            case 'text':
                this.input_element = create('input', 'input', this) 
                break
            case 'customtext':
                this.input_element = create("textarea", 'input', this)
                make_resizable( this.input_element, node.id, [target_widget.name, "input_element"] )
                break
            case 'number':
                this.input_element = new FancySlider(node, target_widget, this)
                break
            case 'combo':
                this.input_element = create("select", 'input', this) 
                target_widget.options.values.forEach((o) => this.input_element.add(new Option(o,o)))
                break
            case 'button':
                var label = target_widget.label
                if (!label) {
                    label = target_widget.name
                    this.entry_label.innerText = ""
                }
                this.input_element = create("button", 'input', this, {"innerText":label})
                break
            default:
                return
        }  
        
        if (!this.input_element) return
  
        switch (target_widget.type) {
            case 'button':
                this.input_element.addEventListener('click', this.button_click_callback.bind(this)) 
                break
            default:
                this.input_element.addEventListener('input', this.input_callback.bind(this))
                this.input_element.addEventListener('keydown', this.keydown_callback.bind(this))
        }

        this.typecheck = (target_widget.type=='number') ? typecheck_number : typecheck_other
        this.original_target_widget_callback = target_widget.callback
        target_widget.callback = this.widget_callback_callback.bind(this)

        this.render()
    }

    valid() { return (this.input_element != null) }

    input_callback(e) {
        const v = this.typecheck(e.target.value)
        if (v != null) {
            target_widget.value = v
            target_widget.callback?.(v)
            app.graph.setDirtyCanvas(true,true)
        }
    }

    keydown_callback(e) {
        if (e.key=="Enter") document.activeElement.blur();
    }

    button_click_callback(e) {
        this.target_widget.callback(); 
        app.graph.setDirtyCanvas(true,true); 
        UpdateController.make_request()
    }

    widget_callback_callback (v) {
        if (this.firing_widget_callback) return                
        this.firing_widget_callback = true
        this._widget_calling_callback(v)
        this.firing_widget_callback = false
    } 

    _widget_calling_callback(v) {
        if (this.target_widget.type=="button") {
            this.original_target_widget_callback?.(v)
            UpdateController.make_request()
        } else {
            if (this.input_element.value == v) return
            this.input_element.value = v
            this.original_target_widget_callback?.(v)
        }
    }

    render() {
        if (document.activeElement == this.input_element) return
        if (this.input_element.value == this.target_widget.value) return
        this.input_element.value = rounding(this.target_widget.value, this.target_widget.options)
    }
}

customElements.define('cp-input',  Entry, {extends: 'div'})