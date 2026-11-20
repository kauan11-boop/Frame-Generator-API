import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { FguaRuntime } from './runtime.js';

const text = value => JSON.stringify(value, null, 2);
const result = value => ({
  content: [{ type: 'text', text: text(value) }],
  structuredContent: value
});

export function createFguaMcpServer(runtime = new FguaRuntime()) {
  const server = new McpServer(
    { name: 'frame-generator-api', version: '0.2.0' },
    {
      instructions: 'FGUA é o runtime universal do Frame-Generator-API. As ferramentas de diagnóstico e leitura funcionam sem IA. Operações de geração e processamento só podem ser executadas quando um engine/provedor real estiver integrado; nunca declare uma execução que não ocorreu.'
    }
  );

  server.registerTool('fgua_system_status', {
    title: 'FGUA System Status',
    description: 'Retorna o estado do runtime MCP e a disponibilidade de configurações.',
    inputSchema: z.object({})
  }, async () => result(runtime.status()));

  server.registerTool('fgua_api_contract', {
    title: 'FGUA API Contract',
    description: 'Retorna o contrato lógico /api/v1 e seus namespaces.',
    inputSchema: z.object({})
  }, async () => result(runtime.contract()));

  server.registerTool('fgua_modules_list', {
    title: 'FGUA Modules',
    description: 'Lista os módulos conhecidos do projeto e diferencia módulos do navegador do runtime Node.',
    inputSchema: z.object({ area: z.string().optional() })
  }, async ({ area }) => {
    const modules = runtime.modules().filter(x => !area || x.area === area);
    return result({ count: modules.length, modules });
  });

  server.registerTool('fgua_catalog_read', {
    title: 'FGUA Catalog',
    description: 'Lê catálogos públicos de modelos, geradores, repacks, permissões ou configurações.',
    inputSchema: z.object({ name: z.enum(['models', 'generators', 'repacks', 'permissions', 'settings', 'api']) })
  }, async ({ name }) => result(runtime.catalog(name)));

  server.registerTool('fgua_ai_status', {
    title: 'FGUA Optional AI Status',
    description: 'Informa se endpoints de provedores de IA foram configurados sem revelar tokens ou chaves.',
    inputSchema: z.object({})
  }, async () => result(runtime.aiStatus()));

  server.registerTool('fgua_pipeline_validate', {
    title: 'FGUA Pipeline Validator',
    description: 'Valida a estrutura JSON de um pipeline. Não executa etapas nem inicia processamento.',
    inputSchema: z.object({
      stages: z.array(z.object({
        id: z.string(),
        type: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
        options: z.record(z.string(), z.unknown()).optional()
      })).min(1).max(100)
    })
  }, async input => result(runtime.validatePipeline(input)));

  server.registerResource('fgua-status', 'fgua://system/status', {
    title: 'FGUA System Status',
    description: 'Estado do runtime universal.',
    mimeType: 'application/json'
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: text(runtime.status()) }] }));

  server.registerResource('fgua-api-contract', 'fgua://api/contract', {
    title: 'FGUA API Contract',
    description: 'Contrato lógico da API.',
    mimeType: 'application/json'
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: text(runtime.contract()) }] }));

  server.registerResource('fgua-model-catalog', 'fgua://catalog/models', {
    title: 'FGUA Model Catalog',
    description: 'Catálogo público de modelos.',
    mimeType: 'application/json'
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: text(runtime.catalog('models')) }] }));

  server.registerResource('fgua-generator-catalog', 'fgua://catalog/generators', {
    title: 'FGUA Generator Catalog',
    description: 'Catálogo de geradores.',
    mimeType: 'application/json'
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: text(runtime.catalog('generators')) }] }));

  server.registerPrompt('fgua_pipeline_design', {
    title: 'Design FGUA Pipeline',
    description: 'Cria uma especificação de pipeline em JSON para revisão humana; não executa o pipeline.',
    argsSchema: {
      goal: z.string().min(3),
      inputType: z.enum(['image', 'video', 'game-frame', 'model-analysis', 'general'])
    }
  }, async ({ goal, inputType }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          'Proponha um pipeline FGUA para o objetivo: ' + goal,
          'Tipo de entrada: ' + inputType,
          'Responda com JSON contendo stages[].id, stages[].type, input e options.',
          'Diferencie planejamento de execução. Não invente engines, modelos, resultados ou capacidades.',
          'A especificação deve ser validável por fgua_pipeline_validate.'
        ].join('\n')
      }
    }]
  }));

  return server;
}
