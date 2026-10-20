'use client';
import {useState,useRef} from 'react';
import Icon from './Icon';
import {Button,Field,Modal} from './UI';

// 为一个成员复刻其真实声音（阿里云 CosyVoice）。
// 流程：本地录音/上传 → 保存到 /api/media → 调 /voice/enroll 发起克隆 → 回写 member.voiceId。
export default function VoiceEnroll({member,api,notify,close,refresh}) {
  const [mode,setMode]=useState('record'); // record | upload
  const [recording,setRecording]=useState(false);
  const [mediaUrl,setMediaUrl]=useState(null); // /api/media/xxx
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const [mediaName,setMediaName]=useState(null); // 已选录音文件名
  const mediaRef=useRef(null);
  const chunksRef=useRef([]);
  const recorderRef=useRef(null);

  if(!member)return null;

  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);
      chunksRef.current=[];
      recorder.ondataavailable=e=>chunksRef.current.push(e.data);
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunksRef.current,{type:'audio/webm'});
        await uploadAndSet(blob);
      };
      recorderRef.current=recorder;recorder.start();setRecording(true);
    }catch{notify('无法访问麦克风，请改用文件上传','error');}
  };
  const stopRecording=()=>{recorderRef.current?.stop();setRecording(false);};

  const uploadAndSet=async(blob,name)=>{
    setBusy(true);
    try{
      // 上传接口按扩展名决定存储类型；文件名跟随真实来源（现场录音为 webm，文件上传保留原扩展名）。
      const safeName=name||'voice.webm';
      const form=new FormData();form.append('file',blob,safeName);
      const result=await api('/upload',{method:'POST',body:form});
      setMediaUrl(result.url);setMediaName(safeName);
      notify('录音已保存，可以开始复刻');
    }catch(e){notify(e.message,'error');}
    finally{setBusy(false);}
  };

  const onFile=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    // 浏览器对 file.type 可能为空，按扩展名兜底，确保 /upload 存为音频。
    const ext=(file.name.split('.').pop()||'wav').toLowerCase();
    const typed=(file.type&&file.type.startsWith('audio/'))?file:new File([file],`voice.${ext}`,{type:`audio/${ext==='mp3'?'mpeg':ext}`});
    setMediaName(file.name);
    await uploadAndSet(typed,file.name);
  };

  const enroll=async()=>{
    if(!mediaUrl)return notify('请先完成录音或上传','error');
    if(!consent)return notify('请先勾选同意用这段录音复刻您自己的声音','error');
    setBusy(true);
    try{
      const updated=await api('/voice/enroll',{method:'POST',body:JSON.stringify({memberId:member.id,audioUrl:mediaUrl,consent:true})});
      await refresh();
      notify(`${member.name} 的声音已复刻成功，老人端将用这个声音讲故事`);
      close();
    }catch(e){notify(e.message,'error');}
    finally{setBusy(false);}
  };

  return <Modal title={`复刻 ${member.name} 的声音`} description="用 5–20 秒清晰的中文朗读，复刻出专属音色。每段声音只用于存储和家庭回放。" onClose={close}>
    <div className="voice-enroll">
      {member.voiceStatus==='ready'&&<div className="inline-notice"><Icon name="check"/><span>已复刻过声音，重新提交会覆盖原有音色。</span></div>}
      <div className="voice-tabs">
        <button className={mode==='record'?'active':''} onClick={()=>setMode('record')} disabled={busy}>现场录音</button>
        <button className={mode==='upload'?'active':''} onClick={()=>setMode('upload')} disabled={busy}>上传音频</button>
      </div>
      {mode==='record'&&<div className="voice-record">
        <button className={`record-button ${recording?'recording':''}`} onClick={recording?stopRecording:startRecording} disabled={busy}>
          <Icon name="mic" size={36}/>
        </button>
        <p>{recording?'正在录音，说完点击停止（建议 5–20 秒）':'点击开始录音，朗读一段熟悉的话'}</p>
      </div>}
      {mode==='upload'&&<Field label="选择一段录音文件（mp3 / wav / m4a 等，5–20 秒清晰朗读）"><input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" onChange={onFile} disabled={busy}/></Field>}
      {mode==='upload'&&!mediaUrl&&<p className="voice-hint"><Icon name="info"/> 也可直接现场录音：切换到「现场录音」即可。</p>}
      {mediaUrl&&<p className="voice-ready"><Icon name="check"/> 已就绪：{mediaName||'待复刻的录音'}</p>}
      <label className="check-row consent-row">
        <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
        <span>我同意用这段录音复刻 <strong>{member.name}</strong> 本人的声音，仅用于家庭陪伴回放。</span>
      </label>
      <div className="inline-notice"><Icon name="info"/><span>合成的语音为 AI 生成内容，老人端播放时会明确标注「AI 合成」。请仅复刻本人的声音。</span></div>
      <div className="modal-actions">
        <Button variant="ghost" type="button" onClick={close}>取消</Button>
        <Button icon="volume" busy={busy} disabled={!mediaUrl||!consent} onClick={enroll}>复刻声音</Button>
      </div>
    </div>
  </Modal>;
}
