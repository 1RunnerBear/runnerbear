import legacy from './index-v982.js';

export { MigrationService } from './migration-service.js';

const BUILD = '10.26.0';

export default {
  async fetch(request, env, ctx) {
    const response = await legacy.fetch(request, env, ctx);
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (request.method !== 'GET' || path !== '/health' || !response.ok) return response;
    try {
      const body = await response.json();
      return Response.json({ ...body, build: BUILD, cloudBuild: BUILD }, {
        status: response.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return response;
    }
  },
};
