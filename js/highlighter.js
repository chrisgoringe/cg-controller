import { focus_mode } from "./utilities.js";
import { global_settings } from "./settings.js";
import { Debug } from "./debug.js";
import { app } from "../../scripts/app.js"

export class Highlighter {
    static highlight_node = null
    static highlight_group = null

    static area = [0,0,0,0]

    static node(n) {
        Highlighter.highlight_node = n
        app.canvas.setDirty(true, true)
    }

    static group(g) {
        Highlighter.highlight_group = g
        app.canvas.setDirty(true, true)
    }

    static highlight_area() {
        const ctx = app.canvas.ctx
        ctx.save();
        try {
            ctx.strokeStyle = "white"
            ctx.lineWidth   = 1
            ctx.shadowColor = "white"
            ctx.shadowBlur  = 4
            ctx.fillStyle   = "#ffd70040"

            ctx.beginPath()
            ctx.roundRect(Highlighter.area[0], Highlighter.area[1], Highlighter.area[2], Highlighter.area[3], 6)
            ctx.stroke()
            ctx.fill()
        } finally {
            ctx.restore()            
        }
    }
    static on_draw() {
        if (focus_mode()=="normal" && global_settings.highlight) {
            if (Highlighter.highlight_node) {
                Highlighter.highlight_node.measure(Highlighter.area);
                this.highlight_area()
            }
            if (Highlighter.highlight_group) {
                app.graph._groups.filter((group)=>(group.title == Highlighter.highlight_group)).forEach((group) => {
                    Highlighter.area[0] = group._pos[0]
                    Highlighter.area[1] = group._pos[1]
                    Highlighter.area[2] = group._size[0]
                    Highlighter.area[3] = group._size[1]
                    this.highlight_area()
                });
            }
        }
    }
}