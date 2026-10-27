export async function chatAPI(path,options={}){
  const response=await fetch(`/api/chat/${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'暂时无法连接，请重试'),data);return data;
}
