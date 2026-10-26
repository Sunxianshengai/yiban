export async function familiaAPI(endpoint,{body,...options}={}){
  const response=await fetch(`/api/familia/${endpoint}`,{...options,headers:{'Content-Type':'application/json',...options.headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'暂时无法连接，请重试');return data;
}
