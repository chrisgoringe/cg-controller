import { create } from "./elements.js"
import { step_size } from "./utilities.js"
import { rounding } from "./utilities.js"
import { app } from "../../scripts/app.js";

function find_max_override(name) {
    var maxes = app.ui.settings.getSettingValue('Controller.sliders.max', "")
    if (!maxes.includes(name)) return null
    maxes = maxes.split(',')
    for (var i=0; i<maxes.length; i++) {
        const m = maxes[i].trim()
        if (m.split('=')[0].trim()==name && m.split('=').length==2) {
            return parseFloat(m.split('=')[1].trim())
        } 
    }
    return null
}

export class InputSlider extends HTMLSpanElement {
    constructor(value, options, name) {
        super()
        this.classList.add("controller_slider_span")
        this.options = options
        const parameters = {"type":"range", "value":value}
        
        var mx = find_max_override(name)
        if (mx!=null)         parameters.max = mx
        else if (options.max) parameters.max = options.max
        if (options.min)      parameters.min = options.min

        parameters.step = step_size(options)

        this.display = create("span", "controller_slider_display", this, {"innerText":`${rounding(value, options)}`})
        this.slider = create("input", "controller_slider", this, parameters )
        this.slider.addEventListener("input", (e)=>{
            this.display.innerText = `${rounding(e.target.value, this.options)}`
        })
    }

    static can_be_slider(options, setting, name) {
        if (setting == 0 || options?.min == undefined || options?.max == undefined) return false
        if (setting == 2) return true;
        var mx = find_max_override(name)
        if (mx==null) mx = options.max
        const range = (mx - options.min)
        if (range/step_size(options) > 200) return false
        return true
    }
}

customElements.define('cp-slider', InputSlider, {extends: 'span'})