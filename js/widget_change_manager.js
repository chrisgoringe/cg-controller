import { app } from "../../scripts/app.js";
import { clamp } from "./utilities.js";

export class WidgetChangeManager {
    static widget_listener_map = {}
    static next_id = 1
    static add_listener(widget, listener) {
        if (!widget.wcm_id) {
            widget.wcm_id = WidgetChangeManager.next_id
            WidgetChangeManager.next_id += 1
            WidgetChangeManager.widget_listener_map[widget.wcm_id] = []
        }
        WidgetChangeManager.widget_listener_map[widget.wcm_id].push(listener)
    }
    static notify(widget) {
        if (widget.wcm_id && WidgetChangeManager.widget_listener_map[widget.wcm_id]) {
            WidgetChangeManager.widget_listener_map[widget.wcm_id] = WidgetChangeManager.widget_listener_map[widget.wcm_id].filter((l)=>l.wcm_manager_callback())
        }
        app.graph.setDirtyCanvas(true,true)
    }
    static set_widget_value(widget, v) {
        widget.value = v
        if (widget.original_callback) widget.original_callback(widget.value)
        if (widget.options.min != null) widget.value = clamp(widget.value, widget.options.min, widget.options.max)
        WidgetChangeManager.notify(widget)
    }
}
