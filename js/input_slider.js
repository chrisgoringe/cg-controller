import { app } from "../../scripts/app.js";
import { create, step_size, check_float } from "./utilities.js"
import { rounding, clamp, classSet } from "./utilities.js"
import { Debug } from "./debug.js"
import { UpdateController } from "./update_controller.js"
import { settings } from "./settings.js";
import { SettingIds } from "./constants.js";

class SliderOptions {
    static KEYS = [ "min", "max", "step", "precision", "round" ]
    constructor(widget_options) {
        this.min       = widget_options.min
        this.max       = widget_options.max
        this.step      = step_size(widget_options)
        this.precision = widget_options.precision
    }
}

class SliderOptionEditor extends HTMLSpanElement {
    static instance

    constructor(slider_options, heading_text, widget, node) {
        super()
        if (SliderOptionEditor.instance) SliderOptionEditor.instance.remove()
        SliderOptionEditor.instance = this
        this.classList.add('option_setting')
        this.style.backgroundColor = node.color

        this.slider_options = slider_options
        this.widget = widget
        this.node = node

        this.other_like_node = app.graph._nodes.filter((other_node) => (other_node.id != node.id && node.type==other_node.type))
        this.is_integer = (widget.options.round == 1 || widget.options.precision == 0)

        this.heading = create('span',  'option_setting_panel', this)
        this.title = create('span', 'option_setting_title', this.heading, {"innerText":heading_text})

        this.value_panel = create('span',  'option_setting_panel', this)
        this.min_edit  = create('input', 'option_setting_input min', this.value_panel, {"value":slider_options.min})
        create('span', 'option_setting_dash', this.value_panel, {"innerHTML":"-"})
        this.max_edit  = create('input', 'option_setting_input max', this.value_panel, {"value":slider_options.max})

        this.step_panel = create('span',  'option_setting_panel', this)
        create('span', 'option_setting_label', this.step_panel, {"innerHTML":"Step:"})
        this.step_edit  = create('input', 'option_setting_input step', this.step_panel, {"value":slider_options.step})

        this.min_edit.addEventListener('keyup', (e) => {this._keyup(e)})
        this.max_edit.addEventListener('keyup', (e) => {this._keyup(e)})
        this.step_edit.addEventListener('keyup', (e) => {this._keyup(e)})

        if (this.other_like_node.length>0) {
            const n = this.other_like_node.length
            this.apply_also_panel = create('span',  'option_setting_panel', this)
            create('span', 'option_setting_label', this.apply_also_panel, {"innerHTML":`Apply to ${n} similar node${n>1?"s":""}`})
            this.apply_also_checkbox = create('input', 'option_setting_also_checkbox', this.apply_also_panel, {'type':'checkbox'})
        }

        this.buttons       = create('span',  'option_setting_buttons', this)
        this.button_cancel = create('button', 'option_setting_button', this.buttons, {"innerText":"Cancel"})
        this.button_save   = create('button', 'option_setting_button', this.buttons, {"innerText":"Save"})

        this.button_save.addEventListener('click', (e) => { this.save_and_close() })
        this.button_cancel.addEventListener('click', () => {this.close()})

        /* Highlight in red for bad values */
        this.min_edit.addEventListener('input', (e)=>{this.check_for_bad_values()})
        this.max_edit.addEventListener('input', (e)=>{this.check_for_bad_values()})
        this.step_edit.addEventListener('input', (e)=>{this.check_for_bad_values()})
        this.check_for_bad_values()
    }

    _keyup(e) {
        if (e.key == "Enter") this.maybe_save()
    }

    save_and_close() {

        this.slider_options.min = parseFloat(this.min_edit.value)
        this.widget.options.min = parseFloat(this.min_edit.value)
        this.slider_options.max = parseFloat(this.max_edit.value)
        this.widget.options.max = parseFloat(this.max_edit.value)

        this.slider_options.step  = parseFloat(this.step_edit.value)
        this.widget.options.round = parseFloat(this.step_edit.value)

        if (this.apply_also_checkbox?.checked) {
            this.other_like_node.forEach((node) => {
                node.widgets?.forEach((widget) => {
                    if (widget.name == this.widget.name) {
                        widget.options.min   = parseFloat(this.min_edit.value)
                        widget.options.max   = parseFloat(this.max_edit.value)
                        widget.options.round = parseFloat(this.step_edit.value)
                    }
                })
            })
        }

        this.close()
        UpdateController.make_request('slider options changed')
    }

