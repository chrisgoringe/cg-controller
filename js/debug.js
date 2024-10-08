
export class Debug {
    static LEVEL = 2

    static _log(message, level) {
        if (level <= Debug.LEVEL) console.log(message)
    }

    static essential(message) { Debug._log(message, 0) }
    static important(message) { Debug._log(message, 1) }
    static extended(message)  { Debug._log(message, 2) }
    static trivia(message)    { Debug._log(message, 3) }

    //static setLevel(level)    { Debug.LEVEL = level    }
}