import { app } from "../../scripts/app.js";
import { Timings } from "./constants.js"
import { find_controller_parent, create, kill_event } from "./utilities.js"
import { Debug } from "./debug.js";

export class ImagePopup extends HTMLSpanElement {
    constructor() {
        super()
        this.frame = create('span', 'image_popup_frame', this)
        this.img = create('img', 'image_popup_image', this.frame)
        ImagePopup._instance = this
        this.classList.add('image_popup')
        this.classList.add('hidden')
        find_controller_parent().appendChild(this)
    }

    static just_shown = false

    static handle_click(e) { 
        if (ImagePopup.just_shown) return
        ImagePopup.instance.classList.add("hidden") 
    }

    static show(url) {
        ImagePopup.just_shown = true
        ImagePopup.instance.img.src = url
        ImagePopup.instance.classList.remove("hidden")
        setTimeout(()=>{ImagePopup.just_shown=false},Timings.GENERIC_SHORT_DELAY)
    }
}

Object.defineProperty(ImagePopup, "instance", {
    get : ()=>{
        if (!ImagePopup._instance) new ImagePopup()
        return ImagePopup._instance
    }
})

customElements.define('cp-image_popup', ImagePopup, {extends: 'span'})