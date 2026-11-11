import {Decoder, Stream} from '@garmin/fitsdk';
import {unzipSync} from 'fflate';

const limit = 3 * 1024 * 1024;
const metric = value => Number.isFinite(value) && value >= 0 ? value : null;

export function analyzeFit(bytes) {
  if (!bytes.length || bytes.length > limit) throw new Error('FIT_SIZE');
  let data = bytes;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let count = 0;
    const files = unzipSync(bytes, {filter(entry) {
      if (!/\.fit$/i.test(entry.name)) return false;
      if (++count > 1 || entry.originalSize > limit) throw new Error('FIT_ARCHIVE_SIZE');
      return true;
    }});
    data = Object.values(files)[0];
  }
  if (!data || data.length > limit) throw new Error('FIT_FILE_MISSING');
  const decoder = new Decoder(Stream.fromByteArray(data));
  if (!decoder.checkIntegrity()) throw new Error('FIT_INTEGRITY');
  const {messages, errors} = decoder.read({convertDateTimesToDates:false});
  if (errors.length) throw new Error('FIT_DECODE');
  const laps = messages.lapMesgs || [];
  if (laps.length > 1000) throw new Error('FIT_LAP_LIMIT');
  return {version:1,laps:laps.map(lap => ({
    intensity:typeof lap.intensity === 'string' ? lap.intensity : null,
    seconds:metric(lap.totalTimerTime),distanceM:metric(lap.totalDistance),
    avgHr:metric(lap.avgHeartRate),avgPower:metric(lap.avgPower)
  }))};
}

export async function readBounded(response) {
  const reader=response.body.getReader(), chunks=[];
  let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.length;
      if(size>limit){await reader.cancel();throw new Error('FIT_SIZE');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const data=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return data;
}
