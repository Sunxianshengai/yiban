import {createHash} from 'node:crypto';
export const RESET_TABLES=['documents','credit_ledger','credit_operations','credit_wallets'];
export function resetFingerprint(identity){return createHash('sha256').update(identity).digest('hex').slice(0,20);}
export function authorizeReset({apply=false,confirmation,environment,fingerprint,maintenance,approval,setupToken}){
  if(!apply)return;
  if(confirmation!==fingerprint)throw Error('目标指纹未确认，拒绝清空');
  if(environment==='production'){
    if(!maintenance)throw Error('正式站须先进入维护模式');
    if(!setupToken)throw Error('须先配置新的首次初始化口令，防止重置后管理员被抢先创建');
    if(!approval?.approved||approval.fingerprint!==fingerprint||approval.scope!=='all-business-data'||!approval.acceptanceConfirmed)throw Error('尚未取得验收确认后的清空授权文件');
  }
}
