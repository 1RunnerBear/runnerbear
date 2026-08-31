PRAGMA foreign_keys = ON;

-- Health observations are a normalized projection of rb_health_daily. Rebuild
-- only that derived Tredict projection, then make repeated syncs idempotent.
DROP TRIGGER IF EXISTS trg_rb_health_observations_insert;
DROP TRIGGER IF EXISTS trg_rb_health_observations_update;

DELETE FROM rb_health_observations
WHERE source='tredict' AND metric IN ('hrv','sleep','rhr');

INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:hrv',user_id,date,'hrv',hrv_ms,'ms',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE hrv_ms IS NOT NULL;
INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:sleep',user_id,date,'sleep',sleep_seconds,'seconds',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE sleep_seconds IS NOT NULL;
INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:rhr',user_id,date,'rhr',rhr_bpm,'bpm',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE rhr_bpm IS NOT NULL;

CREATE TRIGGER trg_rb_health_observations_insert
AFTER INSERT ON rb_health_daily
BEGIN
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:hrv',NEW.user_id,NEW.date,'hrv',NEW.hrv_ms,'ms',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.hrv_ms IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:sleep',NEW.user_id,NEW.date,'sleep',NEW.sleep_seconds,'seconds',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.sleep_seconds IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:rhr',NEW.user_id,NEW.date,'rhr',NEW.rhr_bpm,'bpm',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.rhr_bpm IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
END;

CREATE TRIGGER trg_rb_health_observations_update
AFTER UPDATE OF hrv_ms,sleep_seconds,rhr_bpm,payload_json,updated_at ON rb_health_daily
BEGIN
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='hrv' AND source='tredict' AND NEW.hrv_ms IS NULL;
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:hrv',NEW.user_id,NEW.date,'hrv',NEW.hrv_ms,'ms',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.hrv_ms IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='sleep' AND source='tredict' AND NEW.sleep_seconds IS NULL;
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:sleep',NEW.user_id,NEW.date,'sleep',NEW.sleep_seconds,'seconds',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.sleep_seconds IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='rhr' AND source='tredict' AND NEW.rhr_bpm IS NULL;
  INSERT INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:rhr',NEW.user_id,NEW.date,'rhr',NEW.rhr_bpm,'bpm',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.rhr_bpm IS NOT NULL
  ON CONFLICT(user_id,local_date,metric,source) DO UPDATE SET value=excluded.value,unit=excluded.unit,measured_at=excluded.measured_at,ingested_at=excluded.ingested_at,quality=excluded.quality,payload_json=excluded.payload_json;
END;
