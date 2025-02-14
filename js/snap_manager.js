import { clamp, mouse_is_down } from "./utilities.js"
import { Debug } from "./debug.js"
import { Pixels, Timings } from "./constants.js"

const THRESHOLD = 16
const OVERLAP   = Pixels.BORDER_WIDTH
const UNDERLAP  = Math.min(3, OVERLAP) // pixel grabbable at the bottom

class ChildType {
    anything() {
        return (Object.values(this).filter((v)=>(v)).length>0)
    }
    child_in_x()   { this.move_with = true; this.joined_x = true; this.indirect_joined_x = true }
    child_in_y()   { this.move_with = true; this.joined_y = true; this.indirect_joined_y = true }
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

export function get_parent_height() {
    return (Object.values(SnapManager.panels).length) ?  Object.values(SnapManager.panels)[0].parentElement.getBoundingClientRect().height : null
}

export function get_parent_width() {
    return (Object.values(SnapManager.panels).length) ?  Object.values(SnapManager.panels)[0].parentElement.getBoundingClientRect().width : null
}

function update_panel_position(panel, need_tidy) {
    panel.set_position(true)
    SnapManager.last_dim[panel.index] = {...panel.settings.position}
    if (need_tidy!==null) panel.needs_tidy = need_tidy
}

export class WindowResizeManager {

    static vertical_fraction = {}
    static vertical_snapped = new Set()
    static deferred_owr_outstanding = false
    static owr_stack = 0

    static onWindowResize() {
        WindowResizeManager.owr_stack += 1
        setTimeout(WindowResizeManager._onWindowResize, Timings.GENERIC_SHORT_DELAY)
    }

    static _onWindowResize() {
        WindowResizeManager.owr_stack -= 1
        if (WindowResizeManager.owr_stack>0) return
        Object.values(SnapManager.panels).filter((p)=>(p.settings.fullwidth)).forEach((panel)=>{
            const w = panel.parentElement.getBoundingClientRect().width + 2 * OVERLAP
            const me = panel.settings
            me.set_position( null, null, (me.fullwidth) ? w : null, null )
            update_panel_position(panel)
        })

        const parent_height = get_parent_height()
        
        Array.from(WindowResizeManager.vertical_snapped).forEach((i)=>{
            const panel = SnapManager.panels[i]
            if (!panel) return
            const frac = WindowResizeManager.vertical_fraction[i]
            const new_height = parent_height * frac + 2*OVERLAP
            const new_y = (panel.settings.position.y == -OVERLAP) ? -OVERLAP : parent_height - new_height

            Debug.trivia(`Panel ${{i}} vertical rescale from ${panel.settings.position.h} to ${new_height}`)

            panel.settings.set_position(null, new_y, null, new_height )
            update_panel_position(panel)
        })
    }

    static update_vertical_spans() {
        if (WindowResizeManager.owr_stack>0) return
        Debug.trivia("get_vertical_spans")
        const parent_height = get_parent_height()
        WindowResizeManager.vertical_snapped = new Set()

        Object.keys(SnapManager.panels).forEach((i)=>{
            const panel = SnapManager.panels[i]
            WindowResizeManager.vertical_fraction[i] = (panel.getBoundingClientRect().height - 2*OVERLAP) / parent_height
            if (panel.settings.fullheight) WindowResizeManager.vertical_snapped.add(i)
            if (Math.abs(panel.settings.position.y + panel.settings.position.h - parent_height - UNDERLAP) < THRESHOLD) {
                // we are touching the bottom. Are we child of anyone touching the top?
                Object.keys(SnapManager.panels).filter((j)=>(SnapManager.child_types[j][i]?.joined_y)).forEach((j)=>{
                    if (SnapManager.panels[j].settings.position.y == -OVERLAP) {
                        WindowResizeManager.vertical_snapped.add(i)
                        WindowResizeManager.vertical_snapped.add(j)
                        panel.settings.set_position(null, null, null, parent_height + OVERLAP - panel.settings.position.y - UNDERLAP)
                        update_panel_position(panel)
                    }
                })
            }
        })

    }
}

export class SnapManager {
    static panels = {}
    static last_dim = {}
    static child_types = {}
    static gutter_overlay = null

