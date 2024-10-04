import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"

function canvas_menu() {
    // Add our items to the canvas menu
    const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        const options = original_getCanvasMenuOptions.apply(this, arguments);
        options.push(null);
        options.push({
            content: ControllerPanel.showing() ? "Update Controller Panel" : "Show Controller Panel",
            callback: () => ControllerPanel.show()
        })
        if (ControllerPanel.showing()) {
            options.push({
                content: "Hide Controller Panel",
                callback: () => ControllerPanel.hide()
            })                
        }
        return options
    }
}

function shortcut_keys() {
    // shortcut keys
    app.ui.settings.addSetting({
        id: "Controller.keyboard",
        name: "Toggle controller visibility:",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:"c", text:"c"}, {value:"C", text:"shift-C"}, 
                                          {value:"p", text:"p"}, {value:"P", text:"shift-P"}],
        defaultValue: "C",
    });

    window.addEventListener('keypress', (e) => {
        if (e.target.tagName=="CANVAS") {
            const keysetting = app.ui.settings.getSettingValue('Controller.keyboard', 0) 
            if (keysetting==e.key) {
                ControllerPanel.toggle()
                e.preventDefault()
                e.stopImmediatePropagation()
                return false
            }
        }
    })
}

export function add_controls() {
    canvas_menu()
    shortcut_keys()
}