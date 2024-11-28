import { app, ComfyApp } from "../../scripts/app.js";

import { ComfyWidgets } from "../../scripts/widgets.js";

import { create, darken, classSet, mode_change, focus_mode } from "./utilities.js";
import { Entry } from "./panel_entry.js"
import { make_resizable } from "./resize_manager.js";
import { get_image_url, image_is_blob, ImageManager, is_image_upload_node, isImageNode } from "./image_manager.js";
import { OnChangeController, UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";
import { Highlighter } from "./highlighter.js";
import { close_context_menu, open_context_menu } from "./context_menu.js";
import { Generic, Texts, Timings } from "./constants.js";
import { InclusionOptions } from "./constants.js";
import { NodeInclusionManager } from "./node_inclusion.js";

function is_single_image(data) { return (data && data.items && data.items.length==1 && data.items[0].type.includes("image")) }

export class NodeBlock extends HTMLSpanElement {
    /*
    NodeBlock represents a single node - zero or more Entry children, and zero or one images.
    If neither Entry nor images, it is not 'valid' (ie should not be included)
    */
    static count = 0

    _remove() {
        Debug.trivia(`removing nodeblock for ${this.node?.id} from controller ${this.parent_controller?.index}`)
        if (!this.has_been_removed) {
            NodeBlock.count -= 1
            this.has_been_removed = true
        } else {
            Debug.trivia('alreadyremoved nodeblock?')
        }
        this.remove()
        this.parent_controller = null
        this._remove_entries()

        if (this.resize_observer) {
            this.resize_observer.disconnect()
            delete this.resize_observer
        }

        if (this.node==Highlighter.highlight_node) Highlighter.highlight_node = null
        //Debug.trivia(`NodeBlock._remove count = ${NodeBlock.count}`)
    }

    _remove_entries() {
        Array.from(this.main.children).forEach((c)=>{c._remove?.()})
    }

    constructor(parent_controller, node) { 
        super()
        NodeBlock.count += 1
        this.parent_controller = parent_controller
        this.node = node
        this.mode = this.node.mode
        this.image_index = null
        Debug.trivia(`creating nodeblock for ${this.node?.id} on controller ${this.parent_controller?.index}`)

        if (!this.node.properties.controller_details) {
            this.node.properties.controller_details = {}
            this.node.properties.controller_widgets = {}
        }
        this.classList.add("nodeblock")
        this.classList.add(`mode_${this.mode}`)

        this.main = create("span","nb_main",this)
        this.build_nodeblock()
        this.add_block_handlers()

        this.progress = create('span','progress_bar')
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

        this.addEventListener('mouseenter', (e) => {Highlighter.node(this.node)})
        this.addEventListener('mouseleave', (e) => {Highlighter.node(null)})
    }

    add_handle_drag_handlers(draghandle) {
        draghandle.draggable = "true"
        draghandle.addEventListener('dragstart', (e) =>  { this.drag_me(e) } )
        //draghandle.addEventListener('mousedown', (e)=>{ })
        draghandle.addEventListener('mouseup', (e)=>{
            if (!NodeBlock.dragged && e.button == 0 && !e.ctrlKey) this.toggle_minimise()
        })
    }

    static dragged = null
    static last_dragged = null

    drag_me(e) {
        if (app.canvas.read_only) return
        NodeBlock.dragged = this
        NodeBlock.last_dragged = this
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

    image_progress_update(value, max) { this.on_progress(value, max) }

    on_progress(value, max) {
        if (value) {
            this.title_bar.appendChild(this.progress)
            const w = this.getBoundingClientRect().width * value / max
            const h = this.minimised ? 2 : 3
            const top = this.title_bar.getBoundingClientRect().height - h
            this.progress.style.width = `${w}px`
            this.progress.style.top = `${top}px`
            this.progress.style.height = `${h}px`
        } else { this.progress.remove() }
    }

    get_minimised() {
        return this.parent_controller.settings.minimised_blocks.includes(this.node.id)
    }

    toggle_minimise() {
        this.set_minimised(!this.get_minimised())
    }

    set_minimised(v) {
        if (v == this.get_minimised()) return
        if (v) {
            this.parent_controller.settings.minimised_blocks.push(this.node.id)
        } else {
            const index = this.parent_controller.settings.minimised_blocks.findIndex((e)=>(e==this.node.id))
            this.parent_controller.settings.minimised_blocks.splice(index, 1)
        }
        this.minimised = v
        classSet(this, 'minimised', this.minimised)
        if (this.minimised && this.contains(document.activeElement)) {
            document.activeElement.blur()
        }
    }

    set_widget_visibility(display_name, v) {
        const wid = `${this.node.id}:${display_name}`
        if (v) {
            const index = this.parent_controller.settings.hidden_widgets.findIndex((e)=>(e==wid))
            if (index>=0) this.parent_controller.settings.hidden_widgets.splice(index, 1)
        } else {
            this.parent_controller.settings.hidden_widgets.push(wid)
        }
    }

    apply_widget_visibility() {
        Array.from(this.main.children).filter((child)=>(child.display_name)).forEach((child)=>{
            const wid = `${this.node.id}:${child.display_name}`
            if (this.parent_controller.settings.hidden_widgets.find((e)=>(e==wid))) child.classList.add("hidden")
        })
    }

    context_menu(e) {
        const ewv_submenu = (value, options, e, menu, node) => {
            const choices = []
            const re = /(.*) '(.*)'/
            Array.from(this.main.children).forEach((child)=>{
                if (child.display_name && (child.display_name!=Texts.IMAGE_WIDGET_NAME || !this.image_panel.classList.contains('nodeblock_image_empty'))) {
                        choices.push(`${child.classList.contains('hidden') ? Generic.SHOW : Generic.HIDE} '${child.display_name}'`)
                     }
            })
            const submenu = new LiteGraph.ContextMenu(
                choices,
                { event: e, callback: (v) => { 
                    const match = v.match(re)
                    //Debug.extended(`Toggle ${display_name}`)
                    this.set_widget_visibility(match[2], (match[1]==Generic.SHOW))
                    UpdateController.make_request('wve', null, null, this.parent_controller)
                    close_context_menu()
                }, 
                parentMenu: menu, node:node}
            )
        }
        open_context_menu(e, null, [ 
            { 
                "title"    : Texts.REMOVE, 
                "callback" : ()=>{
                    this.node.properties["controller"] = InclusionOptions.EXCLUDE
                    NodeInclusionManager.node_change_callback?.('context_menu_remove', Timings.GENERIC_SHORT_DELAY);
                }
            },
            {
                "title"    : Texts.EDIT_WV,
                has_submenu: true,
                callback: ewv_submenu,
            }
        ])
    }

    build_nodeblock() {
        const new_main = create("span", 'nb_main')

        this.title_bar = create("span", 'nodeblock_titlebar', new_main)

        this.title_bar.addEventListener('click', (e)=>{
            if (e.ctrlKey) {
                this.context_menu(e)
                e.stopImmediatePropagation()
                e.preventDefault()
            }
        })

        
        this.title_bar_left = create("span", 'nodeblock_titlebar_left', this.title_bar)
        this.draghandle = create("span", 'nodeblock_draghandle', this.title_bar, { })
        this.title_bar_right = create("span", 'nodeblock_titlebar_right', this.title_bar)

        this.add_handle_drag_handlers(this.draghandle)

        this.minimised = this.get_minimised()

        this.mode_button  = create('i', `pi mode_button mode_button_${this.mode}`, this.title_bar_left)
        this.mode_button.addEventListener('click', (e)=>{
            if (app.canvas.read_only) return
            e.preventDefault(); 
            e.stopPropagation(); 
            this.node.mode = mode_change(this.node.mode,e)
            app.canvas.setDirty(true,true)
            OnChangeController.on_change('node mode button')
        })

        this.title_text = create("span", 'nodeblock_title', this.draghandle, {"innerText":this.node.title, 'draggable':false})

        this.image_pin = create('i', 'pi pi-thumbtack hidden', this.title_bar_right)
        this.image_pin.addEventListener('click', (e) => {
            if (app.canvas.read_only) return
            this.node.properties.controller_widgets[this.image_panel_id].pinned = !this.node.properties.controller_widgets[this.image_panel_id].pinned
            this.update_pin()
        })

        this.style.backgroundColor = this.node.bgcolor ?? LiteGraph.NODE_DEFAULT_BGCOLOR
        if (this.node.bgcolor) {
            this.title_bar.style.backgroundColor = darken(this.node.bgcolor)
        } else {
            this.title_bar.classList.add("titlebar_nocolor")
        }
        this.style.backgroundColor = this.node.bgcolor

        classSet(this, 'minimised', this.minimised)

        if (this.image_panel) this.image_panel.remove()
        this.image_panel = create("div", "nodeblock_image_panel nodeblock_image_empty", new_main, {"display_name":Texts.IMAGE_WIDGET_NAME})

        this.widget_count = 0
        this.entry_controlling_image = null
        this.node.widgets?.forEach(w => {
            if (!this.node.properties.controller_widgets[w.name]) this.node.properties.controller_widgets[w.name] = {}
            const properties = this.node.properties.controller_widgets[w.name]
            try {
                const e = new Entry(this.parent_controller, this, this.node, w, properties)
                if (e.valid()) {
                    if (e.combo_for_image) this.entry_controlling_image = e
                    new_main.appendChild(e)
                    this[w.name] = e
                    this.widget_count += 1                
                } else {
                    e._remove()
                }
            } catch (e) {
                Debug.error(`adding widget on node ${this.node.id}`, e)
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
        this.image_image.addEventListener('load', () => {this.rescale_image()})
        this.image_image.addEventListener('click', (e)=>{
            if (e.ctrlKey) {
                open_context_menu(e, "Image", [ 
                    { 
                        "title":"Open in Mask Editor", 
                        "callback":()=>{
                            ComfyApp.copyToClipspace(this.node)
                            ComfyApp.clipspace_return_node = this.node
                            ComfyApp.open_maskeditor()
                        }
                    },
                ])
            }
        })
        this.image_paging = create('span', 'overlay overlay_paging', this.image_panel)
        
        this.image_prev = create('span', 'overlay_paging_icon', this.image_paging)
        this.image_xofy = create('span', 'overlay_paging_text', this.image_paging)
        this.image_next = create('span', 'overlay_paging_icon', this.image_paging)
        this.image_prev.addEventListener('click', ()=>{this.previousImage()})
        this.image_next.addEventListener('click', ()=>{this.nextImage()})
        
        if (!app.canvas.read_only) {
            make_resizable( this.image_panel, this.node.id, this.image_panel_id, this.node.properties.controller_widgets[this.image_panel_id] )
            this.resize_observer = new ResizeObserver( ()=>{this.rescale_image()} ).observe(this.image_panel)
        }

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

        this._remove_entries()
        this.replaceChild(new_main, this.main)
        this.main = new_main
        this.apply_widget_visibility()

        if (this.node.imgs && this.node.imgs.length>0) {
            const urls = []
            this.node.imgs.forEach((i)=>{urls.push(i.src)})
            this.show_images(urls)
        } 

        this.valid_nodeblock = true 
        if (!(isImageNode(this.node) || this.widget_count || (this.node.imgs && this.node.imgs.length>0))) this.set_minimised(true)
    }

    manage_image(urls, running) {
        if (!this.parentElement) return false
        if (!(this.bypassed || this.hidden)) {
            /* take anything when running, or if we have nothing, or if we have a blob; otherwise reject blobs */
            if (running || !this.image_image.src || image_is_blob(this.image_image.src) || !image_is_blob(urls[0])) this.show_images(urls)
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
        if (!this.parent_controller) {
            Debug.trivia("Nodeblock rescale_image called with no parent", true)
            return
        }
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
                        this.image_panel.style.maxHeight = `unset`
                        this.image_image.style.height = `100%`
                        this.image_image.style.width = `${w/scaled_height_fraction}px`
                    }
                }
            } 
        }
        this.rescaling = false
    }

    select_image(nm) {
        this.show_images([get_image_url(nm),])
    }

    show_images(urls) {
        if (this.entry_controlling_image) setTimeout(()=>{
            this.entry_controlling_image.update_combo_selection()
        }, Timings.GENERIC_SHORT_DELAY)
        const nothing = !(urls && urls.length>0)
        classSet(this.image_panel, 'nodeblock_image_empty', nothing)
        classSet(this.image_pin, 'hidden', nothing)

        if (this.image_index===null || this.image_index>=urls.length) this.image_index = 0

        this.urls = urls
        const url = urls[this.image_index]

        if (this.image_image.src != url) {
            this.image_image.src = url
            this.image_panel.style.maxHeight = ''
        }

        classSet(this.image_paging, 'hidden', urls.length<2)
        classSet(this.image_prev, 'prev', true)
        this.image_xofy.innerHTML = `${this.image_index+1}/${urls.length}`
        classSet(this.image_next, 'next', true)
    }

    previousImage() {
        this.image_index = (this.image_index + this.urls.length - 1) % this.urls.length
        this.show_images(this.urls)
    }

    nextImage() {
        this.image_index = (this.image_index+1) % this.urls.length
        this.show_images(this.urls)        
    }

}



customElements.define('cp-span', NodeBlock, {extends: 'span'})