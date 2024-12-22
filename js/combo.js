import { extension_hiding } from "./utilities.js"
import { open_context_menu, close_context_menu } from "./context_menu.js"
import { WidgetChangeManager } from "./widget_change_manager.js"

export class ExtendedCombo extends HTMLSpanElement {
    constructor(choices, target_widget, node) {
        super()
        this.classList.add('input')
        this.classList.add('clickabletext')
        this.innerText = extension_hiding(target_widget.value)
        this.draggable = false
        this.addEventListener('click', (e)=>{
            e.stopPropagation()
            open_context_menu(e, "", choices,  {
                className: "dark",
                callback: (v)=>{
                    close_context_menu()
                    target_widget.value=v; 
                    this.innerText = extension_hiding(v)
                    target_widget.callback(v, app.canvas, node)
                    WidgetChangeManager.notify(target_widget)
                },
            })
        })
    }
}

customElements.define('extended-combo-widget',  ExtendedCombo, {extends: 'span'})