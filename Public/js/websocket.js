// Browser WebSocket utility with optional auth/code support (client-side only).

function safeJsonParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false, value: text }; }
}

export class WebSocketClient {
  constructor(options = {}) {
    this.url = options.url || null;
    this.code = options.code || '';
    this.protocols = Array.isArray(options.protocols) ? options.protocols : undefined;
    this.autoReconnect = !!options.autoReconnect;
    this.reconnectDelayMs = Math.max(500, Number(options.reconnectDelayMs) || 2000);
    this.maxReconnectAttempts = Math.max(0, Number(options.maxReconnectAttempts) || 5);
    this.attachCodeAsQuery = options.attachCodeAsQuery !== false; // default true when code provided
    this.queryParam = options.queryParam || 'code';
    this.ws = null;
    this.state = 'disconnected'; // disconnected|connecting|open|closing|error
    this.attempts = 0;
    this.manualClose = false;
    this.listeners = new Map();
    this.history = [];
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this.listeners.get(event)?.delete(fn); }
  emit(event, payload) {
    for (const fn of (this.listeners.get(event) || [])) {
      try { fn(payload); } catch {}
    }
  }

  _log(entry) {
    const item = { at: new Date().toISOString(), ...entry };
    this.history.push(item);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    this.emit('log', item);
  }

  _setState(state, detail = null) {
    this.state = state;
    this.emit('state', { state, detail, url: this.url });
  }

  buildUrl() {
    if (!this.url) return null;
    let u;
    try { u = new URL(this.url); } catch { return this.url; }
    if (this.code && this.attachCodeAsQuery) {
      try { u.searchParams.set(this.queryParam, this.code); } catch {}
    }
    return u.toString();
  }

  configure({ url, code, protocols, autoReconnect, reconnectDelayMs, maxReconnectAttempts, attachCodeAsQuery, queryParam } = {}) {
    if (url !== undefined) this.url = url || null;
    if (code !== undefined) this.code = code || '';
    if (protocols !== undefined) this.protocols = Array.isArray(protocols) ? protocols : undefined;
    if (autoReconnect !== undefined) this.autoReconnect = !!autoReconnect;
    if (reconnectDelayMs !== undefined) this.reconnectDelayMs = Math.max(500, Number(reconnectDelayMs) || 2000);
    if (maxReconnectAttempts !== undefined) this.maxReconnectAttempts = Math.max(0, Number(maxReconnectAttempts) || 5);
    if (attachCodeAsQuery !== undefined) this.attachCodeAsQuery = !!attachCodeAsQuery;
    if (queryParam !== undefined) this.queryParam = queryParam || 'code';
    return this.getStatus();
  }

  connect() {
    if (typeof WebSocket === 'undefined') {
      const err = { code: 'UNSUPPORTED', message: 'WebSocket não suportado neste navegador.' };
      this._setState('error', err);
      this._log({ level: 'error', message: err.message });
      return { ok: false, state: 'unsupported', error: err };
    }
    const target = this.buildUrl();
    if (!target) {
      const err = { code: 'INVALID_URL', message: 'Informe uma URL WebSocket válida (ws:// ou wss://).' };
      this._setState('error', err);
      this._log({ level: 'error', message: err.message });
      return { ok: false, state: 'invalid', error: err };
    }
    try {
      this.disconnect(false);
      this.manualClose = false;
      this._setState('connecting');
      this.ws = this.protocols && this.protocols.length ? new WebSocket(target, this.protocols) : new WebSocket(target);
    } catch (e) {
      const err = { code: 'CONNECT_FAILED', message: e?.message || String(e) };
      this._setState('error', err);
      this._log({ level: 'error', message: err.message, detail: { target } });
      return { ok: false, state: 'error', error: err };
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this._setState('open');
      this._log({ level: 'ok', message: 'Conexão WebSocket aberta.', detail: { target } });
      // Optional auth message when code is provided (without forcing protocol semantics)
      if (this.code) {
        try { this.ws.send(JSON.stringify({ type: 'auth', code: this.code })); this._log({ level: 'info', message: 'Mensagem de autenticação (type=auth, code) enviada (opcional).' }); } catch {}
      }
    };
    this.ws.onmessage = (ev) => {
      const parsed = typeof ev.data === 'string' ? safeJsonParse(ev.data) : { ok: true, value: ev.data };
      this._log({ level: 'info', message: 'Mensagem recebida.', detail: { parsed: parsed.ok, preview: typeof ev.data === 'string' ? ev.data.slice(0, 500) : '[binário/objeto]' } });
      this.emit('message', { raw: ev.data, parsed: parsed.ok ? parsed.value : null, text: typeof ev.data === 'string' ? ev.data : null });
    };
    this.ws.onerror = () => {
      this._setState('error', { code: 'SOCKET_ERROR', message: 'Erro na conexão WebSocket (detalhes dependem do navegador/servidor).' });
      this._log({ level: 'error', message: 'Erro na conexão WebSocket.' });
    };
    this.ws.onclose = (ev) => {
      const wasManual = this.manualClose;
      this._setState('disconnected', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      this._log({ level: 'warn', message: `Conexão encerrada (code=${ev.code}${ev.reason ? ', reason=' + ev.reason : ''}).` });
      this.ws = null;
      if (!wasManual && this.autoReconnect && this.attempts < this.maxReconnectAttempts) {
        this.attempts += 1;
        this._log({ level: 'info', message: `Tentativa de reconexão ${this.attempts}/${this.maxReconnectAttempts} em ${this.reconnectDelayMs}ms.` });
        setTimeout(() => { if (!this.manualClose) this.connect(); }, this.reconnectDelayMs);
      }
    };

    return { ok: true, state: 'connecting', url: target };
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const err = { code: 'NOT_CONNECTED', message: 'WebSocket não está conectado.' };
      this._log({ level: 'error', message: err.message });
      return { ok: false, state: this.state, error: err };
    }
    try {
      const payload = (typeof data === 'string') ? data : JSON.stringify(data);
      this.ws.send(payload);
      this._log({ level: 'info', message: 'Mensagem enviada.', detail: { preview: payload.slice(0, 500) } });
      return { ok: true, state: 'sent' };
    } catch (e) {
      const err = { code: 'SEND_FAILED', message: e?.message || String(e) };
      this._log({ level: 'error', message: err.message });
      return { ok: false, state: 'error', error: err };
    }
  }

  disconnect(manual = true) {
    this.manualClose = !!manual;
    if (this.ws) {
      try { this._setState('closing'); this.ws.close(); } catch {}
    } else {
      this._setState('disconnected');
    }
    return { ok: true, state: this.state };
  }

  getStatus() {
    return {
      state: this.state,
      url: this.url,
      effectiveUrl: this.buildUrl(),
      hasCode: !!this.code,
      autoReconnect: this.autoReconnect,
      attempts: this.attempts,
      readyState: this.ws ? this.ws.readyState : null,
    };
  }

  getHistory(limit = 50) {
    return this.history.slice(-Math.max(0, limit));
  }
}

export function createWebSocketClient(options = {}) {
  return new WebSocketClient(options);
}
