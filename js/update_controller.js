import { Timings, SettingIds } from "./constants.js"
import { Debug } from "./debug.js"
import { settings } from "./settings.js"

export class UpdateController {
    static callback      = ()=>{}
    static permission    = ()=>{return false}
    static interest_in   = (node_id)=>{return false}
    static request_stack = 0
    static request_stack_limit = 10
    static pause_stack = 0

    static setup(callback, permission, interest_in) {
        UpdateController.callback    = callback
        UpdateController.permission  = permission
        UpdateController.interest_in = interest_in
        UpdateController.periodic_request()
    }

    static periodic_request() {
        const period = settings.getSettingValue( SettingIds.AUTOUPDATE, 5000 )
        if (period > 0) {
            UpdateController.make_request("periodic request", null, true)
            setTimeout(UpdateController.periodic_request, period)
        } else {
            setTimeout(UpdateController.periodic_request, Timings.RECHECK_AUTOUPDATE)
        }
        
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
            if (label) Debug.extended(`${label} got asked to wait ${wait_time}`)
            if (wait_time == 0) {
                UpdateController.callback()
            } else if (wait_time < 0) {
                return
            } else {
                if (noretry) {
                    Debug.trivia(`noretry set, so ${label} not retrying`)
                    return
                }
                if (UpdateController.request_stack > UpdateController.request_stack_limit) {
                    Debug.extended(`deferred request stack full`)
                    return 
                }
                UpdateController.request_stack += 1
                Debug.trivia(`deferred request stack size now ${UpdateController.request_stack}`)
                setTimeout( UpdateController.deferred_request, wait_time, label)
            }
        }
    }

    static deferred_request(label) {
        UpdateController.request_stack -= 1
        UpdateController.make_request(label)
    }

}