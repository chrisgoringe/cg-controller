export class SettingIds {
    static KEYBOARD_TOGGLE = "Controller.options.keyboard"
    static CONTROL_AFTER_GENERATE = "Controller.options.control_after_generate"
    static SCROLL_MOVES_SLIDERS = "Controller.options.scroll_moves_slider"
    static EDIT_SLIDERS = "Controller.options.edit_slider"
    static DEBUG_LEVEL = "Controller.debug.level"
    static FONT_SIZE = "Controller.options.font_size"
    static TOOLTIPS = "Controller.options.tooltips"
    static DEFAULT_APPLY_TO_SIMILAR = "Controller.options.default_apply_to_similar"
    static SHOW_SCROLLBARS = "Controller.options.show_scrollbars"
    static SHOW_IN_FOCUS_MODE = "Controller.options.show_in_focus_mode"
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
    static DRAG_PAUSE_OVER_BACKGROUND = 500
    static SLIDER_ACTIVE_DELAY = 300
    static UPDATE_EXCEPTION_WAITTIME = 10000
    static PAUSE_STACK_WAIT = 101
    static ACTIVE_ELEMENT_DELAY = 234
    static ON_CHANGE_GAP = 200
}

export class Colors {
    static DARK_BACKGROUND = '#222222'
    static MENU_HIGHLIGHT = '#C08080'
}

export class Pixels {
    static BORDER_WIDTH = 4
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