import { Debug } from "./debug.js"

export class UpdateController {
    static callback      = ()=>{}
    static permission    = ()=>{return false}
    static interst_in    = (node_id)=>{return false}
    static request_wait  = 1500
    static request_stack = 0
    static request_stack_limit = 10

    static setup(callback, permission, interest_in) {
        UpdateController.callback   = callback
        UpdateController.permission = permission
        UpdateController.interst_in = interest_in
    }

    static node_change(node_id) {
        if (this.interst_in(node_id)) UpdateController.make_request()
    }

    static make_request() {
        if (UpdateController.permission()) {
            UpdateController.callback()
        } else {
            if (UpdateController.request_stack > UpdateController.request_stack_limit) {
                Debug.trivia(`deferred request stack full`)
                return 
            }
            UpdateController.request_stack += 1
            Debug.trivia(`deferred request stack size now ${UpdateController.request_stack}`)
            setTimeout( UpdateController.deferred_request, UpdateController.request_wait)
        }
    }

    static deferred_request() {
        UpdateController.request_stack -= 1
        UpdateController.make_request()
    }

}