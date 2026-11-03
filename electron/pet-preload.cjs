const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('yibanDesktop',Object.freeze({version:1,
 showPets:()=>ipcRenderer.invoke('pet:show'),hidePets:()=>ipcRenderer.invoke('pet:hide'),openMain:input=>ipcRenderer.invoke('pet:main',input),
 hitRegions:rects=>ipcRenderer.send('pet:regions',rects),focusInput:()=>ipcRenderer.send('pet:focus'),capturePointer:active=>ipcRenderer.send('pet:pointer',active===true),
}));
