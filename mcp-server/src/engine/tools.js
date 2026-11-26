import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE_PORT, DASHBOARD_URL, REPORTS_DIR, ROOT, VERSION, ensureDirs } from '../config.js';
import { status as llmStatus } from '../llm.js';
import { callTool, getCatalog, status as reaStatus } from '../rea.js';
import { runCode, supportedLanguages } from '../sandbox.js';
import {
  deletePreset, deletePrompt, getJob, getPreset, getPrompt, getSettings, listJobs, listPresets,
  listPrompts, renderPrompt, savePreset, savePrompt, updateSettings,
} from '../store.js';
import { improveCode } from './repair.js';
import { reverseFile, reverseSteps } from './reverse.js';

const obj = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const enu = (values, description) => ({ type: 'string', enum: values, description });
const bool = (description) => ({ type: 'boolean', description });
const num = (description, extra = {}) => ({ type: 'number', description, ...extra });

export const TOOLS = [
  {
    name: 'fgua_status',
    description: 'Estado do FGUA: disponibilidade do REA, do LM Studio, contagem de presets/prompts/jobs e endereços.',
    inputSchema: obj({}),
    handler: async () => {
      const [rea, llm] = await Promise.all([reaStatus(), llmStatus()]);
      const db = { presets: listPresets().length, prompts: listPrompts().length, jobs: listJobs().length };
      return {
        version: VERSION,
        node: process.version,
        platform: process.platform,
        rea,
        llm,
        store: db,
        runnableLanguages: supportedLanguages(),
        reverseSteps,
        bridge: `http://127.0.0.1:${BRIDGE_PORT}`,
        dashboard: DASHBOARD_URL,
        root: ROOT,
      };
    },
  },
  {
    name: 'fgua_presets',
    description: 'Administrar presets de RE, reparo e transpilação (listar, obter, salvar, remover).',
    inputSchema: obj({
      action: enu(['list', 'get', 'save', 'delete'], 'Operação'),
      id: str('Identificador do preset'),
      kind: enu(['reverse', 'repair', 'transpile'], 'Filtrar por tipo (list)'),
      preset: { type: 'object', description: 'Registro completo do preset (save)' },
    }, ['action']),
    handler: async ({ action, id, kind, preset }) => {
      switch (action) {
        case 'list': return { presets: listPresets(kind) };
        case 'get': {
          const found = getPreset(id);
          if (!found) throw new Error(`Preset não encontrado: ${id}`);
          return { preset: found };
        }
        case 'save': return { preset: await savePreset(preset) };
        case 'delete': return await deletePreset(id);
        default: throw new Error(`Ação inválida: ${action}`);
      }
    },
  },
  {
    name: 'fgua_prompts',
    description: 'Administrar prompts locais do painel: listar, obter, salvar, remover e renderizar com variáveis {{chave}}.',
    inputSchema: obj({
      action: enu(['list', 'get', 'save', 'delete', 'render'], 'Operação'),
      id: str('Identificador do prompt'),
      prompt: { type: 'object', description: 'Registro completo (save)' },
      variables: { type: 'object', description: 'Valores para {{chave}} (render)' },
    }, ['action']),
    handler: async ({ action, id, prompt, variables }) => {
      switch (action) {
        case 'list': return { prompts: listPrompts() };
        case 'get': {
          const found = getPrompt(id);
          if (!found) throw new Error(`Prompt não encontrado: ${id}`);
          return { prompt: found };
        }
        case 'save': return { prompt: await savePrompt(prompt) };
        case 'delete': return await deletePrompt(id);
        case 'render': return { id, rendered: renderPrompt(id, variables || {}) };
        default: throw new Error(`Ação inválida: ${action}`);
      }
    },
  },
  {
    name: 'fgua_settings',
    description: 'Ler ou atualizar configurações locais (LM Studio, modelo, temperatura, limites).',
    inputSchema: obj({
      action: enu(['get', 'update'], 'Operação'),
      patch: { type: 'object', description: 'Alterações parciais (update)' },
    }, ['action']),
    handler: async ({ action, patch }) => {
      if (action === 'get') return { settings: getSettings() };
      if (action === 'update') return { settings: await updateSettings(patch) };
      throw new Error(`Ação inválida: ${action}`);
    },
  },
  {
    name: 'fgua_rea_catalog',
    description: 'Descobrir ferramentas do MCP REA por nome ou descrição, com schemas de entrada.',
    inputSchema: obj({
      query: str('Termo de busca (nome ou descrição). Vazio lista todas.'),
      limit: num('Máximo de ferramentas retornadas (padrão 50)', { minimum: 1, maximum: 200 }),
    }),
    handler: (args = {}) => getCatalog({ query: args.query || '', limit: args.limit || 50 }),
  },
  {
    name: 'fgua_rea_call',
    description: 'Chamar qualquer ferramenta do REA com argumentos validados pelo catálogo. Use fgua_rea_catalog para descobrir os argumentos.',
    inputSchema: obj({
      tool: str('Nome exato da ferramenta REA'),
      args: { type: 'object', description: 'Argumentos da ferramenta REA' },
    }, ['tool']),
    handler: async ({ tool, args }) => {
      const result = await callTool(tool, args || {});
      return { tool, ...result };
    },
  },
  {
    name: 'fgua_reverse_file',
    description: 'Engenharia reversa autônoma: aponte um arquivo e um diretório de destino; orquestra o REA e grava relatório Markdown + JSON.',
    inputSchema: obj({
      path: str('Caminho absoluto do arquivo a analisar'),
      outputDir: str('Diretório de destino do relatório (padrão: .frame-data/reports)'),
      preset: str('Preset de RE (padrão: reverse-binary; .wasm usa reverse-wasm)'),
      steps: { type: 'array', items: str('Nome da ferramenta REA'), description: 'Substitui as etapas do preset' },
    }, ['path']),
    handler: (args) => reverseFile(args),
  },
  {
    name: 'fgua_run_tests',
    description: 'Executar código em subprocesso limitado (Node com permission model ou Python isolado) e devolver reward binário.',
    inputSchema: obj({
      code: str('Código a executar'),
      language: enu(supportedLanguages(), 'Linguagem do código'),
      tests: str('Testes anexados ao código'),
      timeoutMs: num('Timeout em ms (padrão 10000)', { minimum: 100, maximum: 120000 }),
    }, ['code']),
    handler: (args = {}) => runCode({ ...args, language: args.language || 'javascript' }),
  },
  {
    name: 'fgua_repair_code',
    description: 'Corrigir código com loop LLM (LM Studio) + testes reais como reward; grava o melhor candidato no destino.',
    inputSchema: obj({
      code: str('Código com defeito'),
      language: str('Linguagem do código', { default: 'javascript' }),
      instruction: str('Instrução adicional de correção'),
      tests: str('Testes de aceitação'),
      preset: str('Preset de reparo'),
      maxIterations: num('Iterações máximas (1-12)', { minimum: 1, maximum: 12 }),
      outputPath: str('Arquivo de destino do código corrigido'),
      model: str('Modelo LM Studio (sobrescreve config)'),
    }, ['code']),
    handler: (args) => improveCode({ ...args, mode: 'repair' }),
  },
  {
    name: 'fgua_transpile_code',
    description: 'Adaptar código de uma linguagem para outra com loop LLM + testes; grava o melhor candidato no destino.',
    inputSchema: obj({
      code: str('Código fonte'),
      language: str('Linguagem de origem'),
      targetLanguage: str('Linguagem de destino'),
      instruction: str('Requisitos adicionais da conversão'),
      tests: str('Testes de aceitação na linguagem de destino'),
      preset: str('Preset de transpilação'),
      maxIterations: num('Iterações máximas (1-12)', { minimum: 1, maximum: 12 }),
      outputPath: str('Arquivo de destino do código convertido'),
      model: str('Modelo LM Studio (sobrescreve config)'),
    }, ['code', 'targetLanguage']),
    handler: (args) => improveCode({ ...args, mode: 'transpile' }),
  },
  {
    name: 'fgua_jobs',
    description: 'Listar, inspecionar ou exportar jobs de RE/reparo/transpilação.',
    inputSchema: obj({
      action: enu(['list', 'get', 'report'], 'Operação'),
      id: str('Identificador do job'),
      outputDir: str('Diretório para exportar o relatório (report)'),
    }, ['action']),
    handler: async ({ action, id, outputDir }) => {
      if (action === 'list') return { jobs: listJobs() };
      const job = getJob(id);
      if (!job) throw new Error(`Job não encontrado: ${id}`);
      if (action === 'get') return { job };
      ensureDirs();
      const targetDir = path.resolve(outputDir || REPORTS_DIR);
      fs.mkdirSync(targetDir, { recursive: true });
      const target = path.join(targetDir, `${job.id}-job.md`);
      fs.writeFileSync(target, `# Job ${job.id}\n\n\`\`\`json\n${JSON.stringify(job, null, 2)}\n\`\`\`\n`, 'utf8');
      return { jobId: job.id, reportPath: target };
    },
  },
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export async function dispatch(name, args = {}) {
  const tool = BY_NAME.get(name);
  if (!tool) throw new Error(`Ferramenta FGUA desconhecida: ${name}`);
  return tool.handler(args || {});
}