    maybe_save() {
        if (!this.button_save.disabled) {
            this.save_and_close()
        }
    }

    close() {
        this.remove()
        SliderOptionEditor.instance = null
    }

    check_for_bad_values() {
        var min_bad = (!check_float(this.min_edit.value))
        var max_bad = (!check_float(this.max_edit.value))
        const both_bad = (parseFloat(this.min_edit.value) >= parseFloat(this.max_edit.value))
        var step_bad = (!check_float(this.step_edit.value))
        if (this.is_integer) {
            min_bad = min_bad || (parseFloat(this.min_edit.value) != parseInt(this.min_edit.value))
            max_bad = max_bad || (parseFloat(this.max_edit.value) != parseInt(this.max_edit.value))
            step_bad = step_bad || (parseFloat(this.step_edit.value) != parseInt(this.step_edit.value))
        }

        classSet(this.min_edit, 'bad_value', (min_bad || both_bad))
        classSet(this.max_edit, 'bad_value', (max_bad || both_bad))
        classSet(this.step_edit, 'bad_value', (step_bad))

        this.button_save.disabled = (min_bad || max_bad || step_bad || 
            (this.min_edit.value == this.slider_options.min && this.max_edit.value == this.slider_options.max && 
                this.step_edit.value == this.slider_options.step))
    }
}

export class FancySlider extends HTMLSpanElement {

    static in_textedit = null

    constructor(node, widget, properties) {
        super()
        this.classList.add("fancy_slider")
        this.node = node
        this.widget = widget

        this.options   = new SliderOptions(widget.options)
        this.value     = widget.value
        this.last_good = this.value

        this.graphic       = create('span', 'fs_graphic', this)
        this.graphic_fill  = create('span', 'fs_graphic_fill', this.graphic)
        this.graphic_text  = create('span', 'fs_graphic_text', this.graphic)
        this.text_edit     = create('input','fs_text_edit', this)
        this.label         = create('span', 'fs_label', this, {"innerText":widget.name})

        this.displaying = "graphic"

        this.addEventListener('mousedown',     (e) => this._mousedown(e))
        this.addEventListener('wheel',         (e) => this._wheel(e))
        this.addEventListener('mouseout',      (e) => this._mouseout(e))
        document.addEventListener('mousemove', (e) => this._mousemove(e))
        document.addEventListener('mouseup',   (e) => this.enddragging(e))
        this.addEventListener('change',        (e) => this._change(e))
        this.addEventListener('focusin',       (e) => this._focus(e))
        this.addEventListener('focusout',      (e) => this._focusout(e))

        this._dragging = false
        Object.defineProperty(this, "dragging", {
            get : () => { return this._dragging},
            set : (v) => {
                this._dragging = v
                if (v) this.classList.add('unrefreshable')
                else this.classList.remove('unrefreshable')
            }
        })

        this._wheeling = false
        Object.defineProperty(this, "wheeling", {
            get : () => { return this._wheeling},
            set : (v) => {
                this._wheeling = v
                if (v) this.classList.add('unrefreshable')
                else {
                    this.classList.remove('unrefreshable')
                    this.redraw()
                }
            }
        })        
        this.redraw()
    }

