import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedMemories, seedAlbums } from './seed.mjs';

const dataDir = process.env.YIBAN_DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(dataDir, {recursive:true});
export const uploadDir = path.join(dataDir, 'uploads');
const globalKey = '__yiban_database';
const db = globalThis[globalKey] || new DatabaseSync(path.join(dataDir, 'yiban.sqlite'));
globalThis[globalKey] = db;
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(collection,id));`);

export function all(collection) {
  return db.prepare('SELECT value FROM documents WHERE collection=?').all(collection).map(x => JSON.parse(x.value));
}
export function get(collection,id) {
  const row=db.prepare('SELECT value FROM documents WHERE collection=? AND id=?').get(collection,id);
  return row ? JSON.parse(row.value) : null;
}
export function put(collection,document) {
  db.prepare('INSERT INTO documents(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value').run(collection,document.id,JSON.stringify(document));
  return document;
}
export function remove(collection,id) { db.prepare('DELETE FROM documents WHERE collection=? AND id=?').run(collection,id); }
export function log(type, text, memoryId=null) {
  return put('activity', {id:randomUUID(),familyId:'family',type,text,memoryId,createdAt:new Date().toISOString()});
}

if (!get('system','initialized')) {
  for(const memory of seedMemories) put('memories',{...memory,status:'confirmed',assetType:'illustration',audio:null,video:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',isDemo:true});
  seedAlbums.forEach(a=>put('albums',a));
  put('settings',{id:'family',familyName:'林家的记忆小屋',elderName:'林阿姨',fontSize:'large',highContrast:false,autoPlay:false,speechRate:0.85, demoNotice:true});
  [{id:'member-1',name:'小雨',role:'管理员',relation:'女儿',color:'peach'},{id:'member-2',name:'陈叔叔',role:'家庭成员',relation:'丈夫',color:'sage'},{id:'member-3',name:'林阿姨',role:'老人',relation:'本人',color:'lavender'}].forEach(m=>put('members',m));
  put('anniversaries',{id:'anniversary-1',title:'林阿姨的生日',date:'03-18',memoryIds:['demo-child','demo-newyear']});
  put('system',{id:'initialized',value:true});
}

export function snapshot() {
  return {memories:all('memories').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),albums:all('albums'),members:all('members'),anniversaries:all('anniversaries'),activity:all('activity').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,300),settings:get('settings','family'),aiEnabled:Boolean(process.env.AI_API_URL&&process.env.AI_API_KEY&&process.env.AI_MODEL)};
}
