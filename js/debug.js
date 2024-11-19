import { app } from "../../scripts/app.js"
import { SettingIds, VERSION } from "./constants.js"

export class Debug {
    static last_message = null
    static _log(message, level, repeatok) {
        if ((message == Debug.last_message && !repeatok) ||
            level > app.ui.settings.getSettingValue(SettingIds.DEBUG_LEVEL, 1)) return
        Debug.last_message = message
        console.log(`Controller ${VERSION}: ${message}`)
    }
    static error(message, e)     { Debug._log(message, 0, true); console.error(e) }
    static essential(message, repeatok) { Debug._log(message, 0, repeatok) }
    static important(message, repeatok) { Debug._log(message, 1, repeatok) }
    static extended(message, repeatok)  { Debug._log(message, 2, repeatok) }
    static trivia(message, repeatok)    { Debug._log(message, 3, repeatok) }
}