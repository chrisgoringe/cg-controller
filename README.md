# Controller

The controller is a floating panel which reproduces widget inputs from selected nodes. That's pretty much it.

## How to use

- Install the custom node
```
cd custom_nodes
git clone https://github.com/chrisgoringe/cg-controller
```
- Right click a node and use the Controller Panel menu to set a node to be included, excluded, or included as an advanced control
- Right-click the canvas and select 'Show Controller Panel'

## Options

In the main comfy menu there are some options:

### Show control after generate

By default the control_after_generate widget (attached to seeds and int primitives) is hidden. You can choose to show it.

### Toggle controller visibility

You can choose one of four keyboard shortcuts to make the controller appear or disappear, or set it to none. Default is `c`.

### Sliders

*This is going away soon, so don't get into it!*

In the settings menu you will find three controls, `Override step size`, `Override min values` and `Override max values`. Each of these has the same format, which is a comma separated list of overrides, each of which is either `widget_name=value` (applies to all matching widgets) or `node_name:widget_name=value` (only applies if both node and widget names match).

Using `Override max values` (and maybe `Override min values`) will allow you to make the sliders a lot more usable in `When possible` mode; using `Override step size` 
can make sliders appear in `When exact` mode. 

The definition used for `When exact` is `(max-min)/step <= 200`

## Updating

- To update the controller code (if you haven't added it via the manager)
```
cd custom_nodes/cg-controller
git pull
```

## Bugs or ideas

Raise them as [issues](https://github.com/chrisgoringe/cg-controller/issues)

## Release history

### v0.9

- Removed colour based controls and replaced with right click menu
- Lots of aesthetics

### v0.8 9/10/2024

- Allow image nodes to be rescaled down
- Drag handle for rearranging
- Visual improvements
- Much nicer sliders

### v0.7 7/10/2024

- Image upload image updates
- Drag and drop images onto image upload
- Drag and drop to reorder nodes in the controller
- Controller update automated 
- Settings to choose color for control nodes and advanced control nodes

### v0.6 6/10/2024

- Added group selector
- Fixed positioning etc with new menu system 

### v0.5 5/10/2024

- Better controls for sliders (target by node, override min and step)
- hide control_after_generate
- submit to registry

### v0.4 4/10/2024

- Added keyboard shortcuts
- Added sliders

### v0.3 3/10/2024

- Updating the panel now picks up changes in widgets and colors 
- Title changes now picked up
- Node order preserved in cases where it was lost

### v0.2 3/10/2024

- Preserve height of resized text areas
- Close panel when workflow cleared
- Cleaned up the layout when multi column
- Submitted to Comfy Manager

### v0.1 2/10/2024

- Added support for Image nodes
- Added 'advanced' colour

### v0.0.9 1/10/2024

- Initial release