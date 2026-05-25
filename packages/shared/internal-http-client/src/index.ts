import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getRequestId } from './context';

export { runWithRequestId, getRequestId } from './context';

export function createInternalClient(serviceUrl: string, serviceKey: string): AxiosInstance {
  const client = axios.create({
    baseURL: serviceUrl,
    timeout: 5000,
    headers: {
      'X-Internal-Service-Key': serviceKey,
      'Content-Type':           'application/json',
    },
  });

  // Propagate X-Request-Id from AsyncLocalStorage on every request
  client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
    const requestId = getRequestId();
    if (requestId) cfg.headers['X-Request-Id'] = requestId;
    return cfg;
  });

  // Single retry with 500 ms backoff on 5xx responses
  client.interceptors.response.use(
    res => res,
    async (error: unknown) => {
      const axiosError = error as {
        config:    InternalAxiosRequestConfig & { _retried?: boolean };
        response?: { status: number };
      };

      const shouldRetry =
        !axiosError.config?._retried &&
        axiosError.response?.status !== undefined &&
        axiosError.response.status >= 500;

      if (shouldRetry) {
        axiosError.config._retried = true;
        await new Promise(resolve => setTimeout(resolve, 500));
        return client(axiosError.config);
      }

      throw error;
    },
  );

  return client;
}
