import { api } from "../../scripts/api.js";
import { Debug } from "./debug.js";

export function is_image_upload_node(node) {
    return ( node?.pasteFile != undefined )
}

export function isImageNode(node) {
    if (node.type=="SaveImage" || node.type=="PreviewImage") return true
    return false
}

export function image_is_blob(url) {
    return url.startsWith('blob')
}

export function clean_image_manager() {
    ImageManager.node_listener_map = {}
    //Object.keys(ImageManager.node_listener_map).forEach((k)=>{
    //    ImageManager.node_listener_map[k] = Set.from(ImageManager.node_listener_map[k].filter((v)=>v.parentElement))
    //})
}


export class ImageManager {
    /*
    node_listener_map is a map from node_id to a Set of listeners.
    Listeners must have the method manage_image(url) which returns
    false if the listener is no longer interested
    */

    static init() {
        ImageManager.node_listener_map = {}
        ImageManager.node_src_map = {}
        ImageManager.executing_node = null
    }

    static node_listener_map = {}  // map to Set
    static node_src_map      = {}  // map to url
    static executing_node    = null

    static add_listener(node_id, listener) {
        if (!ImageManager.node_listener_map[node_id]) ImageManager.node_listener_map[node_id] = new Set()
        ImageManager.node_listener_map[node_id].add(listener)
        const src = ImageManager.node_src_map[node_id]
        if (src) listener.manage_image(src)
    }

    static _send(node_id) {
        const src = ImageManager.node_src_map[node_id]
        if (src) {
            if (ImageManager.node_listener_map[node_id]) {
                Array.from(ImageManager.node_listener_map[node_id]).forEach((l)=>{
                    if (!l.manage_image(src, (ImageManager.executing_node!=null))) ImageManager.node_listener_map[node_id].delete(node_id)
                })
            }
        }
    }

    static send_progress_update(node_id, value, max) {
        if (ImageManager.node_listener_map[node_id]) {
            Array.from(ImageManager.node_listener_map[node_id]).forEach((l)=>{
                l.image_progress_update(value, max)
            })
        }
    }

    static _set_source(node_id, src) {
        ImageManager.node_src_map[node_id] = src
        ImageManager._send(node_id)
    }

    /* called by a nodeblock if it has an imgs value. If we're running, we ignore this */
    static node_img_change(node) {
        Debug.trivia(`node_img_change called for node ${node.id} which now has ${node.imgs.length} image(s)`)
        if (node.imgs.length == 0) return
        const v = node.imgs[0]
        if (ImageManager.executing_node==null || is_image_upload_node(node)) {
            var src = v.src ?? api.apiURL(
                `/view?filename=${encodeURIComponent(v.filename ?? v)}&type=${v.type ?? "input"}&subfolder=${v.subfolder ?? ""}`
            )
            ImageManager._set_source(node.id, src)
        }
    }

    static on_execution_start() {
        ImageManager.node_src_map = {}
    }

    static on_executing(e) {
        ImageManager.executing_node = e.detail
    }

    static on_b_preview(e) {
        Debug.trivia(`ImageManager on_b_preview ${ImageManager.executing_node}`)
        ImageManager._set_source( ImageManager.executing_node, window.URL.createObjectURL(e.detail) )
    }

    static on_executed(e) {
        Debug.trivia(`ImageManager on_executed ${e.detail.node}`)
        const v = e.detail?.output?.images?.[0]
        if (v) {
            ImageManager._set_source( e.detail.node, api.apiURL(
                `/view?filename=${encodeURIComponent(v.filename ?? v)}&type=${v.type ?? "input"}&subfolder=${v.subfolder ?? ""}`
            ) )
        }
    }


}