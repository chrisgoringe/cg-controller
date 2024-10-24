import { app } from "../../scripts/app.js"
import { GroupManager } from "./groups.js"
import { Debug } from "./debug.js"


const DEFAULTS = {
    "node_order"   : [],
    "advanced"     : false,
    "group_choice" : GroupManager.show_all,
    "element_width": 0,
    "scrollbar_on" : false
}

const KEYS = Object.keys(DEFAULTS)

class _Settings {
    fix_backward_compatibility() {
        if (!app.graph.extra.controller_panel) {
            Debug.important("When trying to fix_backward_compatibility, extras did not have controller_panel")
            return
        } 
        KEYS.forEach((k) => {
            if (app.graph.extra.controller_panel[k]===undefined) app.graph.extra.controller_panel[k] = DEFAULTS[k]      
            if (app.graph.extra.controller_panel[k]==="1")       app.graph.extra.controller_panel[k] = true
            if (app.graph.extra.controller_panel[k]==="0")       app.graph.extra.controller_panel[k] = false 
        })
    }

    get(k) {
        if (app.graph?.extra?.controller_panel?.[k] != undefined) return app.graph.extra.controller_panel[k]  // value exists - all good

        if (app.graph?.extra.controller_panel) {  // our settings exist, but not this one. Must be new
            app.graph.extra.controller_panel[k] = DEFAULTS[k]
            return app.graph.extra.controller_panel[k]
        } else if (app.graph.extra) {
            Debug.extended(`When requesting ${k}, extra did not have controller_panel - normal for new workflows - creating it`)
            app.graph.extra.controller_panel = {}
            return DEFAULTS[k]
        } else {
            Debug.important(`When requesting ${k}, extra did not exist`)
            return DEFAULTS[k]
        }        
    }

    set(k,v) {
        if (app.graph?.extra.controller_panel) {
            app.graph.extra.controller_panel[k] = v   
        } else if (app.graph.extra) {
            Debug.important(`When setting ${k}, extra did not have controller_panel`)
        } else {
            Debug.important(`When setting ${k}, extra did not exist`)
        }
    }

    constructor() {
        KEYS.forEach((k) => {
            Object.defineProperty(this, k, {
                get : ( ) => { return this.get(k)   },
                set : (v) => { return this.set(k,v) }
            })
        })
    }

    // convenience method
    getSettingValue(comfy_key, _default) {
        return app.ui.settings.getSettingValue(comfy_key, _default)
    }

}

export const settings = new _Settings()