// One isolated SQLite directory and empty cloud credentials per test server.
import {spawn} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
const port=Number(process.env.YIBAN_TEST_PORT||3887),root=path.resolve('.test-runs');mkdirSync(root,{recursive:true});
const directory=mkdtempSync(path.join(root,'run-')),env={...process.env};
for(const key of Object.keys(env))if(/^(DATABASE_URL|POSTGRES|PGHOST|PGUSER|PGPASSWORD|PGDATABASE|NEON_|BLOB_|DEEPSEEK_|AI_|DASHSCOPE_|QWEN_|OMNI_|WEB_PUSH_|PROACTIVE_CRON_|YIBAN_(ASR|VISION|TTS|SETUP))/.test(key))env[key]='';
Object.assign(env,{VERCEL:'',VERCEL_ENV:'',YIBAN_DATA_DIR:directory,YIBAN_DATA_ENV:'test',YIBAN_DATABASE_ENVIRONMENT:'',YIBAN_NEXT_DIST_DIR:'.next-test',AI_API_URL:`http://127.0.0.1:${port+1}/v1/chat/completions`,AI_API_KEY:'test-only',AI_MODEL:'mock',YIBAN_VOICE_MOCK:'1',QWEN_VOICE_API_KEY:'test-only',QWEN_VOICE_BASE_URL:`http://127.0.0.1:${port+2}/api/v1`,QWEN_VOICE_MODEL:'qwen-audio-3.1-tts-plus'});
const vapid=webpush.generateVAPIDKeys();env.WEB_PUSH_PUBLIC_KEY=vapid.publicKey;env.WEB_PUSH_PRIVATE_KEY=vapid.privateKey;env.PROACTIVE_CRON_SECRET='local-proactive-test';
env.OMNI_CALL_MOCK='1';
writeFileSync(path.join(directory,'test-environment.json'),JSON.stringify({environment:'test',url:`http://localhost:${port}`,directory,createdAt:new Date().toISOString()},null,2));
writeFileSync(path.join(root,`active-${port}.json`),JSON.stringify({environment:'test',url:`http://localhost:${port}`,directory}));
const children=[];
function start(args,extra={}){const child=spawn(process.execPath,args,{env:{...env,...extra},stdio:'inherit',windowsHide:true});children.push(child);return child;}
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('exit',stop);
console.log(`Isolated test environment: http://localhost:${port}\nData: ${directory}\nNo production database or provider credentials are loaded.`);
if(process.argv.includes('--build')){const build=start(['node_modules/next/dist/bin/next','build']);const code=await new Promise(resolve=>build.once('exit',resolve));if(code!==0)process.exit(code||1);}
start(['tests/mock-model.mjs'],{MOCK_PORT:String(port+1)});start(['tests/mock-companion-voice.mjs'],{VOICE_MOCK_PORT:String(port+2)});
start(['node_modules/next/dist/bin/next',process.argv.includes('--build')||process.argv.includes('--start')?'start':'dev','--hostname','127.0.0.1','-p',String(port)]);
