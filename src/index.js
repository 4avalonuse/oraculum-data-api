import { ensureSchema } from './db.js';
import { handleApi, JSON_HEADERS } from './api.js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: JSON_HEADERS });
    }

    try {
      await ensureSchema(env.DB);
      return await handleApi(request, env);
    } catch (error) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'internal_error',
        message: String(error.message || error)
      }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }
  }
};
