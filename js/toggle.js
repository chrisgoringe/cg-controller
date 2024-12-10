import { classSet, create } from "./utilities.js";

export class Toggle extends HTMLSpanElement { 
    constructor(state, label, label_true, label_false, label_intermediate) {
        super()
        this.value = state
        this.label_true = label_true ?? "true"
        this.label_false = label_false ?? "false"
        this.label_intermediate = label_intermediate
        this.threestate = !!(label_intermediate)

        this.classList.add('toggle')
        if (!this.threestate) {
            this.addEventListener('click', (e) => {
                this.value = !this.value            
                const e2 = new Event('input')
                this.dispatchEvent(e2)
                this.render() 
            })
        }
        this.addEventListener('mousedown', (e) => {
            e.preventDefault()
        })

        this.label = create('span', 'toggle_label', this, {"innerHTML":label})

        this.value_span = create('span', 'toggle_value', this)
        this.text_value = create('span', 'toggle_text', this.value_span)
        this.graphical_value = create('span', 'toggle_graphic', this.value_span, {"innerHTML":"&#11044;"})

        this.render()
    }

    render() {
        if (this.threestate) {
            this.text_value.innerText = this.value=="on" ? this.label_true : (this.value=="off" ? this.label_false : this.label_intermediate)
            classSet(this, 'false', this.value=="off")
            classSet(this.graphical_value, "true", this.value=="on")
            classSet(this.graphical_value, "false", this.value=="off")
            classSet(this.graphical_value, "intermediate", this.value=="mixed")
        } else {
            this.text_value.innerText = this.value ? this.label_true : this.label_false
            classSet(this.graphical_value, "true", this.value)
            classSet(this.graphical_value, "false", !this.value)
        }
    }
}

customElements.define('cp-toggle', Toggle, {extends: 'span'})