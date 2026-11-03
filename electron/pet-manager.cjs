const {BrowserWindow,screen,ipcMain,Tray,Menu,nativeImage,app}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

function createPetManager({appUrl,getMainWindow}){
 const origin=new URL(appUrl).origin,overlays=new Map();let tray=null,quitting=false,pointerTimer=null;
 const offlineUrl=pathToFileURL(path.join(__dirname,'pet-offline.html')).href;
 const trusted=(event,overlayOnly=false)=>{const window=BrowserWindow.fromWebContents(event.sender);if(!window||event.senderFrame!==event.sender.mainFrame)return false;if(overlayOnly&&!overlays.has(window.id))return false;try{return new URL(event.senderFrame.url).origin===origin||(overlays.has(window.id)&&event.senderFrame.url===offlineUrl);}catch{return false;}};
 const openMain=()=>{const main=getMainWindow();if(main){main.show();main.focus();}};
 const openConversation=(input={})=>{const main=getMainWindow();if(main&&typeof input.threadId==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(input.threadId)&&typeof input.profileId==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(input.profileId)){const url=new URL('/app',appUrl);url.searchParams.set('chat',input.threadId);url.searchParams.set('petProfile',input.profileId);void main.loadURL(url.toString());}openMain();};
 function ensureTray(){if(tray)return;const image=nativeImage.createFromPath(path.join(__dirname,'../public/pets/sleepy-sheep/poster.png'));tray=new Tray(image.isEmpty()?nativeImage.createFromBuffer(Buffer.alloc(16*16*4,180),{width:16,height:16}):image.resize({width:32,height:18}));tray.setToolTip('忆伴 · 瞌睡小羊');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开忆伴',click:openMain},{label:'显示桌宠',click:show},{label:'隐藏桌宠',click:hide},{type:'separator'},{label:'退出忆伴',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',openMain);}
 async function show(){ensureTray();if(overlays.size){for(const {window} of overlays.values())window.showInactive();return {ok:true};}const display=screen.getPrimaryDisplay(),area=display.workArea;
  const window=new BrowserWindow({x:area.x,y:area.y,width:area.width,height:area.height,transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false,webPreferences:{preload:path.join(__dirname,'pet-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  overlays.set(window.id,{window,rects:[],ignoring:true});window.setIgnoreMouseEvents(true,{forward:true});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(e,url)=>{try{if(new URL(url).origin!==origin)e.preventDefault();}catch{e.preventDefault();}});window.on('closed',()=>overlays.delete(window.id));
  try{const url=new URL('/pet',appUrl);url.searchParams.set('desktop','1');await window.loadURL(url.toString());}catch{await window.loadFile(path.join(__dirname,'pet-offline.html'));}window.showInactive();
  if(!pointerTimer){pointerTimer=setInterval(()=>{const point=screen.getCursorScreenPoint();for(const entry of overlays.values()){if(entry.window.isDestroyed()||!entry.window.isVisible())continue;const bounds=entry.window.getBounds(),x=point.x-bounds.x,y=point.y-bounds.y;const hit=entry.dragging||entry.rects.some(r=>x>=r.x&&y>=r.y&&x<=r.x+r.width&&y<=r.y+r.height);if(entry.ignoring===hit){entry.ignoring=!hit;entry.window.setIgnoreMouseEvents(!hit,{forward:true});}}},60);pointerTimer.unref();}return {ok:true};}
 function hide(){for(const {window} of overlays.values())window.hide();return {ok:true};}
 ipcMain.handle('pet:show',(e)=>{if(!trusted(e))throw new Error('Untrusted desktop sender');return show();});
 ipcMain.handle('pet:hide',(e)=>{if(!trusted(e))throw new Error('Untrusted desktop sender');return hide();});
 ipcMain.handle('pet:main',(e,input)=>{if(!trusted(e,true))throw new Error('Untrusted desktop sender');openConversation(input);return {ok:true};});
 ipcMain.on('pet:focus',e=>{if(trusted(e,true))BrowserWindow.fromWebContents(e.sender).focus();});
 ipcMain.on('pet:pointer',(e,active)=>{if(trusted(e,true)){const entry=overlays.get(BrowserWindow.fromWebContents(e.sender).id);entry.dragging=active===true;}});
 ipcMain.on('pet:regions',(e,rects)=>{if(!trusted(e,true)||!Array.isArray(rects)||rects.length>100)return;const entry=overlays.get(BrowserWindow.fromWebContents(e.sender).id),bounds=entry.window.getBounds();entry.rects=rects.filter(r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0&&r.width<=bounds.width+10&&r.height<=bounds.height+10).map(({x,y,width,height})=>({x,y,width,height}));});
 screen.on('display-metrics-changed',()=>{for(const {window} of overlays.values()){const area=screen.getPrimaryDisplay().workArea;window.setBounds(area);}});
 app.on('before-quit',()=>{quitting=true;if(pointerTimer)clearInterval(pointerTimer);for(const {window} of overlays.values())window.destroy();tray?.destroy();});
 return {show,hide,shouldKeepRunning:()=>!quitting&&Boolean(tray),isQuitting:()=>quitting};
}
module.exports={createPetManager};
