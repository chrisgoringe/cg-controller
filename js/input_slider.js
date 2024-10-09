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

    static drag_graphic = create('span', 'fancy_slider_drag_graphic', document.body)
    static being_dragged = null

    constructor(node, widget) {
        super()
        this.classList.add("fancy_slider")
        this.parameters = SliderOverrides.get_slider_parameters(node, widget)  // min, max, step
        this.rounding_options = { "round":this.parameters.step , "precision":widget.options.precision } 

        this.value     = this.parameters.value
        this.last_good = this.value

        this.graphic      = create('span', 'fancy_slider_graphic', this)
        this.graphic_fill = create('span', 'fancy_slide_graphic_filled', this.graphic)
        this.textinput    = create('input', 'fancy_slider_text', this, {"draggable":true})

        this.textinput.addEventListener('dragstart', (e)=>{this.handle_drag(e)})
        this.textinput.addEventListener('drag',      (e)=>{this.handle_drag(e)})
        this.textinput.addEventListener('dragend',   (e)=>{this.handle_drag(e)})
        this.textinput.addEventListener('dragover',  (e)=>{this.handle_drag(e)})

        this.textinput.addEventListener('change', (e) => {this.change_value(this.textinput.value)})

        this.render()
    }

    round_and_clip(v) {
        return rounding( Math.max(this.parameters.min, Math.min(this.parameters.max, v)), this.rounding_options )
    }

    change_value(new_value) {
        new_value = parseFloat(new_value)
        if (isNaN(new_value)) new_value = this.last_good
        this.value     = this.round_and_clip( new_value )
        this.last_good = this.value  
        this.render()
    }

    handle_drag(e) {
        e.stopPropagation()
        switch (e.type) {
            case 'dragstart':
                this.textinput.setSelectionRange(0,0)
                e.dataTransfer.clearData()
                e.dataTransfer.setDragImage(FancySlider.drag_graphic,0,0)
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.dropEffect = "move";
                this.classList.add("text_input_dragging")
                FancySlider.being_dragged = this
                break   
            case 'drag':
                if (FancySlider.being_dragged==this && e.x!=0) {  // e.x = 0 for a single event if you drop outside the slider?
                    const box = this.getBoundingClientRect()
                    const f = Math.max(0,Math.min(1,( e.x - box.x ) / box.width))
                    const new_value = this.parameters.min + f * (this.parameters.max - this.parameters.min)
                    this.change_value(new_value)
                    
                }
                if (FancySlider.being_dragged) e.preventDefault()
                break
            case 'dragover':
                if (FancySlider.being_dragged) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                }
                break
            case 'dragend':
                FancySlider.being_dragged = null
                this.classList.remove("text_input_dragging")
        }
    }

    render() {
        if (this.rendering) return
        this.rendering = true
        try {
            const f = (this.value - this.parameters.min) / (this.parameters.max - this.parameters.min)
            this.graphic_fill.style.width = `${100*f}%`
            this.textinput.value = this.format_for_display(this.value)
        } finally {
            this.rendering = false
        }
        const e = new Event('input')
        this.dispatchEvent(e)
    }

    format_for_display(v)  { 
        if (this.rounding_options.precision) {
            return v.toFixed(this.rounding_options.precision)
        } else {
            return v
        }
    }
}

customElements.define('cp-fslider', FancySlider, {extends: 'span'})