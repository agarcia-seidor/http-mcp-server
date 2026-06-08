import type http from 'node:http';

import type { AppEnv } from '../config/env.js';
import type { McpTransportBridge } from '../mcp/transport.js';
import type { Logger } from '../observability/logger.js';
import { handleHealthRequest } from './routes/health.js';

type RequestHandlerOptions = {
  env: AppEnv;
  logger: Logger;
  mcpTransport: McpTransportBridge;
};

function sendTextResponse(
  res: http.ServerResponse,
  statusCode: number,
  body: string,
): void {
  if (res.headersSent) {
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(body);
}

export function createRequestHandler({
  env,
  logger,
  mcpTransport,
}: RequestHandlerOptions) {
  return async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      if (!req.url) {
        sendTextResponse(res, 400, 'Missing URL');
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        handleHealthRequest(res, env.mcpName);
        return;
      }

      if (req.url.startsWith('/mcp')) {
        await mcpTransport.handleRequest(
          req,
          res,
          `http://localhost:${env.port}`,
        );
        return;
      }

      sendTextResponse(res, 404, 'Not found');
    } catch (error) {
      logger.error('Unhandled request error', error, {
        method: req.method,
        url: req.url,
      });

      if (res.headersSent) {
        if (!res.writableEnded) {
          res.destroy();
        }

        return;
      }

      if (!res.writableEnded) {
        sendTextResponse(res, 500, 'Internal Server Error');
      }
    }
  };
}
