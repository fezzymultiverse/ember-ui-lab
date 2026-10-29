/* Ember media feature router. Never used as chat fallback; paid jobs need explicit confirmation. */
'use strict';
(() => {
 const W=window, get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d;}catch(_){return d;}};
 const cfg=()=>get('ember_media_cfg',{enabled:false});
 const supported={stability:['image','audio','video']};
 const jobs=new Map(); let dbPromise;
 function db(){ if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('ember_media_artifacts',1);r.onupgradeneeded=()=>r.result.createObjectStore('artifacts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return dbPromise; }
 async function store(a){const d=await db();await new Promise((resolve,reject)=>{const t=d.transaction('artifacts','readwrite');t.objectStore('artifacts').put(a);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});return a;}
 async function list(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('artifacts').objectStore('artifacts').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.at-a.at));r.onerror=()=>reject(r.error);});}
 async function remove(id){const d=await db();await new Promise((resolve,reject)=>{const t=d.transaction('artifacts','readwrite');t.objectStore('artifacts').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});notify();}
 function notify(){W.dispatchEvent(new CustomEvent('ember-media-update'));}
 function retryTime(r){const h=r.headers.get('retry-after');const n=Number(h);return h ? (Number.isFinite(n)?n:Math.max(1,(Date.parse(h)-Date.now())/1000)) : 60;}
 async function responseError(r){let p={};try{p=await r.json();}catch(_){}return Object.assign(new Error((p.errors||[]).join('; ')||p.message||p.error?.message||'Provider HTTP '+r.status),{status:r.status,retryAfter:retryTime(r)});}
 async function stability(kind,prompt,options,job){
   const P=W.Prov, model=kind==='image'?'stable-image-core':'stable-audio-2.5';
   const candidates=P.rotation('stability','media:'+model); let last;
   for(const e of candidates){
     if(e.bad || P.isCool(e.key) || P.modelResting('stability',e.key,model))continue;
     const form=new FormData();form.set('prompt',prompt);
     if(kind==='image'){form.set('output_format','png');form.set('aspect_ratio',options.aspect||'1:1');}
     else{form.set('model','stable-audio-2.5');form.set('duration',String(Math.max(1,Math.min(190,Number(options.duration)||20))));form.set('output_format','mp3');}
     const ctl=new AbortController();job.controller=ctl;
     const timer=setTimeout(()=>ctl.abort(),240000),start=performance.now();
     try{
       const path=kind==='image'?'/v2beta/stable-image/generate/core':'/v2beta/audio/stable-audio-2/text-to-audio';
       const r=await fetch(P.CFG.stability.base+path,{method:'POST',headers:{Authorization:'Bearer '+e.key,Accept:kind==='image'?'image/*':'audio/*'},body:form,signal:ctl.signal});
       if(!r.ok)throw await responseError(r);
       if(r.headers.get('finish-reason')==='CONTENT_FILTERED')throw Object.assign(new Error('Provider filtered this result.'),{status:403});
       const blob=await r.blob();if(!blob.size || !blob.type.startsWith(kind==='image'?'image/':'audio/'))throw Object.assign(new Error('Provider returned no valid media artifact.'),{status:502});
       P.record('stability',model,true,Math.round(performance.now()-start),200);
       return {blob,model};
     }catch(er){
       if(ctl.signal.aborted)throw Object.assign(new Error('Generation stopped or timed out. Provider billing may still apply; no automatic duplicate submitted.'),{code:'cancelled'});
       last=er;P.record('stability',model,false,0,er.status);
       if(er.status===401){e.bad=true; e.st={at:Date.now(),ok:false,code:401,msg:'Key rejected'};U.LS.set('ember_keys',P.keys());continue;}
       if(er.status===429){P.modelRest('stability',e.key,model,er.retryAfter);continue;}
       // Do not auto-repeat billed submissions on timeout/network/5xx or moderation failure.
       throw er;
     }finally{clearTimeout(timer);job.controller=null;}
   }
   throw last||new Error('No available Stability AI key for '+model+'. Add a key or wait for its cooldown.');
 }
 // Video = Stability images (Ken Burns + crossfade on a canvas) + one Stability audio track, recorded on-device. Stability's hosted video API was retired 24 Jul 2025.
 async function compose(imgs,audioBlob,dur,aspect,job){
   const [w,h]=aspect==='9:16'?[540,960]:[960,540],cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
   if(!W.MediaRecorder||!cv.captureStream)throw new Error('This device cannot record video inside the app.');
   const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   if(!mime)throw new Error('This device has no supported video recorder.');
   const bitmaps=await Promise.all(imgs.map(b=>createImageBitmap(b)));
   const AC=W.AudioContext||W.webkitAudioContext,ac=new AC();await ac.resume();
   try{
     const buf=await ac.decodeAudioData(await audioBlob.arrayBuffer()),total=Math.max(4,Math.min(dur,buf.duration));
     const dest=ac.createMediaStreamDestination(),src=ac.createBufferSource();src.buffer=buf;src.connect(dest);
     const stream=new MediaStream([...cv.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);
     const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000}),chunks=[];
     rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
     const stopped=new Promise((res,rej)=>{rec.onstop=res;rec.onerror=()=>rej(new Error('The video recorder failed.'));});
     const per=total/bitmaps.length,fade=Math.min(0.8,per/3);
     const cover=(bm,scale,dx,alpha)=>{const r=Math.max(w/bm.width,h/bm.height)*scale,bw=bm.width*r,bh=bm.height*r;ctx.globalAlpha=alpha;ctx.drawImage(bm,(w-bw)/2+dx,(h-bh)/2,bw,bh);ctx.globalAlpha=1;};
     const paint=t=>{
       const i=Math.min(bitmaps.length-1,Math.floor(t/per)),local=(t-i*per)/per,dir=i%2?-1:1;
       ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
       cover(bitmaps[i],1.04+0.08*(dir>0?local:1-local),dir*w*0.02*(local-0.5),1);
       const left=(i+1)*per-t;
       if(i<bitmaps.length-1&&left<fade){const nd=(i+1)%2?-1:1;cover(bitmaps[i+1],1.04+(nd>0?0:0.08),nd*w*0.02*-0.5,1-left/fade);}
     };
     paint(0);src.start();rec.start(500);const t0=performance.now();
     await new Promise(res=>{const iv=setInterval(()=>{if(job.cancelled){clearInterval(iv);res();return;}const t=(performance.now()-t0)/1000;if(t>=total){clearInterval(iv);res();return;}paint(t);},33);});
     if(rec.state!=='inactive')rec.stop();await stopped;try{src.stop();}catch(_){}
     if(job.cancelled)throw new Error('Job cancelled; provider billing may apply.');
     const out=new Blob(chunks,{type:'video/webm'});if(!out.size)throw new Error('The video recorder produced no data.');return out;
   }finally{try{ac.close();}catch(_){}bitmaps.forEach(b=>{try{b.close();}catch(_){}});}
 }
 async function video(prompt,options,job){
   const n=Math.max(2,Math.min(6,Number(options.scenes)||4)),dur=Math.max(8,Math.min(60,Number(options.duration)||20));
   const aspect=options.aspect==='9:16'?'9:16':'16:9';
   const shots=['wide establishing shot','close-up detail','dramatic low angle','different perspective','atmospheric moody shot','final cinematic frame'];
   const imgs=[];
   for(let i=0;i<n;i++){if(job.cancelled)throw new Error('Job cancelled; provider billing may apply.');job.step='Image '+(i+1)+' of '+n;notify();imgs.push((await stability('image',prompt+', '+shots[i],{aspect},job)).blob);}
   if(job.cancelled)throw new Error('Job cancelled; provider billing may apply.');
   job.step='Music';notify();const au=await stability('audio',prompt,{duration:dur},job);
   job.step='Composing video (plays in real time)';notify();
   return{blob:await compose(imgs,au.blob,dur,aspect,job),model:'Stable Image Core x'+n+' + Stable Audio 2.5'};
 }
 async function generate(request){
   if(!cfg().enabled)throw new Error('Media generation is OFF in AI Features.');
   if(request.confirmed!==true)throw new Error('Explicit generation confirmation required.');
   const {provider,kind}=request,prompt=String(request.prompt||'').trim();
   if(!supported[provider]?.includes(kind))throw new Error('Unsupported provider / media feature.');
   if(!prompt || prompt.length>10000)throw new Error('Prompt must contain 1–10,000 characters.');
   const id='media-'+crypto.randomUUID(),job={id,state:'running',provider,kind,at:Date.now()};jobs.set(id,job);notify();
   try{const result=kind==='video'?await video(prompt,request,job):await stability(kind,prompt,request,job);if(job.cancelled)throw new Error('Job cancelled; provider billing may apply.');const ext=result.blob.type.includes('png')?'png':result.blob.type.includes('jpeg')?'jpg':kind==='video'?'webm':'mp3';
     const a={id,provider,kind,model:result.model,prompt,blob:result.blob,name:'Ember-'+kind+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext,at:Date.now()};
     try{await store(a);job.state='done';job.artifactId=id;}catch(e){job.state='unsaved';job.artifact=a;throw new Error('Generated result could not be stored. Use the recovery download before closing Ember.');}
     notify();return{id,provider,kind,name:a.name};
   }catch(er){if(job.state!=='unsaved')job.state=job.cancelled?'cancelled':'failed';job.error=String(er.message||er).slice(0,240);notify();throw er;}
 }
 function cancel(id){const j=jobs.get(id);if(j){j.cancelled=true;j.controller?.abort();j.state='cancelled';notify();}}
 async function download(a){const url=URL.createObjectURL(a.blob),el=document.createElement('a');el.href=url;el.download=a.name;document.body.append(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 W.EmberMedia={cfg,supported,generate,list,remove,download,cancel,jobs:()=>[...jobs.values()]};
})();
