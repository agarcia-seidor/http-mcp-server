import type { ServerContext } from '@modelcontextprotocol/server';

export const TENANT_REQUEST_CONFIG_SYMBOL = Symbol('tenantRequestConfig');

export type TenantRequestConfig = {
  apiUrl: string;
  bearerToken: string;
};

type TenantRequestConfigState =
  | {
      config: TenantRequestConfig;
      status: 'valid';
    }
  | {
      reason: string;
      status: 'missing';
    }
  | {
      reason: string;
      status: 'invalid';
    };

type TenantAwareRequest = Request & {
  [TENANT_REQUEST_CONFIG_SYMBOL]?: TenantRequestConfigState;
};

function normalizeApiUrl(value: string): string | null {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function parseBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const token = match[1]?.trim();

  return token ? token : null;
}

export function extractTenantRequestConfig(
  headers: Headers,
): TenantRequestConfigState {
  const apiUrlHeader = headers.get('x-api-url');
  const authorizationHeader = headers.get('authorization');

  if (!apiUrlHeader && !authorizationHeader) {
    return {
      reason:
        'Missing tenant configuration headers. Send X-Api-Url and Authorization: Bearer <PAT>.',
      status: 'missing',
    };
  }

  if (!apiUrlHeader) {
    return {
      reason: 'Missing X-Api-Url header.',
      status: 'missing',
    };
  }

  const apiUrl = normalizeApiUrl(apiUrlHeader);

  if (!apiUrl) {
    return {
      reason: 'Invalid X-Api-Url header. Use an absolute http or https URL.',
      status: 'invalid',
    };
  }

  const bearerToken = parseBearerToken(authorizationHeader);

  if (!authorizationHeader) {
    return {
      reason: 'Missing Authorization header. Use Bearer authentication.',
      status: 'missing',
    };
  }

  if (!bearerToken) {
    return {
      reason: 'Invalid Authorization header. Use Bearer <PAT>.',
      status: 'invalid',
    };
  }

  return {
    config: {
      apiUrl,
      bearerToken,
    },
    status: 'valid',
  };
}

export function attachTenantRequestConfig(
  request: Request,
  state: TenantRequestConfigState,
): Request {
  (request as TenantAwareRequest)[TENANT_REQUEST_CONFIG_SYMBOL] = state;

  return request;
}

export function getTenantRequestConfigState(
  context: ServerContext,
): TenantRequestConfigState | undefined {
  const request = context.http?.req as TenantAwareRequest | undefined;

  return request?.[TENANT_REQUEST_CONFIG_SYMBOL];
}

export function requireTenantRequestConfig(
  context: ServerContext,
): TenantRequestConfig {
  const state = getTenantRequestConfigState(context);

  if (!state) {
    throw new Error(
      'Tenant configuration is not attached to this request context.',
    );
  }

  if (state.status !== 'valid') {
    throw new Error(state.reason);
  }

  return state.config;
}
