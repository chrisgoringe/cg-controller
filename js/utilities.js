import { app } from "../../scripts/app.js"
import { SettingIds } from "./constants.js";
import { getSettingValue } from "./settings.js";

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
    if (isNaN(vv)) return false
    return true
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
    if (isNaN(sh)) {
      sh = 0
    }
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