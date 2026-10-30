import {sessionFromRequest} from './auth.mjs';
import {withUserScope} from './access-scope.mjs';
export function scopedRoute(handler){
  return async(request,context)=>{
    try{
      const path=new URL(request.url).pathname;
      if(process.env.YIBAN_MAINTENANCE_MODE==='1'&&path!=='/api/auth/status')return Response.json({error:'系统正在维护，请稍后再试',maintenance:true},{status:503,headers:{'Cache-Control':'no-store'}});
      const authEntry=/^\/api\/auth\/(login|register|setup|status)$/.test(path);
      const user=authEntry||path==='/api/proactive/run'?null:await sessionFromRequest(request);
      const response=await withUserScope(user,()=>handler(request,context));
      response.headers.set('Cache-Control','private, no-store');
      response.headers.append('Vary','Cookie');
      return response;
    }catch(error){return Response.json({error:error.message||'请求未能完成'},{status:error.status||503,headers:{'Cache-Control':'private, no-store'}});}
  };
}
