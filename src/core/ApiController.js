function uid(prefix='req'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

export class ApiController {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || null;
    this.mode = options.mode || 'demo'; // demo | local | remote
    this.adapters = new Map();
    this.middlewares = [];
    this.headers = options.headers || {};
    this.timeoutMs = options.timeoutMs || 30000;
  }

  registerAdapter(name, fn) { this.adapters.set(name, fn); }
  use(mw) { if (typeof mw === 'function') this.middlewares.push(mw); }

  configure({ baseUrl, mode, headers, timeoutMs } = {}) {
    if (baseUrl !== undefined) this.baseUrl = baseUrl;
    if (mode !== undefined) this.mode = mode;
    if (headers !== undefined) this.headers = headers;
    if (timeoutMs !== undefined) this.timeoutMs = timeoutMs;
    return { baseUrl: this.baseUrl, mode: this.mode };
  }

  _resp(ok, data, error=null, meta={}) { return { ok, data, error, meta: { at: new Date().toISOString(), requestId: uid(), ...meta } }; }

  async request(method, path, body=null, options={}) {
    const ctx = { method, path, body, options };
    for (const mw of this.middlewares) await mw(ctx);

    if (options.adapter && this.adapters.has(options.adapter)) {
      try { return this._resp(true, await this.adapters.get(options.adapter)(ctx), null, { adapter: options.adapter }); }
      catch (e) { return this._resp(false, null, { code:'ADAPTER_ERROR', message: e.message }, { adapter: options.adapter }); }
    }

    if (!this.baseUrl || this.mode === 'demo' || (this.mode === 'local' && !options.forceRemote)) {
      return this._resp(false, null, { code:'SERVICE_UNAVAILABLE', message:'Nenhum backend/provedor conectado. Configure endpoint externo ou use processamento local compatível.', contract:{ method, path } }, { mode:this.mode, hosting:'static' });
    }

    const url = this.baseUrl.replace(/\/$/,'') + path;
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { 'Accept':'application/json', ...(body?{'Content-Type':'application/json'}:{}), ...this.headers, ...(options.headers||{}) }, body: body?JSON.stringify(body):undefined, signal: ctrl.signal });
      clearTimeout(t);
      const text = await res.text();
      let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (!res.ok) return this._resp(false, null, { code:`HTTP_${res.status}`, message: data?.message || res.statusText, details:data }, { status: res.status });
      return this._resp(true, data, null, { status: res.status });
    } catch (e) {
      clearTimeout(t);
      return this._resp(false, null, { code: e.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR', message: e.message }, { url });
    }
  }

  get(p,o){return this.request('GET',p,null,o)}
  post(p,b,o){return this.request('POST',p,b,o)}
  put(p,b,o){return this.request('PUT',p,b,o)}
  del(p,o){return this.request('DELETE',p,null,o)}

  getContract() {
    const ns = ['system','models','metadata','quantization','generators','frames','images','videos','engines','repack','tools','users','permissions','config','jobs','storage'];
    return { base:'/api/v1', namespaces: ns.map(n=>`/api/v1/${n}/`) };
  }
}

export default ApiController;
