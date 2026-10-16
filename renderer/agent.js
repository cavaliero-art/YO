(function (Y) {
  'use strict';

  // The page's side of YO's hands: it only asks the main process (main/agent.js), which checks
  // and runs everything. In a plain browser (no Electron) the demo agent stands in.
  function create(emit) {
    const api = window.yo;
    if (!api || !api.run) return Y.mockAgent.create(emit);
    api.onAgent((event) => emit(event));
    return {
      send: (text, id) => api.run({ text, id: id || null }),
      respond: (id, decision) => api.respond(id, decision),
      stop: () => api.stopAgent(),
    };
  }

  // what "open <something>" could mean: folders, a site, installed apps
  function suggestOpen(arg) {
    const api = window.yo;
    if (!api || !api.suggestOpen) return Promise.resolve([]);
    return api.suggestOpen(arg).catch(() => []);
  }

  Y.agent = { create, suggestOpen };
})((window.Yo = window.Yo || {}));
