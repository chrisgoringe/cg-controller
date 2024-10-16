import { Debug } from "./debug.js"
export function make_resizable( element, node_id, name_list ) {
    element.parentNode.resizable = {
        "element"   : element,
        "node_id"   : node_id,
        "name_list" : name_list
    }
    element.resize_id = `${node_id} ${name_list.join(' ')}`
}

class PersistSize {
    static sizes = {}
}

export function observe_resizables( root, change_callback ) {
    const resize_observer = new ResizeObserver( (x) => {
        x.forEach((resize) => {
            if (resize.borderBoxSize[0].inlineSize==0 && resize.borderBoxSize[0].blockSize==0 ) return
            const sz = `${resize.borderBoxSize[0].inlineSize} ${resize.borderBoxSize[0].blockSize}`
            if (PersistSize.sizes[resize.target.resize_id] == sz) return
            PersistSize.sizes[resize.target.resize_id] = sz
            Debug.trivia(`${resize.target.resize_id}  ${sz}`)
            change_callback() 
        })
    } )
    function recursive_observe(element) {
        if (element.resizable) resize_observer.observe(element.resizable.element)
        element.childNodes?.forEach((child) => { recursive_observe(child) })
    }
    setTimeout( recursive_observe, 1000, [root] )
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