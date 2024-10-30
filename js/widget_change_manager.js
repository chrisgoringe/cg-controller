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
            WidgetChangeManager.widget_listener_map[widget.wcm_id] = WidgetChangeManager.widget_listener_map[widget.wcm_id].filter((l)=>l.parentElement)
            WidgetChangeManager.widget_listener_map[widget.wcm_id].forEach((l)=>{l.wcm_manager_callback()})
        }
    }
}