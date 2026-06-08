import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MCP_NAME: z.string().trim().min(1).default('mcp-mock'),
});

export type AppEnv = {
  port: number;
  mcpName: string;
};

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.parse(input);

  return {
    port: parsed.PORT,
    mcpName: parsed.MCP_NAME,
  };
}
