export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       nd.classList.add(clss);
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}