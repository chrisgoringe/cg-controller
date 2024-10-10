import { Debug } from "./debug.js"

export class UpdateController {
    static callback      = ()=>{}
    static permission    = ()=>{return false}
    static request_wait  = 100
    static periodic_wait = 1000
    static request_stack = 0
    static request_stack_limit = 10

    static setup(callback, permission) {
        UpdateController.callback   = callback
        UpdateController.permission = permission
    }

    static make_request() {
        if (UpdateController.permission()) {
            UpdateController.callback()
        } else {
            if (UpdateController.request_stack > UpdateController.request_stack_limit) {
                Debug.important(`deferred request stack full`)
                return 
            }
            UpdateController.request_stack += 1
            Debug.extended(`deferred request stack size now ${UpdateController.request_stack}`)
            setTimeout( UpdateController.deferred_request, UpdateController.request_wait)
        }
    }

    static deferred_request() {
        UpdateController.request_stack -= 1
        UpdateController.make_request()
    }

}