import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFileSync} from 'node:fs';
const env={...process.env,YIBAN_DESKTOP_URL:'http://localhost:3852/pet',ELECTRON_RUN_AS_NODE:''};
delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.PET_ELECTRON_EXECUTABLE||undefined,args:['.',`--user-data-dir=${path.resolve('artifacts/pet-electron-data-'+Date.now())}`],env});
try{
 const main=await app.firstWindow();await main.waitForLoadState('domcontentloaded');
 const login=await main.evaluate(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@yiban.test',password:'TestPassword123!'})});const cfg=await (await fetch('/api/pet/config')).json();await fetch('/api/pet/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pets:cfg.main.pets.map(p=>({...p,display:'web'}))})});return r.status;});assert.equal(login,200);
 await main.reload();await main.getByRole('button',{name:'放到桌面',exact:true}).waitFor({timeout:30000});
 const overlayPromise=app.waitForEvent('window');await main.getByRole('button',{name:'放到桌面',exact:true}).click();const overlay=await overlayPromise;
 await overlay.waitForFunction(()=>[...document.querySelectorAll('video')].some(v=>v.videoWidth>0&&v.currentTime>0),{timeout:30000});
 await overlay.screenshot({path:'artifacts/pet-ingest/desktop-overlay.png'});
 const state=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({id:w.id,visible:w.isVisible(),alwaysOnTop:w.isAlwaysOnTop(),bounds:w.getBounds(),url:w.webContents.getURL(),sandbox:w.webContents.getLastWebPreferences().sandbox,node:w.webContents.getLastWebPreferences().nodeIntegration})));
 assert.equal(state.length,2);assert.ok(state.some(w=>w.alwaysOnTop&&w.url.includes('desktop=1')&&w.sandbox&&!w.node));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('desktop=1')).close());assert.ok((await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>!w.isVisible()).length))>=1);
 writeFileSync('artifacts/pet-ingest/desktop-smoke.json',JSON.stringify({passed:true,windows:state},null,2));console.log('Desktop overlay, shared login, sandbox and close-to-tray passed');
}finally{await app.close();}
