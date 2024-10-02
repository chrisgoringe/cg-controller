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
- If you change colors or widgets or names, use 'Update Controller Panel'
- To update the controller (it's under development...)
```
cd custom_nodes/cg-controller
git pull
```
 
## Limitations

Doesn't work with image upload (yet)

## Bugs or ideas

Raise them as [issues](https://github.com/chrisgoringe/cg-controller/issues)