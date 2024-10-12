import { app } from "../../scripts/app.js"
import { GroupManager } from "./groups.js"

const DEFAULTS = {
    "showing"      : true,
    "minimised"    : [],
    "node_order"   : [],
    "heights"      : [],
    "advanced"     : false,
    "group_choice" : GroupManager.show_all
}

const KEYS = Object.keys(DEFAULTS)

class _Settings {
    load() {
        if (!app.graph.extra.controller_panel) return 
        KEYS.forEach((k) => {
            if (app.graph.extra.controller_panel[k]===undefined) app.graph.extra.controller_panel[k] = DEFAULTS[k]      
            if (app.graph.extra.controller_panel[k]==="1")       app.graph.extra.controller_panel[k] = true
            if (app.graph.extra.controller_panel[k]==="0")       app.graph.extra.controller_panel[k] = false 
        })
    }

    //check() {
    //    if (!app.graph?.extra?.controller_panel) { app.graph.extra.controller_panel = DEFAULTS }
    //}

    initialise() {
        if (!app.graph.extra.controller_panel) {
            app.graph.extra.controller_panel = {}
            this.load()
        }
    }

    constructor() {
        KEYS.forEach((k) => {
            Object.defineProperty(this, k, {
                get : () =>  { return app.graph.extra.controller_panel[k] },
                set : (v) => { app.graph.extra.controller_panel[k] = v   }
            })
        })
    }

    // convenience method
    getSettingValue(comfy_key, _default) {
        return app.ui.settings.getSettingValue(comfy_key, _default)
    }

    is_minimised(node_id) {
        if (!this.minimised) this.minimised = []
        return (this.minimised.includes(node_id))
    }

    toggle_minimised(node_id) {
        if (this.is_minimised(node_id)) {
            const index = this.minimised.indexOf(node_id);
            this.minimised.splice(index, 1)
        } else {
            this.minimised.push(node_id)
        }
    }

}

export const settings = new _Settings()