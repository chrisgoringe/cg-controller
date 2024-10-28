import { app } from "../../scripts/app.js"
import { SettingIds } from "./constants.js";

export function add_controls() {

    app.ui.settings.addSetting({
        id: SettingIds.FONT_SIZE,
        name: "Controller font base size:",
        tooltip: "All font sizes will be scaled relative to this value",
        type: "slider",
        attrs: {
            min: 10,
            max: 16
          },
        defaultValue: 12
    });

    app.ui.settings.addSetting({
        id: SettingIds.CONTROL_AFTER_GENERATE,
        name: "Show control after generate",
        tooltip: "Allow the control_after_generate widget to be shown",
        type: "boolean",
        defaultValue: true
    })

    app.ui.settings.addSetting({
        id: SettingIds.TOOLTIPS,
        name: "Show tooltips",
        tooltop: "Refresh controller after changing",
        type: "boolean",
        defaultValue: true
    })

    app.ui.settings.addSetting({
        id: SettingIds.SCROLL_MOVES_SLIDERS,
        name: "Scrollwheel changes sliders",
        type: "combo",
        options: [ {value:"no", text:"Never"}, 
                {value:"yes", text:"Always"}, 
                {value:"shift", text:"When shift key pressed"},
                {value:"ctrl", text:"When ctrl key pressed"},
             ],
        defaultValue: "yes",
    })

    app.ui.settings.addSetting({
        id: SettingIds.EDIT_SLIDERS,
        name: "Edit slider limits",
        type: "combo",
        options: [ 
                {value:"shift", text:"shift-click"},
                {value:"ctrl", text:"ctrl-click"},
             ],
        defaultValue: "yes",
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

}