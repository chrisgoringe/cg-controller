import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ControllerPanel } from "./controller_panel.js"

app.registerExtension({
	name: "cg.controller",

    async setup() {
        const head = document.getElementsByTagName('HEAD')[0];
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'extensions/cg-controller/controller.css';
        head.appendChild(link);

        const original_getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            // Add our items to the canvas menu 
            const options = original_getCanvasMenuOptions.apply(this, arguments);
            options.push(null); // divider
            options.push({
                content: ControllerPanel.showing() ? "Update Controller Panel" : "Show Controller Panel",
                callback: () => new ControllerPanel()
            })
            if (ControllerPanel.showing()) {
                options.push({
                    content: "Hide Controller Panel",
                    callback: () => ControllerPanel.remove()
                })                
            }
            return options
        }

        api.addEventListener("executing", ControllerPanel.update)
    }
})