# Capturing changes

|Change|code|detection|response|
|-|-|-|-|
|Node created|controller.js|nodeCreated|UpdateController|
|Node destroyed|controller.js|node_Created adds to onRemove|UpdateController|
|Input change|controller.js|beforeRegisterNodeDef|ControllerPanel.node_change|
|Mode change|controller.js|beforeRegisterNodeDef|ControllerPanel.node_change|
|Imgs changed|controller.js|nodeCreated adds to onDrawForeground|ImageManager.node_img_change|
|Definitions refreshed|controller.js|refreshComboInNodes|UpdateController|
|Dialog boxes|controller.js|setup, MutationObserver|UpdateController|
|Focus mode|controller.js|setup, MutationObserver|ControllerPanel.focus_mode_changed|
|read_only|controller.js|setup, hijack of read_only|UpdateController|
|load|controller.js|afterConfigureGraph|ControllerPanel.new_workflow|
|node inclusion|node_inclusion.js|cp_callback_submenu|UpdateController|
|title, color, group membership|controller.js|UpdateController.on_change|