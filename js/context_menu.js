import { app } from "../../scripts/app.js"

var context_menu

function autoclose(e) {
    if (context_menu?.root?.contains(e.target)) return
    close_context_menu()
}

export function close_context_menu() {
    context_menu?.close()
    context_menu = null
}

function _open_context_menu(e, title, values) {
    close_context_menu()
    const options = {
        "title":title, 
        "event":e,
    }
    context_menu = LiteGraph.ContextMenu(values, options, app.canvas.getCanvasWindow())
}
export function open_context_menu(e, title, values) { setTimeout(_open_context_menu, 10, e, title, values) }

window.addEventListener('click',autoclose)
