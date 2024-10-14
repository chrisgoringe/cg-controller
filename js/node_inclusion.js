import { get_node } from "./utilities.js";
import { app } from "../../scripts/app.js"

export class NodeInclusionManager {
    static EXCLUDE  = "Don't include this node"
    static INCLUDE  = "Include this node"
    static ALWAYS   = "Include this node in all group views"
    static ADVANCED = "Include this node as advanced control"
    static node_change_callback = null

    static node_includable(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]!=NodeInclusionManager.EXCLUDE) 
    }

    static node_in_all_views(node_or_node_id){
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]==NodeInclusionManager.ALWAYS) 
    }

    static include_node(node_or_node_id) { 
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]!=NodeInclusionManager.EXCLUDE && nd.mode == 0) 
    }
    
    static advanced_only(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]==NodeInclusionManager.ADVANCED && nd.mode == 0) 
    }

    static visual(ctx, node) {
        const r = 3
        const title_mid = 15
        if (NodeInclusionManager.node_includable(node)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(3+node.size[0]-title_mid, -title_mid, r, 0, 2*Math.PI, false);
            if (!NodeInclusionManager.advanced_only(node)) {
                ctx.fillStyle = "#C08080";
                ctx.fill()
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#C08080";
            ctx.stroke();
            ctx.restore();       
        }
    }
}

function cp_callback_submenu(value, options, e, menu, node) {
    const current = node.properties["controller"] ?? NodeInclusionManager.EXCLUDE;
    const submenu = new LiteGraph.ContextMenu(
        [NodeInclusionManager.EXCLUDE, NodeInclusionManager.INCLUDE, NodeInclusionManager.ALWAYS, NodeInclusionManager.ADVANCED],
        { event: e, callback: function (v) { 
            node.properties["controller"] = v; 
            NodeInclusionManager.node_change_callback?.();
            app.canvas.setDirty(true, true) 
        }, 
        parentMenu: menu, node:node}
    )
    Array.from(submenu.root.children).forEach(child => {
        if (child.innerText == current) child.style.borderLeft = "2px solid #C08080";
    });
}

export function add_control_panel_options(options) {
    if (options[options.length-1] != null) options.push(null);
    options.push(
        {
            content: "Controller Panel",
            has_submenu: true,
            callback: cp_callback_submenu,
        }
    )
    options.push(null);
}

