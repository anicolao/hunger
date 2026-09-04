package com.anicolao.hunger

internal val NATIVE_BOOTSTRAP = """
    (() => {
      if (globalThis.hungerNative) return;
      const rawHandler = globalThis.$BRIDGE_NAME;
      if (!rawHandler) return;
      const pending = new Map();
      rawHandler.onmessage = (event) => {
        let reply;
        try { reply = JSON.parse(event.data); } catch { return; }
        const request = pending.get(reply?.id);
        if (!request || typeof reply.ok !== 'boolean') return;
        pending.delete(reply.id);
        if (reply.ok) request.resolve(reply.value);
        else {
          const error = new Error(reply.error?.message ?? 'The native request failed.');
          error.code = reply.error?.code ?? 'native_error';
          request.reject(error);
        }
      };
      const request = (command, payload = {}) => new Promise((resolve, reject) => {
        const id = globalThis.crypto?.randomUUID?.() ?? `request-${'$'}{Date.now()}-${'$'}{Math.random()}`;
        pending.set(id, { resolve, reject });
        try { rawHandler.postMessage(JSON.stringify({ version: 1, id, command, payload })); }
        catch (error) { pending.delete(id); reject(error); }
      });
      Object.defineProperty(globalThis, 'hungerNative', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({ request })
      });
    })();
""".trimIndent()