    static register(panel) {
        SnapManager.panels[panel.index]   = panel
        SnapManager.last_dim[panel.index] = {...panel.settings.position}
        SnapManager.update_child_list('register')
    }
    static remove(panel) {
        delete SnapManager.panels[panel.index]
        SnapManager.update_child_list('remove')
    }

    static update_child_list(note) {
        Debug.trivia(`update_child_list ${note?note:''}`)
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

        SnapManager.apply_transitively('move_with')
        SnapManager.apply_transitively('shared_t')
        SnapManager.apply_transitively('shared_b')
        SnapManager.apply_transitively('shared_l')
        SnapManager.apply_transitively('shared_r')

        /* if we share a top, and you are joined in y to someone, so am I */
        Object.keys(SnapManager.panels).forEach((i)=>{
            const me = SnapManager.panels[i].settings.position
            Object.keys(SnapManager.panels).filter((j)=>(i!=j && SnapManager.child_types[i][j].shared_t)).forEach((j)=>{
                Object.keys(SnapManager.panels).filter((k)=>(i!=k && j!=k && SnapManager.child_types[k][i].joined_y)).forEach((k)=>{
                    Debug.trivia(`${j} joined in y to ${k} via ${i}`)
                    SnapManager.child_types[k][j].child_in_y()
                })
            })
        })

        Object.keys(SnapManager.panels).forEach((i)=>{
            const me = SnapManager.panels[i].settings.position
            Object.keys(SnapManager.panels).filter((j)=>(i!=j && SnapManager.child_types[i][j].shared_l)).forEach((j)=>{
                Object.keys(SnapManager.panels).filter((k)=>(i!=k && j!=k && SnapManager.child_types[k][i].joined_x)).forEach((k)=>{
                    Debug.trivia(`${j} joined in x to ${k} via ${i}`)
                    SnapManager.child_types[k][j].child_in_x()
                })
            })
        })

        SnapManager.apply_transitively('indirect_joined_x')
        SnapManager.apply_transitively('indirect_joined_y')

        Object.keys(SnapManager.panels).forEach((i)=>{
            Object.keys(SnapManager.panels).filter((j)=>(i!=j)).forEach((j)=>{
                Debug.trivia(`SnapManager.child_types[${i}][${j}] = ${SnapManager.child_types[i][j].describe()}`)
            })
        })
        

        /* set the z-indices */
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

    static apply_transitively(property) {
        var need_to_recurse = true
        while (need_to_recurse) {
            need_to_recurse = false
            Object.keys(SnapManager.panels).forEach((i)=>{
                Object.keys(SnapManager.panels).filter((j)=>(i!=j)).forEach((j)=>{
                    Object.keys(SnapManager.panels).filter((k)=>(i!=k && j!=k)).forEach((k)=>{
                        if (SnapManager.child_types[j][i][property] && SnapManager.child_types[k][j][property] && !SnapManager.child_types[k][i][property]) {
                            Debug.trivia(`Transitive: ${k} now has '${property}' with ${i} via ${j}`)
                            SnapManager.child_types[k][i][property] = true
                            need_to_recurse = true
                        }
                    })
                })
            })
        }
    }

    /* 
    Called by a panel when it has been moved by the user.
    */
    static apply_snapping(panel) {
        if (mouse_is_down) {
            SnapManager.move_my_children(panel)
        } else {
            SnapManager.update_child_list(`panel ${panel.index}`)
            SnapManager.tidy_edges()
            WindowResizeManager.update_vertical_spans()
        }
    }

    static tidy_edges() {
        // start in the upper left
        const order = Object.values(SnapManager.panels).sort((a,b)=>(parseInt(b.style.zIndex) - parseInt(a.style.zIndex)))
        const reversed = Object.keys(SnapManager.panels).sort((a,b)=>(parseInt(SnapManager.panels[a].style.zIndex) - parseInt(SnapManager.panels[b].style.zIndex)))
        order.forEach((p)=>{
            SnapManager.tidy_up(p, reversed)
        })
    }

    static tidy_up(panel, apply_order) {

        Debug.trivia(`Tidy up ${panel.index}`)
        const me = panel.settings
        const i = panel.index

        apply_order.filter( (k)=>(k!=i && SnapManager.child_types[k][i]?.anything()) ).forEach((k)=>{
            const you = SnapManager.panels[k].settings
            const child_type = SnapManager.child_types[k][i] 

            Debug.trivia(`${i} tidy_up ${i} is a child of ${k}, child_type '${child_type.describe()}'`)

            if (child_type.move_with) {
                if (child_type.shared_t) me.set_position( null, you.position.y, null, null )
                if (child_type.shared_b) me.set_position( null, null, null, you.position.y + you.position.h - me.position.y )
                if (child_type.shared_l) me.set_position( you.position.x, null, null, null )
                if (child_type.shared_r) me.set_position( null, null, you.position.x + you.position.w - me.position.x, null )
            }
            
            if (child_type.joined_x) {
                const your_r = you.position.x + you.position.w - OVERLAP
                me.set_position( your_r, null, null, null )
            }

            if (child_type.joined_y) {
                const your_b = you.position.y + you.position.h - OVERLAP
                const my_h = WindowResizeManager.vertical_snapped.has(i) ? (get_parent_height() - your_b + OVERLAP) : null
                me.set_position( null, your_b, null, my_h )
            }


        })

        me.set_position( clamp(me.position.x,-OVERLAP), clamp(me.position.y,-OVERLAP), null, null )
        if (me.position.x < THRESHOLD) {
            me.set_position( -OVERLAP, null, null, null )
            if (me.position.x + me.position.w + THRESHOLD > panel.parentElement.getBoundingClientRect().width) {
                me.fullwidth = true
                me.set_position( null, null, panel.parentElement.getBoundingClientRect().width + 2 * OVERLAP, null )
            } else { me.fullwidth = false }
        } else { me.fullwidth = false }

        if (me.position.y < THRESHOLD) {
            me.set_position( null, -OVERLAP, null, null )
            if (me.position.y + me.position.h + THRESHOLD > panel.parentElement.getBoundingClientRect().height) {
                me.fullheight = true
                me.set_position( null, null, null, panel.parentElement.getBoundingClientRect().height + 2 * OVERLAP - UNDERLAP )
            } else { me.fullheight = false }
        } else { me.fullheight = false }
        
        update_panel_position(panel, false)
    }

    static move_my_children(panel) {
        /*
        Called when mouse is down; apply any existing snappings to other panels
        */
        
        const me = panel.settings
        const dx = me.position.x - SnapManager.last_dim[panel.index].x
        const dw = me.position.w - SnapManager.last_dim[panel.index].w
        const dy = me.position.y - SnapManager.last_dim[panel.index].y
        const dh = me.position.h - SnapManager.last_dim[panel.index].h

        if (!(dx||dw||dy||dh)) return

        Object.keys(SnapManager.child_types[panel.index]).forEach((i)=>{
            const effects_to_apply = SnapManager.child_types[panel.index][i]
            const ysnap = WindowResizeManager.vertical_snapped.has(i)

            if (effects_to_apply.anything()) {
                Debug.trivia(`moved ${panel.index}, child ${i}, ${effects_to_apply.describe()}, ${dx}, ${dy}, ${dw}, ${dh}`)

                if (dw || dh) {
                    if ( effects_to_apply.indirect_joined_x && dx==0 ) SnapManager.delta( i,   dw, null, null, null )
                    if ( effects_to_apply.indirect_joined_y && dy==0 ) SnapManager.delta( i, null,   dh, null, ysnap?-dh:null )
                    if ( effects_to_apply.shared_r && dx==0 )          SnapManager.delta( i, null, null,   dw, null )
                    if ( effects_to_apply.shared_b && dy==0 )          SnapManager.delta( i, null, null, null,   dh )  
                    if ( effects_to_apply.shared_l && dx!=0 )          SnapManager.delta( i,  -dw, null,   dw, null )
                    if ( effects_to_apply.shared_t && dy!=0 )          SnapManager.delta( i, null,  -dh, null,   dh )       
                } else {
                    if ( effects_to_apply.move_with         )          SnapManager.delta( i,   dx,   dy, null, null ) 
                }             
                                
                update_panel_position( SnapManager.panels[i], true )

            }
        })
        update_panel_position( panel, true )
    }

    static delta(i, x, y, w, h) {
        if (x || y || w || h) SnapManager.panels[i].settings.delta_position(x,y,w,h)
    }
}