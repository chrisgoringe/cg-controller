import { app, ComfyApp } from "../../scripts/app.js"

var context_menu

function close_context_menu() {
    if (context_menu) context_menu.root.remove()
    context_menu = null
}

function _open_context_menu(e, title, values) {
    const options = {
        "title":title, 
        "event":e,
    }
    context_menu = LiteGraph.ContextMenu(values, options, app.canvas.getCanvasWindow())
}
export function open_context_menu(e, title, values) { setTimeout(_open_context_menu, 10, e, title, values) }

window.addEventListener('click',close_context_menu)
