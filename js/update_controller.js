import { Debug } from "./debug.js"

export class UpdateController {
    static callback      = ()=>{}
    static permission    = ()=>{return false}
    static interest_in    = (node_id)=>{return false}
    static request_stack = 0
    static request_stack_limit = 10

    static setup(callback, permission, interest_in) {
        UpdateController.callback    = callback
        UpdateController.permission  = permission
        UpdateController.interest_in = interest_in
    }

    static node_change(node_id) {
        if (this.interest_in(node_id)) UpdateController.make_request()
    }

    static make_request(after_seconds, label) {
        if (after_seconds) {
            if (label) Debug.extended(`${label} made request`)
            setTimeout(UpdateController.make_request, after_seconds*1000, null, label)
        } else {
            const wait_time = UpdateController.permission()
            if (label) Debug.extended(`${label} got asked to wait ${wait_time}`)
            if (wait_time == 0) {
                UpdateController.callback()
            } else if (wait_time < 0) {
                return
            } else {
                if (UpdateController.request_stack > UpdateController.request_stack_limit) {
                    Debug.trivia(`deferred request stack full`)
                    return 
                }
                UpdateController.request_stack += 1
                Debug.trivia(`deferred request stack size now ${UpdateController.request_stack}`)
                setTimeout( UpdateController.deferred_request, wait_time*1000)
            }
        }
    }

    static deferred_request() {
        UpdateController.request_stack -= 1
        UpdateController.make_request()
    }

}