import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"
import { Colors, Texts } from "./constants.js"
import { mode_change } from "./utilities.js"
import { Debug } from "./debug.js"

function recompute_safely(group) {
    const _g = [...group._nodes]
    const _c = new Set(group._children)
    group.recomputeInsideNodes()
    const nodes = [...group._nodes]
    group._nodes = _g
    group._children = _c
    return nodes
}

export function family_names(group_name) {
    /* Given the name of a group, return a list of the names of all parents and children of all groups with this name */
    const names = new Set([group_name,])
    app.graph._groups.filter((g)=>(g.title==group_name)).forEach((g)=>{
        g.recomputeInsideNodes()
        Array.from(g._children).filter((c)=>(c instanceof LGraphGroup)).forEach((c)=>{names.add(c.title)})
        app.graph._groups.filter((p)=>(p._children.has(g))).forEach((p)=>{names.add(p.title)})
    })
    return names
}

export class GroupManager {
    static _instance = null
    constructor() {
        this.groups = {}  // maps group name to Set of node ids
        const ungrouped = new Set()
        app.graph._nodes.forEach((node)=>{
            if (NodeInclusionManager.node_includable(node)) ungrouped.add(node.id)
        })
        this.colors = {}  // maps group name to color
        app.graph._groups.forEach((group) => {
            if (!group.graph) {
                group.graph = app.graph
            }
            recompute_safely(group).forEach((node) => {
                if (NodeInclusionManager.node_includable(node)) {
                    if (!this.groups[group.title]) {
                        this.groups[group.title] = new Set()
                        this.colors[group.title] = group.color
                    }
                    this.groups[group.title].add(node.id)
                    ungrouped.delete(node.id)
                }
            })
        })
        if (ungrouped.size>0) this.groups[Texts.UNGROUPED] = ungrouped

        this.jsoned = JSON.stringify(this,(_key, value) => (value instanceof Set ? [...value] : value))
    }

    static check_for_changes() {
        const gm2 = new GroupManager()
        if (gm2.jsoned==GroupManager.instance.jsoned) return false
        GroupManager._instance = gm2
        return true
    }

    static list_group_names() {
        const names = Object.keys(GroupManager.instance.groups)
        //Object.keys(GroupManager.instance.groups).forEach((gp) => {names.push(gp)})
        names.sort()
        names.unshift(Texts.ALL_GROUPS)
        return names
    }

    static group_color(group_name) {
        return GroupManager.instance.colors[group_name] ?? Colors.DARK_BACKGROUND
    }

    static group_node_mode(group_name) {
        const modes = {0:0,2:0,4:0}
        app.graph._groups.forEach((group) => {
            if (group.title == group_name) {
                group.recomputeInsideNodes()
                group._nodes.forEach((node) => {
                    modes[node.mode] += 1
                })
            }
        })
        if (modes[2]==0 && modes[4]==0) return 0
        if (modes[0]==0 && modes[4]==0) return 2
        if (modes[0]==0 && modes[2]==0) return 4
        return 9
    }

    static change_group_mode(group_name, current_mode, e) {
        const value = mode_change(current_mode,e)
        app.graph._groups.forEach((group) => {
            if (group.title == group_name) {
                group.recomputeInsideNodes()
                group._nodes.forEach((node) => {
                    node.mode = value
                })
            }
        })        
    }

    static is_node_in(group_name, node_id) {
        if (group_name==Texts.ALL_GROUPS) return true
        return (GroupManager.instance.groups?.[group_name] && GroupManager.instance.groups[group_name].has(parseInt(node_id)))
    }

    static any_groups() { return (Object.keys(GroupManager.instance.groups).length > 0) }
}

Object.defineProperty(GroupManager, "instance", {
    get : () => {
        if (!GroupManager._instance) GroupManager._instance = new GroupManager()
        return GroupManager._instance
    }
})