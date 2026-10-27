/* Notifications only. Authenticated pages and API responses are never cached. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let jobId;try{jobId=event.data.json().jobId;}catch{return;}
 if(typeof jobId!=='string'||!/^proactive-[a-f0-9]{64}$/.test(jobId))return;
 const response=await fetch('/api/proactive/delivery/'+jobId,{credentials:'include',cache:'no-store'});if(!response.ok)return;
 const data=await response.json();if(data.suppressed)return;
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(clients.some(client=>client.visibilityState==='visible')){for(const c of clients)c.postMessage({type:'proactive-arrived'});return;}
 await self.registration.showNotification(data.title,{body:data.body,tag:data.tag,renotify:false,data:{url:data.url},icon:'/app-icon.svg'});
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL(event.notification.data?.url||'/app',self.location.origin);if(url.origin!==self.location.origin||url.pathname!=='/app')return;const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});const tab=tabs[0];if(tab){await tab.navigate(url.href);await tab.focus();}else await self.clients.openWindow(url.href);})());});
