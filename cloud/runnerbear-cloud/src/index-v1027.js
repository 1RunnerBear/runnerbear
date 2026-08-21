import legacy from './index-v982.js';

export { MigrationService } from './migration-service.js';

const BUILD = '10.27.0';

async function historyAudit(db) {
  if (!db) return { ok: false, activities: 0, duplicateExternalIds: 0, planItems: 0, events: 0 };
  try {
    const [activities, duplicates, plans, events] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total,MIN(date) AS earliest,MAX(date) AS latest FROM rb_activities WHERE user_id='primary'").first(),
      db.prepare("SELECT COUNT(*) AS total FROM (SELECT source,source_id FROM rb_activities WHERE user_id='primary' GROUP BY source,source_id HAVING COUNT(*)>1)").first(),
      db.prepare("SELECT COUNT(*) AS total FROM rb_plan_revision_items i JOIN rb_plan_revisions r ON r.plan_revision_id=i.plan_revision_id WHERE r.user_id='primary'").first(),
      db.prepare("SELECT COUNT(*) AS total FROM rb_training_events WHERE user_id='primary'").first(),
    ]);
    const result={activities:Number(activities?.total||0),earliestActivity:activities?.earliest||null,latestActivity:activities?.latest||null,duplicateExternalIds:Number(duplicates?.total||0),planItems:Number(plans?.total||0),events:Number(events?.total||0)};
    return{ok:result.activities>0&&result.duplicateExternalIds===0,...result};
  } catch (error) {
    return{ok:false,activities:0,duplicateExternalIds:0,planItems:0,events:0,error:String(error?.message||error).slice(0,160)};
  }
}

export default {
  async fetch(request, env, ctx) {
    const response = await legacy.fetch(request, env, ctx);
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (request.method !== 'GET' || path !== '/health' || !response.ok) return response;
    try {
      const [body,audit] = await Promise.all([response.json(),historyAudit(env.DB)]);
      return Response.json({ ...body, build: BUILD, cloudBuild: BUILD, historyIntegrity:audit.ok, historyAudit:{activitiesPresent:audit.activities>0,duplicateExternalIds:audit.duplicateExternalIds} }, {
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
