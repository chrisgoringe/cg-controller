import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"
import { Colors, Texts } from "./constants.js"

export class GroupManager {
    static instance = null
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
            group.recomputeInsideNodes()
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
    }

    static setup() { GroupManager.instance = new GroupManager() }

    static list_group_names() {
        const names = [Texts.ALL_GROUPS,]
        Object.keys(GroupManager.instance.groups).forEach((gp) => {names.push(gp)})
        return names
    }

    static group_color(group_name) {
        return GroupManager.instance.colors[group_name] ?? Colors.DARK_BACKGROUND
    }

    static bypassed(group_name) {
        var any = false
        var all = true
        app.graph._groups.forEach((group) => {
            if (group.title == group_name) {
                group._nodes.forEach((node) => {
                    any = any || (node.mode!=0)
                    all = all && (node.mode!=0)
                })
            }
        })
        return {"any":any, "all":all}
    }

    static is_node_in(group_name, node_id) {
        if (group_name==Texts.ALL_GROUPS) return true
        return (GroupManager.instance.groups?.[group_name] && GroupManager.instance.groups[group_name].has(parseInt(node_id)))
    }

    static any_groups() { return (Object.keys(GroupManager.instance.groups).length > 0) }
}