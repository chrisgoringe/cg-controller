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
        this.settings = app.graph.extra.controller_panel.controllers[index]
        KEYS.forEach((k) => {
            Object.defineProperty(this, k, {
                get : ()  => { return this.settings[k] },
                set : (v) => { this.settings[k] = v }
            })
        })
    }
}

export function get_all_settings() {
    initialise_settings()
    fill_blanks()
    const all_settings = []
    for (var i=0; i<app.graph.extra.controller_panel.controllers.length; i++) {
        all_settings.push(new _Settings(i))
    }
    return all_settings
}

function initialise_settings() {
    GLOBAL_KEYS.forEach((k)=>{
        if (app.graph.extra.controller_panel[k] == undefined) app.graph.extra.controller_panel[k] = GLOBAL[k]
    })
    if (app.graph.extra.controller_panel?.controllers) return
    if (app.graph.extra.controller_panel) {
        app.graph.extra.controller_panel = {"controllers":[app.graph.extra.controller_panel,]}
    } else {
        const s = {}
        Object.assign(s, DEFAULTS)
        app.graph.extra.controller_panel = {"controllers":[s,]}
    }
}

function fill_blanks() {
    app.graph.extra.controller_panel.controllers.forEach((controller_settings) => {
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

