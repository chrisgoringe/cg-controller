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
        return result
    }

    static get_slider_parameters(node, widget) {
        const parameters = {
            "type"  : "range", 
            "value" : widget.value,
            "min"   : SliderOverrides.get_value('min',  node.title, widget.name, widget.options.min),
            "max"   : SliderOverrides.get_value('max',  node.title, widget.name, widget.options.max),
            "step"  : SliderOverrides.get_value('step', node.title, widget.name, step_size(widget.options)),
        }
        if (parameters.min  == null || parameters.min  == undefined || 
            parameters.max  == null || parameters.max  == undefined || 
            parameters.step == null || parameters.step == undefined )  return null
        return parameters
    }

}

export class InputSlider extends HTMLSpanElement {
    constructor(node, widget) {
        super()
        this.classList.add("controller_slider_span")
        this.rounding_options = widget.options
        const parameters = SliderOverrides.get_slider_parameters(node, widget)
        this.display = create("span", "controller_slider_display", this, {"innerText":`${rounding(widget.value, this.rounding_options)}`})
        this.slider = create("input", "controller_slider", this, parameters )
        this.slider.addEventListener("input", (e)=>{
            this.display.innerText = `${rounding(e.target.value, this.rounding_options)}`
        })
    }

    static can_be_slider(node, widget) {
        const setting = app.ui.settings.getSettingValue('Controller.sliders', 1)
        if (setting == 0) return false
        const parameters = SliderOverrides.get_slider_parameters(node, widget)
        if (parameters == null) return false
        if (setting == 2) return true
        return ( (parameters.max - parameters.min)/parameters.step <= 200 )
    }
}

customElements.define('cp-slider', InputSlider, {extends: 'span'})