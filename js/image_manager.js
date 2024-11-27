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
}

export function get_image_url(v) {
    if (v.src) return v.src
    return api.apiURL( `/view?filename=${encodeURIComponent(v.filename ?? v)}&type=${v.type ?? "input"}&subfolder=${v.subfolder ?? ""}`)
}

export class ImageManager {
    /*
    node_listener_map is a map from node_id to a Set of listeners.
    Listeners must have the method manage_image(url) which returns
    false if the listener is no longer interested
    */

    static init() {
        ImageManager.node_listener_map = {}
        ImageManager.node_urls_map = {}
        ImageManager.executing_node = null
    }

    static node_listener_map = {}  // map to Set
    static node_urls_map      = {}  // map to url
    static executing_node    = null

    static add_listener(node_id, listener) {
        if (!ImageManager.node_listener_map[node_id]) ImageManager.node_listener_map[node_id] = new Set()
        ImageManager.node_listener_map[node_id].add(listener)
        const urls = ImageManager.node_urls_map[node_id]
        if (urls) listener.manage_image(urls)
    }

    static _send(node_id) {
        const urls = ImageManager.node_urls_map[node_id]
        if (urls) {
            if (ImageManager.node_listener_map[node_id]) {
                Array.from(ImageManager.node_listener_map[node_id]).forEach((l)=>{
                    if (!l.manage_image(urls, (ImageManager.executing_node!=null))) ImageManager.node_listener_map[node_id].delete(node_id)
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

    static _set_sources(node_id, srcs) {
        ImageManager.node_urls_map[node_id] = srcs
        ImageManager._send(node_id)
    }

    /* called by a nodeblock if it has an imgs value. If we're running, we ignore this */
    static node_img_change(node) {
        Debug.trivia(`node_img_change called for node ${node.id} which now has ${node.imgs.length} image(s)`)
        if (node.imgs.length == 0) return
        
        if (ImageManager.executing_node==null || is_image_upload_node(node)) {
            const srcs = []
            node.imgs.forEach((v)=>{ srcs.push(get_image_url(v)) })
            ImageManager._set_sources(node.id, srcs)
        }
    }

    static on_execution_start() {
        ImageManager.node_urls_map = {}
    }

    static on_executing(e) {
        ImageManager.executing_node = e.detail
    }

    static on_b_preview(e) {
        Debug.trivia(`ImageManager on_b_preview ${ImageManager.executing_node}`)
        ImageManager._set_sources( ImageManager.executing_node, [window.URL.createObjectURL(e.detail),] )
    }

    static on_executed(e) {
        Debug.trivia(`ImageManager on_executed ${e.detail.node}`)
        const srcs = []
        e.detail?.output?.images?.forEach((v)=>{ srcs.push(get_image_url(v)) })
        if (srcs.length>0) { ImageManager._set_sources( e.detail.node, srcs ) }
    }


}