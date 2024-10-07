import { app } from "../../scripts/app.js"

export class GroupManager {
    static instance = null
    static show_all = "All"
    constructor(c1,c2) {
        this.groups = {}
        app.graph._groups.forEach((group) => {
            group.recomputeInsideNodes()
            group._nodes.forEach((node) => {
                if (node.color==c1 || node.color==c2) {
                    if (!this.groups[group.title]) this.groups[group.title] = new Set()
                    this.groups[group.title].add(node.id)
                }
            })
        })
    }

    static setup( c1, c2 ) { GroupManager.instance = new GroupManager(c1,c2) }

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