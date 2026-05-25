import { createProxyMiddleware } from 'http-proxy-middleware';
import { Request, Response }     from 'express';
import { config }                from '../config';

// Express strips the mount prefix from req.url before the proxy sees it,
// so use req.originalUrl (full path) and strip only /api/v1 from that.
const rewrite = (_path: string, req: Request) =>
  req.originalUrl.replace(/^\/api\/v1/, '');

const makeProxy = (target: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: rewrite,
    on: {
      error: (_err, _req, res) => {
        (res as Response).status(502).json({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Upstream service unavailable.' },
        });
      },
    },
  });

export const authProxy     = makeProxy(config.serviceAuthUrl);
export const userProxy     = makeProxy(config.serviceUserUrl);
export const courseProxy   = makeProxy(config.serviceCourseUrl);
export const enrollProxy   = makeProxy(config.serviceEnrollUrl);
export const progressProxy = makeProxy(config.serviceProgressUrl);
export const storageProxy  = makeProxy(config.serviceStorageUrl);
export const notifyProxy   = makeProxy(config.serviceNotifyUrl);
export const auditProxy    = makeProxy(config.serviceAuditUrl);
export const cellProxy      = makeProxy(config.serviceCellUrl);
export const analyticsProxy = makeProxy(config.serviceAnalyticsUrl);
