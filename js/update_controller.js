

export class UpdateController {
    static instance

    constructor( callback, grace_window, delays ) {
        this.callback      = callback
        this.grace_window  = grace_window ? grace_window : 100
        this.delays        = delays ? delays : [10, 1000, 5000]
        this.request_count = 0
    }

    static setup(callback, grace_window, delays) {
        UpdateController.instance = new UpdateController(callback, grace_window, delays)
    }

    make_request() {
        this.request_count += 1
        setTimeout( this._consider_request.bind(this), this.grace_window )
    }

    _consider_request() {
        this.request_count -= 1
        if (this.request_count == 0) {
            this.delays.forEach((delay) => { setTimeout( this.callback, delay )});
        }
    }

}