/**
 * 认证路由包装 —— 照抄 @nanmicoder/dsh-agent-teams/lib/web-routes.js 的已验证实现。
 *
 * 为什么必须包这层：裸 WebServer 路由**不继承** Connection 的认证围栏，
 * 直接暴露会把插件内部状态泄露给未认证请求。
 */

export class RequestBodyError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** 读取并限长 JSON 请求体，超限返回 413。 */
export async function readJsonRequest(req, maxBytes = 1_000_000) {
  const raw = await new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const finish = (error) => {
      if (settled) return;
      settled = true;
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('aborted', onAborted);
      req.off('error', onError);
      if (error) {
        chunks.length = 0;
        req.once('error', () => {});
        req.resume();
        reject(error);
      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    };
    const onData = (chunk) => {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += part.length;
      if (size > maxBytes) finish(new RequestBodyError('request body is too large', 413));
      else chunks.push(part);
    };
    const onEnd = () => finish();
    const onAborted = () => finish(new RequestBodyError('request body was aborted', 400));
    const onError = () => finish(new RequestBodyError('invalid request body', 400));
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('aborted', onAborted);
    req.once('error', onError);
  });
  let value;
  try {
    value = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    throw new RequestBodyError('invalid JSON', 400);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RequestBodyError('body must be an object', 400);
  }
  return value;
}

/**
 * 把路由注册器包上认证检查。
 * @param server  原始 webServer（提供 register）
 * @param connection  取当前 Connection 的函数
 */
export function authenticatedWebRoutes(server, connection) {
  return {
    register(route) {
      return server.register({
        ...route,
        async handler(req, res) {
          const gate = connection();
          // Connection 缺失或正在销毁属于装配故障，绝不放行
          const rejection = gate === undefined ? 503 : gate.requestRejection(req);
          if (rejection !== undefined) {
            res.writeHead(rejection, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            });
            res.end(JSON.stringify({
              error: rejection === 503 ? 'authentication unavailable'
                : rejection === 401 ? 'unauthorized' : 'forbidden',
            }));
            return;
          }
          await route.handler(req, res);
        },
      });
    },
  };
}

/** 统一的 JSON 响应助手。 */
export function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

/** 统一的 HTML 响应助手。 */
export function sendHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(html),
  });
  res.end(html);
}
