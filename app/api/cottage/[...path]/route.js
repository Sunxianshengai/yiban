import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {scopedRoute} from '../../../../lib/request-scope.mjs';
import {CottageError,listCottageEntries,createCottageEntry,readCottageEntry,changeCottageEntry,deleteCottageEntry} from '../../../../lib/cottage-store.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function bodyOf(request){
  if(Number(request.headers.get('content-length')||0)>100000)throw new CottageError('记忆内容过大',413);
  const raw=await request.text();
  if(raw.length>100000)throw new CottageError('记忆内容过大',413);
  try{return JSON.parse(raw);}catch{throw new CottageError('记忆内容格式无效');}
}
async function handle(request,{params}){
  try{
    const user=await sessionFromRequest(request);if(!user)return json({error:'请先登录忆伴'},401);
    if(request.method!=='GET'&&!sameOrigin(request))return json({error:'请求来源无效'},403);
    const {path}=await params,[resource,id]=path;
    if(resource!=='entries'||path.length>2)return json({error:'接口不存在'},404);
    if(request.method==='GET'){
      if(id)return json({item:await readCottageEntry(user,id)});
      const url=new URL(request.url);
      return json(await listCottageEntries(user,{offset:Number(url.searchParams.get('offset')||0),limit:Number(url.searchParams.get('limit')||100)}));
    }
    if(request.method==='POST'&&!id){const result=await createCottageEntry(user,await bodyOf(request),request.headers.get('idempotency-key'));return json(result,result.replay?200:201);}
    if(request.method==='PATCH'&&id)return json(await changeCottageEntry(user,id,await bodyOf(request)));
    if(request.method==='DELETE'&&id)return json(await deleteCottageEntry(user,id));
    return json({error:'不支持此操作'},405);
  }catch(error){return json({error:error.message||'小屋暂时无法保存，请重试'},error.status||400);}
}
const scoped=scopedRoute(handle);
export {scoped as GET,scoped as POST,scoped as PATCH,scoped as DELETE};
