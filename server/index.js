#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createFguaMcpServer } from './mcp-server.js';
import { createRuntime } from './runtime.js';
import { startHttpServer } from './http.js';

const transport = (process.env.FGUA_MCP_TRANSPORT || 'stdio').toLowerCase();

if (transport === 'stdio') {
  const runtime = await createRuntime();
  await serveStdio(() => createFguaMcpServer(runtime));
} else if (transport === 'http') {
  await startHttpServer();
} else {
  console.error('FGUA_MCP_TRANSPORT deve ser stdio ou http.');
  process.exitCode = 2;
}
