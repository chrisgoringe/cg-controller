import { create } from "./utilities.js"
import { Toggle } from "./toggle.js"
import { OnChangeController, UpdateController } from "./update_controller.js"
import { FancySlider } from "./input_slider.js"
import { app } from "../../scripts/app.js";

class PseudoWidget {
    constructor(target_widget, pil) {
        this.target_widget = target_widget
        this.pil = pil

        Object.defineProperty(this, 'value', {
            'get': () => { return this.target_widget.value.strength },
            'set': (v) => { 
                this.target_widget.value.strength = v; 
                if (pil.slider) {
                    pil.slider.value = v
                    pil.slider.redraw()
                }
            }
        })

        this.options = {"min":parseFloat(target_widget.loraInfo?.strengthMin ?? -4), "max":parseFloat(target_widget.loraInfo?.strengthMax ?? 4), "precision":2}
        this.label = "strength"
    }

    original_callback(v) {
        this.value = v
    }
}

export class PLL_Widget extends HTMLSpanElement {
    constructor(parent_controller, node, target_widget) {
        super()
        this.parent_controller = parent_controller
        this.node = node
        this.target_widget = target_widget
        this.classList.add('two_line_entry')
        this.top_line = create('span','line', this)
        this.label = create('span', 'label', this.top_line, {"innerText":this.target_widget._value.lora})
        this.on_off = new Toggle(target_widget._value.on, "", "Active", "Muted")
        this.on_off.addEventListener('input',(e)=>{
            target_widget.hitAreas.toggle.onDown.apply(target_widget, e)
            OnChangeController.on_change('pll_widget toggle')
            app.canvas.setDirty(true,true)
        })
        this.top_line.appendChild(this.on_off)

        this.second_line = create('span','line', this)


        this.options = {}
        this.ps = new PseudoWidget(this.target_widget, this)
        this.slider = new FancySlider(parent_controller, node, this.ps)
        this.slider._change = (e)=>{
            e.stopPropagation()
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) this.ps.value = v
            this.slider.switch_to_graphicaledit()
            FancySlider.currently_active = null
        }
        this.second_line.appendChild(this.slider)

        let a;
    }

}

customElements.define('pll-widget',  PLL_Widget, {extends: 'span'})