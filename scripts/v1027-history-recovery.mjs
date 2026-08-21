import fs from 'node:fs';

const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath)throw new Error('Usage: node scripts/v1027-history-recovery.mjs snapshot.json recovery.sql');
const snapshot=JSON.parse(fs.readFileSync(inputPath,'utf8'));
if(snapshot.ok!==true||!Array.isArray(snapshot.activities)||!snapshot.activities.length)throw new Error('Verified Tredict activity snapshot is empty');
const text=value=>value==null?'NULL':`'${String(value).replaceAll("'","''")}'`;
const number=value=>Number.isFinite(Number(value))?String(Number(value)):'NULL';
const date=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value||''))?String(value).slice(0,10):'';
const updatedAt=String(snapshot.syncedAt||new Date().toISOString());
const statements=[
  `INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary',${text(updatedAt)},${text(updatedAt)}) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at;`,
];
for(const activity of snapshot.activities){
  const sourceId=String(activity?.id||''),localDate=date(activity?.date);if(!sourceId||!localDate)continue;
  const summary=activity?.summary||activity?.extendedSummary||{};
  statements.push(`INSERT INTO rb_activities(user_id,source,source_id,date,sport_type,sub_sport_type,title,duration_seconds,distance_m,pace_seconds_per_km,avg_hr,max_hr,power,cadence,payload_json,updated_at) VALUES('primary','tredict',${text(sourceId)},${text(localDate)},${text(activity?.sportType||'')},${text(activity?.subSportType||'')},${text(activity?.title||summary?.title||'')},${number(activity?.duration??summary?.duration)},${number(activity?.distance??summary?.distance)},${number(activity?.pace??summary?.pace)},${number(activity?.heartrate??summary?.heartrate)},${number(activity?.heartrateMax??summary?.heartrateMax)},${number(activity?.power??summary?.power)},${number(activity?.cadence??summary?.cadence)},${text(JSON.stringify(activity))},${text(updatedAt)}) ON CONFLICT(user_id,source,source_id) DO UPDATE SET date=excluded.date,sport_type=excluded.sport_type,sub_sport_type=excluded.sub_sport_type,title=excluded.title,duration_seconds=excluded.duration_seconds,distance_m=excluded.distance_m,pace_seconds_per_km=excluded.pace_seconds_per_km,avg_hr=excluded.avg_hr,max_hr=excluded.max_hr,power=excluded.power,cadence=excluded.cadence,payload_json=excluded.payload_json,updated_at=excluded.updated_at;`);
}
if(statements.length===1)throw new Error('No valid activities found in snapshot');
fs.writeFileSync(outputPath,`${statements.join('\n')}\n`,'utf8');
console.log(JSON.stringify({activities:statements.length-1,windowDays:snapshot.windowDays||365,output:outputPath}));
