import { create, step_size, check_float } from "./utilities.js"
import { rounding, clamp, classSet } from "./utilities.js"
import { Debug } from "./debug.js"
import { UpdateController } from "./update_controller.js"
import { settings } from "./settings.js"
import { SettingIds } from "./constants.js"

class SliderOptions {
    static KEYS = [ "min", "max", "step", "precision", "round" ]
    constructor(properties, widget_options) {
        SliderOptions.KEYS.forEach((k)=> {
            Object.defineProperty(this, k, {
                get : ( ) => { return properties[k] },
                set : (v) => { properties[k] = v }
            })
        })

        if (properties.min       == undefined) properties.min       = widget_options.min
        if (properties.max       == undefined) properties.max       = widget_options.max
        if (properties.step      == undefined) properties.step      = step_size(widget_options)
        if (properties.round     == undefined) properties.round     = properties.step
        if (properties.precision == undefined) properties.precision = widget_options.precision
    }
}

class SliderOptionEditor extends HTMLSpanElement {
    static instance

    constructor(slider_options, heading_text, widget, color) {
        super()
        if (SliderOptionEditor.instance) SliderOptionEditor.instance.remove()
        SliderOptionEditor.instance = this

        this.slider_options = slider_options
        this.widget = widget
        this.classList.add('option_setting')
        this.style.backgroundColor = color

        this.heading = create('span',  'option_setting_panel', this)
        this.title = create('span', 'option_setting_title', this.heading, {"innerText":heading_text})

        this.value_panel = create('span',  'option_setting_panel', this)
        this.min_edit  = create('input', 'option_setting_input min', this.value_panel, {"value":slider_options.min})
        create('span', 'option_setting_dash', this.value_panel, {"innerHTML":"-"})
        this.max_edit  = create('input', 'option_setting_input max', this.value_panel, {"value":slider_options.max})
        
        this.min_edit.addEventListener('change', (e) => {this.maybe_save()})
        this.max_edit.addEventListener('change', (e) => {this.maybe_save()})

        this.buttons       = create('span',  'option_setting_buttons', this)
        this.button_cancel = create('button', 'option_setting_button', this.buttons, {"innerText":"Cancel"})
        this.button_save   = create('button', 'option_setting_button', this.buttons, {"innerText":"Save"})

        this.button_save.addEventListener('click', (e) => { this.save_and_close() })
        this.button_cancel.addEventListener('click', () => {this.close()})

        this.min_edit.addEventListener('input', (e)=>{this.check_for_bad_values()})
        this.max_edit.addEventListener('input', (e)=>{this.check_for_bad_values()})
        this.check_for_bad_values()
    }

    save_and_close() {
        if (check_float(this.min_edit.value)) {
            this.slider_options.min = parseFloat(this.min_edit.value)
            this.widget.options.min = this.slider_options.min
        }
        if (check_float(this.max_edit.value)) {
            this.slider_options.max = parseFloat(this.max_edit.value)
            this.widget.options.max = this.slider_options.max
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
        const min_bad = (!check_float(this.min_edit.value))
        const max_bad = (!check_float(this.max_edit.value))
        const both_bad = (parseFloat(this.min_edit.value) >= parseFloat(this.max_edit.value))

        classSet(this.min_edit, 'bad_value', (min_bad || both_bad))
        classSet(this.max_edit, 'bad_value', (max_bad || both_bad))

        this.button_save.disabled = (min_bad || max_bad || (this.min_edit.value == this.slider_options.min && this.max_edit.value == this.slider_options.max))
    }
}

export class FancySlider extends HTMLSpanElement {

    static in_textedit = null

    constructor(node, widget, properties) {
        super()
        this.classList.add("fancy_slider")
        this.node = node
        this.widget = widget

        this.options   = new SliderOptions(properties, widget.options)
        this.value     = widget.value
        this.last_good = this.value

        this.graphic       = create('span', 'fs_graphic', this)
        this.graphic_fill  = create('span', 'fs_graphic_fill', this.graphic)
        this.scrollhint    = create('span', 'fs_graphic_scrollhint hidden', this.graphic)
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
                    this.rounded_out = 0
                    this.redraw()
                }
            }
        })        

        this.rounded_out = 0
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
        const soe = new SliderOptionEditor(this.options, `${this.node.title}.${this.widget.name} range`, this.widget, this.node.color)
        document.body.appendChild( soe )
        soe.style.left = `${clamp(e.x-10, 10)}px`
        soe.style.top  = `${clamp(e.y-10, 20,  window.innerHeight - soe.getBoundingClientRect().height - 20)}px`
    }

    _wheel(e) {
        if (this.displaying = "graphic") {
            this.wheeling = true
            const delta = settings.getSettingValue(SettingIds.SCROLL_SPEED, 3) * e.wheelDelta * (this.options.max - this.options.min) / (30000)
            const new_value =  clamp(this.rounded_out + this.value + delta, this.options.min, this.options.max)
            this.redraw_with_value(new_value)
            this.rounded_out = new_value - this.value
            this.redraw()
            Debug.trivia(`Wheel rounding carry = ${this.rounded_out}`)
            e.preventDefault()
            e.stopPropagation() 
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
        if (e.shiftKey) {
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
        if (this.options.precision) {
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

                if (this.rounded_out != 0) {
                    const fh = (this.value + this.rounded_out - this.options.min) / (this.options.max - this.options.min)
                    this.scrollhint.style.left = `${100*fh}%`
                    this.scrollhint.classList.remove('hidden')
                } else {
                    this.scrollhint.classList.add('hidden')
                }
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