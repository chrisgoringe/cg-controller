import { Timings } from "./constants.js"
import { Debug } from "./debug.js"

export class UpdateController {
    static callback      = ()=>{}
    static permission    = ()=>{return false}
    static interest_in   = (node_id)=>{return false}
    static pause_stack = 0

    static setup(callback, permission, interest_in) {
        UpdateController.callback    = callback
        UpdateController.permission  = permission
        UpdateController.interest_in = interest_in
    }


    static node_change(node_id) {
        if (this.interest_in(node_id)) UpdateController.make_request(`node ${node_id} changed`)
    }

    static push_pause() { UpdateController.pause_stack += 1 }
    static pop_pause() { UpdateController.pause_stack -= 1 }

    static make_single_request(label, controller) {
        UpdateController.make_request(label, null, null, controller)
    }
    static make_request(label, after_ms, noretry, controller) {
        if (after_ms) {
            setTimeout(UpdateController.make_request, after_ms, label, null, noretry, controller)
        } else {
            
            const wait_time = UpdateController.pause_stack>0 ? Timings.PAUSE_STACK_WAIT : UpdateController.permission(controller)
            if (label) Debug.extended(`${label} made update request and got ${wait_time}`)

            if (wait_time == 0) {
                UpdateController.callback(controller)
                return
            }

            var reason_not_to_try_again = null
            if (wait_time < 0)               reason_not_to_try_again = "delay was negative"
            if (noretry)                     reason_not_to_try_again = "noretry was set"
            if (UpdateController.requesting) reason_not_to_try_again = "a retry is already pending"

            if (reason_not_to_try_again) {
                Debug.extended(`${label} not trying again because ${reason_not_to_try_again}`)
            } else {
                UpdateController.requesting = true
                setTimeout( UpdateController.deferred_request, wait_time, label, controller)
            }

        }
    }

    static deferred_request(label, controller) {
        UpdateController.requesting = false
        UpdateController.make_request(label, null, null, controller)
    }

}