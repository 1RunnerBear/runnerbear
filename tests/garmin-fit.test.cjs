const test=require('node:test');
const assert=require('node:assert/strict');
test('FIT archive yields measured lap metrics and rejects truncated input',async()=>{
  const {analyzeFit}=await import('../cloud/runnerbear-cloud/src/v1027/garmin-fit.js');
  const bytes=Buffer.from('UEsDBBQAAAAIAO4+a13gF8kUNAAAADIAAAAHAAAAbGFwLmZpdONjehqkxMDAoOfmGeIn6cDAIMzAKs7IxMHSxsnSxs/IJMzUwsCgsJ+JocGCkWHhQwaZJABQSwECFAAUAAAACADuPmtd4BfJFDQAAAAyAAAABwAAAAAAAAAAAAAAAAAAAAAAbGFwLmZpdFBLBQYAAAAAAQABADUAAABZAAAAAAA=','base64');
  assert.deepEqual(analyzeFit(bytes).laps,[{intensity:'active',seconds:180,distanceM:800,avgHr:161,avgPower:225}]);
  assert.throws(()=>analyzeFit(bytes.subarray(0,25)));
});
