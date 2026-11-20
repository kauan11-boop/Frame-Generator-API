/**
 * Frame-Generator-API SDK (static-first, adapter-aware)
 * - Descobre endpoints em /api/v1/index.json
 * - Cache por ETag/version e auto-sync por polling (manifests autoajustáveis)
 * - Despacho de comandos em envelope JSON (schemas/command.schema.json)
 * - Leitura estática no GitHub Pages; escrita/execução via adapter configurado
 */

const DEFAULT_POLL_MS = 60000;

function rid(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class FrameGeneratorAPI {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || '.').replace(/\/$/, '');
    this.adapterUrl = options.adapterUrl ? options.adapterUrl.replace(/\/$/, '') : null;
    this.adapterId = options.adapterId || 'adapter-static-readonly';
    this.auth = options.auth || { mode: 'none' };
    this.client = options.client || { name: 'frame-api-sdk', version: '1.0.0' };
    this.pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_MS;
    this.discovery = null;
    this.cache = new Map(); // key -> { etag, version, data }
    this.listeners = new Set();
    this._timer = null;
  }

  _url(path) {
    if (!path) return this.baseUrl;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}/${path.replace(/^\//, '')}`;
  }

  async _fetchJson(path, { method = 'GET', body, headers = {}, useAdapter = false } = {}) {
    const base = useAdapter && this.adapterUrl ? this.adapterUrl : this.baseUrl;
    const url = /^https?:\/\//i.test(path) ? path : `${base}/${path.replace(/^\//, '')}`;
    const res = await fetch(url, {
      method,
      headers: { 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${url}`);
      err.status = res.status; err.body = json; throw err;
    }
    return { json, etag: res.headers.get('etag'), status: res.status };
  }

  async discover(force = false) {
    if (this.discovery && !force) return this.discovery;
    const { json } = await this._fetchJson('api/v1/index.json');
    this.discovery = json;
    return json;
  }

  async getResource(key, force = false) {
    const d = await this.discover();
    const path = d.endpoints?.[key] || key;
    if (!force && this.cache.has(key)) return this.cache.get(key).data;
    const { json, etag } = await this._fetchJson(path);
    this.cache.set(key, { etag: etag || json.etag, version: json.version, updated_at: json.updated_at, data: json });
    return json;
  }

  async listModels(force = false) { return this.getResource('models', force); }
  async listFrames(force = false) { return this.getResource('frames', force); }
  async listFrameTemplates(force = false) { return this.getResource('frame_templates', force); }
  async listPackages(force = false) { return this.getResource('packages', force); }
  async listCommands(force = false) { return this.getResource('commands', force); }
  async getRepack(force = false) { return this.getResource('repack', force); }
  async listAdapters(force = false) { return this.getResource('adapters', force); }
  async getSystemStatus(force = false) { return this.getResource('system_status', force); }
  async getIntegrationPrompt(force = false) { return this.getResource('integration_prompt', force); }

  envelope(command, payload = {}, meta = {}) {
    return {
      command,
      request_id: meta.request_id || rid('req'),
      client: this.client,
      auth: meta.auth || this.auth,
      meta: { dry_run: !!meta.dry_run, trace: !!meta.trace, idempotency_key: meta.idempotency_key },
      payload
    };
  }

  isWriteCommand(commandName, commandsIndex) {
    const def = (commandsIndex?.commands || []).find(c => c.name === commandName);
    if (!def) return true; // desconhecido -> tratar como sensível
    return def.scope !== 'read' || !(def.transport || []).includes('static');
  }

  async sendCommand(command, payload = {}, meta = {}) {
    const cmdIndex = await this.listCommands().catch(() => null);
    const allowed = cmdIndex?.commands?.some(c => c.name === command);
    if (cmdIndex?.enforce?.allowlist && !allowed) {
      throw new Error(`Comando não allowlisted: ${command}`);
    }
    const write = this.isWriteCommand(command, cmdIndex);
    const env = this.envelope(command, payload, meta);

    // Leitura estática: resolver por recursos conhecidos
    if (!write) {
      return this._handleStaticRead(command, payload, env);
    }
    if (!this.adapterUrl) {
      throw new Error(`Comando '${command}' requer adapter/backend (configure adapterUrl).`);
    }
    const { json } = await this._fetchJson('/commands/execute', { method: 'POST', body: env, useAdapter: true });
    return json;
  }

  async _handleStaticRead(command, payload, env) {
    const map = {
      'system.status': () => this.getSystemStatus(true),
      'models.list': () => this.listModels(true),
      'models.get': async () => {
        const m = await this.listModels(true);
        return (m.models || []).find(x => x.id === payload.id) || null;
      },
      'packages.list': () => this.listPackages(true),
      'repack.status': () => this.getRepack(true),
      'sync.manifest': async () => this._manifestSnapshot(payload.resources)
    };
    const fn = map[command];
    if (!fn) throw new Error(`Leitura estática não suportada para '${command}'. Use um adapter.`);
    const data = await fn();
    return { ok: true, request_id: env.request_id, command, data, error: null, meta: { source: 'static' } };
  }

  async _manifestSnapshot(resources) {
    const keys = resources && resources.length ? resources : ['models','frames','packages','commands','repack','adapters','system_status'];
    const snap = {};
    for (const k of keys) {
      const d = await this.getResource(k, true).catch(() => null);
      if (d) snap[k] = { version: d.version, updated_at: d.updated_at, etag: d.etag };
    }
    return snap;
  }

  async syncOnce(resources) {
    const keys = resources && resources.length ? resources : ['models','frames','packages','commands','repack','adapters','system_status'];
    const changes = [];
    for (const k of keys) {
      const prev = this.cache.get(k);
      const d = await this.getResource(k, true).catch(() => null);
      if (!d) continue;
      const curSig = `${d.version}|${d.etag}|${d.updated_at}`;
      const prevSig = prev ? `${prev.version}|${prev.etag}|${prev.updated_at}` : null;
      if (prevSig && prevSig !== curSig) changes.push({ resource: k, previous: prevSig, current: curSig, data: d });
    }
    if (changes.length) this.listeners.forEach(fn => { try { fn(changes, this); } catch {} });
    return changes;
  }

  onUpdate(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  startAutoSync(resources) {
    this.stopAutoSync();
    this._timer = setInterval(() => { this.syncOnce(resources); }, this.pollIntervalMs);
    return () => this.stopAutoSync();
  }

  stopAutoSync() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

  // Helpers de alto nível
  async createFrameJob(job, meta = {}) { return this.sendCommand('frames.create', job, meta); }
  async inspectGguf(source_uri, mode = 'kv', meta = {}) { return this.sendCommand('models.inspect_gguf', { source_uri, mode }, meta); }
  async planRepack(target = 'api/v1', options = {}, meta = {}) { return this.sendCommand('repack.plan', { target, ...options }, meta); }
}

export default FrameGeneratorAPI;
