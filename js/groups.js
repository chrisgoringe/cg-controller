import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"

export class GroupManager {
    static instance = null
    static show_all = "All"
    constructor() {
        this.groups = {}
        app.graph._groups.forEach((group) => {
            group.recomputeInsideNodes()
            group._nodes.forEach((node) => {
                if (NodeInclusionManager.node_includable(node)) {
                    if (!this.groups[group.title]) this.groups[group.title] = new Set()
                    this.groups[group.title].add(node.id)
                }
            })
        })
    }

    static setup() { GroupManager.instance = new GroupManager() }

    static list_group_names() {
        const names = [GroupManager.show_all]
        Object.keys(GroupManager.instance.groups).forEach((gp) => {names.push(gp)})
        return names
    }

    static is_node_in(group_name, node_id) {
        if (group_name==GroupManager.show_all) return true
        return (GroupManager.instance.groups[group_name] && GroupManager.instance.groups[group_name].has(parseInt(node_id)))
    }

    static any_groups() { return (Object.keys(GroupManager.instance.groups).length > 0) }

    static valid_option(group_name) {
        if (group_name && GroupManager.instance.groups[group_name]) return group_name
        return GroupManager.show_all
    }
}