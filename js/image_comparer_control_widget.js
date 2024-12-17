import { ImageManager } from "./image_manager.js"
import { create, classSet } from "./utilities.js"

export class ImageComparerControlWidget extends HTMLSpanElement {
    constructor(parent_controller, node, target_widget) {
        super()
        this.classList.add('image_comparer_widget')
        Object.keys(target_widget.hitAreas).forEach((key)=>{
            const clickable = create('span', 'image_comparer_option', this, {"innerText":key})
            classSet(clickable, 'selected', target_widget.hitAreas[key].data.selected)
            clickable.addEventListener('click', (e)=>{
                e.stopPropagation()
                target_widget.hitAreas[key].onDown.bind(target_widget)(e,null,node,target_widget.hitAreas[key])
                const imgs = []
                target_widget.selected.forEach((v)=>{imgs.push(v.img)})
                node.imgs = imgs
                ImageManager.node_reported_images(node.id, imgs)
            })
        })
    }

}

customElements.define('pll-iccw',  ImageComparerControlWidget, {extends: 'span'})