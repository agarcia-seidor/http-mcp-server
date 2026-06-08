import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export function registerTimeTool(server: McpServer): void {
  server.registerTool(
    'time',
    {
      description: 'Returns the current server time in ISO format.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ now: new Date().toISOString() }),
        },
      ],
    }),
  );
}
