import { app } from "../../scripts/app.js";

import { ComfyWidgets } from "../../scripts/widgets.js";

import { create, darken, classSet, mode_change } from "./utilities.js";
import { Entry } from "./panel_entry.js"
import { make_resizable } from "./resize_manager.js";
import { image_is_blob, ImageManager, is_image_upload_node, isImageNode } from "./image_manager.js";
import { UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";

function is_single_image(data) { return (data && data.items && data.items.length==1 && data.items[0].type.includes("image")) }

export class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    constructor(parent_controller, node) { 
        super()
        this.parent_controller = parent_controller
        this.node = node
        this.mode = this.node.mode

        if (!this.node.properties.controller_details) {
            this.node.properties.controller_details = {}
            this.node.properties.controller_widgets = {}
        }
        this.classList.add("nodeblock")

        this.mode_overlay = create('span', `mode_overlay mode_overlay_${this.mode}`, this)
        classSet(this, 'bypassed', this.mode!=0)

        this.main = create("span","nb_main",this)
        this.build_nodeblock()
        this.add_block_handlers()
    }

    can_reuse() {
        if (this.bypassed != (this.node.mode!=0)) return false
        return true
    }

    add_block_handlers() {
        this.addEventListener('dragover',  function (e) { NodeBlock.drag_over_me(e) } )
        this.addEventListener('drop',      function (e) { NodeBlock.drop_on_me(e)   } )
        this.addEventListener('dragend',   function (e) { NodeBlock.drag_end(e)     } )
        this.addEventListener('dragenter', function (e) { e.preventDefault()        } )

        this.addEventListener('mouseenter', (e) => {this.mouseover(true)})
        this.addEventListener('mouseleave', (e) => {this.mouseover(false)})
    }

    static area = [0,0,0,0]
    static on_draw(ctx) {
        if (NodeBlock.mouse_in) {
            const ctx = app.canvas.ctx

            ctx.save();
            try {
                ctx.translate(NodeBlock.mouse_in.node.pos[0], NodeBlock.mouse_in.node.pos[1]);

                NodeBlock.mouse_in.node.measure(NodeBlock.area);
                NodeBlock.area[0] -= NodeBlock.mouse_in.node.pos[0];
                NodeBlock.area[1] -= NodeBlock.mouse_in.node.pos[1];

                ctx.strokeStyle = "white"
                ctx.lineWidth   = 1
                ctx.shadowColor = "white"
                ctx.shadowBlur  = 4
                ctx.fillStyle   = "#ffd70040"

                ctx.beginPath()
                ctx.roundRect(NodeBlock.area[0], NodeBlock.area[1], NodeBlock.area[2], NodeBlock.area[3], 6)
                ctx.stroke()
                ctx.fill()
            } finally {
                ctx.restore()
            }
        }
    }

    mouseover(isin) {
        if (isin) {
            NodeBlock.mouse_in = this
        } else {
            NodeBlock.mouse_in = null
        }
        app.canvas.setDirty(true, true)
    }

    add_handle_drag_handlers(draghandle) {
        draghandle.draggable = "true"
        draghandle.addEventListener('dragstart', (e) =>  { this.drag_me(e) } )
        //draghandle.addEventListener('mousedown', (e)=>{ })
        draghandle.addEventListener('mouseup', (e)=>{
            if (!NodeBlock.dragged) this.toggle_minimise()
        })
    }

    static dragged = null
    static last_dragged = null

    drag_me(e) {
        NodeBlock.dragged = this
        NodeBlock.last_dragged = this
        NodeBlock.dragged.classList.add("being_dragged")
        e.dataTransfer.setDragImage(this, e.layerX, e.layerY);
    }

    toggle_minimise() {
        this.node.properties.controller_details.minimised = (!!!this.node.properties.controller_details.minimised)
        this.minimised = this.node.properties.controller_details.minimised
        classSet(this, 'minimised', this.minimised)
        if (this.minimised && this.contains(document.activeElement)) {
            document.activeElement.blur()
        }
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
            if (is_image_upload_node(nodeblock_over?.node) && is_single_image(e.dataTransfer)) {
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
            if (is_image_upload_node(e.currentTarget?.node) && is_single_image(e.dataTransfer)) {
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
        const new_main = create("span", 'nb_main')

        this.title_bar = create("span", 'nodeblock_titlebar', new_main)
        
        this.title_bar_left = create("span", 'nodeblock_titlebar_left', this.title_bar)
        this.draghandle = create("span", 'nodeblock_draghandle', this.title_bar, { })
        this.title_bar_right = create("span", 'nodeblock_titlebar_right', this.title_bar)

        this.add_handle_drag_handlers(this.draghandle)

        this.minimised = this.node.properties.controller_details.minimised

        this.mode_button  = create('i', `pi mode_button mode_button_${this.mode}`, this.title_bar_left)
        this.mode_button.addEventListener('click', (e)=>{
            e.preventDefault(); 
            e.stopPropagation(); 
            this.node.mode = mode_change(this.node.mode,e)
            app.canvas.setDirty(true,true)
            UpdateController.make_request('node mode button')        
        })

        this.title_text = create("span", 'nodeblock_title', this.draghandle, {"innerText":this.node.title, 'draggable':false})

        this.image_pin = create('i', 'pi pi-thumbtack hidden', this.title_bar_right)
        this.image_pin.addEventListener('click', (e) => {
            this.node.properties.controller_widgets[this.image_panel_id].pinned = !this.node.properties.controller_widgets[this.image_panel_id].pinned
            this.update_pin()
        })

        this.style.backgroundColor = this.node.bgcolor ?? LiteGraph.NODE_DEFAULT_BGCOLOR
        if (this.node.bgcolor) {
            this.style.backgroundColor = this.node.bgcolor
            this.title_bar.style.backgroundColor = darken(this.node.bgcolor)
        } else {
            this.style.backgroundColor = LiteGraph.NODE_DEFAULT_BGCOLOR
            this.title_bar.classList.add("titlebar_nocolor")
        }

        classSet(this, 'minimised', this.minimised)

        if (this.image_panel) this.image_panel.remove()
        this.image_panel = create("div", "nodeblock_image_panel nodeblock_image_empty", new_main)

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

        this.image_panel_id = `__image_panel.${this.parent_controller.settings.index}`

        if (!this.node.properties.controller_widgets[this.image_panel_id]) {
            this.node.properties.controller_widgets[this.image_panel_id] = {}
            if (this.node.properties.controller_widgets['__image_panel']) { // backward compatibility - get the size from the per-node version 
                Object.assign(this.node.properties.controller_widgets[this.image_panel_id], this.node.properties.controller_widgets['__image_panel'])
                delete this.node.properties.controller_widgets['__image_panel']
            }
        }
        if (this.node.properties.controller_widgets[this.image_panel_id].pinned == undefined) this.node.properties.controller_widgets[this.image_panel_id].pinned = true
        this.update_pin()

        this.image_image = create('img', 'nodeblock_image', this.image_panel)
        this.image_image.addEventListener('load', this.rescale_image.bind(this))
        
        make_resizable( this.image_panel, this.node.id, this.image_panel_id, this.node.properties.controller_widgets[this.image_panel_id] )
        new ResizeObserver(this.rescale_image.bind(this)).observe(this.image_panel)

        if (isImageNode(this.node)) {
            const add_upstream = (nd) => {
                if (nd==this.node || (!isImageNode(nd) && !is_image_upload_node(nd))) {
                    ImageManager.add_listener(nd.id, this)
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
        ImageManager.add_listener(this.node.id, this) // add ourself last to take priority

        this.replaceChild(new_main, this.main)
        this.main = new_main

        if (this.node.imgs && this.node.imgs.length>0) {
            ImageManager.node_has_img(this.node, this.node.imgs[0])
        } 

        this.valid_nodeblock = true
    }

    manage_image(url, running) {
        if (!this.parentElement) return false
        if (!(this.bypassed || this.hidden)) {
            /* take anything when running, or if we have nothing, or if we have a blob; otherwise reject blobs */
            if (running || !this.image_image.src || image_is_blob(this.image_image.src) || !image_is_blob(url)) this.show_image(url)
        }
        return true
    }

    update_pin() {
        classSet(this.image_pin, 'clicked', this.node.properties.controller_widgets[this.image_panel_id].pinned)
        this.image_panel.style.resize = this.node.properties.controller_widgets[this.image_panel_id].pinned ? "none" : "vertical"
        this.rescale_image()
    }

    rescale_image() {
        if (this.rescaling) return
        if (this.parent_controller.settings.collapsed) return
        this.rescaling = true
        if (this.image_image) {
            const box = this.image_panel.getBoundingClientRect()
            const pinned = this.node.properties.controller_widgets[this.image_panel_id].pinned
            if (box.width) {
                this.node.properties.controller_widgets[this.image_panel_id].height = box.height
                const w = box.width - 8
                const im_h = this.image_image?.naturalHeight
                const im_w = this.image_image?.naturalWidth
                if (im_h && im_w) {
                    if (pinned) {
                        const full_h = (im_h/im_w)*w
                        this.image_panel.style.height = `${full_h}px`
                        this.image_panel.style.maxHeight = `${full_h}px`
                        this.image_image.style.height = `${full_h}px`
                        this.image_image.style.width = `${w}px`
                    } else {
                        const scaled_height_fraction = (im_h * w) / (im_w * box.height)
                        //if (scaled_height_fraction<=1) {
                        //    this.image_panel.style.height = `${(im_h * w) / (im_w)}px`
                        //    this.image_panel.style.maxHeight = `${(im_h * w) / (im_w)}px`
                        //    this.image_image.style.height = `100%`
                        //    this.image_image.style.width = `${w}px`
                        //} else {
                            this.image_panel.style.maxHeight = `unset`
                            this.image_image.style.height = `100%`
                            this.image_image.style.width = `${w/scaled_height_fraction}px`
                        //}
                    }
                }
            } 
        }
        this.rescaling = false
    }

    show_image(url) {
        classSet(this.image_panel, 'nodeblock_image_empty', !url)
        classSet(this.image_pin, 'hidden', !url)

        if (this.image_image.src != url) {
            this.image_image.src = url
            this.image_panel.style.maxHeight = ''
        }
    }
}



customElements.define('cp-span', NodeBlock, {extends: 'span'})