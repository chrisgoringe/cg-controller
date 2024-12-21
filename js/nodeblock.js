import { app, ComfyApp } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

import { create, darken, classSet, mode_change, tooltip_if_overflowing, kill_event } from "./utilities.js";
import { Entry } from "./panel_entry.js"
import { make_resizable } from "./resize_manager.js";
import { get_image_url, image_is_blob, ImageManager, is_image_upload_node, isImageNode } from "./image_manager.js";
import { OnChangeController, UpdateController } from "./update_controller.js";
import { Debug } from "./debug.js";
import { Highlighter } from "./highlighter.js";
import { close_context_menu, open_context_menu } from "./context_menu.js";
import { Generic, /*MAXIMUM_UPSTREAM, */Texts, Timings } from "./constants.js";
import { InclusionOptions } from "./constants.js";
import { NodeInclusionManager } from "./node_inclusion.js";
import { ImagePopup } from "./image_popup.js";

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

    image_progress_update(value, max, me) {
        if (value) {
            this.title_bar.appendChild(this.progress)
            const w = this.getBoundingClientRect().width * value / max
            const h = this.minimised ? 2 : 3
            const top = this.title_bar.getBoundingClientRect().height - h
            this.progress.style.width = `${w}px`
            this.progress.style.top = `${top}px`
            this.progress.style.height = `${h}px`
            this.progress.style.backgroundColor = me ? "var(--progress-color)" : "var(--alien-progress-color)"
        } else { this.progress.remove() }
    }

    get_minimised() {
        return this.parent_controller.settings.minimised_blocks.includes(this.node.id)
    }

    get_rejects_upstream() {
        return this.parent_controller.settings.blocks_rejecting_upstream.includes(this.node.id)
    }

    toggle_minimise() {
        this.set_minimised(!this.get_minimised())
    }

    toggle_rejects_upstream() {
        this.set_rejects_upstream(!this.get_rejects_upstream())
    }

    set(lst, v) {
        if (v) {
            lst.push(this.node.id)
        } else {
            const index = lst.findIndex((e)=>(e==this.node.id))
            lst.splice(index, 1)
        }        
    }

    set_minimised(v) {
        if (v == this.get_minimised()) return
        this.set(this.parent_controller.settings.minimised_blocks, v)
        this.minimised = v
        classSet(this, 'minimised', this.minimised)
        if (this.minimised && this.contains(document.activeElement)) {
            document.activeElement.blur()
        }
    }

    set_rejects_upstream(v) {
        if (v == this.get_rejects_upstream()) return
        this.set(this.parent_controller.settings.blocks_rejecting_upstream, v)
        this.rejects_updates = v
    }

    set_all_widget_visibility(v) {
        this.parent_controller.settings.hidden_widgets = []
        if (!v) {
            Array.from(this.main.children).filter((child)=>(child.display_name)).forEach((child)=>{
                this.parent_controller.settings.hidden_widgets.push(`${this.node.id}:${child.display_name}`)
            })
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

    show_nodeblock_context_menu(e) {
        const ewv_submenu = (value, options, e, menu, node) => {
            const choices = []
            const re = /(.*) '(.*)'/
            var showing = 0
            var hidden = 0
            Array.from(this.main.children).forEach((child)=>{
                if (child.display_name && (child.display_name!=Texts.IMAGE_WIDGET_NAME || !this.image_panel.classList.contains('nodeblock_image_empty'))) {
                        choices.push(`${child.classList.contains('hidden') ? Generic.SHOW : Generic.HIDE} '${child.display_name}'`)
                        if (child.classList.contains('hidden')) hidden += 1
                        else showing += 1
                     }
            })
            if (showing>1) choices.push(Generic.HIDE_ALL)
            if (hidden>1) choices.push(Generic.SHOW_ALL)

            const submenu = new LiteGraph.ContextMenu(
                choices,
                { event: e, callback: (v) => { 
                    if (v==Generic.HIDE_ALL || v==Generic.SHOW_ALL) {
                        this.set_all_widget_visibility(v==Generic.SHOW_ALL)
                    } else {
                        const match = v.match(re)
                        this.set_widget_visibility(match[2], (match[1]==Generic.SHOW))
                    }
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
                "title"    : this.rejects_updates ? Texts.ACCEPT_UPSTREAM : Texts.REJECT_UPSTREAM, 
                "callback" : ()=>{
                    this.toggle_rejects_upstream()
                    UpdateController.make_request('accepts updates toggled', null, null, this.parent_controller)
                }
            },
            {
                "title"    : Texts.EDIT_WV,
                has_submenu: true,
                callback: ewv_submenu,
            }
        ])
    }

    nodeblock_context_menu(e) {
        e.stopImmediatePropagation()
        e.preventDefault() 
        this.show_nodeblock_context_menu(e)
    }

    image_context_menu(e) {
        open_context_menu(e, "Image", [ 
            { 
                "title":"Open in Mask Editor", 
                "callback":()=>{
                    ComfyApp.copyToClipspace(this.node)
                    ComfyApp.clipspace_return_node = this.node
                    ComfyApp.open_maskeditor()
                }
            },
            { 
                "title":"Open in new tab", 
                "callback":()=>{
                    window.open(this.urls[this.image_index])
                }
            },
            { 
                "title":"Save image", 
                "callback":()=>{
                    const a = create('a', 'hidden', this, {href:this.urls[this.image_index], download:"image.png"})
                    a.click()
                    a.remove()
                }
            },
        ])
    }

    build_nodeblock() {
        const new_main = create("span", 'nb_main')

        this.title_bar = create("span", 'nodeblock_titlebar', new_main)

        this.title_bar.addEventListener('click', (e)=>{
            if (e.ctrlKey) {
                this.nodeblock_context_menu(e)
            }
        })

        this.title_bar_left = create("span", 'nodeblock_titlebar_left', this.title_bar)
        this.draghandle = create("span", 'nodeblock_draghandle', this.title_bar, { })
        this.title_bar_right = create("span", 'nodeblock_titlebar_right', this.title_bar)

        this.add_handle_drag_handlers(this.draghandle)
        this.draghandle.handle_right_click = (e)=>{
            this.nodeblock_context_menu(e)
        }

        this.minimised = this.get_minimised()
        this.rejects_updates = this.get_rejects_upstream()

        this.mode_button  = create('i', `pi mode_button mode_button_${this.mode}`, this.title_bar_left)
        this.mode_button.addEventListener('click', (e)=>{
            if (app.canvas.read_only) return
            kill_event(e)
            this.node.mode = mode_change(this.node.mode,e)
            app.canvas.setDirty(true,true)
            OnChangeController.on_change('node mode button')
        })

        this.title_text = create("span", 'nodeblock_title', this.draghandle, {"innerText":this.node.title, 'draggable':false})
        tooltip_if_overflowing(this.title_text, this.title_bar)

        this.image_pin = create('i', 'pi pi-thumbtack hidden', this.title_bar_right)
        this.image_pin.addEventListener('click', (e) => {
            if (app.canvas.read_only) return
            this.node.properties.controller_widgets[this.image_panel_id].pinned = !this.node.properties.controller_widgets[this.image_panel_id].pinned
            this.update_pin(true)
        })

        this.style.backgroundColor = this.node.bgcolor ?? LiteGraph.NODE_DEFAULT_BGCOLOR
        if (this.node.bgcolor) {
            this.title_bar.style.backgroundColor = darken(this.node.bgcolor)
        } else {
            this.title_bar.classList.add("titlebar_nocolor")
        }

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
                    //this[w.name] = e   // removed because it breaks when widgets are named like 'style'. Why was it here? Dates from change 12149b1
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
        this.image_image.addEventListener('load', (e) => {this.rescale_image()})
        this.image_image.addEventListener('error', (e) => {delete e.target.src})
        this.image_image.addEventListener('click', (e)=>{
            if (e.ctrlKey) { kill_event(e); this.image_context_menu(e) }
            if (e.shiftKey) { ImagePopup.show(this.urls[this.image_index]) }
        })
        this.image_paging = create('span', 'overlay overlay_paging', this.image_panel)
        this.image_image.handle_right_click = (e) => { this.image_context_menu(e) }
        
        this.image_prev = create('span', 'overlay_paging_icon', this.image_paging)
        this.image_xofy = create('span', 'overlay_paging_text', this.image_paging)
        this.image_next = create('span', 'overlay_paging_icon', this.image_paging)
        this.image_prev.addEventListener('click', ()=>{this.previousImage()})
        this.image_next.addEventListener('click', ()=>{this.nextImage()})
        
        make_resizable( this.image_panel, this.node.id, this.image_panel_id, this.node.properties.controller_widgets[this.image_panel_id] )
        this.resize_observer = new ResizeObserver( ()=>{this.rescale_image()} ).observe(this.image_panel)
        if (app.canvas.read_only) this.image_panel.style.resize = "none"

        this._remove_entries()
        this.replaceChild(new_main, this.main)
        this.main = new_main
        this.apply_widget_visibility()

        if (ImageManager.get_urls(this.node.id)) {
            this.show_images(ImageManager.get_urls(this.node.id), this.node.id)
        } else if (this.node.imgs && this.node.imgs.length>0) {
            const urls = []
            this.node.imgs.forEach((i)=>{urls.push(i.src)})
            this.show_images(urls, this.node.id)
        } 

        this.valid_nodeblock = true 
        if (!(isImageNode(this.node) || this.widget_count || (this.node.imgs && this.node.imgs.length>0))) this.set_minimised(true)
    }

    update_pin(from_click) {
        classSet(this.image_pin, 'clicked', this.node.properties.controller_widgets[this.image_panel_id].pinned)
        this.image_panel.style.resize = this.node.properties.controller_widgets[this.image_panel_id].pinned ? "none" : "vertical"
        this.rescale_image(from_click)
    }

    rescale_image(from_click) {
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
                        const max_height = (im_h/im_w) * w;
                        if (from_click) {
                            const overflow = box.bottom - this.parent_controller.getBoundingClientRect().bottom + 8
                            const height = (from_click) ? Math.min(max_height, max_height - overflow) : max_height
                            this.image_panel.style.height = `${height}px`
                        }
                        this.image_panel.style.maxHeight = `${max_height}px`
                        this.image_image.style.height = `100%`
                        this.image_image.style.width = `auto`
                    }
                }
            } 
        }
        this.rescaling = false
    }

    select_image(nm) {
        this.show_images([get_image_url(nm),])
    }

    static comparing = null
    static handle_mouse_move(e) {
        if (e.target.doing_compare) {
            NodeBlock.comparing = e.target.doing_compare
            const fraction = e.offsetX / NodeBlock.comparing.image_image.getBoundingClientRect().width
            NodeBlock.comparing.show_part_of_overlay(fraction)
            Debug.extended(`mouse over compare image ${fraction}`)
        } else if (NodeBlock.comparing) {
            NodeBlock.comparing.show_part_of_overlay(0)
            NodeBlock.comparing = null
        }
    }

    show_part_of_overlay(fraction) {
        if (this.image_image_2) {
            const box = this.image_image_2.getBoundingClientRect()
            const w = fraction * box.width
            const h = box.height
            this.image_image_2.style.clip = `rect(0, ${w}px, ${h}px, 0)`
        }
    }

    show_images(urls, node_id) {
        if (this.get_rejects_upstream() && node_id!=this.node.id) return

        const nothing = !(urls && urls.length>0)
        const is_blob = (!nothing && image_is_blob(urls[0]))
        
        if (this.entry_controlling_image) setTimeout(()=>{
            this.entry_controlling_image.update_combo_selection()
        }, Timings.GENERIC_SHORT_DELAY)

        const doing_compare = (this.node.type=="Image Comparer (rgthree)" && urls && urls.length==2)
        
        this.image_image_2?.remove()
        if (doing_compare) {
            this.image_image_2 = create('img', 'nodeblock_image_overlay', this.image_panel, {"doing_compare":this})
            this.image_index = 0
        }
        this.image_image.doing_compare = doing_compare ? this : null

        
        classSet(this.image_panel, 'nodeblock_image_empty', nothing)
        classSet(this.image_pin, 'hidden', nothing)

        if (this.image_index===null || !urls || this.image_index>=urls.length) {
            this.image_index = this.node.imageIndex ?? 0
        } else {
            this.node.imageIndex = this.image_index
            app.canvas.setDirty(true,true)
        }

        this.urls = urls
        const url = nothing ? null : (is_blob ? urls[0] : urls[this.image_index])

        if (this.image_image.src != url) {
            this.image_image.src = url
            this.image_panel.style.maxHeight = ''
        }

        if (doing_compare) {
            classSet(this.image_paging, 'hidden', true)
            this.image_image_2.src = urls[1]
            setTimeout(this.show_part_of_overlay.bind(this), Timings.GENERIC_SHORT_DELAY, 0.0)
        } else {
            classSet(this.image_paging, 'hidden', nothing || urls.length<2)
            classSet(this.image_prev, 'prev', true)
            this.image_xofy.innerHTML = `${this.image_index+1}/${urls?.length}`
            classSet(this.image_next, 'next', true)
        }
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