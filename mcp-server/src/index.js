import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { VERSION, ensureDirs } from './config.js';
import { TOOLS, dispatch } from './engine/tools.js';
import { close as closeRea } from './rea.js';

ensureDirs();

const server = new Server(
  { name: 'frame-generator-api', version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params || {};
  try {
    const result = await dispatch(name, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Erro no ${name}: ${error?.message || String(error)}` }],
    };
  }
});

async function shutdown() {
  try { await closeRea(); } catch { /* noop */ }
  try { await server.close(); } catch { /* noop */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await server.connect(new StdioServerTransport());
