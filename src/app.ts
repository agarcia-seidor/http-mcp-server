import http from 'node:http';

import type { McpServer } from '@modelcontextprotocol/server';

import type { AppEnv } from './config/env.js';
import { createRequestHandler } from './http/request-handler.js';
import {
  createMcpTransportBridge,
  type McpTransportBridge,
} from './mcp/transport.js';
import { createLogger, type Logger } from './observability/logger.js';

export type CreateAppOptions = {
  env: AppEnv;
  mcpServer: McpServer;
  logger?: Logger;
  transportBridge?: McpTransportBridge;
};

export function createApp({
  env,
  logger,
  mcpServer,
  transportBridge,
}: CreateAppOptions): http.Server {
  const appLogger = logger ?? createLogger('app');
  const mcpTransport = transportBridge ?? createMcpTransportBridge(mcpServer);
  const handleRequest = createRequestHandler({
    env,
    logger: appLogger,
    mcpTransport,
  });

  return http.createServer((req, res) => {
    void handleRequest(req, res);
  });
}
