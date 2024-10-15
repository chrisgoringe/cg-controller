import { app } from "../../scripts/app.js";
import { create } from "./elements.js";
import { FancySlider } from "./input_slider.js";
import { rounding } from "./utilities.js";
import { make_resizable } from "./resize_manager.js";
import { UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";
import { SettingIds } from "./constants.js";

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
    static FULL_WIDTH = [ 'customtext' ]

    static firing_widget_callback = false
    constructor(node, target_widget) {
        super()
        if (target_widget.disabled) return
        if (target_widget.name=='control_after_generate' && !app.ui.settings.getSettingValue(SettingIds.CONTROL_AFTER_GENERATE, false)) return

        this.classList.add('entry')
        this.target_widget = target_widget
        this.input_element = null


        if (!Entry.FULL_WIDTH.includes(target_widget.type)) {
            this.entry_label = create('span','entry_label', this, {'innerText':target_widget.name, 'draggable':false} )  
        }


        switch (target_widget.type) {
            case 'text':
                this.input_element = create('input', 'input', this) 
                break
            case 'customtext':
                this.input_element = create("textarea", 'input', this, {"title":target_widget.name, "placeholder":target_widget.name})
                make_resizable( this.input_element, node.id, [target_widget.name, "input_element"] )
                break
            case 'number':
                this.input_element = new FancySlider(node, target_widget, this)
                this.input_element.addEventListener('keydown', this.keydown_callback.bind(this))
                this.appendChild(this.input_element)
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
        }

        this.typecheck = (target_widget.type=='number') ? typecheck_number : typecheck_other

        target_widget.unhijacked_callback = target_widget.unhijacked_callback ?? target_widget.callback
        this.original_target_widget_callback = target_widget.unhijacked_callback
        target_widget.callback = this.widget_callback_callback.bind(this)

        this.render()
    }

    valid() { return (this.input_element != null) }

    input_callback(e) {
        Debug.trivia("input_callback")
        UpdateController.push_pause()
        try {
            const v = this.typecheck(e.target.value)
            if (v != null) {
                this.target_widget.value = v
                this.target_widget.callback?.(v)
                app.graph.setDirtyCanvas(true,true)
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

    widget_callback_callback (v) {
        Debug.trivia("widget_callback_callback")
        UpdateController.push_pause()
        try {
            if (Entry.firing_widget_callback) return                
            try { 
                Entry.firing_widget_callback = true;
                this._widget_calling_callback(v)
            } finally { Entry.firing_widget_callback = false }
           
        } finally { UpdateController.pop_pause() }
    } 

    _widget_calling_callback(v) {
        if (this.target_widget.type=="button") {
            this.original_target_widget_callback?.(v)
            UpdateController.make_request("target widget button clicked")
        } else {
            this.input_element.value = v
            this.original_target_widget_callback?.apply(this.target_widget,arguments)
            UpdateController.make_request("target widget changed")
        }
    }

    render() {
        if (document.activeElement == this.input_element) return
        if (this.input_element.value == this.target_widget.value) return
        this.input_element.value = rounding(this.target_widget.value, this.target_widget.options)
    }
}

customElements.define('cp-input',  Entry, {extends: 'div'})