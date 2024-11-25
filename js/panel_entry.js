import { app } from "../../scripts/app.js";
import { create } from "./utilities.js";
import { FancySlider } from "./input_slider.js";
import { rounding } from "./utilities.js";
import { make_resizable } from "./resize_manager.js";
import { UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";
import { SettingIds } from "./constants.js";
import { Toggle } from "./toggle.js";
import { WidgetChangeManager } from "./widget_change_manager.js";

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
    static count = 0

    _remove() {
        this.remove()
        Object.keys(this).forEach((k)=>{this[k]=null})
        Entry.count -= 1
        //Debug.trivia(`Entry._remove count = ${Entry.count}`)
    }

    constructor(parent_controller, parent_nodeblock, node, target_widget, properties) {
        super()
        Entry.count += 1
        if (target_widget.disabled) return
        if (target_widget.name=='control_after_generate' && !app.ui.settings.getSettingValue(SettingIds.CONTROL_AFTER_GENERATE, false)) return

        const widget_label = target_widget.label ?? target_widget.name

        this.classList.add('entry')
        this.parent_controller = parent_controller
        this.parent_nodeblock = parent_nodeblock
        this.target_widget = target_widget
        this.input_element = null
        this.properties = properties

        switch (target_widget.type) {
            case 'text':
                this.entry_label = create('span','entry_label text', this, {'innerText':widget_label, 'draggable':false} )  
                this.input_element = create('input', 'input', this) 
                break
            case 'customtext':
                this.input_element = create("textarea", 'input', this, {"title":widget_label, "placeholder":widget_label})
                make_resizable( this.input_element, node.id, target_widget.name, properties )
                break
            case 'number':
                this.input_element = new FancySlider(parent_controller, node, target_widget, properties)
                this.is_integer = this.input_element.is_integer
                this.input_element.addEventListener('keydown', this.keydown_callback.bind(this))
                this.appendChild(this.input_element)
                break
            case 'combo':
                this.entry_label = create('span','entry_label', this, {'innerText':widget_label, 'draggable':false} )  
                this.entry_value = create('span','entry_label value', this, {'innerText':target_widget.value, 'draggable':false} )  
                this.input_element = create("select", 'input', this, {"doesntBlockRefresh":true}) 
                const choices = (target_widget.options.values instanceof Function) ? target_widget.options.values() : target_widget.options.values
                choices.forEach((o) => this.input_element.add(new Option(o,o)))
                this.input_element.addEventListener("change", (e)=>{
                    this.entry_value.innerText = e.target.value
                })
                this.input_element.redraw = () => {
                    this.entry_value.innerText = this.input_element.value
                }
                break
            case 'button':
                this.input_element = create("button", 'input', this, {"innerText":widget_label, "doesntBlockRefresh":true})
                break
            case 'toggle':
                this.input_element = new Toggle(target_widget.value, widget_label)
                this.appendChild(this.input_element)
                break
            default:
                return
        }  
        
        if (!this.input_element) return

        this.combo_for_image = (this.target_widget.name=='image' && this.target_widget._real_value && this.target_widget.type=="combo")
  
        switch (target_widget.type) {
            case 'button':
                this.input_element.addEventListener('click', this.button_click_callback.bind(this)) 
                break
            default:
                this.input_element.addEventListener('input', this.input_callback.bind(this))  
        }

        this.typecheck = (target_widget.type=='number') ? typecheck_number : typecheck_other

        if (target_widget.element) {
            target_widget.element.addEventListener('input', (e)=>{WidgetChangeManager.notify(target_widget)})
        } else {
            if (!target_widget.original_callback) target_widget.original_callback = target_widget.callback
            const callback = target_widget.original_callback
            target_widget.callback = function() {
                callback?.apply(this, arguments) // (target_widget.value, app.canvas, this.pa)
                WidgetChangeManager.notify(target_widget)
            }
        }

        WidgetChangeManager.add_listener(target_widget, this)
        this.render()
    }

    update_combo_selection() {
        if (this.input_element) {
            this.input_element.value   = this.target_widget.value
            this.entry_value.innerText = this.target_widget.value
        } else {
            Debug.important("update_combo with no input_element")
        }
    }

    wcm_manager_callback() {
        if (!this.parent_controller?.contains(this)) return false;
        this.input_element.value = this.target_widget.value;
        if (this.input_element.wcm_manager_callback) this.input_element.wcm_manager_callback()
        if (this.input_element.redraw) this.input_element.redraw(true)
        if (this.combo_for_image) {
            try {
                this.parent_nodeblock.select_image(this.target_widget.value)
            } catch (e) {
                Debug.error('wcm_manager_callback',e)
            }
        }
        return true;
    }

    valid() { return (this.input_element != null) }

    input_callback(e) {
        Debug.trivia("input_callback")
        UpdateController.push_pause()
        try {
            const v = this.typecheck(e.target.value)
            if (v != null && this.target_widget.value != v) {
                this.target_widget.value = v
                this.target_widget.callback?.(v, app.canvas, this.parent_nodeblock.node, [e.x,e.y], e)  
                WidgetChangeManager.notify(this.target_widget)
            }
        } finally { UpdateController.pop_pause() }
    }

    keydown_callback(e) {
        Debug.trivia("keydown_callback")
        UpdateController.push_pause()
        try {
            if (e.key=="Enter") document.activeElement.blur();
        } finally { UpdateController.pop_pause() }
    }

    button_click_callback(e) {
        Debug.trivia("button_click_callback")
        UpdateController.push_pause()
        try {
            this.target_widget.callback(); 
            app.graph.setDirtyCanvas(true,true); 
            UpdateController.make_request("button clicked")
        } finally { UpdateController.pop_pause() }
    }

    render() {
        if (document.activeElement == this.input_element) return
        if (this.input_element.value == this.target_widget.value) return
        this.input_element.value = rounding(this.target_widget.value, this.target_widget.options)
    }
}

customElements.define('cp-input',  Entry, {extends: 'div'})