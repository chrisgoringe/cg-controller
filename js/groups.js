import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"
import { Colors, Texts } from "./constants.js"
import { mode_change } from "./utilities.js"
import { Debug } from "./debug.js"

function selected_groups_and_childgroups() {
    const sgac = Set()
    function add_groups_recursively(g) {
        sgac.add(g)
        Array.from(g.children).filter((c)=>(c instanceof LGraphGroup)).forEach((c)=>{add_groups_recursively(c)})
    }
    app.graph._nodes.filter((g)=>(g.selected)).forEach((g)=>{add_groups_recursively(g)})
    add_groups_recursively()
    return sgac
}

export class GroupManager {
    static _instance = null
    constructor() {
        this.groups = {}  // maps group name to Set of node ids
        const ungrouped = new Set()
        const selected = selected_groups_and_childgroups()
        app.graph._nodes.forEach((node)=>{
            if (NodeInclusionManager.node_includable(node)) ungrouped.add(node.id)
        })
        this.colors = {}  // maps group name to color
        app.graph._groups.forEach((group) => {
            if (!group.graph) {
                group.graph = app.graph
            }
            if (!selected.has(group)) group.recomputeInsideNodes()
            else Debug.trivia(`Not updating group ${group.title} because it is selected`)
            group._nodes.forEach((node) => {
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

        this.jsoned = JSON.stringify(this)
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