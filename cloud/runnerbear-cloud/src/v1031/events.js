export const newId=prefix=>`${prefix}_${crypto.randomUUID()}`;
export function event({userId,type,source='runnerbear',sourceId='',localDate='',payload={},quality='high',now=new Date().toISOString()}={}){
  const eventId=newId('evt');
  return{eventId,userId,type,occurredAt:now,localDate,source,sourceId:sourceId||eventId,payload,quality,ingestedAt:now};
}
export const eventStatement=(db,row)=>db.prepare(`INSERT INTO rb_training_events
  (event_id,user_id,event_type,occurred_at,local_date,source,source_id,payload_json,quality,ingested_at)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
  ON CONFLICT(user_id,source,source_id,event_type) DO NOTHING`).bind(row.eventId,row.userId,row.type,row.occurredAt,row.localDate||'',row.source,row.sourceId,JSON.stringify(row.payload||{}),row.quality,row.ingestedAt);
