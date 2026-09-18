import { ensureSchema } from './db.js';
import { handleApi, JSON_HEADERS } from './api.js';

export default {
  async fetch(request, env) {
    const startedAt = Date.now();
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: JSON_HEADERS });
    }

    console.log(JSON.stringify({
      event: 'request_start',
      method: request.method,
      path: url.pathname,
      hasQuery: Boolean(url.search)
    }));

    try {
      await ensureSchema(env.DB);
      const response = await handleApi(request, env);

      console.log(JSON.stringify({
        event: 'request_complete',
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt
      }));

      return response;
    } catch (error) {
      const message = String(error.message || error);
      console.error(JSON.stringify({
        event: 'request_error',
        method: request.method,
        path: url.pathname,
        error: message,
        durationMs: Date.now() - startedAt
      }));

      return new Response(JSON.stringify({
        ok: false,
        error: 'internal_error',
        message
      }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }
  }
};
