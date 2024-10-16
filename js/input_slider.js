import { create } from "./elements.js"
import { step_size } from "./utilities.js"
import { rounding } from "./utilities.js"
import { app } from "../../scripts/app.js"

export class SliderOverrides {
    static instance = null

    static setup() {
        SliderOverrides.instance = new SliderOverrides()
    }

    constructor() {
        this.overrides = { 
            'min'  : this.parse_override_string(app.ui.settings.getSettingValue('Controller.sliders.min', "")),
            'max'  : this.parse_override_string(app.ui.settings.getSettingValue('Controller.sliders.max', "")),
            'step' : this.parse_override_string(app.ui.settings.getSettingValue('Controller.sliders.step', "")),
        }
    }

    parse_override_string(strng) {
        const entries = strng.split(',')
        const parsed_entries = []
        for (var i=0; i<entries.length; i++) {
            try {
                const entry = entries[i]
                var a = null
                var x = entry.split('=')[0].trim()
                var y = entry.split('=')[1].trim()
                if (x.includes(':')) {
                    a = x.split(':')[0].trim()
                    x = x.split(':')[1].trim()
                }
                parsed_entries.push( [a,x,y] )
            } catch {
                let a; // breakpoint bait
            }
        }
        return parsed_entries
    }

    static get_value(parameter, node_name, widget_name, deflt) {
        const override_list = SliderOverrides.instance.overrides[parameter]
        var result = deflt
        override_list.forEach(override => {
            if ( (override[0] == null || override[0] == node_name) && (override[1] == widget_name) ) {
                result = override[2]
                return
            }
        })
        return parseFloat(result)
    }

    static get_slider_parameters(node, widget) {
        const parameters = {
            "type"  : "range", 
            "value" : widget.value,
            "min"   : SliderOverrides.get_value('min',  node.title, widget.name, widget.options.min),
            "max"   : SliderOverrides.get_value('max',  node.title, widget.name, widget.options.max),
            "step"  : SliderOverrides.get_value('step', node.title, widget.name, step_size(widget.options)),
        }
        if (isNaN(parameters.min) || isNaN(parameters.max) || isNaN(parameters.step) )  return null
        return parameters
    }

}

export class FancySlider extends HTMLSpanElement {

    static in_textedit = null

    constructor(node, widget) {
        super()
        this.classList.add("fancy_slider")
        this.parameters = SliderOverrides.get_slider_parameters(node, widget)  // min, max, step
        this.rounding_options = { "round":this.parameters.step , "precision":widget.options.precision } 

        this.value     = this.parameters.value
        this.last_good = this.value

        this.graphic       = create('span', 'fs_graphic', this)
        this.graphic_fill  = create('span', 'fs_graphic_fill', this.graphic)
        this.graphic_text  = create('span', 'fs_graphic_text', this.graphic)
        this.mouse_pad     = create('span', 'fs_mouse_pad', this.graphic)
        this.text_edit     = create('input','fs_text_edit', this)

        this.displaying = "graphic"

        this.addEventListener('mousedown', (e) => this._mousedown(e))
        this.mouse_pad.addEventListener('mousemove', (e) => this._mousemove(e))
        this.mouse_pad.addEventListener('mouseleave',(e) => this.enddragging(e))
        this.addEventListener('mouseup',   (e) => this.enddragging(e))
        this.addEventListener('change',    (e) => this._change(e))
        this.addEventListener('focusin',   (e) => this._focus(e))
        this.addEventListener('focusout',  (e) => this._focusout(e))

        this._dragging = false
        Object.defineProperty(this, "dragging", {
            get : () => { return this._dragging},
            set : (v) => {
                this._dragging = v
                if (v) this.classList.add('unrefreshable')
                else this.classList.remove('unrefreshable')
            }
        })

        this.redraw()
    }

    enddragging(e) {
        this.mouse_down_on_me_at = null; 
        this.dragging = false
        this.classList.remove('can_drag')
        if (e) {
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
                const f = Math.max(0,Math.min(1,( e.x - box.x ) / box.width))
                const new_value = this.parameters.min + f * (this.parameters.max - this.parameters.min)
                this.redraw_with_value(new_value)
                e.preventDefault()
                e.stopPropagation() 
            }
        }
    }

    round_and_clip(v) {
        return rounding( Math.max(this.parameters.min, Math.min(this.parameters.max, v)), this.rounding_options )
    }

    format_for_display(v)  { 
        if (this.rounding_options.precision) {
            return v.toFixed(this.rounding_options.precision)
        } else {
            return v
        }
    }

    redraw() {
        this.redraw_with_value(null)
    }

    redraw_with_value(new_value) {
        if (new_value != null) {
            new_value = parseFloat(new_value)
            if (isNaN(new_value)) new_value = this.last_good
            this.value     = this.round_and_clip( new_value )
            this.last_good = this.value  
        }

        if (this.rendering) return
        this.rendering = true
        try {
            if (this.displaying=="graphic") {
                this.graphic.classList.remove("hidden")
                this.text_edit.classList.add("hidden")
                const f = (this.value - this.parameters.min) / (this.parameters.max - this.parameters.min)
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