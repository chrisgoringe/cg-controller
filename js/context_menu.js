import { app } from "../../scripts/app.js"
import { Timings } from "./constants.js"

var context_menu
var closable = false

function autoclose(e) {
    if (context_menu?.root?.contains(e.target)) return
    close_context_menu()
}

export function close_context_menu() {
    context_menu?.close()
    if (closable) {
        Array.from(document.getElementsByClassName('litecontextmenu')).forEach((e)=>e.remove())
    }
    closable = false
    context_menu = null
}

export function register_closable() {
    closable = true
}

function _open_context_menu(e, title, values, opts) {
    close_context_menu()
    
    const options = {
        "title":title, 
        "event":e,
    }
    if (opts) Object.assign(options, opts)
    context_menu = LiteGraph.ContextMenu(values, options, app.canvas.getCanvasWindow())
}
export function open_context_menu(e, title, values, opts, node) { 
    if (node) app.canvas.current_node = node
    setTimeout(_open_context_menu, Timings.GENERIC_SHORT_DELAY, e, title, values, opts) 
}

window.addEventListener('click',autoclose)
