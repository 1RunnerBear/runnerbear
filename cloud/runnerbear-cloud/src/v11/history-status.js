export function activityHistory({rows=[],limit=400,sync=null,now=Date.now()}={}){
  const age=now-Date.parse(sync?.last_synced_at),current=sync?.status==='ok'&&age>=-60000&&age<=6*3600000;
  return{version:'activity-history-1',state:current?'current':'pending',count:rows.length,truncated:rows.length>=limit,oldestDate:rows.at(-1)?.date||null,latestDate:rows[0]?.date||null,syncedAt:sync?.last_synced_at||null};
}
export function historyCovers(history,date){return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&(!history||(history.state==='current'&&(!history.truncated||date>history.oldestDate)))}
