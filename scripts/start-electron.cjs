const {spawn}=require('node:child_process');
const {cpSync,mkdirSync,existsSync,writeFileSync,statSync}=require('node:fs');
const path=require('node:path');
const os=require('node:os');

// Some Windows profile/workspace ACLs make Chromium abort before main.cjs runs.
// Keep the verified installed runtime intact and use normal temp inheritance.
// This does not disable Electron's sandbox or change any directory permissions.
const installed=require('electron');
let executable=installed;
if(process.platform==='win32'){
 const version=require('electron/package.json').version;
 const target=path.join(os.tmpdir(),'yiban-electron-runtime',version);
 const marker=path.join(target,`${statSync(installed).mtimeMs}.ready`);
 if(!existsSync(marker)){
  mkdirSync(target,{recursive:true});
  cpSync(path.dirname(installed),target,{recursive:true});
  writeFileSync(marker,version);
 }
 executable=path.join(target,'electron.exe');
}
const child=spawn(executable,['.',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
