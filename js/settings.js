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
    "hidden" : false
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
    initialise_settings()
    fill_blanks()
    const all_setting_indices = []
    Object.keys(app.graph.extra.controller_panel.controllers).forEach((i)=>{all_setting_indices.push(i)})
    return all_setting_indices
}

export function new_controller_setting_index() {
    var i = 0
    while (app.graph.extra.controller_panel.controllers[i]) i += 1
    //app.graph.extra.controller_panel.controllers[i] = {}
    return i
}

function initialise_settings() {
    GLOBAL_KEYS.forEach((k)=>{
        if (app.graph.extra.controller_panel[k] == undefined) app.graph.extra.controller_panel[k] = GLOBAL[k]
    })
    if (app.graph.extra.controller_panel?.controllers) {
        const nc = {}
        Object.keys(app.graph.extra.controller_panel?.controllers).forEach((k)=>{
            if (app.graph.extra.controller_panel?.controllers[k]) nc[k] = app.graph.extra.controller_panel?.controllers[k]
        })
        if (nc=={}) {
            nc[0] = {}
            Object.assign(nc[0], DEFAULTS)
        }
        app.graph.extra.controller_panel.controllers = nc
    } else if (app.graph.extra.controller_panel) {
        app.graph.extra.controller_panel.controllers = {0:app.graph.extra.controller_panel}
    } else {
        const s = {}
        Object.assign(s, DEFAULTS)
        app.graph.extra.controller_panel = {"controllers":{0:s}}
    }
}

function fill_blanks() {
    Object.keys(app.graph.extra.controller_panel.controllers).forEach((k) => {
        const controller_settings = app.graph.extra.controller_panel.controllers[k]
        KEYS.forEach((key)=>{
            if (!controller_settings[key]) controller_settings[key] = DEFAULTS[key]
        })
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

