import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { Debug } from "./debug.js";
import { Timings } from "./constants.js";
import { pim } from "./prompt_id_manager.js";

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

export function get_image_url(v) {
    if (v.src) return v.src
    return api.apiURL( `/view?filename=${encodeURIComponent(v.filename ?? v)}&type=${v.type ?? "input"}&subfolder=${v.subfolder ?? ""}`)
}

function differs(one, from) {
    if (one.length!=from.length) return true
    for (var i=0; i<one.length; i++) { if (from[i]!=one[i]) return true }
    return false
}

export class ImageManager {
    static node_listener_map  = {}  // map to Set: node_id (listened to) to node_id's (listeners)
    static node_urls_map      = {}  // map to urls: node_id to list[str]
    static executing_node     = null
    static just_finished      = false
    static last_preview_node  = null
    static last_preview_image = null
    static node_image_change = (node_id)=>{}

    static reset() {
        this.node_listener_map = {}
        this.executing_node    = null
        this.last_preview_node = null
    } 

    static clear_listeners(node_id) {
        Object.values(this.node_listener_map).forEach((s)=>{s.delete(node_id)})
    }

    static add_listener(node_id, listens_to_node_id) {
        if (!this.node_listener_map[listens_to_node_id]) this.node_listener_map[listens_to_node_id] = new Set()
            this.node_listener_map[listens_to_node_id].add(node_id)
    }

    static get_urls(node_id) {
        if (this.node_urls_map[node_id] && this.node_urls_map[node_id].length>0) return this.node_urls_map[node_id] 
        return null
    }

    static get_listeners(node_id) {
        return Array.from(this.node_listener_map[node_id] ?? [])
    }

    static _set_urls(node_id, urls, caused_by_node_id) {
        if (!this.node_urls_map[node_id]) this.node_urls_map[node_id] = []
        const is_change = differs(this.node_urls_map[node_id], urls)
        if (is_change) {
            this.node_urls_map[node_id] = Array.from(urls)
            Debug.trivia(`Sending image update to node ${node_id} caused by ${caused_by_node_id}`)
            this.node_image_change(node_id, caused_by_node_id)
        } 
        return is_change
    }

    static _consider_urls(node_id, urls, caused_by_node_id) {
        if (    ImageManager.executing_node              || // when running, we take any image 
                !this.get_urls(node_id)                  || // if we don't have an image, we take any image
                image_is_blob(this.get_urls(node_id)[0]) || // if we have a blob, we take any image
                !image_is_blob(urls[0])                     // if this isn't a blob, take it
            ) {
                this._set_urls(node_id, urls, caused_by_node_id)
            } else { return false }
    }

    static _images_received(node_id, urls, detail) {
        if (this._set_urls(node_id, urls, node_id)) { 
            if (detail) Debug.trivia(`${detail}: Image urls received for ${node_id} with length ${urls.length}`)
            if (urls.length && this.node_listener_map[node_id]) {
                Array.from(this.node_listener_map[node_id]).forEach((listener)=>{this._consider_urls(listener, urls, node_id)})
            }
        }
    }

    static node_reported_images(node_id, imgs) {
        if (ImageManager.executing_node || ImageManager.just_finished) return
        const urls = []
        imgs.filter((i)=>(i.src && ! i.src.endsWith('undefined'))).forEach((i)=>{urls.push(i.src)})
        this._set_urls(node_id, urls, node_id)
    }

    static on_executing(e) {
        // TODO if (!pim.ours(e)) return
        ImageManager.executing_node = e.detail
        if (!ImageManager.executing_node) {
            ImageManager.just_finished = true
            Array.from(app.graph._nodes).filter((node)=>(node.imgs && node.imgs.length>0)).forEach((node)=>{
                ImageManager.node_reported_images(node.id, node.imgs)
            })
            setTimeout(()=>{ImageManager.just_finished = false}, Timings.GENERIC_LONGER_DELAY)
        }

    }

    static on_b_preview(e) {
        // TODO if (!pim.ours(e)) return
        const blob_url = window.URL.createObjectURL(e.detail)
        ImageManager.last_preview_node = ImageManager.executing_node
        const i = new Image()
        i.onload = ()=>{
            ImageManager.last_preview_image = {width: i.width, height: i.height}
        }
        i.src = blob_url
        ImageManager._images_received( ImageManager.executing_node, [blob_url,], "b_preview" )
    }

    static on_executed(e) {
        // TODO if (!pim.ours(e)) return
        const srcs = []
        e.detail?.output?.images?.forEach((v)=>{ srcs.push(get_image_url(v)) })
        if (srcs.length) {
            ImageManager._images_received( e.detail.node, srcs, 'on_executed' ) 
            ImageManager._images_received( ImageManager.last_preview_node, srcs, 'on_executed' ) 
            ImageManager.last_preview_node = null
        }
        
    }

    static on_execution_start(e) {
        ImageManager.analyse_graph()
        this.node_urls_map = {}
    }

    static analyse_graph() {
        this.reset()
        Array.from(app.graph._nodes).filter((node)=>(isImageNode(node))).forEach((node)=>{
            add_upstream(node, node, new Set())
        })
    }

    static send_all() {
        Object.keys(this.node_listener_map).forEach((origin)=>{
            Array.from(this.node_listener_map[origin]).forEach((destination)=>{
                this.node_image_change(destination, origin)
            })
            this.node_image_change(origin, origin)
        })
    }

}

function get_upstream_ids(node) {
    const upstream_ids = new Set()
    node.inputs?.filter((i)=>(i.type=="IMAGE" || i.type=="LATENT")).forEach((i)=>{
        const lk = i.link
        if (lk && app.graph.links[lk]?.origin_id) upstream_ids.add(app.graph.links[lk]?.origin_id)
    })
    if (app.graph.extra?.ue_links) {
        app.graph.extra?.ue_links?.forEach((ue_link)=>{
            if (ue_link.downstream==node.id && (ue_link.type=="IMAGE" || ue_link.type=="LATENT")) upstream_ids.add(ue_link.upstream)
        })
    }
    return Array.from(upstream_ids)
}

function add_upstream(root_node, nd, seen) {
    if (seen.has(nd.id)) return
    seen.add(nd.id)
    if (root_node!=nd) ImageManager.add_listener(root_node.id, nd.id)
    get_upstream_ids(nd).forEach((nd2_id)=>{add_upstream(root_node, app.graph._nodes_by_id[nd2_id], seen)})
}


