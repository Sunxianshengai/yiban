import {AsyncLocalStorage} from 'node:async_hooks';
const scopes=new AsyncLocalStorage();
export const currentScope=()=>scopes.getStore()||null;
export const withUserScope=(user,work)=>scopes.run(user?{userId:user.id,familyId:user.familyId||'family',role:user.role,platformRole:user.platformRole||null}:null,work);
export const withoutScope=work=>scopes.run(null,work);
export const FAMILY_COLLECTIONS=new Set(['memories','members','anniversaries','activity','settings','milestones','quotes','answers','highlights','narrations','memory_videos','voice_cache','families','invites']);
export const USER_COLLECTIONS=new Set(['chat_threads','chat_messages','chat_jobs','chat_limits','chat_callbacks','chat_callback_settings','companion_profiles','companion_defaults','companion_threads','role_threads','personal_memory_scopes','personal_memory_actions','mood_checkins','proactive_state','proactive_settings','proactive_jobs','notification_subscriptions','notification_outbox','companion_voices']);
export const INTERNAL_COLLECTIONS=new Set(['system','sessions','account_emails','proactive_runner','proactive_atomic_probe','companion_voice_locks','companion_voice_queries','companion_voice_previews']);
export const accessDenied=()=>Object.assign(Error('内容不存在或无权访问'),{status:404});
export function scopedId(collection,id){const scope=currentScope();return scope&&collection==='settings'&&id==='family'&&scope.familyId!=='family'?'family:'+scope.familyId:id;}
export function stampScope(collection,document){
  const scope=currentScope();if(!scope)return document;
  if(FAMILY_COLLECTIONS.has(collection))return {...document,id:scopedId(collection,document.id),familyId:scope.familyId};
  if(USER_COLLECTIONS.has(collection)){if(document.userId&&document.userId!==scope.userId)throw accessDenied();return {...document,userId:scope.userId};}
  if(collection==='uploads'){if(document.userId&&document.userId!==scope.userId&&document.familyId!==scope.familyId)throw accessDenied();return {...document,familyId:document.familyId||scope.familyId};}
  if(collection==='family_memberships'){if(document.userId!==scope.userId)throw accessDenied();return document;}
  if(collection==='users'||INTERNAL_COLLECTIONS.has(collection))return document;
  throw accessDenied();
}
