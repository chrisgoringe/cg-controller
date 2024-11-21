
export const VERSION = "1.4.1"

export class SettingIds {
    static KEYBOARD_TOGGLE = "Controller.options.keyboard"
    static CONTROL_AFTER_GENERATE = "Controller.options.control_after_generate"
    static SCROLL_MOVES_SLIDERS = "Controller.options.scroll_moves_slider"
    static SCROLL_REVERSED = "Controller.options.scroll_reversed_for_slider"
    static EDIT_SLIDERS = "Controller.options.edit_slider"
    static DEBUG_LEVEL = "Controller.debug.level"
    static FONT_SIZE = "Controller.options.font_size"
    static TOOLTIPS = "Controller.options.tooltips"
    static DEFAULT_APPLY_TO_SIMILAR = "Controller.options.default_apply_to_similar"
    static SHOW_SCROLLBARS = "Controller.options.show_scrollbars"
    static SHOW_IN_FOCUS_MODE = "Controller.options.show_in_focus_mode"
}

export class SettingNames {
    static KEYBOARD_TOGGLE = "Toggle controller visibility:"
    static FONT_SIZE = "Controller font base size:"
    static CONTROL_AFTER_GENERATE = "Show control after generate"
    static TOOLTIPS = "Show tooltips"
    static DEFAULT_APPLY_TO_SIMILAR = "Default apply to similar"
    static SHOW_IN_FOCUS_MODE = "Show controllers in focus mode"
    static SCROLL_MOVES_SLIDERS = "Scrollwheel changes sliders"
    static SCROLL_REVERSED = "Scrollwheel reversed for sliders"
    static SHOW_SCROLLBARS = "Controller scrollbars"
    static EDIT_SLIDERS = "Edit slider limits"
    static DEBUG_LEVEL = "Debug level"
}

export class Generic {
    static NEVER = "Never"
    static ALWAYS = "Always"
    static SHIFT = "When shift key pressed"
    static CTRL = "When ctrl key pressed"
    static OFF = "Off"
    static THIN = "Thing"
    static NORMAL = "Normal"
    static D0 = "Only show errors"
    static D1 = "Normal debugging"
    static D2 = "Extra information"
    static D3 = "Maximum information"
}

export class Tooltips {
    static FONT_SIZE = "All font sizes will be scaled relative to this value"
    static CONTROL_AFTER_GENERATE = "Allow the control_after_generate widget to be shown"
    static TOOLTIPS = "Refresh controller after changing"
    static DEFAULT_APPLY_TO_SIMILAR =  "Default setting of 'apply to similar' checkbox"
    static SCROLL_REVERSED = "Scroll up to reduce value"
    static SHOW_SCROLLBARS = "If off, can still scroll with scrollwheel"
    static DEBUG_LEVEL = "Press f12 for js console"
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
    static ON_WINDOW_RESIZE_GAP = 27
    static GROUP_CHANGE_DELAY = 10
}

export class Colors {
    static DARK_BACKGROUND = '#222222'
    static MENU_HIGHLIGHT = '#C08080'
}

export class Pixels {
    static BORDER_WIDTH = 4
    static FOOTER = 4
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

