// Only degrade for the provider's explicit write quota error. Read, schema and
// permission failures must still surface as failures, never as a usable plan.
export function isStorageWriteLimit(error){
  const message=String(error?.message||error);
  return /D1_ERROR/i.test(message)&&/exceeded D1's free tier daily row write limit/i.test(message);
}
export const STORAGE_WRITE_LIMIT={code:'STORAGE_WRITE_LIMIT',writeAvailable:false,message:'Lagring er midlertidig utilgjengelig. Du kan se planen, men nye registreringer og endringer kan ikke lagres akkurat nå.'};
