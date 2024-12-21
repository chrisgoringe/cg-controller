import { SettingIds, SettingNames, Tooltips, Generic } from "./constants.js";

export const OPTIONS = [
    {
        id: SettingIds.MINIMUM_TAB_WIDTH,
        name: SettingNames.MINIMUM_TAB_WIDTH,
        tooltip: Tooltips.MINIMUM_TAB_WIDTH,
        type: "slider",
        attrs: {
            min: 20,
            max: 150
          },
        defaultValue: 50
    },
    {
        id: SettingIds.HIDE_EXTENSIONS,
        name: SettingNames.HIDE_EXTENSIONS,
        tooltip: Tooltips.HIDE_EXTENSIONS,
        type: "boolean",
        defaultValue: false
    },
    {
        id: SettingIds.KEYBOARD_TOGGLE,
        name: SettingNames.KEYBOARD_TOGGLE,
        type: "combo",
        options: [ {value:0, text:"Off"}, {value:"c", text:"c"}, {value:"C", text:"shift-C"}, 
                                          {value:"o", text:"o"}, {value:"O", text:"shift-O"}],
        defaultValue: "C",
    },
    {
        id: SettingIds.SHOW_SCROLLBARS,
        name: SettingNames.SHOW_SCROLLBARS,
        tooltip: Tooltips.SHOW_SCROLLBARS,
        type: "combo",
        options: [ {value:"no", text:Generic.OFF}, 
                {value:"thin", text:Generic.THIN}, 
                {value:"full", text:Generic.NORMAL},
             ],
        defaultValue: "thin",     
    },
    {
        id: SettingIds.FONT_SIZE,
        name: SettingNames.FONT_SIZE,
        tooltip: Tooltips.FONT_SIZE,
        type: "slider",
        attrs: {
            min: 10,
            max: 16
          },
        defaultValue: 12
    },
    {
        id: SettingIds.CONTROL_AFTER_GENERATE,
        name: SettingNames.CONTROL_AFTER_GENERATE,
        tooltip: Tooltips.CONTROL_AFTER_GENERATE,
        type: "boolean",
        defaultValue: true
    },
    {
        id: SettingIds.TOOLTIPS,
        name: SettingNames.TOOLTIPS,   
        tooltip: Tooltips.TOOLTIPS, 
        type: "boolean",
        defaultValue: true
    },

    {
        id: SettingIds.SHOW_IN_FOCUS_MODE,
        name: SettingNames.SHOW_IN_FOCUS_MODE,
        type: "boolean",
        defaultValue: false        
    },
    {
        id: SettingIds.SCROLL_MOVES_SLIDERS,
        name: SettingNames.SCROLL_MOVES_SLIDERS,
        type: "combo",
        options: [ {value:"no", text:Generic.NEVER}, 
                {value:"yes", text:Generic.ALWAYS}, 
                {value:"shift", text:Generic.SHIFT},
                {value:"ctrl", text:Generic.CTRL},
             ],
        defaultValue: "yes",
    },
    {
        id: SettingIds.SCROLL_REVERSED,
        name: SettingNames.SCROLL_REVERSED,
        tooltip: Tooltips.SCROLL_REVERSED,
        type: "boolean",
        defaultValue: false           
    },

    {
        id: SettingIds.EDIT_SLIDERS,
        name: SettingNames.EDIT_SLIDERS,
        type: "combo",
        options: [ 
                {value:"shift", text:"shift-click"},
                {value:"ctrl", text:"ctrl-click"},
             ],
        defaultValue: "yes",
    },
    {
        id: SettingIds.DEFAULT_APPLY_TO_SIMILAR,
        name: SettingNames.DEFAULT_APPLY_TO_SIMILAR,
        tooltip: Tooltips.DEFAULT_APPLY_TO_SIMILAR,
        type: "boolean",
        defaultValue: true        
    },
    {
        id: SettingIds.DEBUG_LEVEL,
        name: SettingNames.DEBUG_LEVEL,
        tooltip: Tooltips.DEBUG_LEVEL,
        type: "combo",
        options: [ {value:0, text:Generic.D0}, 
                   {value:1, text:Generic.D1}, 
                   {value:2, text:Generic.D2}, 
                   {value:3, text:Generic.D3} ],
        defaultValue: "1"
    }
].reverse()