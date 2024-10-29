import { Debug } from "./debug.js"
export function make_resizable( element, node_id, widget_name, properties ) {
    element.resizable = {
        "node_id"     : node_id,
        "widget_name" : widget_name,
        "properties"  : properties
    }
    element.resize_id = `${node_id}.${widget_name}`
    if (properties.height) element.style.height = `${properties.height}px`
}

class PersistSize {
    static sizes = {}
}

export function observe_resizables( root, change_callback ) {
    const resize_observer = new ResizeObserver( (x) => {
        x.forEach((resize) => {
            if (resize.borderBoxSize[0].blockSize==0 ) return
            const sz = resize.borderBoxSize[0].blockSize
            var delta = sz - PersistSize.sizes[resize.target.resize_id]
            PersistSize.sizes[resize.target.resize_id] = sz
            if (isNaN(delta)) delta = 0
            change_callback(resize.target, delta) 
            resize.target.resizable.properties.height = resize.target.getBoundingClientRect().height
        })
    } )
    function recursive_observe(element) {
        if (element.resizable) resize_observer.observe(element)
        element.childNodes?.forEach((child) => { recursive_observe(child) })
    }
    setTimeout( recursive_observe, 1000, [root] )
    recursive_observe(root)
}