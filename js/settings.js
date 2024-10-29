import { app } from "../../scripts/app.js"
import { Debug } from "./debug.js"
import { Texts } from "./constants.js"

const DEFAULTS = {
    "node_order"   : [],
    "advanced"     : false,
    "group_choice" : Texts.ALL_GROUPS,
    "position"     : {"x" : 0, "y" : 0, "w" : 250, "h" : 180},
    "userposition" : {"x" : 0, "y" : 0, "w" : 250, "h" : 180},
    "collapsed"    : false
} 
const KEYS = Object.keys(DEFAULTS)

const GLOBAL = {
    "hidden" : false,
    "version" : 1
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
        KEYS.forEach((k) => {
            Object.defineProperty(this, k, {
                get : ()  => { return this.settings[k] },
                set : (v) => { this.settings[k] = v /*; console.log(`${this.index} ${k} <= ${v}`)*/}
            })
        })
    }
    set_position(x,y,w,h) {
        this.position = {
            "x" : (x!=null) ? x : this.position.x,
            "y" : (y!=null) ? y : this.position.y,
            "w" : (w!=null) ? w : this.position.w,
            "h" : (h!=null) ? h : this.position.h,
        }
    }
    store_position() {
        Object.assign(this.userposition, this.position)
    }
    retreive_position() {
        Object.assign(this.position, this.userposition)
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
            Object.defineProperty(this, k, {
                get : ()  => { return app.graph.extra.controller_panel[k] },
                set : (v) => { app.graph.extra.controller_panel[k] = v }
            })
        })
    }
}

export const global_settings = new GlobalSettings()

export function getSettingValue(comfy_key, _default) {
    return app.ui.settings.getSettingValue(comfy_key, _default)
}

