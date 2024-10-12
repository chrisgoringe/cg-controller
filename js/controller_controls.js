import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"
import { SettingIds } from "./constants.js";

function canvas_menu() {
    // Add our items to the canvas menu
    const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        const options = original_getCanvasMenuOptions.apply(this, arguments);
        options.push(null);

        options.push({
            content: ControllerPanel.showing() ? "Hide Controller Panel" : "Show Controller Panel",
            callback: () => ControllerPanel.toggle()
        })                
        return options
    }
}

function settings_menu() {
    app.ui.settings.addSetting({
        id: SettingIds.KEYBOARD_TOGGLE,
        name: "Toggle controller visibility:",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:"c", text:"c"}, {value:"C", text:"shift-C"}, 
                                          {value:"o", text:"o"}, {value:"O", text:"shift-O"}],
        defaultValue: "C",
    });

    app.ui.settings.addSetting({
        id: "Controller.sliders.max",
        name: "Override max values:",
        tooltip: "Max values for sliders. Comma separated list of widget_name=value or node_name:widget_name=value. First match wins.",
        type: 'text',
        defaultValue: 'guidance=10, steps=50, cfg=20'
    });
    app.ui.settings.addSetting({
        id: "Controller.sliders.min",
        name: "Override min values:",
        tooltip: "Min values for sliders. Comma separated list of widget_name=value or node_name:widget_name=value. First match wins.",
        type: 'text',
        defaultValue: ''
    });
    app.ui.settings.addSetting({
        id: "Controller.sliders.step",
        name: "Override step size:",
        tooltip: "Step size for sliders. Comma separated list of widget_name=value or node_name:widget_name=value. First match wins.",
        type: 'text',
        defaultValue: 'cfg=0.1'
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

    app.ui.settings.addSetting({
        id: SettingIds.AUTOUPDATE,
        name: "Autoupdate",
        tooltop: "How often the controller checks for certain changes in the workflow",
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:10000, text:"Slow (10s)"}, {value:5000, text:"Normal (5s)"}, {value:1000, text:"Fast (1s)"} ],
        defaultValue: 5000
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

export function add_controls() {
    canvas_menu()
    settings_menu()
}