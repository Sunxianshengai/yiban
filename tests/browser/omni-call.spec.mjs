import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin} from './helpers.mjs';
test.use({launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
const folder='.impeccable/review/omni-call';
async function openChat(page,mobile){if(mobile){await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();}else await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();}
// A second browser-native PeerConnection stands in for the provider. Both RTP
// audio and DataChannel events are real; no microphone data leaves localhost.
async function nativePeer(page){
 await page.route('**/api/omni-calls/offer',async route=>{
  const response=await route.fetch(),result=await response.json();if(response.status()!==201)return route.fulfill({response});
  const request=route.request().postDataJSON();
  result.answer=await page.evaluate(async({sdp,session})=>{
   const context=new AudioContext();await context.resume();const oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();gain.gain.value=0;oscillator.connect(gain).connect(destination);oscillator.start();
   const peer=new RTCPeerConnection({iceServers:[]});peer.addTrack(destination.stream.getAudioTracks()[0],destination.stream);const remote={peer,context,gain,channel:null,received:[],session:null,mic:null};window.__omniPeer=remote;
   peer.ontrack=event=>{remote.mic=event.track;};
   peer.ondatachannel=event=>{remote.channel=event.channel;event.channel.onopen=()=>event.channel.send(JSON.stringify({type:'session.created',event_id:crypto.randomUUID()}));event.channel.onmessage=message=>{const data=JSON.parse(message.data);remote.received.push(data);if(data.type==='session.update'){remote.session=data.session;event.channel.send(JSON.stringify({type:'session.updated',session:data.session,event_id:crypto.randomUUID()}));}};};
   await peer.setRemoteDescription({type:'offer',sdp});await peer.setLocalDescription(await peer.createAnswer());if(peer.iceGatheringState!=='complete')await new Promise(resolve=>peer.addEventListener('icegatheringstatechange',()=>{if(peer.iceGatheringState==='complete')resolve();}));return peer.localDescription.sdp;
  },{sdp:request.sdp,session:result.session});
  await route.fulfill({response,json:result});
 });
}
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: phone opens real WebRTC, applies private voice, interrupts, mutes and releases resources`,async({browser})=>{
  test.setTimeout(90000);const context=await browser.newContext({viewport:{width,height},permissions:['microphone']});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await signInAsNewAdmin(page,{prefix:'omni',credits:9});await openChat(page,device==='mobile');const before=(await(await page.request.get('/api/credits/balance')).json()).balance;
  await page.getByRole('button',{name:'语音通话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'语音通话',exact:true});await expect(dialog).toContainText('预览体验');await expect(dialog.getByRole('button',{name:'开始通话',exact:true})).toBeEnabled();await expect(dialog.getByLabel('通话声音')).toHaveValue(/mock-omni/);fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:`${folder}/${device}-ready.png`,fullPage:true});
  await nativePeer(page);await dialog.getByRole('button',{name:'开始通话',exact:true}).click();await expect(dialog.locator('.oc-status')).toContainText('通话中',{timeout:30000});expect(await page.evaluate(()=>window.__omniPeer.session.turn_detection.interrupt_response)).toBe(true);expect(await page.evaluate(()=>window.__omniPeer.session.voice)).toMatch(/mock-omni/);
  await page.evaluate(()=>{const r=window.__omniPeer;r.gain.gain.value=.15;for(const event of [{type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'今天有点累。'},{type:'response.created',response:{id:'reply-1'}},{type:'response.audio_transcript.delta',item_id:'a1',response_id:'reply-1',delta:'那先歇一会儿。'}])r.channel.send(JSON.stringify({...event,event_id:crypto.randomUUID()}));});
  await expect(dialog.getByLabel('通话字幕')).toContainText('那先歇一会儿');await page.evaluate(()=>window.__omniPeer.channel.send(JSON.stringify({type:'input_audio_buffer.speech_started',event_id:crypto.randomUUID()})));await expect(dialog.getByLabel('通话字幕')).toContainText('已打断');await expect.poll(()=>page.evaluate(()=>window.__omniPeer.received.some(e=>e.type==='response.cancel'))).toBe(true);expect(await dialog.locator('audio').evaluate(e=>e.muted)).toBe(true);
  await dialog.getByRole('button',{name:'静音',exact:true}).click();await expect(dialog.getByRole('button',{name:'取消静音',exact:true})).toHaveAttribute('aria-pressed','true');await dialog.getByRole('button',{name:'取消静音',exact:true}).click();
  await page.screenshot({path:`${folder}/${device}-connected.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:'挂断通话',exact:true}).click();await expect(dialog.locator('.oc-state')).toContainText('下次再聊');expect(await dialog.locator('audio').evaluate(e=>e.srcObject)).toBe(null);
  const state=await(await page.request.get('/api/omni-calls')).json();expect(state.available).toBe(true);expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(before);
  await dialog.getByRole('button',{name:'关闭窗口',exact:true}).click();await expect(dialog).toHaveCount(0);expect(errors).toEqual([]);await context.close();
 });
}
test('permission denial leaves the chat usable without recording',async({page})=>{
 await signInAsNewAdmin(page,{prefix:'omni-error',credits:0});await openChat(page,false);await page.getByRole('button',{name:'语音通话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'语音通话'});await page.evaluate(()=>{window.__oldMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});await dialog.getByRole('button',{name:'开始通话',exact:true}).click();await expect(dialog).toContainText('没有获得麦克风权限');await expect(dialog.getByRole('button',{name:'再次通话',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'关闭窗口'}).click();await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();
});
test('hanging up during permission acquisition cannot revive an old call; failed SDP stops every track',async({page,context})=>{
 await context.grantPermissions(['microphone']);await signInAsNewAdmin(page,{prefix:'omni-race',credits:0});await openChat(page,false);await page.getByRole('button',{name:'语音通话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'语音通话'});
 await page.evaluate(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__pendingMics=[];navigator.mediaDevices.getUserMedia=async options=>{const stream=await original(options);return new Promise(resolve=>window.__pendingMics.push({stream,resolve}));};});
 await page.route('**/api/omni-calls/offer',route=>route.fulfill({status:503,json:{error:'模拟网络断开'}}));
 await dialog.getByRole('button',{name:'开始通话',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__pendingMics.length)).toBe(1);await dialog.getByRole('button',{name:'挂断通话',exact:true}).click();await dialog.getByRole('button',{name:'再次通话',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__pendingMics.length)).toBe(2);
 await page.evaluate(()=>window.__pendingMics[0].resolve(window.__pendingMics[0].stream));await expect.poll(()=>page.evaluate(()=>window.__pendingMics[0].stream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);await expect(dialog.getByRole('button',{name:'挂断通话'})).toBeVisible();
 await page.evaluate(()=>window.__pendingMics[1].resolve(window.__pendingMics[1].stream));await expect(dialog).toContainText('模拟网络断开');await expect.poll(()=>page.evaluate(()=>window.__pendingMics.every(p=>p.stream.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
});
