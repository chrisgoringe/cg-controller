import { app } from "../../scripts/app.js"
import { ControllerPanel } from "./controller_panel.js"

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
        id: "Controller.keyboard",
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
        id: "Controller.extras.control_after_generate",
        name: "Show control after generate",
        tooltip: "Allow the control_after_generate widget to be shown",
        type: "boolean",
        defaultValue: true
    })

    window.addEventListener('keypress', (e) => {
        if (e.target.tagName=="CANVAS" || e.target.tagName=="BODY") {
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
    settings_menu()
}