(function (Y) {
  'use strict';

  // Calculator: type or tap; the answer shows as you go, Enter keeps it in the history.
  // Uses YO's own math parser (renderer/quick.js), so typed text is never run as code.
  // It also understands the quick answers: "20% of 150", "5 km in miles", "100 f to c".
  const { h, button } = Y.miniapps;
  const KEY = 'yo.calc';
  const MAX = 20;
  // [shown, inserted]: what the key shows and what it puts in the box
  const PAD = [
    ['C', 'clear'], ['⌫', 'back'], ['%', '%'], ['÷', ' ÷ '],
    ['7'], ['8'], ['9'], ['×', ' × '],
    ['4'], ['5'], ['6'], ['−', ' − '],
    ['1'], ['2'], ['3'], ['+', ' + '],
    ['('], ['0'], ['.'], [')'],
  ];

  const tidy = (v) => String(Number(v.toPrecision(12)));

  function solve(expr) {
    const src = expr.replace(/−/g, '-').trim();
    if (!src) return null;
    const v = Y.quick.evaluate(src);
    if (v !== null) return { value: tidy(v) };
    const found = Y.quick.answer(src);
    return found ? { value: found.rows[0].value, note: found.rows[0].label } : null;
  }

  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter((e) => e && typeof e.expr === 'string' && typeof e.value === 'string') : [];
    } catch (err) {
      return [];
    }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (err) { /* not kept */ }
  }

  function mount(host) {
    const { t } = host;
    let history = load();

    const input = h('input.calc-in', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('app.calc.placeholder'), 'aria-label': t('cmd.calc') });
    const out = h('span.calc-val');
    const note = h('span.calc-note');
    const copy = button('btn small calc-copy', t('copy'), () => { if (out.dataset.value) host.copy(out.dataset.value); });
    const list = h('div.calc-list');
    const clear = button('link calc-clear', t('app.calc.clear'), () => {
      history = [];
      save(history);
      drawHistory();
      host.sound('tick');
    });

    const pad = h('div.calc-pad');
    PAD.forEach(([label, insert]) => {
      const kind = insert === 'clear' || insert === 'back' ? 'fn' : /[÷×−+%]/.test(label) ? 'op' : 'num';
      pad.append(button('ckey ' + kind, label, () => press(insert || label)));
    });
    pad.append(button('ckey eq', '=', commit));

    const root = h('div.calc',
      h('div.calc-main',
        h('div.calc-screen', input, h('div.calc-res', h('span.calc-eq', { text: '=' }), out, note, copy)),
        pad),
      h('div.calc-side', h('div.side-head', h('span.olabel', { text: t('app.calc.history') }), clear), list));

    function update() {
      const r = solve(input.value);
      out.textContent = r ? r.value : '';
      out.dataset.value = r ? r.value : '';
      note.textContent = r && r.note ? r.note : '';
      root.classList.toggle('has-result', Boolean(r));
    }

    // a key from the pad goes where the caret is
    function press(insert) {
      if (insert === 'clear') input.value = '';
      else if (insert === 'back') {
        const at = input.selectionStart === input.selectionEnd ? input.selectionStart : null;
        if (at === null) input.setRangeText('');
        else if (at > 0) {
          const cut = /\s[÷×−+]\s$/.test(input.value.slice(0, at)) ? 3 : 1; // an operator and its spaces go together
          input.setRangeText('', at - cut, at, 'end');
        }
      } else {
        input.setRangeText(insert, input.selectionStart, input.selectionEnd, 'end');
      }
      input.focus();
      update();
      host.sound('tick');
    }

    // Enter: keep it in the history, and carry on from the answer
    function commit() {
      const expr = input.value.trim();
      const r = solve(expr);
      if (!r) {
        if (expr) {
          host.toast(t('app.calc.bad'));
          host.sound('info');
        }
        return;
      }
      if (expr !== r.value) {
        history = [{ expr, value: r.value }].concat(history.filter((e) => e.expr !== expr)).slice(0, MAX);
        save(history);
        drawHistory();
      }
      input.value = r.value;
      update();
      host.react('success');
      host.sound('tick');
    }

    function drawHistory() {
      if (!history.length) {
        list.replaceChildren(h('div.side-empty', { text: t('app.calc.empty') }));
        clear.hidden = true;
        return;
      }
      clear.hidden = false;
      list.replaceChildren(...history.map((e) => button('calc-item', '', () => {
        input.setRangeText(e.value, input.selectionStart, input.selectionEnd, 'end');
        input.focus();
        update();
      }, { title: e.expr + ' = ' + e.value })));
      Array.from(list.children).forEach((node, i) => {
        node.append(h('span.ci-expr', { text: history[i].expr }), h('span.ci-val', { text: history[i].value }));
      });
    }

    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'c' && event.ctrlKey && input.selectionStart === input.selectionEnd && out.dataset.value) {
        event.preventDefault(); // nothing selected: Ctrl+C copies the answer
        host.copy(out.dataset.value);
      }
    });

    drawHistory();
    return {
      root,
      open(seed) {
        if (seed) input.value = seed;
        update();
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }, 60);
      },
      drop(text) {
        input.value = text.slice(0, 200);
        update();
        return true;
      },
    };
  }

  Y.miniapps.define('calc', mount);
  Y.miniapps.solveCalc = solve; // for tests
})((window.Yo = window.Yo || {}));
