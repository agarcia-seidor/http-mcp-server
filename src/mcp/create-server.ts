import { McpServer } from '@modelcontextprotocol/server';

import { SERVER_VERSION } from '../version.js';
import { registerEchoTool } from './tools/echo.js';
import { registerTimeTool } from './tools/time.js';

export type CreateMcpServerOptions = {
  name: string;
  version?: string;
};

export function createMcpServer({
  name,
  version = SERVER_VERSION,
}: CreateMcpServerOptions): McpServer {
  const server = new McpServer({ name, version });

  registerEchoTool(server);
  registerTimeTool(server);

  return server;
}
