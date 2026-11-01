import {get} from './store.mjs';
import {withoutScope} from './access-scope.mjs';
import {createOperation} from './credits-store.mjs';
import {fingerprint} from './credits.mjs';

// Only accounts created after this rule was introduced are eligible. The
// unique wallet operation makes concurrent logins and failed-session retries
// safe without a second mutable "claimed" flag or a public claim endpoint.
export async function ensureWelcomeCredits(userId){
  const user=await withoutScope(()=>get('users',userId));
  if(!user||user.disabled||user.welcomeCreditVersion!==1)return;
  // Explicitly disable promotions in isolated test deployments when testing
  // low/empty balances. Production defaults to the approved 100 points.
  const amount=process.env.YIBAN_WELCOME_CREDITS==='0'?0:100;
  if(!amount)return;
  await createOperation({userId,requestKey:'system:welcome:v1',requestHash:fingerprint({userId,promotion:'welcome-v1',amount}),feature:'welcome_grant',amount,note:'新用户注册赠送 100 积分（每个账号一次）',metadata:{promotion:'welcome-v1'},grant:true});
}
