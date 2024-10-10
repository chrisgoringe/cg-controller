import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

import { darken } from "./utilities.js";
import { Entry } from "./panel_entry.js"
import { create } from "./elements.js";
import { make_resizable } from "./resize_manager.js";

function is_single_image(data) { return (data && data.items && data.items.length==1 && data.items[0].type.includes("image")) }

export class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    constructor(node, redraw_force_callback) { 
        super()
        this.node = node
        this.classList.add("nodeblock")
        this.build_nodeblock()
        this.add_block_drag_handlers()
        this.redraw_force_callback = redraw_force_callback
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
        e.dataTransfer.setDragImage(this, 10, 10);
    }

    static drag_over_me(e) {
        if (NodeBlock.dragged) {
        //    e.dataTransfer.effectAllowed = "all";
            e.dataTransfer.dropEffect = "move"
            e.preventDefault(); 
        }
        if (NodeBlock.dragged && e.currentTarget!=NodeBlock.dragged) { 
            if (e.currentTarget != NodeBlock.last_swap) {
                if (e.currentTarget.drag_id=='header') {
                    NodeBlock.dragged.parentElement.insertBefore(NodeBlock.dragged, NodeBlock.dragged.parentElement.firstChild)
                } else if (e.currentTarget.drag_id=='footer') {
                    NodeBlock.dragged.parentElement.appendChild(NodeBlock.dragged)
                } else {
                    if (e.currentTarget.previousSibling == NodeBlock.dragged) {
                        e.currentTarget.parentElement.insertBefore(e.currentTarget, NodeBlock.dragged)
                    } else {
                        e.currentTarget.parentElement.insertBefore(NodeBlock.dragged, e.currentTarget)
                    }
                }
                NodeBlock.last_swap = e.currentTarget
            }
        }
        if (!NodeBlock.dragged && e.currentTarget?.is_image_node && e.currentTarget.is_image_node() && is_single_image(e.dataTransfer)) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.dropEffect = "move"
            e.preventDefault(); 
        }
    }

    static async drop_on_me(e) {
        if (NodeBlock.dragged) {
            e.preventDefault(); 
        } else {
            if (e.currentTarget.is_image_node() && is_single_image(e.dataTransfer)) {
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
            }
        }
    }

    static drag_end(e) {
        if (NodeBlock.dragged) NodeBlock.dragged.classList.remove("being_dragged")
        NodeBlock.dragged = null
        NodeBlock.last_swap = null
    }

    build_nodeblock() {
        this.innerHTML = ""
        this.title_bar = create("span", 'nodeblock_titlebar', this)
        this.draghandle = create("span", 'nodeblock_draghandle', this.title_bar, { "innerHTML":"&equiv;"})
        this.add_handle_drag_handlers(this.draghandle)
        this.title_text = create("span", 'nodeblock_title', this.title_bar, {"innerText":this.node.title, 'draggable':false})

        this.valid_nodeblock = false
        this.node.widgets?.forEach(w => {
            const e = new Entry(this.node, w)
            if (e.valid_entry) {
                this.appendChild(e)
                this[w.name] = e
                this.valid_nodeblock = true
            } 
        })

        if (this.is_image_node()) {
            if (this.image_panel) {
                this.appendChild(this.image_panel)
            } else {
                this.image_panel = create("div", "nodeblock_image_panel nodeblock_image_empty", this)
                this.node._imgs = this.node.imgs
                try {
                    delete this.node.imgs
                    Object.defineProperty(this.node, "imgs", {
                        get : () => { return this.node._imgs },
                        set : (v) => { this.node._imgs = v; this.show_image(v) }
                    })               
                } catch { }
                this.image_image = create('img', 'nodeblock_image', this.image_panel)
                this.image_image.addEventListener('load', this.rescale_image.bind(this))
                
                make_resizable( this.image_panel, this.node.id, ["image_panel"] )
                new ResizeObserver(this.rescale_image.bind(this)).observe(this.image_panel)
            }
            if (this.node._imgs) this.show_image(this.node._imgs)
            this.valid_nodeblock = true
        }

        this.style.backgroundColor = this.node.bgcolor
        this.title_bar.style.backgroundColor = darken(this.node.bgcolor)
    }

    rescale_image() {
        if (this.rescaling) return
        this.rescaling = true
        if (this.image_image) {
            const box = this.image_panel.getBoundingClientRect()
            if (box.width) {
                const im_h = this.image_image?.naturalHeight
                const im_w = this.image_image?.naturalWidth
                if (im_h && im_w) {
                    const scaled_height_fraction = (im_h * box.width) / (im_w * box.height)
                    if (scaled_height_fraction<=1) {
                        this.image_image.style.height = `${100*scaled_height_fraction}%`
                        this.image_image.style.width = `100%`
                    } else {
                        this.image_image.style.height = `100%`
                        this.image_image.style.width = `${100/scaled_height_fraction}%`
                    }
                }
            } 
        }
        this.rescaling = false
    }

    is_image_node() {
        return (
            this.node.imgs ||
            ( this.node.widgets &&
              this.node.widgets.findIndex((obj) => obj.name === 'image') >= 0) ||
            this.node.title.indexOf('Image')>=0
          )
    }

    show_image(v) {
        if (v.length>0) {
            this.image_panel.classList.remove('nodeblock_image_empty')
            if (this.image_image.src != v[0].src) this.image_image.src = v[0].src
        } else {
            this.image_panel.classList.add('nodeblock_image_empty')
        }    
    }

}

customElements.define('cp-span', NodeBlock, {extends: 'span'})