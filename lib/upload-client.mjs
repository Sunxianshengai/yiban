import {uploadPresigned} from '@vercel/blob/client';

// 客户端共用的素材上传：家庭记忆与聊天图片走同一条链路。
// 远端用 Vercel Blob 签名直传（服务端在 /api/upload/complete 核实并登记），
// 本机开发直接 multipart 交给 /api/upload。返回 {url,type}，url 是带权限检查的 /api/media 地址。
const EXTENSIONS={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/ogg':'ogg','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm'};

export async function uploadMedia(api,file,{remoteStorage=false,maxBytes=50*1024*1024}={}){
  if(!file.size||file.size>maxBytes)throw new Error('请选择 50 MB 以内的素材文件');
  if(remoteStorage){
    const extension=EXTENSIONS[file.type];
    if(!extension)throw new Error('不支持的素材格式');
    const blob=await uploadPresigned(`yiban/${crypto.randomUUID()}.${extension}`,file,{access:'private',handleUploadUrl:'/api/upload/token',contentType:file.type,multipart:file.size>5*1024*1024});
    return {...(await api('/upload/complete',{method:'POST',body:JSON.stringify({pathname:blob.pathname})})),type:file.type};
  }
  const data=new FormData();data.append('file',file);
  return await api('/upload',{method:'POST',body:data});
}
