import { clamp } from "./utilities.js"
import { Debug } from "./debug.js"

const THRESHOLD = 5
const OVERLAP = 4

function is_child_of(p1, p2, direction) {
    if (!p1 || !p2) return false
    const r2 = p2.x + p2.w - OVERLAP
    const b2 = p2.y + p2.h - OVERLAP
    const r1 = p1.x + p1.w - OVERLAP
    const b1 = p1.y + p1.h - OVERLAP
    if (direction=="x") {
        if ((Math.abs(p1.x - r2)<THRESHOLD) && p1.y < b2 && p2.y < b1) return true
    }
    if (direction=="y") {
        if ((Math.abs(p1.y - b2)<THRESHOLD) && p1.x < r2 && p2.x < r1) return true
    }
    return false
}

export class SnapManager {
    static panels = {}
    static last_dim = {}
    static mouse_is_down = false
    static child_indices_x = {}
    static child_indices_y = {}
    static setup() {
        window.addEventListener('mousedown', ()=>{SnapManager.mouse_is_down = true})
        window.addEventListener('mouseup', ()=>{SnapManager.mouse_is_down = false})
    }

    static register(panel) {
        SnapManager.panels[panel.index]   = panel
        SnapManager.last_dim[panel.index] = {...panel.settings.position}
        SnapManager.update_child_list()
    }
    static remove(panel) {
        delete SnapManager.panels[panel.index]
        SnapManager.update_child_list()
    }

    static update_child_list() {
        Object.keys(SnapManager.panels).forEach((i)=>{
            SnapManager.child_indices_x[i] = []
            SnapManager.child_indices_y[i] = []
            Object.keys(SnapManager.panels).filter((j)=>(i!=j)).forEach((j)=>{
                if (is_child_of(SnapManager.panels[j].settings.position, SnapManager.panels[i].settings.position, "x")) SnapManager.child_indices_x[i].push(j)
                else if (is_child_of(SnapManager.panels[j].settings.position, SnapManager.panels[i].settings.position, "y")) SnapManager.child_indices_y[i].push(j)
            })
        })
    }

    /* 
    Called by a panel when it has been moved by the user.
    */
    static call_depth = 0
    static moved = {}
    static apply_snapping(panel) {
        SnapManager.call_depth += 1 
        try {
            SnapManager._apply_snapping(panel)
        } finally {
            SnapManager.call_depth -= 1 
            if (SnapManager.call_depth==0) SnapManager.moved = {}
        }
    }

    static _apply_snapping(panel) {
        /*
        If the mouse is up, snap ourselves to any new parent or edge on left or top
        */
        if (!SnapManager.mouse_is_down) {
            panel.settings.set_position( clamp(panel.settings.position.x,0), clamp(panel.settings.position.y,0), null, null )
            if (panel.settings.position.x < THRESHOLD) panel.settings.set_position( 0, null, null, null )
            if (panel.settings.position.y < THRESHOLD) panel.settings.set_position( null, 0, null, null )

            Object.keys(SnapManager.panels).filter( (k)=>(k!=panel.index) ).forEach((k)=>{
                const your_r = SnapManager.panels[k].settings.position.x + SnapManager.panels[k].settings.position.w - OVERLAP
                if (is_child_of(panel.settings.position, SnapManager.panels[k].settings.position, "x")) {
                    panel.settings.set_position( your_r, null, null, null )
                    if (Math.abs(panel.settings.position.y - SnapManager.panels[k].settings.position.y) < THRESHOLD) {
                        panel.settings.set_position( null, SnapManager.panels[k].settings.position.y, null, null )
                        if (Math.abs(panel.settings.position.h - SnapManager.panels[k].settings.position.h) < THRESHOLD) {
                            panel.settings.set_position( null, null, null, SnapManager.panels[k].settings.position.h )
                        }
                    }

                }
                const your_b = SnapManager.panels[k].settings.position.y + SnapManager.panels[k].settings.position.h - OVERLAP
                if (is_child_of(panel.settings.position, SnapManager.panels[k].settings.position, "y")) {
                    panel.settings.set_position( null, your_b, null, null )
                    if (Math.abs(panel.settings.position.x - SnapManager.panels[k].settings.position.x) < THRESHOLD) {
                        panel.settings.set_position( SnapManager.panels[k].settings.position.x, null, null, null )
                        if (Math.abs(panel.settings.position.w - SnapManager.panels[k].settings.position.w) < THRESHOLD) {
                            panel.settings.set_position( null, null, SnapManager.panels[k].settings.position.w, null )
                        }
                    }
                }
            })
            SnapManager.update_child_list()
        }

        const dx = panel.settings.position.x - SnapManager.last_dim[panel.index].x
        const dr = dx + panel.settings.position.w - SnapManager.last_dim[panel.index].w
        const dy = panel.settings.position.y - SnapManager.last_dim[panel.index].y
        const db = dy + panel.settings.position.h - SnapManager.last_dim[panel.index].h

        SnapManager.child_indices_x[panel.index].forEach((i)=>{
            if (!SnapManager.moved[i]) {
                SnapManager.panels[i].settings.set_position( SnapManager.panels[i].settings.position.x + dr, SnapManager.panels[i].settings.position.y + dy )
                SnapManager.panels[i].set_position()
                SnapManager.last_dim[i] = {...SnapManager.panels[i].settings.position}
            }
        })
        SnapManager.child_indices_y[panel.index].forEach((i)=>{
            if (!SnapManager.moved[i]) {
                SnapManager.panels[i].settings.set_position( SnapManager.panels[i].settings.position.x + dx, SnapManager.panels[i].settings.position.y + db )
                SnapManager.panels[i].set_position()
                SnapManager.last_dim[i] = {...SnapManager.panels[i].settings.position}
            }
        })
        SnapManager.child_indices_x[panel.index].forEach((i)=>{ SnapManager.moved[i]=true })
        SnapManager.child_indices_y[panel.index].forEach((i)=>{ SnapManager.moved[i]=true })

        /*
        Remember where we are
        */
        SnapManager.last_dim[panel.index] = {...panel.settings.position}
    }
}