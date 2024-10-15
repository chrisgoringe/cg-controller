import { create } from "./elements.js";

export class Toggle extends HTMLSpanElement { 
    constructor(state, label, label_true, label_false) {
        super()
        this.value = state
        this.label_true = label_true ?? "true"
        this.label_false = label_false ?? "false"

        this.classList.add('toggle')
        this.addEventListener('click', () => {
            this.value = !this.value            
            const e = new Event('input')
            this.dispatchEvent(e)
            this.render() 
        })

        this.label = create('span', 'toggle_label', this, {"innerHTML":label})

        this.value = create('span', 'toggle_value', this)
        this.text_value = create('span', 'toggle_text', this.value)
        this.graphical_value = create('span', 'toggle_graphic', this.value, {"innerHTML":"&#11044;"})

        this.render()
    }

    render() {
        this.text_value.innerText = this.value ? this.label_true : this.label_false
        this.graphical_value.classList.add( this.value ? "true" : "false"  )
        this.graphical_value.classList.remove( this.value ? "false" : "true" )
    }
}

customElements.define('cp-toggle', Toggle, {extends: 'span'})