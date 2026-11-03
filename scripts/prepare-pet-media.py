"""Ingest user videos, remove connected background, normalize, encode VP9 alpha.
Original videos are never modified. sources.json records provenance and fallbacks.
"""
import argparse, json, subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import imageio_ffmpeg
from rembg import remove,new_session

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path.home()/'Desktop'/'\u684c\u5ba0'
OUT=ROOT/'public/pets/sleepy-sheep'
WORK=ROOT/'artifacts/pet-ingest'
IDS={'1395':'idle','2094':'stretch','2735':'play','5384':'thinking','5506':'speaking','6238':'rub-eyes','7013':'celebrate','7347':'petting','9223':'sleep-start','9783':'walk'}
SESSION=None

def matte(frame):
    """Segment the subject and reduce green spill at soft alpha edges."""
    global SESSION
    if SESSION is None:SESSION=new_session('u2netp')
    # Segment the subject instead of erasing white wool along with white backdrops.
    rgb=cv2.cvtColor(cv2.resize(frame,(640,360),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB)
    result=np.array(remove(Image.fromarray(rgb),session=SESSION))
    edge=result[:,:,3]<250
    red=result[:,:,0].astype(np.int16);green=result[:,:,1].astype(np.int16);blue=result[:,:,2].astype(np.int16)
    result[:,:,1]=np.where(edge,np.minimum(green,np.maximum(red,blue)+8),green).astype(np.uint8)
    return result

def run(only=None,force=False):
    OUT.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();records=[]
    for p in sorted(SOURCE.glob('*.mp4')):
        code=p.name.split('-')[4];action=IDS.get(code)
        if not action or (only and action!=only):continue
        target=OUT/(action+'.webm')
        if target.exists() and not force:continue
        c=cv2.VideoCapture(str(p));fps=c.get(cv2.CAP_PROP_FPS);length=int(c.get(cv2.CAP_PROP_FRAME_COUNT));frames=[];bounds=[]
        for i in range(length):
            ok,f=c.read()
            if not ok:break
            # Remove the source-image-to-video background transition.
            if i<round(fps*.55):continue
            rgba=matte(f);pts=cv2.findNonZero((rgba[:,:,3]>128).astype(np.uint8))
            if pts is not None:bounds.append(cv2.boundingRect(pts));frames.append(rgba)
        c.release()
        if not frames:raise RuntimeError('No foreground: '+p.name)
        # One transform per clip, never per frame (prevents zoom/pumping).
        x0=min(b[0] for b in bounds);y0=min(b[1] for b in bounds);x1=max(b[0]+b[2] for b in bounds);y1=max(b[1]+b[3] for b in bounds)
        scale=min(290/(y1-y0),300/(x1-x0));w=round((x1-x0)*scale);h=round((y1-y0)*scale)
        cmd=[ffmpeg,'-y','-v','error','-f','rawvideo','-pixel_format','rgba','-video_size','640x360','-framerate',str(fps),'-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','28','-auto-alt-ref','0','-row-mt','1',str(target)]
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
        for i,rgba in enumerate(frames):
            patch=cv2.resize(rgba[y0:y1,x0:x1],(w,h),interpolation=cv2.INTER_AREA);canvas=np.zeros((360,640,4),np.uint8);canvas[330-h:330,(640-w)//2:(640-w)//2+w]=patch
            proc.stdin.write(canvas.tobytes())
            if i==len(frames)//2:Image.fromarray(canvas).save(WORK/(action+'-check.png'))
            if action=='idle' and i==0:Image.fromarray(canvas).save(OUT/'poster.png')
            if action=='sleep-start' and i==len(frames)-1:Image.fromarray(canvas).save(WORK/'sleep-end.png')
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed: '+action)
        records.append(dict(action=action,source=p.name,frames=len(frames),fps=fps,transform=dict(crop=[x0,y0,x1,y1],scale=scale),status='needs-visual-review'))
        print(action,flush=True)
    manifest=WORK/'media-provenance.json';old=json.loads(manifest.read_text()) if manifest.exists() else [];manifest.write_text(json.dumps(old+records,ensure_ascii=False,indent=2),encoding='utf8')
    # Explicitly derived transitions, never presented as original generated clips.
    if (OUT/'sleep-start.webm').exists():
        for name,filters in [('wake','reverse'),('sleep-rest','trim=start=3.7,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=3')]:
            if force or not (OUT/(name+'.webm')).exists():
                subprocess.run([ffmpeg,'-y','-v','error','-c:v','libvpx-vp9','-i',str(OUT/'sleep-start.webm'),'-vf',filters,'-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-crf','28','-b:v','0',str(OUT/(name+'.webm'))],check=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--only');parser.add_argument('--force',action='store_true');args=parser.parse_args();run(args.only,args.force)