    enddragging(e) {
        this.mouse_down_on_me_at = null; 
        this.dragging = false
        this.classList.remove('can_drag')
        if (e && e.target==this) {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    switch_to_textedit() {
        if (FancySlider.in_textedit) FancySlider.in_textedit.switch_to_graphicaledit()
        FancySlider.in_textedit = this
        this.displaying = "text"
        this.enddragging()
        this.classList.add('unrefreshable')
        this.reason = "slider in text edit mode"
        this.redraw()
        setTimeout(()=>{this.please_focus()},100)
    }

    please_focus() {
        this.text_edit.focus()
    }

    switch_to_graphicaledit() {
        if (FancySlider.in_textedit == this) FancySlider.in_textedit = null
        this.displaying = "graphic"
        this.redraw_with_value(this.text_edit.value)
    }

    edit_min_max(e) {
        const soe = new SliderOptionEditor(this.options, `${this.node.title}.${this.widget.name} range`, this.widget, this.node)
        document.body.appendChild( soe )
        soe.style.left = `${clamp(e.x-10, 10)}px`
        soe.style.top  = `${clamp(e.y-10, 20,  window.innerHeight - soe.getBoundingClientRect().height - 20)}px`
    }

    _wheel(e) {
        if (this.displaying = "graphic") {
            const shift_setting = settings.getSettingValue(SettingIds.SCROLL_MOVES_SLIDERS, "yes")
            if ( shift_setting=="yes" || (shift_setting=="shift" && e.shiftKey) || (shift_setting=="ctrl" && e.ctrlKey) ) {
                this.wheeling = true
                const new_value =  this.value + this.options.step * (e.wheelDelta>0 ? 1 : -1)
                this.redraw_with_value(new_value)
                e.preventDefault()
                e.stopPropagation() 
            }
        }
    }

    _mouseout(e) {
        if (this.wheeling) this.wheeling = false
    }

    _focus(e) {
        this.text_edit.select()
    }

    _focusout(e) {
        if (this.displaying = "text") this.switch_to_graphicaledit()
    }

    _change(e) {
        e.stopPropagation()
        this.switch_to_graphicaledit()
        this.classList.remove('unrefreshable')
    }

    _mousedown(e) { 
        const shift_setting = settings.getSettingValue(SettingIds.EDIT_SLIDERS, "shift")
        if ((e.shiftKey && shift_setting=='shift') || (e.ctrlKey && shift_setting=='ctrl')){
            this.edit_min_max(e)
            e.preventDefault()
            e.stopPropagation()
            return
        }
        if (this.displaying=="graphic") {
            e.preventDefault()
            if (e.detail==2) {
                this.switch_to_textedit()
            } else {
                this.classList.add('can_drag')
                this.mouse_down_on_me_at = e.x;
                e.stopPropagation()
            }
        }
    }

    _mousemove(e) { 
        if (this.mouse_down_on_me_at) {
            if (!this.dragging && (Math.abs(e.x-this.mouse_down_on_me_at)>6 || Math.abs(e.movementX)>4)) {
                this.dragging = true 
            }
            if (this.dragging) {
                const box = this.getBoundingClientRect()
                const f =  clamp(( e.x - box.x ) / box.width, 0, 1)
                const new_value = this.options.min + f * (this.options.max - this.options.min)
                this.redraw_with_value(new_value)
                e.preventDefault()
                e.stopPropagation() 
            }
        }
    }

    round_and_clip(v) {
        return rounding( clamp(v,this.options.min,this.options.max), this.options )
    }

    format_for_display(v)  { 
        if (this.options.precision != null) {
            return v.toFixed(this.options.precision)
        } else {
            return v
        }
    }

    redraw() {
        this.redraw_with_value(this.value)
    }

    redraw_with_value(new_value) {
        new_value = parseFloat(new_value)
        if (isNaN(new_value)) new_value = this.last_good
        this.value     = this.round_and_clip( new_value )
        this.last_good = this.value  

        if (this.rendering) return
        this.rendering = true
        try {
            if (this.displaying=="graphic") {
                this.graphic.classList.remove("hidden")
                this.text_edit.classList.add("hidden")
                const f = (this.value - this.options.min) / (this.options.max - this.options.min)
                this.graphic_fill.style.width = `${100*f}%`
                this.graphic_text.innerHTML   = this.format_for_display(this.value)
            } else {
                this.graphic.classList.add("hidden")
                this.text_edit.classList.remove("hidden")
                this.text_edit.value = this.format_for_display(this.value)        
            }
        } finally {
            this.rendering = false
            const e = new Event('input')
            this.dispatchEvent(e)
        }
    }

}

customElements.define('cp-fslider', FancySlider, {extends: 'span'})
customElements.define('cp-fslideroptioneditor', SliderOptionEditor, {extends: 'span'})