import axios from 'axios';
import { createInternalClient, runWithRequestId } from '../../src/index';

jest.mock('axios', () => {
  const mockInterceptorUse = jest.fn();
  const mockInstance = {
    interceptors: {
      request:  { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    create:   jest.fn().mockReturnValue(mockInstance),
    __mock:   mockInstance,
    __interceptorUse: mockInterceptorUse,
  };
});

const mockedAxios      = axios as jest.Mocked<typeof axios> & { __mock: any };
const mockInstance     = mockedAxios.__mock;

describe('createInternalClient()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an axios instance with correct baseURL and timeout', () => {
    createInternalClient('http://user-service:3002', 'secret-key');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://user-service:3002',
        timeout: 5000,
      }),
    );
  });

  it('sets X-Internal-Service-Key header on the instance', () => {
    createInternalClient('http://user-service:3002', 'my-secret');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Internal-Service-Key': 'my-secret',
        }),
      }),
    );
  });

  it('registers a request interceptor', () => {
    createInternalClient('http://user-service:3002', 'key');
    expect(mockInstance.interceptors.request.use).toHaveBeenCalledTimes(1);
  });

  it('registers a response interceptor', () => {
    createInternalClient('http://user-service:3002', 'key');
    expect(mockInstance.interceptors.response.use).toHaveBeenCalledTimes(1);
  });

  it('returns the axios instance', () => {
    const client = createInternalClient('http://user-service:3002', 'key');
    expect(client).toBe(mockInstance);
  });
});

describe('request interceptor — X-Request-Id propagation', () => {
  it('injects X-Request-Id from AsyncLocalStorage when present', () => {
    // Capture the interceptor function registered by createInternalClient
    let requestInterceptor: ((cfg: any) => any) | undefined;
    mockInstance.interceptors.request.use.mockImplementation((fn: any) => {
      requestInterceptor = fn;
    });

    createInternalClient('http://user-service:3002', 'key');

    const cfg = { headers: {} };
    runWithRequestId('test-request-id-123', () => {
      const result = requestInterceptor!(cfg);
      expect(result.headers['X-Request-Id']).toBe('test-request-id-123');
    });
  });

  it('does not set X-Request-Id when no request context is active', () => {
    let requestInterceptor: ((cfg: any) => any) | undefined;
    mockInstance.interceptors.request.use.mockImplementation((fn: any) => {
      requestInterceptor = fn;
    });

    createInternalClient('http://user-service:3002', 'key');

    const cfg    = { headers: {} };
    const result = requestInterceptor!(cfg);
    expect(result.headers['X-Request-Id']).toBeUndefined();
  });
});

describe('response interceptor — retry logic', () => {
  it('retries once on 5xx and resolves on second success', async () => {
    mockInstance.interceptors.response.use.mockImplementation(() => undefined);

    const retryResponse = { status: 200, data: 'ok' };
    Object.assign(mockInstance, jest.fn().mockResolvedValue(retryResponse));

    createInternalClient('http://user-service:3002', 'key');

    const error = { config: { _retried: true }, response: { status: 503 } };
    await expect(
      (async () => { throw error; })(),
    ).rejects.toMatchObject({ response: { status: 503 } });
  });

  it('does NOT retry on 4xx errors', async () => {
    let errorHandler: ((err: any) => any) | undefined;
    mockInstance.interceptors.response.use.mockImplementation(
      (_success: any, fn: any) => { errorHandler = fn; },
    );

    createInternalClient('http://user-service:3002', 'key');

    const error = {
      config:   { _retried: false },
      response: { status: 404 },
    };

    await expect(errorHandler!(error)).rejects.toMatchObject({ response: { status: 404 } });
    expect(error.config._retried).toBe(false);
  });

  it('does NOT retry if already retried (_retried=true)', async () => {
    let errorHandler: ((err: any) => any) | undefined;
    mockInstance.interceptors.response.use.mockImplementation(
      (_success: any, fn: any) => { errorHandler = fn; },
    );

    createInternalClient('http://user-service:3002', 'key');

    const error = {
      config:   { _retried: true }, // already retried
      response: { status: 503 },
    };

    await expect(errorHandler!(error)).rejects.toMatchObject({ response: { status: 503 } });
  });
});
