import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export function registerEchoTool(server: McpServer): void {
  server.registerTool(
    'echo',
    {
      description: 'Returns the input payload as-is.',
      inputSchema: z.object({
        message: z.string().describe('Message to echo back'),
      }),
    },
    async ({ message }) => ({
      content: [{ type: 'text', text: JSON.stringify({ message }) }],
    }),
  );
}
