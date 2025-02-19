
export const VERSION = "1.6.1"

//export const MAXIMUM_UPSTREAM = 4

export class SettingIds {
    static KEYBOARD_TOGGLE = "Controller.Display.keyboard"
    static CONTROL_AFTER_GENERATE = "Controller.Display.control_after_generate"
    static SCROLL_MOVES_SLIDERS = "Controller.Sliders.scroll_moves_slider"
    static SCROLL_REVERSED = "Controller.Sliders.scroll_reversed_for_slider"
    static EDIT_SLIDERS = "Controller.Sliders.edit_slider"
    static DEBUG_LEVEL = "Controller.Debug.level"
    static FONT_SIZE = "Controller.Display.font_size"
    static TOOLTIPS = "Controller.Display.tooltips"
    static MINIMUM_TAB_WIDTH = "Controller.Display.minimum_tab_width"
    static DEFAULT_APPLY_TO_SIMILAR = "Controller.Sliders.default_apply_to_similar"
    static SHOW_SCROLLBARS = "Controller.Display.show_scrollbars"
    static SHOW_IN_FOCUS_MODE = "Controller.Display.show_in_focus_mode"
    static HIDE_EXTENSIONS = "Controller.Display.hide_extensions"
}

export class SettingNames {
    static KEYBOARD_TOGGLE = "Toggle controller visibility:"
    static FONT_SIZE = "Base font size:"
    static CONTROL_AFTER_GENERATE = "Show 'control before/after generate'"
    static TOOLTIPS = "Show tooltips"
    static MINIMUM_TAB_WIDTH = "Minimum tab width"
    static DEFAULT_APPLY_TO_SIMILAR = "Default apply to similar"
    static SHOW_IN_FOCUS_MODE = "Show controllers in focus mode"
    static SCROLL_MOVES_SLIDERS = "Scrollwheel changes sliders"
    static SCROLL_REVERSED = "Scrollwheel reversed for sliders"
    static SHOW_SCROLLBARS = "Controller scrollbars"
    static EDIT_SLIDERS = "Edit slider limits"
    static DEBUG_LEVEL = "Debug level"
    static HIDE_EXTENSIONS = "Hide extensions"
}

export class Generic {
    static NEVER = "Never"
    static ALWAYS = "Always"
    static SHIFT = "shift key"
    static CTRL = "ctrl key"
    static OFF = "Off"
    static THIN = "Thin"
    static NORMAL = "Normal"
    static D0 = "Minimal"
    static D1 = "Normal"
    static D2 = "Extra"
    static D3 = "Verbose"
    static SHOW = "Show"
    static HIDE = "Hide"
    static SHOW_ALL = "[Show all widgets]"
    static HIDE_ALL = "[Hide all widgets]"
}

export class Tooltips {
    static FONT_SIZE = "All font sizes will be scaled relative to this value"
    static CONTROL_AFTER_GENERATE = "Allow the control_after_generate widget to be shown"
    static TOOLTIPS = "Refresh controller after changing"
    static MINIMUM_TAB_WIDTH = "Minimum width of a tab before switching to stacked layout"
    static DEFAULT_APPLY_TO_SIMILAR =  "Default setting of 'apply to similar' checkbox"
    static SCROLL_REVERSED = "Scroll up to reduce value"
    static SHOW_SCROLLBARS = "If off, can still scroll with scrollwheel"
    static DEBUG_LEVEL = "Press f12 for js console"
    static HIDE_EXTENSIONS = "Hide filename extensions"
}

export class InclusionOptions {
    static EXCLUDE   = "Don't include this node"
    static INCLUDE   = "Include this node"
    static ADVANCED  = "Include this node as advanced control"
    static FAVORITE  = "Include this node as favorite"
    static EXCLUDES  = InclusionOptions.EXCLUDE.replace('this node', 'these nodes')
    static INCLUDES  = InclusionOptions.INCLUDE.replace('this node', 'these nodes')
    static ADVANCEDS = InclusionOptions.ADVANCED.replace('this node', 'these nodes')
    static FAVORITES = InclusionOptions.FAVORITE.replace('this node', 'these nodes')
}

export class Timings { // ms
    static GENERIC_SHORT_DELAY = 20
    static GENERIC_LONGER_DELAY = 1000
    static GENERIC_MUCH_LONGER_DELAY = 5000
    static PERIODIC_CHECK = 1000              // on_change 'tick'
    static DRAG_PAUSE_OVER_BACKGROUND = 500
    static SLIDER_ACTIVE_DELAY = 300
    static UPDATE_EXCEPTION_WAITTIME = 10000
    static PAUSE_STACK_WAIT = 101
    static ACTIVE_ELEMENT_DELAY = 234
    static ON_CHANGE_GAP = 200                 // must be less than PERIODIC_CHECK. How long to wait for gap in on_change calls
    static ALLOW_LAYOUT = 1000
}

export class Colors {
    static DARK_BACKGROUND = '#222222'
    static MENU_HIGHLIGHT = '#C08080'
    static FAVORITES_FG = '#CC4444'
    static FAVORITES_GROUP = '#223322'
    static FOREGROUND = '#FFFFFF'
    static OPTIONS = ['#FFFFFF', '#000000']
    static UNSELECTED_DARKEN = 0.4
    static HEADER_DARKEN = 0.666
}

export class Pixels {
    static BORDER_WIDTH = 4
    static FOOTER = 4
}

export class Texts {
    static ALL_GROUPS = "All"
    static UNGROUPED = "Ungrouped"
    static FAVORITES = "&#x2764;"
    static CONTEXT_MENU = "Controller Panel"
    static MODE_TOOLTIP = {
        0 : "Click to bypass</br>ctrl&#8209;click to mute",
        2 : "Group muted.</br>Click to activate",
        4 : "Group bypassed.</br>Click to activate",
        9 : "Some nodes muted or bypassed.</br>Click to activate"
    }
    static REMOVE = "Remove from controllers"
    static EDIT_WV = "Edit widget visibility"
    static IMAGE_WIDGET_NAME = "image viewer"
    static UNCONNECTED = "Unconnected Input"
    static EDIT_IMAGE_SETTING = "Images"
    static ACCEPT_UPSTREAM = "Show upstream images"
    static REJECT_UPSTREAM = "Only show my images"
    static NO_IMAGES = "Don't show images"
    static STACK_ALWAYS = "Only show active tab"
    static STACK_IF_NEEDED = "Show all tabs if space allows"
}

export const DisplayNames = {
    "&#x2764;" : "&#x2764; Favorites"
}

export const BASE_PATH = "extensions/cg-controller"

