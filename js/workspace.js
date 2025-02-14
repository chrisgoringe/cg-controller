import { Debug } from "./debug.js";
import { get_parent_height, get_parent_width } from "./snap_manager.js";

function to_json() {
    return JSON.stringify( app.graph.extra.controller_panel  )
}

function from_json(j) {
    app.graph.extra.controller_panel = JSON.parse(j)
}

export function download_workspace_as_json(panel_instances, filename) {
    const json = to_json(panel_instances)
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);  
    element.click();  
    document.body.removeChild(element);
}

export async function load_workspace(callback, error_callback) {
    try {
        const fileHandles = await window.showOpenFilePicker({"types":[{"accept":{"application/json":[".json"]}}]})
        const file = await fileHandles[0].getFile()
        const reader = new FileReader();
        reader.onload = (e) => { 
            from_json(e.target.result) 
            callback()
        };
        reader.readAsText(file);
    } catch (e) {
        error_callback?.(e)
    }
}

export function set_settings_for_instance(settings, instance, w_was, h_was) {
    Object.keys(instance).filter((key)=>(key!="index")).forEach((key)=>settings.settings[key] = instance[key])
    const h = get_parent_height()
    const w = get_parent_width()
    settings.set_position(
        Math.round(settings.position.x * w / w_was),
        Math.round(settings.position.y * h / h_was),
        Math.round(settings.position.w * w / w_was),
        Math.round(settings.position.h * h / h_was),
    )
}
