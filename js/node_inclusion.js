import { get_node } from "./utilities.js";
import { app } from "../../scripts/app.js"
import { InclusionOptions, Texts, Colors } from "./constants.js";

export class NodeInclusionManager {
    static node_change_callback = null

    static node_includable(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]!=InclusionOptions.EXCLUDE) 
    }

    static include_node(node_or_node_id) { 
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]!=InclusionOptions.EXCLUDE) 
    }
    
    static advanced_only(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]==InclusionOptions.ADVANCED) 
    }

    static visual(ctx, node) {
        const r = 3
        const title_mid = 15
        const width = node.collapsed ? node._collapsed_width : node.size[0]
        if (NodeInclusionManager.node_includable(node)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(3+width-title_mid, -title_mid, r, 0, 2*Math.PI, false);
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

function selected_nodes() {
    return app.graph._nodes.filter((node)=>node.is_selected)
}

function cp_callback_submenu(value, options, e, menu, node) {
    const current = node.properties["controller"] ?? InclusionOptions.EXCLUDE;
    const selection = selected_nodes()
    const choices = (selection.length==1) ? 
        [InclusionOptions.EXCLUDE,  InclusionOptions.INCLUDE,  InclusionOptions.ADVANCED] : 
        [InclusionOptions.EXCLUDES, InclusionOptions.INCLUDES, InclusionOptions.ADVANCEDS]
    const submenu = new LiteGraph.ContextMenu(
        choices,
        { event: e, callback: function (v) { 
            selection.forEach((nd)=>{nd.properties["controller"] = v.replace('these nodes', 'this node')})
            NodeInclusionManager.node_change_callback?.('submenu', 100);
            app.canvas.setDirty(true, true) 
        }, 
        parentMenu: menu, node:node}
    )
    Array.from(submenu.root.children).forEach(child => {
        if (child.innerText == current) child.style.borderLeft = `2px solid ${Colors.MENU_HIGHLIGHT}`;
    });
}

export function add_control_panel_options(options) {
    if (options[options.length-1] != null) options.push(null);
    options.push(
        {
            content: Texts.CONTEXT_MENU,
            has_submenu: true,
            callback: cp_callback_submenu,
        }
    )
}

