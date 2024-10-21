import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"
import { SettingIds } from "./constants.js";

export function add_controls() {
    app.ui.settings.addSetting({
        id: SettingIds.KEYBOARD_TOGGLE,
        name: "Toggle controller visibility:",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:"c", text:"c"}, {value:"C", text:"shift-C"}, 
                                          {value:"o", text:"o"}, {value:"O", text:"shift-O"}],
        defaultValue: "C",
    });

    app.ui.settings.addSetting({
        id: SettingIds.CONTROL_AFTER_GENERATE,
        name: "Show control after generate",
        tooltip: "Allow the control_after_generate widget to be shown",
        type: "boolean",
        defaultValue: true
    })

    app.ui.settings.addSetting({
        id: SettingIds.DEBUG_LEVEL,
        name: "Debug level",
        tooltip: "Press f12 for js console",
        type: "combo",
        options: [ {value:0, text:"Critical only"}, 
                   {value:1, text:"Important messages"}, 
                   {value:2, text:"Extra information"}, 
                                          {value:3, text:"Verbose"} ],
        defaultValue: "1"
    })


    window.addEventListener('keypress', (e) => {
        if (e.target.tagName=="CANVAS" || e.target.tagName=="BODY") {
            const keysetting = app.ui.settings.getSettingValue(SettingIds.KEYBOARD_TOGGLE, "C") 
            if (keysetting==e.key) {
                ControllerPanel.toggle()
                e.preventDefault()
                e.stopImmediatePropagation()
                return false
            }
        }
    })
}