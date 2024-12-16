import { Timings } from "./constants.js"

export class PromptIdManager {
    constructor() {
        this.prompt_ids = new Set()
    }

    add(pid) {this.prompt_ids.add(pid)}
    
    on_executed(e) {
        setTimeout(PromptIdManager._execution_end, Timings.GENERIC_SHORT_DELAY, e)
    }
    _on_executed(e) {
        this.prompt_ids.delete(e.prompt_id)
    }

    ours(e) {
        return (this.prompt_ids.has(e.prompt_id))
    }s
}

export const pim = new PromptIdManager()