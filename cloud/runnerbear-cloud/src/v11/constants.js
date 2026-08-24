export const BUILD='11.0.0';
export const SCHEMA_VERSION=2;
export const POLICY_VERSION='bakken-adaptive-coach-3';
export const FLAGS=Object.freeze(['coach_loop_shadow','coach_loop_read','coach_loop_ui','coach_loop_write','coach_loop_sync','coach_loop_safe_auto','coach_loop_goal_confidence']);
export const DEFAULT_FLAGS=Object.freeze(Object.fromEntries(FLAGS.map(flag=>[flag,false])));
export const HEALTH_TTL=Object.freeze({freshMeasurementHours:18,freshSyncHours:6,partialMeasurementHours:36,minBaselineDays:10,baselineWindowDays:21});
export const DECISION_TYPES=Object.freeze(['keep','reduce','replace','move','rest','replan','wait_for_data','needs_input']);
export const DECISION_STATUSES=Object.freeze(['proposed','auto_applied','accepted','rejected','superseded','undone']);
