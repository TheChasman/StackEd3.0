(function () {
  if (window.__substackInjected) return;
  window.__substackInjected = true;
  const { listen, emit } = window.__TAURI__.event;
  listen('substack:request', async (event) => {
    const { id, method, url, body } = event.payload;
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== null && body !== undefined) {
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const resp = await fetch(url, opts);
      const text = await resp.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      emit('substack:response', {
        id,
        ok: resp.ok,
        status: resp.status,
        body: parsed,
      });
    } catch (err) {
      emit('substack:response', {
        id,
        ok: false,
        status: 0,
        body: { error: String(err) },
      });
    }
  });
})();
