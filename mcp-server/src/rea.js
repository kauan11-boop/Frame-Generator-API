import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { reaTransportConfig, VERSION } from './config.js';

const EVIDENCE_RE = /ev_[0-9a-f]{64}/g;

let client = null;
let connection = null;
let catalog = null;
let catalogAt = 0;
const CATALOG_TTL_MS = 60_000;

async function ensureClient() {
  if (client) return client;
  if (connection) return connection;
  connection = (async () => {
    const cfg = reaTransportConfig();
    const [command, ...args] = cfg.command;
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...cfg.environment },
      stderr: 'pipe',
    });
    const instance = new Client(
      { name: 'fgua-rea-layer', version: VERSION },
      { capabilities: {}, requestTimeout: 120_000 },
    );
    await instance.connect(transport);
    client = instance;
    return instance;
  })().catch((error) => {
    connection = null;
    throw error;
  });
  return connection;
}

export function normalizeResult(result) {
  const parts = [];
  for (const item of result?.content || []) {
    if (item.type === 'text' && typeof item.text === 'string') parts.push(item.text);
    else if (item.type === 'resource' && typeof item.resource?.text === 'string') parts.push(item.resource.text);
  }
  const text = parts.join('\n');
  let data = null;
  try { data = JSON.parse(text); } catch { /* texto livre */ }
  const evidenceIds = [...new Set(text.match(EVIDENCE_RE) || [])];
  return { isError: Boolean(result?.isError), text, data, evidenceIds };
}

async function allTools() {
  const instance = await ensureClient();
  if (!catalog || Date.now() - catalogAt > CATALOG_TTL_MS) {
    const listed = await instance.listTools();
    catalog = (listed.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    }));
    catalogAt = Date.now();
  }
  return catalog;
}

export async function getCatalog({ query = '', limit = 50 } = {}) {
  const all = await allTools();
  const needle = String(query).toLowerCase().trim();
  const matches = needle
    ? all.filter((t) => t.name.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle))
    : all;
  return { total: all.length, matched: matches.length, tools: matches.slice(0, Math.min(limit, 200)) };
}

export async function callTool(tool, args = {}) {
  if (!tool || typeof tool !== 'string') throw new Error('tool é obrigatório');
  const instance = await ensureClient();
  const all = await allTools();
  if (!all.some((t) => t.name === tool)) {
    const suggestions = await getCatalog({ query: tool, limit: 5 });
    throw new Error(`Ferramenta REA desconhecida: ${tool}. Sugestões: ${suggestions.tools.map((t) => t.name).join(', ') || 'nenhuma'}`);
  }
  return normalizeResult(await instance.callTool({ name: tool, arguments: args || {} }));
}

export async function status() {
  try {
    const cfg = reaTransportConfig();
    const { total } = await getCatalog();
    return { available: true, toolCount: total, source: cfg.source, command: cfg.command };
  } catch (error) {
    return { available: false, toolCount: 0, error: error?.message || String(error) };
  }
}

export async function close() {
  if (client) await client.close();
  client = null;
  connection = null;
  catalog = null;
  catalogAt = 0;
}
