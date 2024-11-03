import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"
import { Colors, Texts } from "./constants.js"

export class GroupManager {
    static instance = null
    constructor() {
        this.groups = {}
        const ungrouped = new Set()
        app.graph._nodes.forEach((node)=>{
            if (NodeInclusionManager.node_includable(node)) ungrouped.add(node.id)
        })
        this.colors = {}
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
        this.groups[Texts.UNGROUPED] = ungrouped
    }

    static setup() { GroupManager.instance = new GroupManager() }

    static list_group_names() {
        const names = [Texts.ALL_GROUPS]
        Object.keys(GroupManager.instance.groups).forEach((gp) => {names.push(gp)})
        return names
    }

    static group_color(group_name) {
        return GroupManager.instance.colors[group_name] ?? Colors.DARK_BACKGROUND
    }

    static is_node_in(group_name, node_id) {
        if (group_name==Texts.ALL_GROUPS) return true
        return (GroupManager.instance.groups[group_name] && GroupManager.instance.groups[group_name].has(parseInt(node_id)))
    }

    static any_groups() { return (Object.keys(GroupManager.instance.groups).length > 0) }

    static valid_option(group_name) {
        if (group_name && GroupManager.instance.groups[group_name]) return group_name
        return Texts.ALL_GROUPS
    }
}