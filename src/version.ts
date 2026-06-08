import { readFileSync } from 'node:fs';

type PackageMetadata = {
  version: string;
};

const packageJsonPath = new URL('../package.json', import.meta.url);
const { version } = JSON.parse(
  readFileSync(packageJsonPath, 'utf8'),
) as PackageMetadata;

export const SERVER_VERSION = version;
