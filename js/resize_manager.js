
export function make_resizable( element, node_id, name_list ) {
    element.parentNode.resizable = {
        "element"   : element,
        "node_id"   : node_id,
        "name_list" : name_list
    }
}


export function observe_resizables( root, change_callback ) {
    const resize_observer = new ResizeObserver( () => change_callback() )
    function recursive_observe(element) {
        if (element.resizable) resize_observer.observe(element.resizable.element)
        element.childNodes?.forEach((child) => { recursive_observe(child) })
    }
    recursive_observe(root)
}

export function get_resizable_heights( root ) {
    const heights = []
    function recursive_measure(element) {
        if (element.resizable) heights.push( {
            "height"    : element.resizable.element.style.height, 
            "node_id"   : element.resizable.node_id, 
            "name_list" : element.resizable.name_list
        } )
        element.childNodes?.forEach((child) => { recursive_measure(child) })
    }
    recursive_measure(root)   
    return heights 
}

export function restore_heights( node_map, heights ) {
    heights.forEach( (h) => {
        if (node_map[h.node_id]) {
            var target = node_map[h.node_id]
            h.name_list.forEach((childname) => { target = target?.[childname] })
            if (target) target.style.height = h.height
        }
    })
}