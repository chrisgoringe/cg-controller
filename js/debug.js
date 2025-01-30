import { app } from "../../scripts/app.js"
import { SettingIds, VERSION } from "./constants.js"

export class _Debug {
    static instance

    constructor(title = "Controller") {
        this.prefix = title
        this.last_message = null
        _Debug.instance = this
    }

    _log(message, level, repeatok) {
        if ((message == this.last_message && !repeatok) ||
            level > app.ui.settings.getSettingValue(SettingIds.DEBUG_LEVEL, 1)) return
        this.last_message = message
        console.log(`${VERSION} ${(this.prefix instanceof Function) ? this.prefix() : this.prefix}: (${level}) ${message}`)
    }
    error(message, e) { 
        _Debug.instance._log(message, 0, true); 
        if (e) console.error(e) 
    }
    essential(message, repeatok) { _Debug.instance._log(message, 0, repeatok) }
    important(message, repeatok) { _Debug.instance._log(message, 1, repeatok) }
    extended(message, repeatok)  { _Debug.instance._log(message, 2, repeatok) }
    trivia(message, repeatok)    { _Debug.instance._log(message, 3, repeatok) }
}

export const Debug = new _Debug()