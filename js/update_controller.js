import { app } from "../../scripts/app.js"
import { Timings } from "./constants.js"
import { _Debug } from "./debug.js"
import { GroupManager } from "./groups.js"
import { send_graph_changed } from "./utilities.js"
import { pim } from "./prompt_id_manager.js"

const Debug = new _Debug(()=>(new Date().toISOString()))

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
            if (wait_time==0 && UpdateController.pause_stack>0) {
                Debug.extended("Delayed by pause_stack")
                wait_time = Timings.PAUSE_STACK_WAIT
            }
            if (wait_time==0 && UpdateController._configuring) wait_time = -2
            if (wait_time==0) wait_time = UpdateController.permission(controller)
            Debug.extended(`Update ${cont_name} requested because '${label}'. ${message(wait_time)}`)

            if (wait_time == 0) {
                Debug.extended(`Update ${cont_name} request '${label}' sent`)
                UpdateController.callback(controller)
                send_graph_changed()
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
    if (!node) return "nonode"
    var hash = `${node.bgcolor} ${node.title} ${node.mode} ${node.imageIndex}`
    node.inputs?.forEach(                                 (i)=>{hash += `${i.label ?? i.name} `})
    node.outputs?.forEach(                                (o)=>{hash += `${o.name} `})
    node.widgets?.filter((w)=>(w.element?.value)).forEach((w)=>{hash += `${w.element.value} `})
    node.widgets?.filter((w)=>(w.value)).forEach(         (w)=>{hash += JSON.stringify(w.value)})
    node.widget_values?.forEach(                          (w)=>{hash += `${w} `})
    return hash
}

function node_changed(node) {
    if (!node) return false
    const new_hash = hash_node(node)
    if (new_hash == node._controller_hash) return false
    node._controller_hash = new_hash
    return true
}

export class OnChangeController {
    static nodes_requested = new Set()
    static all_nodes = false
    constructor() {
        setTimeout(OnChangeController.start, Timings.GENERIC_LONGER_DELAY)
    }
    static start() {
        setInterval(OnChangeController.on_change, Timings.PERIODIC_CHECK, "tick")
    }
    static gap_request_stack = 0
    static on_change(details, node_id) {
        OnChangeController.gap_request_stack += 1
        if (node_id) OnChangeController.nodes_requested.add(node_id)
        else OnChangeController.all_nodes = true
        setTimeout(OnChangeController._on_change, Timings.ON_CHANGE_GAP, details)
    }

    static _on_change(details) {
        const log = (details=="tick") ? Debug.trivia : Debug.extended
        OnChangeController.gap_request_stack -= 1
        if (OnChangeController.gap_request_stack == 0) {
            if (GroupManager.check_for_changes()) {
                UpdateController.make_request(`on_change (${details}), change in groups`)
            } else {
                var nodes_to_check = []
                if (OnChangeController.all_nodes) {
                    nodes_to_check = Array.from(app.graph._nodes)
                } else {
                    Array.from(OnChangeController.nodes_requested).forEach((nid)=>{ nodes_to_check.push(app.graph._nodes_by_id[nid])})
                }
                const changed_nodes = nodes_to_check.filter((node)=>(node_changed(node))) 
                if (changed_nodes.length > 1) {
                    UpdateController.make_request(`on_change (${details}), ${changed_nodes.length} nodes changed`)
                } else if (changed_nodes.length == 1) {
                    UpdateController.single_node(changed_nodes[0].id, `on_change (${details}), node ${changed_nodes[0].id} changed`)
                } else if (app.canvas.read_only != app.canvas._controller_read_only) {
                    UpdateController.make_request(`on_change (${details}), read_only changed to ${app.canvas.read_only}`)
                    app.canvas._controller_read_only = app.canvas.read_only
                } else {
                    log(`on_change (${details}), no changes`, true)
                }
                OnChangeController.all_nodes = false
                OnChangeController.nodes_to_check = new Set()
            } 
        } else {
            log(`on_change (${details}), too soon`, true)
        }
    }
    static on_executing(e) {
        //if (!pim.ours(e)) return
        if (OnChangeController.executing_node && OnChangeController.executing_node!=e.detail) {
            OnChangeController.on_change(`on_executing ${e.detail}`)
        }
        OnChangeController.executing_node = e.detail
    }
    /*static _on_executing(nid) {
        if (node_changed(app.graph._nodes_by_id[nid])) {
            Debug.extended(`Node (${nid} on_executing changed)`)
            UpdateController.single_node(nid, `on_executing, node ${nid} changed`)
        } else {
            Debug.extended(`Node (${nid} on_executing unchanged)`)
        }
    }*/
}

const occ = new OnChangeController()