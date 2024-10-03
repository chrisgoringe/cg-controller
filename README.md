# Controller

The controller is a floating panel which reproduces widget inputs from all the red nodes in your workflow. That's pretty much it.

So you can use Comfy with it looking like this:

![basic](images/basic.png)

When the workflow really looks like this:

![ugly](images/ugly.png)

## How to use

- Install the custom node
```
cd custom_nodes
git clone https://github.com/chrisgoringe/cg-controller
```
- Set the nodes in your workflow you want to see the widgets from to be red
- Right-click the canvas and select 'Show Controller Panel'

## Anything else?

- You can make nodes brown to designate them as advanced controls
- If you change colors or widgets or names, use the 'Update Controller Panel' canvas menu (to be fixed  - issue #9)
- To update the controller code (will add to manager - issue #14)
```
cd custom_nodes/cg-controller
git pull
```

## Bugs or ideas

Raise them as [issues](https://github.com/chrisgoringe/cg-controller/issues)

## Release history

### v0.2 3/10/2024

- Preserve height of resized text areas
- Close panel when workflow cleared
- Cleaned up the layout when multi column

### v0.1 2/10/2024

- Added support for Image nodes
- Added 'advanced' colour

### v0.0.9 1/10/2024

- Initial release