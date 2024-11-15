import { clamp, create, find_controller_parent } from "./utilities.js"
import { Debug } from "./debug.js"
import { Pixels } from "./constants.js"

const THRESHOLD = 16
const OVERLAP = Pixels.BORDER_WIDTH

class ChildType {
    anything() {
        return (Object.values(this).filter((v)=>(v)).length>0)
    }
    child_in_x()   { this.move_with = true; this.joined_x = true }
    child_in_y()   { this.move_with = true; this.joined_y = true }
    share_top()    { this.shared_t = true; }
    share_bottom() { this.shared_b = true; }
    share_left()   { this.shared_l = true; }
    share_right()  { this.shared_r = true; }

    describe() {
        var desc = ""
        Object.keys(this).forEach((k)=>{if (this[k]) desc += `${k} `})
        return desc
    }

    static none() { return new ChildType() }
}

function get_child_type(p1, p2) {
    const r = new ChildType()
    if (p1 && p2) {
        const r2 = p2.x + p2.w - OVERLAP
        const b2 = p2.y + p2.h - OVERLAP
        const r1 = p1.x + p1.w - OVERLAP
        const b1 = p1.y + p1.h - OVERLAP
        if ((Math.abs(p1.x - r2)<THRESHOLD) && p1.y < b2 && p2.y < b1) {
            r.child_in_x()
            if (Math.abs(p1.y-p2.y)<THRESHOLD) r.share_top()
            if (Math.abs(b2-b1)<THRESHOLD)     r.share_bottom()
        }
        if ((Math.abs(p2.x - r1)<THRESHOLD) && p1.y < b2 && p2.y < b1) {
            if (Math.abs(p1.y-p2.y)<THRESHOLD) r.share_top()
            if (Math.abs(b2-b1)<THRESHOLD)     r.share_bottom()
        }
        if ((Math.abs(p1.y - b2)<THRESHOLD) && p1.x < r2 && p2.x < r1) {
            r.child_in_y()
            if (Math.abs(p1.x-p2.x)<THRESHOLD) r.share_left()
            if (Math.abs(r2-r1)<THRESHOLD)     r.share_right()
        }
        if ((Math.abs(p2.y - b1)<THRESHOLD) && p1.x < r2 && p2.x < r1) {
            if (Math.abs(p1.x-p2.x)<THRESHOLD) r.share_left()
            if (Math.abs(r2-r1)<THRESHOLD)     r.share_right()
        }
    }
    return r
}

export class SnapManager {
    static panels = {}
    static last_dim = {}
    static mouse_is_down = false
    static child_types = {}
    static gutter_overlay = null

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
        SnapManager.child_types = {}
        Object.keys(SnapManager.panels).forEach((i)=>{
            SnapManager.child_types[i] = {}
            Object.keys(SnapManager.panels).filter((j)=>(i!=j)).forEach((j)=>{
                if (SnapManager.panels[i].settings.collapsed || SnapManager.panels[j].settings.collapsed) {
                    SnapManager.child_types[i][j] = ChildType.none()
                } else {
                    SnapManager.child_types[i][j] = get_child_type(SnapManager.panels[j].settings.position, SnapManager.panels[i].settings.position) 
                }
            })
        })

        Object.keys(SnapManager.panels).forEach((i)=>{
            var count = 0
            const my_box = SnapManager.panels[i].getBoundingClientRect()
            Object.keys(SnapManager.panels).filter((j)=>(i!=j)).forEach((j)=>{
                const your_box = SnapManager.panels[j].getBoundingClientRect()
                if (your_box.x > my_box.x) count += 1
                if (your_box.y > my_box.y) count += 1
            })
            SnapManager.panels[i].style.zIndex = 900 + count
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
            if (SnapManager.call_depth==1) {
                SnapManager.moved[panel.index] = "xywh"
            }
            SnapManager._apply_snapping(panel)
        } finally {
            SnapManager.call_depth -= 1 
            if (SnapManager.call_depth==0) {
                SnapManager.moved = {}
                //SnapManager.on_stack_empty()
            }
        }
    }
/*
    static create_overlap(t,h,l,w) {
        const overlap = create('span', 'gutter_overlap', SnapManager.gutter_overlay)
        overlap.style.top    = `${t}px`
        overlap.style.height = `${h}px`
        overlap.style.left   = `${l}px`
        overlap.style.width  = `${w}px`        
    }

    static on_stack_empty() {
        Debug.extended('SnapManager on_stack_empty')
        SnapManager.gutter_overlay?.remove()       
        if (SnapManager.mouse_is_down) return
        SnapManager.gutter_overlay = create('span', 'gutter_overlay', find_controller_parent())
        const b = SnapManager.gutter_overlay.getBoundingClientRect()

        Object.keys(SnapManager.panels).forEach((i)=>{
            const b1 = SnapManager.panels[i].getBoundingClientRect()
            if (b1.y == b.y) SnapManager.create_overlap(0, Pixels.BORDER_WIDTH, b1.left - b.left, b1.width)
            if (b1.x == b.x) SnapManager.create_overlap(b1.top - b.top, b1.height, 0, Pixels.BORDER_WIDTH)
            Object.keys(SnapManager.panels).filter( (j)=>(j!=i) ).forEach((j)=>{
                const b2 = SnapManager.panels[j].getBoundingClientRect()
                if (SnapManager.child_types[i][j].joined_x) {
                    SnapManager.create_overlap(Math.max(b1.top, b2.top) - b.top, Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top), b2.left - b.left, Pixels.BORDER_WIDTH)
                    Debug.extended(`${i} and ${j} joined in x`)
                }
                if (SnapManager.child_types[i][j].joined_y) {
                    SnapManager.create_overlap(b2.top - b.top, Pixels.BORDER_WIDTH, Math.max(b1.left, b2.left) - b.left, Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left))
                    Debug.extended(`${i} and ${j} joined in y`)
                }
            })
        })
    }*/

