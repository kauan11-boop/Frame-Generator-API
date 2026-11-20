import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

function validateEndpoint(value) {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password) throw new Error('Credenciais não podem ser embutidas na URL.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use HTTPS para servidores remotos ou HTTP somente para loopback local.');
  }
  if (url.protocol === 'https:' && !url.hostname) throw new Error('Host inválido.');
  return url;
}

export async function connectMcpServer({ url, token } = {}) {
  const endpoint = validateEndpoint(url);
  const client = new Client({ name: 'fgua-universal-client', version: '0.2.0' });
  const transport = new StreamableHTTPClientTransport(endpoint, token
    ? { requestInit: { headers: { Authorization: 'Bearer ' + token } } }
    : undefined);
  await client.connect(transport);
  return {
    server: client.getServerVersion(),
    capabilities: client.getServerCapabilities(),
    listTools: () => client.listTools(),
    listResources: () => client.listResources(),
    listPrompts: () => client.listPrompts(),
    callTool: (name, args = {}) => client.callTool({ name, arguments: args }),
    readResource: uri => client.readResource({ uri }),
    getPrompt: (name, args = {}) => client.getPrompt({ name, arguments: args }),
    close: () => client.close()
  };
}
