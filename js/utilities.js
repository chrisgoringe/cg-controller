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

export function ColorLuminance(hex, lum) {

	// validate hex string
	hex = String(hex).replace(/[^0-9a-f]/gi, '');
	if (hex.length < 6) {
		hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
	}
	lum = lum || 0;

	// convert to decimal and change luminosity
	var rgb = "#", c, i;
	for (i = 0; i < 3; i++) {
		c = parseInt(hex.substr(i*2,2), 16);
		c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        if (c.length==1) rgb += "0"
		rgb += c
	}

	return rgb;
}