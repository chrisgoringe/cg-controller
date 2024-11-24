import { app, ComfyApp } from "../../scripts/app.js"

export function new_context_menu(e, title, values) {
    const options = {
        "title":title, 
        "event":e
    }
    new LiteGraph.ContextMenu(values, options, app.canvas.getCanvasWindow())
}
