const activeStatus=new Set(['queued','processing','failed_retryable','review_required','failed_terminal']);
const clean=value=>String(value||'').trim();
const codeFor=row=>clean(row.last_error||row.code||'UNCONFIRMED');
const workoutId=row=>clean(row.workout_id||row.workoutId);
const operationId=row=>clean(row.operation_id||row.operationId);

export function repairKind(row={}){
  const status=clean(row.status),code=codeFor(row),type=clean(row.operation_type||row.operationType);
  if(['queued','processing','failed_retryable'].includes(status))return'processing';
  if(code==='DUPLICATE_CALENDAR_ENTRIES')return'duplicate_entries';
  if(code==='PLAN_ACTIVATION_REQUIRED')return'activation_required';
  if(code==='SOURCE_NOT_FOUND')return'source_missing';
  if(code==='STRUCTURAL_CHANGE_REQUIRES_REVIEW'||['cancel','replace','update'].includes(type))return'structural_review';
  if(status==='failed_terminal')return'terminal';
  return status==='review_required'?'structural_review':'healthy';
}

function copyFor(kind,row){
  const type=clean(row.operation_type||row.operationType),date=clean(row.local_date||row.localDate||row.date),title=clean(row.title)||'Planlagt økt';
  if(kind==='activation_required')return{title:'Aktiver RunnerBear-planen i Tredict',message:`${title}${date?` · ${date}`:''} er lagret i RunnerBear, men finnes ikke bekreftet i aktiv Tredict-kalender.`,actionLabel:'Publiser eller aktiver planen',verifyLabel:'Kontroller på nytt'};
  if(kind==='source_missing')return{title:'Tredict finner ikke den gamle økten',message:`RunnerBear kan ikke verifisere ${type==='move'?'flyttingen':'endringen'} for ${title}. Publiser den aktive planen på nytt før kontroll.`,actionLabel:'Publiser aktiv plan',verifyLabel:'Kontroller på nytt'};
  if(kind==='duplicate_entries')return{title:'Flere kopier finnes i Tredict',message:`RunnerBear har flyttet den autoritative utgaven av ${title}, men fant eldre kopier med samme RunnerBear-ID. Ingen ny plan publiseres.`,actionLabel:'Vis kalenderkontroll',verifyLabel:'Kontroller på nytt'};
  if(kind==='structural_review')return{title:type==='cancel'?'Bekreft at økten er fjernet i Tredict':type==='replace'?'Bekreft erstatningen i Tredict':'Kontroller endringen i Tredict',message:`RunnerBear har lagret riktig plan. ${title}${date?` · ${date}`:''} må stemme i Tredict før Garmin følger kalenderen.`,actionLabel:'Åpne reparasjonssteg',verifyLabel:'Jeg har rettet – kontroller'};
  if(kind==='terminal')return{title:'Synken trenger ny reparasjon',message:`${title} kunne ikke verifiseres automatisk. RunnerBear-planen er fortsatt trygg og uendret.`,actionLabel:'Vis reparasjonssteg',verifyLabel:'Prøv kontroll igjen'};
  return{title:'Serveren synkroniserer',message:'Planen er lagret. RunnerBear prøver Tredict på nytt automatisk.',actionLabel:'',verifyLabel:''};
}

export function buildSyncRepair(operations=[],planRevisionId=''){
  const relevant=(operations||[]).filter(row=>activeStatus.has(clean(row.status))&&(!planRevisionId||clean(row.plan_revision_id||row.planRevisionId)===clean(planRevisionId))),items=relevant.map(row=>{const kind=repairKind(row),copy=copyFor(kind,row);return{operationId:operationId(row),workoutId:workoutId(row),operationType:clean(row.operation_type||row.operationType),status:clean(row.status),code:codeFor(row),externalId:clean(row.external_id||row.externalId),localDate:clean(row.local_date||row.localDate||row.date),title:clean(row.title),kind,requiresUser:['activation_required','source_missing','duplicate_entries','structural_review','terminal'].includes(kind),...copy}}),required=items.filter(row=>row.requiresUser),processing=items.filter(row=>row.kind==='processing'),attention=required.length?'action':processing.length?'processing':'healthy',primary=required[0]||processing[0]||null;
  return{version:'sync-repair-1',planRevisionId:clean(planRevisionId),attention,summary:required.length?`${required.length} ${required.length===1?'kalenderendring må':'kalenderendringer må'} kontrolleres i Tredict.`:processing.length?'RunnerBear behandler den aktive planen.':'Tredict-kalenderen er uten utestående konflikt.',primary,items,counts:{actionRequired:required.length,processing:processing.length,total:items.length},canVerify:required.length>0};
}

export function canExplicitlyVerify(row={}){
  return clean(row.status)==='review_required'&&['create','move','cancel','replace','update'].includes(clean(row.operation_type||row.operationType));
}
