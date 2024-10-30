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

export class OnExecutedManager {
    static node_listener_map = {}
    static add_listener(node_id, listener) {
        if (!OnExecutedManager.node_listener_map[node_id]) OnExecutedManager.node_listener_map[node_id] = new Set()
        OnExecutedManager.node_listener_map[node_id].add(listener)
    }

    static send(node_id, output) {
        if (OnExecutedManager.node_listener_map[node_id]) {
            Array.from(OnExecutedManager.node_listener_map[node_id]).forEach((l)=>{
                if (l.parentElement) {
                    l.oem_manager_callback(output)
                } else {
                    OnExecutedManager.node_listener_map[node_id].delete(node_id)
                }
            })
        }
    }

    static on_executed(e) {
        const node_id = e.detail.node
        const output = e.detail.output
        OnExecutedManager.send(node_id, output)
    }

    static executing_node = null
    static on_executing(e) {
        OnExecutedManager.executing_node = e.detail
    }

    static on_b_preview(e) {
        const node_id = OnExecutedManager.executing_node
        const output = {"images":[{"src":window.URL.createObjectURL(e.detail)}]}
        OnExecutedManager.send(node_id, output)
    }
}