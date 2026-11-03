import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin} from './helpers.mjs';

const first='先听你说。',second='今天不用急着复盘。';
async function openChat(page,mobile=false){
  if(mobile){await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();}
  else await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();
  await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();
}

for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  test(`${device}: typing stays in the header and every bubble arrives complete`,async({page})=>{
    await page.setViewportSize({width,height});
    await signInAsNewAdmin(page,{prefix:`whole-${device}`,credits:5});
    await openChat(page,device==='mobile');
    await page.evaluate(()=>{
      window.bubbleSnapshots=[];window.bubbleArrivals={};
      window.deliveryObserver=new MutationObserver(()=>{
        const texts=[...document.querySelectorAll('.cw-assistant .im-bubble')].map(el=>el.textContent.trim());
        if(texts.length)window.bubbleSnapshots.push(texts);
        for(const text of texts)window.bubbleArrivals[text]??=performance.now();
      });
      window.deliveryObserver.observe(document.querySelector('.cw-message-list')||document.querySelector('.cw-feed'),{subtree:true,childList:true,characterData:true});
    });
    await page.getByLabel('发送给家伴的消息').fill('[test:companion-bubbles]');
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const typing=page.locator('.cw-header [role="status"]');
    await expect(typing).toHaveText(' · 对方正在输入…');
    await page.waitForTimeout(500); // Model sends five-character chunks every 120 ms.
    await expect(page.locator('.cw-assistant .im-bubble')).toHaveCount(0);
    await expect(page.locator('.cw-thinking')).toHaveCount(0);
    await expect(page.locator('.cw-header')).toContainText('AI 伙伴');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    fs.mkdirSync('artifacts/chat-delivery',{recursive:true});
    await page.screenshot({path:`artifacts/chat-delivery/${device}-waiting.png`});
    await expect(page.locator('.cw-assistant .im-bubble')).toHaveText([first,second],{timeout:15000});
    await expect(page.locator('.cw-assistant .im-sticker img')).toHaveCount(1);
    await expect(typing).toHaveCount(0);
    const recorded=await page.evaluate(()=>({snapshots:window.bubbleSnapshots,arrivals:window.bubbleArrivals}));
    expect(recorded.snapshots.length).toBeGreaterThan(0);
    expect(recorded.snapshots.flat().every(text=>[first,second].includes(text))).toBe(true);
    expect(recorded.arrivals[second]-recorded.arrivals[first]).toBeGreaterThanOrEqual(400);
    expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(4);
    await page.screenshot({path:`artifacts/chat-delivery/${device}-delivered.png`});
    await page.evaluate(()=>window.deliveryObserver.disconnect());
    await page.reload();await openChat(page,device==='mobile');
    await expect(page.locator('.cw-assistant .im-bubble')).toHaveText([first,second]);
    await expect(page.locator('.cw-assistant .im-sticker img')).toHaveCount(1);
    await expect(page.locator('.cw-header [role="status"]')).toHaveCount(0);
    expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(4);
  });
}

test('cancellation and model failure clear typing without delivering unfinished text',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'whole-stop',credits:5});await openChat(page);
  await page.getByLabel('发送给家伴的消息').fill('[test:slow]');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(page.locator('.cw-header [role="status"]')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator('.cw-assistant .im-bubble')).toHaveCount(0);
  await page.getByRole('button',{name:'停止生成',exact:true}).click();
  await expect(page.locator('.cw-message-status')).toContainText('已停止');
  await expect(page.locator('.cw-header [role="status"]')).toHaveCount(0);
  await expect(page.locator('.cw-assistant .im-bubble')).toHaveCount(0);
  expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(5);
  await page.getByLabel('发送给家伴的消息').fill('[test:fail]');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:15000});
  await expect(page.locator('.cw-message-status').last()).toContainText('积分已退回');
  await expect(page.locator('.cw-header [role="status"]')).toHaveCount(0);
  await expect(page.locator('.cw-assistant .im-bubble')).toHaveCount(0);
  expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(5);
});

test('dense unseparated replies become complete bubbles and later messages are never merged',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'whole-semantic',credits:5});await openChat(page);
  const send=async text=>{
    await page.getByLabel('发送给家伴的消息').fill(text);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});
    await expect(page.locator('.cw-header [role="status"]')).toHaveCount(0,{timeout:15000});
  };
  await send('[test:long-bubble]');
  const firstReply=page.locator('.cw-assistant').first().locator('.im-bubble');
  expect(await firstReply.count()).toBeGreaterThan(1);
  const texts=await firstReply.allTextContents();
  expect(texts.every(text=>Array.from(text.trim()).length<=64&&text.trim().endsWith('。'))).toBe(true);
  await send('[test:many-bubbles]');
  const expected=['第一条。','第二条。','第三条。','第四条。','第五条。','第六条。'];
  await expect(page.locator('.cw-assistant').last().locator('.im-bubble')).toHaveText(expected);
  const listed=await(await page.request.get('/api/chat/threads')).json();
  const thread=await(await page.request.get(`/api/chat/threads/${listed.threads[0].id}`)).json();
  expect(thread.messages.filter(message=>message.role==='assistant').at(-1).parts.map(part=>part.text)).toEqual(expected);
  await page.reload();await openChat(page);
  await expect(page.locator('.cw-assistant').last().locator('.im-bubble')).toHaveText(expected);
  expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(3);
});
