import { app } from "../../scripts/app.js"
import { NodeInclusionManager } from "./node_inclusion.js"
import { Colors, Texts, DisplayNames } from "./constants.js"
import { mode_change, pickContrastingColor, darken } from "./utilities.js"
import { Debug } from "./debug.js"

function recompute_safely(group) {
    const _g = [...group._nodes]
    const _c = new Set(group._children)
    group.recomputeInsideNodes()
    group._controller_nodes = [...group._nodes]
    group._controller_children = new Set(group._children)
    group._nodes = _g
    group._children = _c
    return group._controller_nodes
}

function recompute_all_safely() {
    app.graph._groups.forEach((g)=>{recompute_safely(g)})
}

export function family_names(group_name) {
    recompute_all_safely()
    /* Given the name of a group, return a list of the names of all parents and children of all groups with this name */
    const names = new Set([group_name,])
    app.graph._groups.filter((g)=>(g.title==group_name)).forEach((g)=>{
        Array.from(g._controller_children).filter((c)=>(c instanceof LGraphGroup)).forEach((c)=>{names.add(c.title)})
        app.graph._groups.filter((p)=>(p._controller_children.has(g))).forEach((p)=>{names.add(p.title)})
    })
    return names
}

export class GroupManager {
    static _instance = null
    static change_callback
    static group_properties = {}

    constructor() {
        this.groups = {}  // maps group name to Set of node ids
        const ungrouped = new Set()
        const favorites = new Set()
        app.graph._nodes.forEach((node)=>{
            if (NodeInclusionManager.node_includable(node)) ungrouped.add(node.id)
            if (NodeInclusionManager.favorite(node)) favorites.add(node.id)
        })
        if (favorites.size>0) this.groups[Texts.FAVORITES] = favorites
        this.colors = { }
        this.colors[Texts.FAVORITES] = Colors.FAVORITES_GROUP  // maps group name to color
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
        const group_titles = new Set()
        app.graph._groups.forEach((group) => {
            const id = parseInt(group.id)
            group_titles.add(group.title)
            if (GroupManager.group_properties[id]) {
                if (GroupManager.group_properties[id].color != group.color) {
                    GroupManager.change_callback?.(GroupManager.group_properties[id].title, {"color":group.color})
                    GroupManager.group_properties[id].color = group.color
                }
                if (GroupManager.group_properties[id].title != group.title) {
                    GroupManager.change_callback?.(GroupManager.group_properties[id].title, {"title":group.title})
                    GroupManager.group_properties[id].title = group.title
                }
            } else {
                GroupManager.group_properties[id] = {"color":group.color, "title":group.title}
            }
        })
        Object.keys(GroupManager.group_properties).filter((id)=>(!group_titles.has(GroupManager.group_properties[id].title))).forEach((id)=>{
            GroupManager.change_callback?.(GroupManager.group_properties[id].title, {"removed":true})
            delete GroupManager.group_properties[id]
        })

        const gm2 = new GroupManager()
        if (gm2.jsoned==GroupManager.instance.jsoned) return false
        GroupManager._instance = gm2
        return true
    }

    static displayName(group_name) {
        return DisplayNames[group_name] ?? group_name
    }

    static list_group_names() {
        const names = Object.keys(GroupManager.instance.groups)
        names.sort()
        names.unshift(Texts.ALL_GROUPS)
        return names
    }

    static group_bgcolor(group_name, selected) {
        var c = GroupManager.instance.colors[group_name] ?? Colors.DARK_BACKGROUND
        return selected ? c : darken(c, Colors.UNSELECTED_DARKEN)
    }

    static group_fgcolor(group_name, selected) {
        var c = (group_name==Texts.FAVORITES) ? Colors.FAVORITES_FG : 
            pickContrastingColor(GroupManager.group_bgcolor(group_name, selected),Colors.OPTIONS)
        return selected ? c : darken(c, Colors.UNSELECTED_DARKEN)
    }

    static normal_group(group_name) {
        return !(group_name==Texts.ALL_GROUPS || group_name==Texts.UNGROUPED || group_name==Texts.FAVORITES)
    }

    static group_node_mode(group_name) {
        const modes = {0:0,2:0,4:0}
        app.graph._groups.forEach((group) => {
            if (group.title == group_name) {
                recompute_safely(group).forEach((node) => {
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
                recompute_safely(group).forEach((node) => {
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