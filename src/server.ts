import 'dotenv/config';

import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createMcpServer } from './mcp/create-server.js';
import { createLogger } from './observability/logger.js';

async function main(): Promise<void> {
  const logger = createLogger('server');
  const env = parseEnv();
  const mcpServer = createMcpServer({ name: env.mcpName });
  const httpServer = createApp({ env, logger, mcpServer });

  httpServer.on('error', (error) => {
    logger.error('HTTP server error', error);
  });

  httpServer.listen(env.port, () => {
    logger.info('HTTP server listening', {
      port: env.port,
      url: `http://localhost:${env.port}`,
    });
  });
}

void main().catch((error) => {
  const logger = createLogger('server');
  logger.error('Failed to start HTTP server', error);
  process.exitCode = 1;
});
