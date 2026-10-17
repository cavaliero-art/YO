(function (Y) {
  'use strict';

  // Mini apps: small tools that open inside the pill (Translate, Calculator, To-do...).
  // Each file in renderer/apps/ calls define(id, mount). app.js gives every app the same frame
  // (header with YO, Back and Close) and calls mount(host) the first time it opens.
  //   mount(host) -> { root, open(seed), escape?() -> handled, drop?(text) -> handled, close?() }
  //   live: what an app shows on its home tile while it runs (live.focus(), live.todoToday(tasks))
  //   host: { t, bridge, copy(text), toast(text), react(move), sound(name), close() }
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

  // ---------- motion the apps share: short, only when something changes, none with "reduce motion" ----------
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  const still = () => calm.matches;
  const EASE = 'cubic-bezier(.3, .9, .3, 1)';
  const SPRING = 'cubic-bezier(.2, 1.4, .4, 1)';

  // a little bounce: a count that changed, a dot that filled
  function pop(node, size) {
    if (still() || !node) return;
    node.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + (size || 1.35) + ')' }, { transform: 'scale(1)' }], { duration: 320, easing: SPRING });
  }

  // a node travels toward another (a done task toward the Done tab) and fades; resolves when it's there,
  // with the animation (cancel() puts the node back)
  function fly(node, target, ms, scale) {
    if (still() || !node || !target) return Promise.resolve(null);
    const a = node.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const k = a.width / node.offsetWidth || 1; // the pill's size setting zooms everything
    const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / k;
    const dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / k;
    const move = node.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + (scale || 0.4) + ')', opacity: 0 },
    ], { duration: ms || 380, easing: EASE, fill: 'forwards' });
    return move.finished.then(() => move, () => move);
  }

  // the opposite of fly: a node arrives from where something else is (an answer lands in History)
  function land(node, source, ms) {
    if (still() || !node || !source) return;
    const a = node.getBoundingClientRect();
    const b = source.getBoundingClientRect();
    const k = a.width / node.offsetWidth || 1;
    const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / k;
    const dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / k;
    node.animate([
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.7)', opacity: 0.2 },
      { transform: 'none', opacity: 1 },
    ], { duration: ms || 380, easing: EASE });
  }

  // new text rolls up in place of the old (a result, a time left)
  function roll(node, text) {
    if (node.textContent === text) return;
    node.textContent = text;
    if (still()) return;
    node.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: EASE });
  }

  Y.miniapps = { define, get: (id) => APPS[id] || null, h, button, live: {}, still, pop, fly, land, roll, EASE, SPRING };
})((window.Yo = window.Yo || {}));
