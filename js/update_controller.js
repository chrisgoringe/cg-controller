import { app } from "../../scripts/app.js"
import { Timings } from "./constants.js"
import { Debug } from "./debug.js"
import { GroupManager } from "./groups.js"

function message(wait_time) {
    if (wait_time==0) return ""
    if (wait_time==-2) return "Graph configuring"
    if (wait_time<0) return "Controller refused with no retry"
    return `Controller requested retry after ${wait_time}ms`
}

export class UpdateController {
    static callback     = ()=>{}
    static permission   = ()=>{return false}
    static single_node  = (node_id, info)=>{}
    static pause_stack  = 0
    static _configuring = false

    static setup(callback, permission, single_node) {
        UpdateController.callback    = callback
        UpdateController.permission  = permission
        UpdateController.single_node = single_node
    }

    static push_pause() { UpdateController.pause_stack += 1 }
    static pop_pause() { UpdateController.pause_stack -= 1 }

    static configuring(v) { 
        Debug.trivia(`_configuring set to ${v}`)
        UpdateController._configuring = v 
    }

    static make_single_request(label, controller) {
        UpdateController.make_request(label, null, null, controller)
    }
    static make_request_unless_configuring(label, after_ms, noretry, controller) {
        if (UpdateController._configuring) {
            Debug.extended(`make_request_unless_configuring ${label} ignored because still configuring`)
        } else {      
            UpdateController.make_request(label, after_ms, noretry, controller)
        }
    }
    static make_request(label, after_ms, noretry, controller) {
        label = label ?? ""
        const cont_name = controller ? `for controller ${controller.settings.index}` : `all controllers`
        if (after_ms) {

            setTimeout(UpdateController.make_request, after_ms, label, null, noretry, controller)

        } else {
            var wait_time = 0
            if (wait_time==0 && UpdateController.pause_stack>0) wait_time = Timings.PAUSE_STACK_WAIT
            if (wait_time==0 && UpdateController._configuring) wait_time = -2
            if (wait_time==0) wait_time = UpdateController.permission(controller)
            Debug.extended(`Update ${cont_name} requested because '${label}'. ${message(wait_time)}`)

            if (wait_time == 0) {
                Debug.extended(`Update ${cont_name} request '${label}' sent`)
                UpdateController.callback(controller)
                return
            } else {
                var reason_not_to_try_again = null
                if (wait_time < 0)               reason_not_to_try_again = "delay was negative"
                if (noretry)                     reason_not_to_try_again = "noretry was set"
                if (UpdateController.requesting) reason_not_to_try_again = "a retry is already pending"

                if (reason_not_to_try_again) {
                    Debug.extended(`Update ${cont_name} request '${label}' cancelled because ${reason_not_to_try_again}`)
                } else {
                    Debug.extended(`Update ${cont_name} request '${label}' rescheduled for ${wait_time}ms`)
                    UpdateController.requesting = true
                    setTimeout( UpdateController.deferred_request, wait_time, label, controller)
                }
            }

        }
    }

    static deferred_request(label, controller) {
        UpdateController.requesting = false
        UpdateController.make_request(label, null, null, controller)
    }
}

function hash_node(node) {
    /* 
    hash all the things we want to check for changes.
    */
    var hash = `${node.bgcolor} ${node.title} `
    node.inputs.forEach((i)=>{hash += `${i.name} `})
    node.outputs.forEach((o)=>{hash += `${o.name} `})
    return hash
}

function node_changed(node) {
    const new_hash = hash_node(node)
    if (new_hash == node._controller_hash) return false
    node._controller_hash = new_hash
    return true
}

export class OnChangeController {
    static gap_request_stack = 0
    static on_change() {
        OnChangeController.gap_request_stack += 1
        setTimeout(OnChangeController._on_change, Timings.ON_CHANGE_GAP)
    }
    static _on_change() {
        OnChangeController.gap_request_stack -= 1
        if (OnChangeController.gap_request_stack == 0) {
            if (GroupManager.check_for_changes()) {
                UpdateController.make_request("on_change, change in groups")
            } else {
                const changed_nodes = app.graph._nodes.filter((node)=>(node_changed(node)))
                if (changed_nodes.length > 1) {
                    UpdateController.make_request("on_change, multiple nodes changed")
                } else if (changed_nodes.length == 1) {
                    UpdateController.single_node(changed_nodes[0], "on_change")
                } else if (app.canvas.read_only != app.canvas._controller_read_only) {
                    UpdateController.make_request(`on_change, read_only ${app.canvas.read_only}`)
                    app.canvas._controller_read_only = app.canvas.read_only
                } else {
                    Debug.trivia("on_change, no changes", true)
                }
            } 
        } else {
            Debug.trivia("on_change, too soon", true)
        }
    }

}