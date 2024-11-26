import { app } from "../../scripts/app.js"

var context_menu
var sah

function autoclose() {
    if (sah) return
    close_context_menu()
}

export function close_context_menu() {
    
    if (context_menu) context_menu.root.remove()
    context_menu = null
}

function _open_context_menu(e, title, values, supress_autohide) {
    sah = supress_autohide
    const options = {
        "title":title, 
        "event":e,
    }
    context_menu = LiteGraph.ContextMenu(values, options, app.canvas.getCanvasWindow())
}
export function open_context_menu(e, title, values, supress_autohide) { setTimeout(_open_context_menu, 10, e, title, values, supress_autohide) }

window.addEventListener('click',autoclose)
