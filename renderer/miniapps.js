(function (Y) {
  'use strict';

  // Mini apps: small tools that open inside the pill (Translate, Calculator, Clipboard...).
  // Each file in renderer/apps/ calls define(id, mount). app.js gives every app the same frame
  // (header with YO, Back and Close) and calls mount(host) the first time it opens.
  //   mount(host) -> { root, open(seed), escape?() -> handled, drop?(text) -> handled, close?() }
  //   host: { t, bridge, copy(text), toast(text), react(move), sound(name), close(), pasteBack(), recentCopy(ms) }
  const APPS = {};

  function define(id, mount) {
    APPS[id] = mount;
  }

  // a tiny element helper the apps share: h('div.calc-out', { title }, child, 'text', ...)
  function h(tag, props, ...children) {
    if (props instanceof Node || typeof props === 'string') {
      children.unshift(props); // no props, just children
      props = null;
    }
    const [name, ...classes] = tag.split('.');
    const node = document.createElement(name);
    if (classes.length) node.className = classes.join(' ');
    Object.keys(props || {}).forEach((key) => {
      const value = props[key];
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value; // static markup only (icons)
      else if (key in node && key !== 'list') node[key] = value;
      else node.setAttribute(key, value);
    });
    children.forEach((child) => {
      if (child !== null && child !== undefined && child !== false) node.append(child);
    });
    return node;
  }

  // a button that keeps focus where it was (the app's input)
  function button(cls, label, run, props) {
    const node = h('button.' + cls, Object.assign({ type: 'button', text: label }, props || {}));
    node.addEventListener('mousedown', (event) => event.preventDefault());
    node.addEventListener('click', run);
    return node;
  }

  function ago(at, now) {
    const s = Math.max(0, Math.round(((now || Date.now()) - at) / 1000));
    if (s < 45) return Y.i18n.t('app.clipboard.now');
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min';
    if (s < 86400) return Math.round(s / 3600) + ' h';
    return new Date(at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  Y.miniapps = { define, get: (id) => APPS[id] || null, h, button, ago };
})((window.Yo = window.Yo || {}));
