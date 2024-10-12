import { app } from "../../scripts/app.js"
import { SettingIds } from "./constants.js"

export class Debug {
    static last_message = null
    static _log(message, level) {
        if (message == Debug.last_message ||
            level > app.ui.settings.getSettingValue(SettingIds.DEBUG_LEVEL, 1)) return
        Debug.last_message = message
        console.log(message)
    }

    static essential(message) { Debug._log(message, 0) }
    static important(message) { Debug._log(message, 1) }
    static extended(message)  { Debug._log(message, 2) }
    static trivia(message)    { Debug._log(message, 3) }
}