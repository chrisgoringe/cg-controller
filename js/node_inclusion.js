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

    static favorite(node_or_node_id) {
        const nd = get_node(node_or_node_id)
        return (nd && nd.properties["controller"] && nd.properties["controller"]==InclusionOptions.FAVORITE) 
    }

    static visual(ctx, node) {
        const r = NodeInclusionManager.favorite(node) ? 4 : 3
        const title_mid = 15
        const width = node.collapsed ? node._collapsed_width : node.size[0]
        const x = 3+width-title_mid
        const y = -title_mid
        if (NodeInclusionManager.node_includable(node)) {
            ctx.save();

            ctx.fillStyle = "#C08080";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#C08080";

            if (NodeInclusionManager.favorite(node)) {
                ctx.beginPath();
                ctx.arc(x-(r/2), y-(r/2), (r/2), -Math.PI, 0, false);
                ctx.arc(x+(r/2), y-(r/2), (r/2), -Math.PI, 0, false);
                ctx.lineTo(x, y+r)
                ctx.lineTo(x-r, y-(r/2))
                ctx.fill()
            } else {
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2*Math.PI, false);
                if (!NodeInclusionManager.advanced_only(node)) {
                    ctx.fill()
                } else {
                    ctx.stroke()
                }
            }

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
        [InclusionOptions.EXCLUDE,  InclusionOptions.INCLUDE,  InclusionOptions.ADVANCED,  InclusionOptions.FAVORITE] : 
        [InclusionOptions.EXCLUDES, InclusionOptions.INCLUDES, InclusionOptions.ADVANCEDS, InclusionOptions.FAVORITES]
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

