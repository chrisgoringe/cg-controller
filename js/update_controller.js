import { Timings, SettingIds } from "./constants.js"
import { Debug } from "./debug.js"
import { settings } from "./settings.js"

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

    static make_request(label, after_ms, noretry) {
        if (after_ms) {
            if (label) Debug.extended(`${label} made request`)
            setTimeout(UpdateController.make_request, after_ms, label, null, noretry)
        } else {
            const wait_time = UpdateController.pause_stack>0 ? Timings.PAUSE_STACK_WAIT : UpdateController.permission()

            if (wait_time == 0) {
                UpdateController.callback()
                return
            }

            if (label) Debug.extended(`${label} got asked to wait ${wait_time}`)

            var reason_not_to_try_again = null
            if (wait_time < 0)               reason_not_to_try_again = "delay was negative"
            if (noretry)                     reason_not_to_try_again = "noretry was set"
            if (UpdateController.requesting) reason_not_to_try_again = "a retry is already pending"

            if (reason_not_to_try_again) {
                Debug.extended(`${label} not trying again because ${reason_not_to_try_again}`)
            } else {
                UpdateController.requesting = true
                setTimeout( UpdateController.deferred_request, wait_time, label)
            }

        }
    }

    static deferred_request(label) {
        UpdateController.requesting = false
        UpdateController.make_request(label)
    }

}