    static tidy_up(panel, insist) {
        if (!(panel.needs_tidy || insist)) {
            Debug.trivia(`Tidy up not needed for ${panel.index}`)
            return
        }
        Debug.extended(`Tidy up called for ${panel.index}`)
        const me = panel.settings

        Object.keys(SnapManager.panels).filter( (k)=>(k!=panel.index) ).forEach((k)=>{
            const you = SnapManager.panels[k].settings
            const child_type = get_child_type(me.position, you.position)
            if (child_type.anything()) {
                Debug.extended(`${panel.index} tidy_up: ${k} has child_type ${child_type.describe()}`)
                const your_r = you.position.x + you.position.w - OVERLAP
                const your_b = you.position.y + you.position.h - OVERLAP
                if (child_type.joined_x) me.set_position( your_r, null, null, null )
                if (child_type.joined_y) me.set_position( null, your_b, null, null )
                if (child_type.shared_l) me.set_position( you.position.x, null, null, null )
                if (child_type.shared_t) me.set_position( null, you.position.y, null, null )
                if (child_type.shared_r) me.set_position( null, null, you.position.x + you.position.w - me.position.x, null )
                if (child_type.shared_b) me.set_position( null, null, null, you.position.y + you.position.h - me.position.y )
            }
        })

        panel.settings.set_position( clamp(me.position.x,-OVERLAP), clamp(me.position.y,-OVERLAP), null, null )
        if (me.position.x < THRESHOLD) panel.settings.set_position( -OVERLAP, null, null, null )
        if (me.position.y < THRESHOLD) panel.settings.set_position( null, -OVERLAP, null, null )

        Object.keys(SnapManager.panels).forEach((k)=>{
            if (k!=panel.index && SnapManager.child_types[panel.index][k].move_with) {
                SnapManager.tidy_up(SnapManager.panels[k], true)
            }
        })
        
        panel.set_position(true)
        SnapManager.last_dim[panel.index] = {...me.position}
        panel.needs_tidy = false
    }

    static _apply_snapping(panel) {
        /*
        If the mouse is up, snap ourselves to any new parent or edge on left or top
        */
        
        if (!SnapManager.mouse_is_down) {
            SnapManager.tidy_up(panel)
            SnapManager.update_child_list()
            SnapManager.moved[panel.index] = "xywh"
        } else {
            const me = panel.settings
            const dx = me.position.x - SnapManager.last_dim[panel.index].x
            const dw = me.position.w - SnapManager.last_dim[panel.index].w
            const dy = me.position.y - SnapManager.last_dim[panel.index].y
            const dh = me.position.h - SnapManager.last_dim[panel.index].h

            if (!(dx||dw||dy||dh)) return

            Object.keys(SnapManager.child_types[panel.index]).forEach((i)=>{
                const you = SnapManager.panels[i].settings
                const effects_to_apply = SnapManager.child_types[panel.index][i]

                if (effects_to_apply.anything()) {
                    var changed = false

                    if (dw || dh) {
                        if ( effects_to_apply.joined_x && dx==0 ) changed = changed || SnapManager.delta( i,   dw, null, null, null )
                        if ( effects_to_apply.joined_y && dy==0 ) changed = changed || SnapManager.delta( i, null,   dh, null, null )
                        if ( effects_to_apply.shared_r && dx==0 ) changed = changed || SnapManager.delta( i, null, null,   dw, null )
                        if ( effects_to_apply.shared_b && dy==0 ) changed = changed || SnapManager.delta( i, null, null, null,   dh )  
                        if ( effects_to_apply.shared_l && dx!=0 ) changed = changed || SnapManager.delta( i,  -dw, null,   dw, null )
                        if ( effects_to_apply.shared_t && dy!=0 ) changed = changed || SnapManager.delta( i, null,  -dh, null,   dh )                 
                    } else {
                        if ( effects_to_apply.move_with         ) changed = changed || SnapManager.delta( i,   dx,   dy, null, null ) 
                    }             
                                    
                    if (changed) {
                        SnapManager.panels[i].set_position()
                        SnapManager.last_dim[i] = {...you.position}
                        SnapManager.panels[i].needs_tidy = true
                    }
                }
            })
            SnapManager.last_dim[panel.index] = {...me.position}
            SnapManager.panels[panel.index].needs_tidy = true
        }
    }

    static delta(i, x, y, w, h) {
        if (!SnapManager.moved[i]) SnapManager.moved[i] = ""

        if (x!=null) {
            if (SnapManager.moved[i].includes('x')) x = 0
            else SnapManager.moved[i] += "x"
        }
        if (y!=null) {
            if (SnapManager.moved[i].includes('y')) y = 0
            else SnapManager.moved[i] += "y"
        }
        if (w!=null) {
            if (SnapManager.moved[i].includes('w')) w = 0
            else SnapManager.moved[i] += "w"
        }
        if (h!=null) {
            if (SnapManager.moved[i].includes('h')) h = 0
            else SnapManager.moved[i] += "h"
        }

        if (x || y || w || h) SnapManager.panels[i].settings.delta_position(x,y,w,h)
        return (x || y || w || h)
    }
}