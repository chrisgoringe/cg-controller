import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

import { create, darken, classSet } from "./utilities.js";
import { Entry } from "./panel_entry.js"
import { make_resizable } from "./resize_manager.js";
import { WidgetChangeManager, OnExecutedManager } from "./widget_change_manager.js";
import { UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";

function is_single_image(data) { return (data && data.items && data.items.length==1 && data.items[0].type.includes("image")) }

function isImageNode(node) {
    if (node.type=="SaveImage" || node.type=="PreviewImage") return true
    return false
}

export class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    constructor(parent_controller, node) { 
        super()
        this.parent_controller = parent_controller
        this.node = node
        if (!this.node.properties.controller_details) {
            this.node.properties.controller_details = {}
            this.node.properties.controller_widgets = {}
        }
        this.classList.add("nodeblock")
        this.bypassed = (this.node.mode!=0)
        if (this.bypassed) {
            create('span', 'bypass_overlay', this)
        }
        classSet(this, 'bypassed', this.bypassed)
        this.main = create("span",null,this)
        this.build_nodeblock()
        this.add_block_drag_handlers()
    }

    can_reuse() {
        if (this.bypassed != (this.node.mode!=0)) return false
        return true
    }

    add_block_drag_handlers() {
        this.addEventListener('dragover',  function (e) { NodeBlock.drag_over_me(e) } )
        this.addEventListener('drop',      function (e) { NodeBlock.drop_on_me(e)   } )
        this.addEventListener('dragend',   function (e) { NodeBlock.drag_end(e)     } )
        this.addEventListener('dragenter', function (e) { e.preventDefault()        } )
    }

    add_handle_drag_handlers(draghandle) {
        draghandle.draggable = "true"
        draghandle.addEventListener('dragstart', (e) =>  { this.drag_me(e) } )
    }

    static dragged = null

    drag_me(e) {
        NodeBlock.dragged = this
        NodeBlock.dragged.classList.add("being_dragged")
        e.dataTransfer.setDragImage(this, e.layerX, e.layerY);
    }

    static drag_over_me(e, nodeblock_over, force_before) {
        nodeblock_over = nodeblock_over ?? e.currentTarget
        if (NodeBlock.dragged) {
        //    e.dataTransfer.effectAllowed = "all";
            e.dataTransfer.dropEffect = "move"
            e.preventDefault(); 
        }
        if (NodeBlock.dragged && nodeblock_over!=NodeBlock.dragged && nodeblock_over.parent_controller==NodeBlock.dragged.parent_controller) { 
            if (nodeblock_over != NodeBlock.last_swap) {
                if (nodeblock_over.drag_id=='header') {
                    NodeBlock.dragged.parentElement.insertBefore(NodeBlock.dragged, NodeBlock.dragged.parentElement.firstChild)
                } else if (nodeblock_over.drag_id=='footer') {
                    NodeBlock.dragged.parentElement.appendChild(NodeBlock.dragged)
                } else {
                    if (nodeblock_over.previousSibling == NodeBlock.dragged && !force_before) {
                        nodeblock_over.parentElement.insertBefore(nodeblock_over, NodeBlock.dragged)
                    } else {
                        nodeblock_over.parentElement.insertBefore(NodeBlock.dragged, nodeblock_over)
                    }
                }
                NodeBlock.last_swap = nodeblock_over
            }
        }

        if (e.dataTransfer.types.includes('Files')) {
            if (nodeblock_over?.is_image_upload_node?.() && is_single_image(e.dataTransfer)) {
                e.dataTransfer.dropEffect = "move"    
                e.stopPropagation()        
            } else {
                e.dataTransfer.dropEffect = "none"                            
            }
            e.preventDefault();
        }
    }

    static async drop_on_me(e) {
        if (NodeBlock.dragged) {
            e.preventDefault(); 
        } else if (e.dataTransfer.types.includes('Files')) {
            if (e.currentTarget.is_image_upload_node?.() && is_single_image(e.dataTransfer)) {
                const node = e.currentTarget.node
                e.preventDefault(); 
                e.stopImmediatePropagation()

                /*
                When an IMAGEUPLOAD gets created, it adds an input node to the body. 
                That'll be the last element added, so give it the files, 
                tell it that it has changed and wait for it to do the upload,
                then remove it from the node and the document.
                */
                ComfyWidgets.IMAGEUPLOAD(node, "image", node, app)
                document.body.lastChild.files = e.dataTransfer.files
                await document.body.lastChild.onchange()
                node.widgets.pop()
                document.body.lastChild.remove()

                node.setSizeForImage()
                UpdateController.make_request('image_upload', 100)
            }
        }
    }

    static drag_end(e) {
        if (NodeBlock.dragged) NodeBlock.dragged.classList.remove("being_dragged")
        NodeBlock.dragged = null
        NodeBlock.last_swap = null
    }

    build_nodeblock() {
        const new_main = create("span")

        this.title_bar = create("span", 'nodeblock_titlebar', new_main)
        this.draghandle = create("span", 'nodeblock_draghandle', this.title_bar, { })
        this.add_handle_drag_handlers(this.draghandle)

        this.minimised = this.node.properties.controller_details.minimised

        this.minimisedot = create("span", 'minimisedot', this.title_bar, { "innerHTML":"&#x25FC;"})
        this.minimisedot.addEventListener("click", (e)=>{ 
            e.preventDefault(); 
            e.stopPropagation(); 
            this.node.properties.controller_details.minimised = (!!!this.node.properties.controller_details.minimised)
            this.minimised = this.node.properties.controller_details.minimised
            classSet(this, 'minimised', this.minimised)
            if (this.minimised && this.contains(document.activeElement)) {
                document.activeElement.blur()
            }
        })
        this.minimisedot.addEventListener("mousedown", (e)=>{ 
            e.preventDefault(); 
            e.stopPropagation(); 
        })

        this.title_text = create("span", 'nodeblock_title', this.title_bar, {"innerText":this.node.title, 'draggable':false})

        this.style.backgroundColor = this.node.bgcolor ?? LiteGraph.NODE_DEFAULT_BGCOLOR
        if (this.node.bgcolor) {
            this.style.backgroundColor = this.node.bgcolor
            this.title_bar.style.backgroundColor = darken(this.node.bgcolor)
        } else {
            this.style.backgroundColor = LiteGraph.NODE_DEFAULT_BGCOLOR
            this.title_bar.classList.add("titlebar_nocolor")
        }

        classSet(this, 'minimised', this.minimised)

        this.valid_nodeblock = false
        this.node.widgets?.forEach(w => {
            if (!this.node.properties.controller_widgets[w.name]) this.node.properties.controller_widgets[w.name] = {}
            const properties = this.node.properties.controller_widgets[w.name]
            const e = new Entry(this.parent_controller, this, this.node, w, properties)
            if (e.valid()) {
                new_main.appendChild(e)
                this[w.name] = e
                this.valid_nodeblock = true                    
            }
        })

        if (this.image_panel) this.image_panel.remove()

        if (!this.node.properties.controller_widgets['__image_panel']) this.node.properties.controller_widgets['__image_panel'] = {}
        this.image_panel = create("div", "nodeblock_image_panel nodeblock_image_empty", new_main)
        this.image_image = create('img', 'nodeblock_image', this.image_panel)
        this.image_image.addEventListener('load', this.rescale_image.bind(this))
        
        make_resizable( this.image_panel, this.node.id, "__image_panel", this.node.properties.controller_widgets['__image_panel'] )
        new ResizeObserver(this.rescale_image.bind(this)).observe(this.image_panel)

        OnExecutedManager.add_listener(this.node.id, this)

        if (isImageNode(this.node)) {
            const add_upstream = (nd) => {
                if (nd==this.node || !isImageNode(nd)) {
                    OnExecutedManager.add_listener(nd.id, this)
                    //Debug.trivia(`${this.node.id} listening to ${nd.id}`)
                    nd.inputs.forEach((i)=>{
                        if (i.type=="IMAGE" || i.type=="LATENT") {
                            const lk = i.link
                            const upstream_id = lk ? app.graph.links[lk]?.origin_id : null
                            if (upstream_id) add_upstream(app.graph._nodes_by_id[upstream_id])
                        }
                    })
                }
            }
            add_upstream(this.node)
        }

        this.replaceChild(new_main, this.main)
        this.main = new_main

        if (this.node.imgs) this.show_image(this.node.imgs)
        else OnExecutedManager.resend(this.node.id)
    
        this.valid_nodeblock = true
    }

    oem_manager_callback(o) {
        if (!this.parentElement) return false
        if (o && o.images && !this.hidden) {
            this.show_image(o.images)
        }
        return true
    }

    rescale_image() {
        if (this.rescaling) return
        if (this.parent_controller.settings.collapsed) return
        this.rescaling = true
        if (this.image_image) {
            const box = this.image_panel.getBoundingClientRect()
            if (box.width) {
                this.node.properties.controller_widgets['__image_panel'].height = box.height
                const w = box.width - 8
                const im_h = this.image_image?.naturalHeight
                const im_w = this.image_image?.naturalWidth
                if (im_h && im_w) {
                    const scaled_height_fraction = (im_h * w) / (im_w * box.height)
                    if (scaled_height_fraction<=1) {
                        this.image_panel.style.height = `${(im_h * w) / (im_w)}px`
                        this.image_panel.style.maxHeight = `${(im_h * w) / (im_w)}px`
                        this.image_image.style.height = `100%`
                        this.image_image.style.width = `${w}px`
                    } else {
                        this.image_panel.style.maxHeight = `${(im_h * w) / (im_w)}px`
                        this.image_image.style.height = `100%`
                        this.image_image.style.width = `${w/scaled_height_fraction}px`
                    }
                }
            } 
        }
        this.rescaling = false
    }

    is_image_upload_node() {
        return ( this.node.pasteFile != undefined )
    }

    show_image(v) {
        classSet(this.image_panel, 'nodeblock_image_empty', !(v?.length>0))
        if (v.length==0) return
        var src = v[0].src ?? api.apiURL(
            `/view?filename=${encodeURIComponent(v[0].filename ?? v)}&type=${v[0].type ?? "input"}&subfolder=${v[0].subfolder ?? ""}`
          )
        if (this.image_image.src != src) {
            this.image_image.src = src
            this.image_panel.style.maxHeight = ''
        }
    }
}



customElements.define('cp-span', NodeBlock, {extends: 'span'})