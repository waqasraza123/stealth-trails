import axios from "axios";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import {
  createClientTelemetry,
  installGlobalTelemetryHandlers
} from "@stealth-trails-bank/ui-foundation";
import {
  MutationCache,
  QueryCache,
  QueryClient
} from "@tanstack/react-query";

const runtimeConfig = loadWebRuntimeConfig(import.meta.env);

export const webTelemetry = createClientTelemetry({
  app: "customer-web",
  endpoint: runtimeConfig.telemetryEndpoint,
  environment: runtimeConfig.telemetryEnvironment,
  release: runtimeConfig.telemetryRelease
});

let webObservabilityInstalled = false;

function getRouteContext() {
  return {
    route:
      typeof globalThis.location === "undefined"
        ? null
        : globalThis.location.pathname
  };
}

function isReportableHttpError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return true;
  }

  const status = error.response?.status;
  return status === undefined || status >= 500;
}

export function reportWebApiError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  if (!isReportableHttpError(error)) {
    return;
  }

  const requestError = axios.isAxiosError(error) ? error : null;

  // These request objects contain credentials. Recovery pages handle their own
  // sanitized errors; never pass the AxiosError to analytics or telemetry.
  if (/\/auth\/(?:forgot|reset)-password(?:[?#]|$)/u.test(requestError?.config?.url ?? "")) return;

  webTelemetry.captureException(error, {
    kind: "http_error",
    message: "Customer web API request failed",
    context: {
      ...getRouteContext(),
      ...context,
      method: requestError?.config?.method?.toUpperCase(),
      url: requestError?.config?.url,
      status: requestError?.response?.status
    }
  });
}

export function installWebObservability() {
  if (webObservabilityInstalled) {
    return;
  }

  webObservabilityInstalled = true;

  installGlobalTelemetryHandlers(webTelemetry, {
    source: "customer-web",
    resolveContext: getRouteContext
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      reportWebApiError(error);
      return Promise.reject(error);
    }
  );
}

function formatQueryKey(value: readonly unknown[]) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable-query-key]";
  }
}

export function createWebQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        if (axios.isAxiosError(error)) {
          return;
        }

        webTelemetry.captureException(error, {
          kind: "query_error",
          message: "Customer web query failed",
          context: {
            ...getRouteContext(),
            queryKey: formatQueryKey(query.queryKey)
          }
        });
      }
    }),
    mutationCache: new MutationCache({
      onError(error, variables, _context, mutation) {
        if (axios.isAxiosError(error)) {
          return;
        }

        webTelemetry.captureException(error, {
          kind: "mutation_error",
          message: "Customer web mutation failed",
          context: {
            ...getRouteContext(),
            mutationKey: formatQueryKey(mutation.options.mutationKey ?? []),
            variables
          }
        });
      }
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  });
}
