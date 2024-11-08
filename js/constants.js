export class SettingIds {
    static KEYBOARD_TOGGLE = "Controller.options.keyboard"
    static CONTROL_AFTER_GENERATE = "Controller.options.control_after_generate"
    static SCROLL_MOVES_SLIDERS = "Controller.options.scroll_moves_slider"
    static EDIT_SLIDERS = "Controller.options.edit_slider"
    static DEBUG_LEVEL = "Controller.debug.level"
    static FONT_SIZE = "Controller.options.font_size"
    static TOOLTIPS = "Controller.options.tooltips"
    static DEFAULT_APPLY_TO_SIMILAR = "Controller.options.default_apply_to_similar"
}

export class InclusionOptions {
    static EXCLUDE   = "Don't include this node"
    static INCLUDE   = "Include this node"
    static ADVANCED  = "Include this node as advanced control"
    static EXCLUDES  =  InclusionOptions.EXCLUDE.replace('this node', 'these nodes')
    static INCLUDES  = InclusionOptions.INCLUDE.replace('this node', 'these nodes')
    static ADVANCEDS = InclusionOptions.ADVANCED.replace('this node', 'these nodes')
}

export class Timings { // ms
    static RESIZE_DELAY_BEFORE_REDRAW = 200
    static SETTINGS_TRY_RELOAD = 1000
    static DRAG_PAUSE_OVER_BACKGROUND = 500
    static END_HEIGHT_CHANGE_PAUSE = 10
    static UPDATE_GENERAL_WAITTIME = 1234
    static UPDATE_EXCEPTION_WAITTIME = 10000
    static GROUP_SELECT_NOSELECT_WAIT = 5000
    static PAUSE_STACK_WAIT = 101
    static HOLDER_RESIZED_WAIT = 2000
}

export class Colors {
    static DARK_BACKGROUND = '#222222'
    static MENU_HIGHLIGHT = '#C08080'
}

export class Texts {
    static ALL_GROUPS = "All"
    static UNGROUPED = "Ungrouped"
    static CONTEXT_MENU = "Controller Panel"
    static MODE_TOOLTIP = {
        0 : "Click to bypass</br>ctrl&#8209;click to mute",
        2 : "Group muted.</br>Click to activate",
        4 : "Group bypassed.</br>Click to activate",
        9 : "Some nodes muted or bypassed.</br>Click to activate"
    }
}

export const BASE_PATH = "extensions/cg-controller"