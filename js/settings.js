import { app } from "../../scripts/app.js"
import { Debug } from "./debug.js"
import { Texts } from "./constants.js"
import { defineProperty, send_graph_changed } from "./utilities.js"

const DEFAULTS = {
    "node_order"   : [],
    "advanced"     : false,
    "groups"       : [],
    "group_choice" : Texts.ALL_GROUPS,
    "position"     : {"x" : 0, "y" : 0, "w" : 250, "h" : 180},
    "userposition" : {"x" : 0, "y" : 0, "w" : 250, "h" : 180},
    "collapsed"    : false,
    "fullheight"   : false,
    "fullwidth"    : false,
    "hidden_widgets" : [],
    "minimised_blocks" : [],
    "blocks_rejecting_upstream" : [],
    "stack_tabs"   : false,
} 
const KEYS = Object.keys(DEFAULTS)

const GLOBAL = {
    "hidden"        : true,
    "highlight"     : true,
    "version"       : 2,
    "default_order" : []
}
const GLOBAL_KEYS = Object.keys(GLOBAL)

class _Settings {
    constructor(index) {
        this.index = index
        if (!app.graph.extra.controller_panel.controllers[index]) {
            app.graph.extra.controller_panel.controllers[index] = {}
            Object.assign(app.graph.extra.controller_panel.controllers[index], DEFAULTS)
        }
        this.settings = app.graph.extra.controller_panel.controllers[index]
        if (this.settings.node_order.length==0) this.settings.node_order = Array.from(global_settings.default_order)
        KEYS.forEach((k) => {
            defineProperty(this, k, {
                get : ()  => { return this.settings[k] },
                set : (v) => { this.settings[k] = v; send_graph_changed(); }
            })
        })
    }
    set_position(x,y,w,h) {
        if (isNaN(x)) {
            x = 0
        }
        this.position = {
            "x" : (x!=null) ? x : this.position.x,
            "y" : (y!=null) ? y : this.position.y,
            "w" : (w!=null) ? w : this.position.w,
            "h" : (h!=null) ? h : this.position.h,
        }
    }
    delta_position(x,y,w,h) {
        this.set_position( 
            x ? x + this.position.x : null,
            y ? y + this.position.y : null,
            w ? w + this.position.w : null,
            h ? h + this.position.h : null,
         )
    }
}

export function get_settings(index) {
    return new _Settings(index)
}

export function delete_settings(index) {
    delete app.graph.extra.controller_panel.controllers[index]
}

export function get_all_setting_indices() {
    const all_setting_indices = []
    Object.keys(app.graph.extra.controller_panel.controllers).forEach((i)=>{
        if (app.graph.extra.controller_panel.controllers[i]) all_setting_indices.push(i)
    })
    return all_setting_indices
}

export function new_controller_setting_index() {
    var i = 0
    if (app.graph.extra.controller_panel == undefined) initialise_settings()
    while (app.graph.extra.controller_panel.controllers[i]) i += 1
    return i
}

export function valid_settings() {
    if (app.graph.extra.controller_panel == undefined || app.graph.extra.controller_panel.hidden == undefined) {
        initialise_settings()
        return false
    }
    return true
}

export function initialise_settings() {
    /* If there is no controller_panel */
    if (app.graph.extra.controller_panel == undefined) {
        app.graph.extra.controller_panel = { "controllers":{} }
    }

    /* If there is one of the old style */
    if (app.graph.extra.controller_panel.controllers == undefined) {
        app.graph.extra.controller_panel = { "controllers":{} }
    }

    /* Fix any missing GLOBALS */
    GLOBAL_KEYS.forEach((k)=>{
        if (app.graph.extra.controller_panel[k] == undefined) app.graph.extra.controller_panel[k] = GLOBAL[k]
    })

    /* Fix any missing DEFAULTS */
    Object.keys(app.graph.extra.controller_panel.controllers).forEach((k) => {
        const controller_settings = app.graph.extra.controller_panel.controllers[k]
        if (controller_settings) {
            if (controller_settings.controllers) controller_settings.controllers = null
            KEYS.forEach((key)=>{
                if (!controller_settings[key]) controller_settings[key] = DEFAULTS[key]
            })
        }
    })
}

class GlobalSettings {
    constructor() {
        GLOBAL_KEYS.forEach((k) => {
            defineProperty(this, k, {
                get : ()  => { 
                    const v = app?.graph?.extra?.controller_panel?.[k] 
                    return v ?? GLOBAL[k]
                },
                set : (v) => { 
                    try {
                        app.graph.extra.controller_panel[k] = v 
                    } catch (e) { Debug.error("global set", e)}
                }
            })
        })
    }
}

export const global_settings = new GlobalSettings()

export function getSettingValue(comfy_key, _default) {
    return app.ui.settings.getSettingValue(comfy_key)
}

export function add_missing_nodes(order) {
    app.graph._nodes.forEach((n)=>{
        if (!order.includes(n.id)) order.push(n.id)
        if (!global_settings.default_order.includes(n.id)) global_settings.default_order.push(n.id)   
    })
}

export function update_node_order(order, moved_node, now_after, now_before) {
    _update_node_order(order, moved_node, now_after, now_before)
    _update_node_order(global_settings.default_order, moved_node, now_after, now_before)
}

function _update_node_order(order, moved_node, now_after, now_before) {
    const initial      = order.indexOf(moved_node)
    const place_after  = order.indexOf(now_after) 
    const place_before = (order.indexOf(now_before) >= 0) ? order.indexOf(now_before) : order.length

    if (place_before < place_after) {
        _update_node_order(order, now_before, now_after)
        _update_node_order(order, moved_node, now_after, now_before)
        return
    }

    if (initial < place_after) {
        order.splice(initial, 1)
        order.splice(place_after, 0, moved_node)
    } else if (initial > place_before) {
        order.splice(initial, 1)
        order.splice(place_before, 0, moved_node)
    }

}