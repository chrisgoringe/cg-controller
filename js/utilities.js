import { app } from "../../scripts/app.js"

export function step_size(options) {
    if (options.round)     return options.round
    if (options.precision) return Math.pow(0.1, options.precision)
    return 1
}

var floatRegex = /^-?\d+(?:[.,]\d*?)?$/

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