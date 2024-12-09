import { Debug } from "./debug.js";
import { get_parent_height, get_parent_width } from "./snap_manager.js";

function instances_to_json(panel_instances) {
    const jsonable = []
    const h = get_parent_height()
    const w = get_parent_width()
    Object.values(panel_instances).forEach((instance) => {
        jsonable.push( {
            "x" : instance.settings.position.x / w,
            "y" : instance.settings.position.y / h,
            "w" : instance.settings.position.w / w,
            "h" : instance.settings.position.h / h,
            "collapsed" : instance.settings.collapsed
        } )
    });
    return JSON.stringify(jsonable)
}

export function download_workspace_as_json(panel_instances, filename) {
    const json = instances_to_json(panel_instances)
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
        reader.onload = (e) => { callback(JSON.parse(e.target.result)) };
        reader.readAsText(file);
    } catch (e) {
        error_callback?.(e)
    }
}

export function set_settings_for_instance(settings, instance) {
    const h = get_parent_height()
    const w = get_parent_width()
    settings.set_position(Math.round(w*instance.x),Math.round(h*instance.y),Math.round(w*instance.w),Math.round(h*instance.h))
    settings.collapsed = instance.collapsed
}