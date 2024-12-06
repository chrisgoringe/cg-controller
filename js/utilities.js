import { app } from "../../scripts/app.js"
import { api } from "../../scripts/api.js"
import { SettingIds, Timings } from "./constants.js";
import { getSettingValue } from "./settings.js";
import { Debug } from "./debug.js";

export var mouse_is_down 
export function mouse_change(v) { mouse_is_down = v }

var started = false
var sgc_stack = 0

function _send_graph_changed() {
    sgc_stack -= 1
    if (sgc_stack == 0) {
        Debug.extended("Sending graphChanged")
        api.dispatchEvent(
        new CustomEvent('graphChanged', { })
        )
    } else {
        Debug.trivia("Not sending graphChanged yet")
    }
}

export function send_graph_changed(turn_on) {
    started = started || turn_on
    if (started) {
        sgc_stack += 1
        setTimeout(_send_graph_changed, Timings.GENERIC_LONGER_DELAY)
    }
}


export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}

export function create_deep( tag_clss_properties_list, parent ) {
    tag_clss_properties_list.forEach((tcp) => {
        parent = create(tcp.tag, tcp.clss, parent, tcp.properties)
    })
    return parent
}


export function step_size(options) {
    if (options.round)     return options.round
    if (options.precision) return Math.pow(0.1, options.precision)
    return 1
}

var floatRegex = /^-?\d+(?:[.,]\d*?)?$/

export function check_float(v) {
    if (!floatRegex.test(`${v}`)) return false;
    var vv = parseFloat(v)
    return  (!isNaN(vv))
}

export function rounding(v, options) {
    if (!floatRegex.test(`${v}`)) return v;
    var vv = parseFloat(v)
    if (isNaN(vv)) return v
    if (options?.round) {
        vv = Math.round((vv + Number.EPSILON) / options.round) * options.round
    }
    if (options?.precision) {
        vv = vv.toFixed(options.precision)
    }
    return parseFloat(vv)
}

export function integer_rounding(v, options) {
    const s = options.step / 10
    let sh = options.min % s
    sh = (isNaN(sh)) ? 0 : sh
    return Math.round((v - sh) / s) * s + sh   
}

export function get_node(node_or_node_id) {
    if (node_or_node_id.id) return node_or_node_id
    return app.graph._nodes_by_id[node_or_node_id]
}

export function darken(hex) {
	hex = hex.replace("#", '');
    const lum = 0.666;
    const rgb = (hex.length == 3) ?
        [ parseInt(hex.substr(0,1), 16)*17*lum, parseInt(hex.substr(1,1), 16)*17*lum, parseInt(hex.substr(2,1), 16)*17*lum ] :
        [ parseInt(hex.substr(0,2), 16)*lum, parseInt(hex.substr(2,2), 16)*lum, parseInt(hex.substr(4,2), 16)*lum ]
        
	var result = "#"
    rgb.forEach((v) => {
        const hex = Math.round(v).toString(16)
        if (hex.length==1) result += "0" 
        result += hex
    })

	return result;
}

export function clamp(v,min,max) {
    if (max!=null) return Math.max(min, Math.min(v,max))
    return Math.max(min,v)
}

export function classSet(element, name, add) {
    if (add) {
        element.classList.add(name)
    } else {
        element.classList.remove(name)
    }
}

export function add_tooltip(element, text, extra_classes) {
    if (app.canvas.read_only) return
    if (getSettingValue(SettingIds.TOOLTIPS, true)) {
        element.classList.add('tooltip')
        if (extra_classes) extra_classes.split(" ").forEach((s) => element.classList.add(s))
        create('span', 'tooltiptext', element, {"innerHTML":text.replaceAll(' ','&nbsp;')}) 
    }
}

export function defineProperty(instance, property, desc) {
    const existingDesc = Object.getOwnPropertyDescriptor(instance, property);
    if (existingDesc?.configurable === false) {
        throw new Error(`Error: Cannot define un-configurable property "${property}"`);
    }
    if (existingDesc?.get && desc.get) {
        const descGet = desc.get;
        desc.get = () => {
            existingDesc.get.apply(instance, []);
            return descGet.apply(instance, []);
        };
    }
    if (existingDesc?.set && desc.set) {
        const descSet = desc.set;
        desc.set = (v) => {
            existingDesc.set.apply(instance, [v]);
            return descSet.apply(instance, [v]);
        };
    }
    desc.enumerable = desc.enumerable ?? existingDesc?.enumerable ?? true;
    desc.configurable = desc.configurable ?? existingDesc?.configurable ?? true;
    if (!desc.get && !desc.set) {
        desc.writable = desc.writable ?? existingDesc?.writable ?? true;
    }
    return Object.defineProperty(instance, property, desc);
}

export function mode_change(mode, e) {
    return (mode==0) ? (e.ctrlKey ? 2 : 4) : ((e.ctrlKey && mode==4) ? 2 : 0)
}

export function focus_mode() {
    if (document.getElementsByClassName('graph-canvas-panel')[0]) return "normal"
    if (document.getElementsByClassName('graph-canvas-container')[0]) return "focus"
    return null
}

export function find_controller_parent() {
  const show_in_focus = getSettingValue(SettingIds.SHOW_IN_FOCUS_MODE, false)
  return document.getElementsByClassName('graph-canvas-panel')[0] ?? 
          (show_in_focus ? (document.getElementsByClassName('graph-canvas-container')[0] ?? null) : null)
}

export function createBounds(objects, padding = 10) {
    const bounds = new Float32Array([Infinity, Infinity, -Infinity, -Infinity]);
    for (const obj of objects) {
        const rect = obj.boundingRect;
        bounds[0] = Math.min(bounds[0], rect[0]);
        bounds[1] = Math.min(bounds[1], rect[1]);
        bounds[2] = Math.max(bounds[2], rect[0] + rect[2]);
        bounds[3] = Math.max(bounds[3], rect[1] + rect[3]);
    }
    if (!bounds.every((x2) => isFinite(x2))) return null;
    return [
        bounds[0] - padding,
        bounds[1] - padding,
        bounds[2] - bounds[0] + 2 * padding,
        bounds[3] - bounds[1] + 2 * padding
    ];
  }

/* 
After a short delay (for layout), add or remove a title to the specified element, based on whether it's content is overflowing.
if overflowing, add title (which acts as a tooltip in most browsers) otherwise remove title.

Second parameter is the element that the title gets applied to (default is the same as the first)

If the element applied to has a .tooltip property this is used when not overflowing

Used for elements with ellipsis text-overflow
*/
export function tooltip_if_overflowing(element, applyto) {
  if (element) setTimeout(_tooltip_if_overflowing, Timings.GENERIC_LONGER_DELAY, element, applyto ?? element)
}

function _tooltip_if_overflowing(element, applyto) {
    if (element.clientWidth < element.scrollWidth) {
        applyto.title = element.innerText ?? innerHTML
    } else if (applyto.tooltip) {
        applyto.title = applyto.tooltip
    } else {
        if (applyto.title) delete applyto.title
    }
}