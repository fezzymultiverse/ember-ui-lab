/* Optional loopback-only yt-dlp bridge. npm run downloads; requires yt-dlp + ffmpeg on PATH.
   No shell execution, arbitrary URLs, remote binding, API-key forwarding or cookie imports. */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const TOKEN=process.env.EMBER_DOWNLOAD_TOKEN||crypto.randomBytes(32).toString('hex');
const PORT=Number(process.env.EMBER_DOWNLOAD_PORT)||8091;
const ROOT=path.resolve(process.env.EMBER_DOWNLOAD_DIR||path.join(os.homedir(),'EmberDownloads'));fs.mkdirSync(ROOT,{recursive:true});
const JOBS=new Map(),queue=[];let active=false;
const origins=new Set((process.env.EMBER_ALLOWED_ORIGINS||'http://127.0.0.1:8080,http://localhost:8080,http://localhost,https://localhost,capacitor://localhost').split(','));
function validURL(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/(^|\.)(youtube\.com|youtu\.be|soundcloud\.com)$/.test(u.hostname);}catch(_){return false;}}
function limit(n){return Math.max(1,Math.min(100,parseInt(n)||100));}
function execute(args,onLine,timeout=120000){return new Promise((resolve,reject)=>{const child=spawn(process.env.EMBER_YTDLP_BIN||'yt-dlp',args,{shell:false,windowsHide:true});let out='',err='',line='',settled=false;const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('yt-dlp timed out'));},timeout);function finish(e){if(settled)return;settled=true;clearTimeout(timer);e?reject(e):resolve(out);}
 child.stdout.on('data',b=>{if(out.length<8000000)out+=b;line+=b.toString();const ls=line.split(/[\r\n]/);line=ls.pop()||'';ls.forEach(x=>onLine&&onLine(x));if(line.length>65536)line=line.slice(-65536);});child.stderr.on('data',b=>{err=(err+b).slice(-6000);});child.on('error',e=>finish(new Error(e.code==='ENOENT'?'yt-dlp not installed. Install yt-dlp and ffmpeg first.':e.message)));child.on('close',code=>{if(line&&onLine)onLine(line);finish(code===0?null:new Error(err.replace(/https?:\/\/\S+/g,'[media-url]').slice(-800)||'yt-dlp exited '+code));});});}
async function info(url,n){return JSON.parse(await execute(['--ignore-config','--flat-playlist','--dump-single-json','--skip-download','--playlist-end',String(n),'--',url]));}
function items(j){return (j.entries||[j]).filter(x=>x&&x._type!=='unavailable').map(x=>({title:x.title||'(untitled)',url:x.webpage_url||x.original_url||(x.id&&j.extractor_key?.startsWith('Youtube')?'https://www.youtube.com/watch?v='+x.id:x.url),artist:x.uploader||x.channel||'',channel:x.uploader||x.channel||'',durationSec:x.duration||0,thumb:x.thumbnail||x.thumbnails?.[0]?.url||''})).filter(x=>validURL(x.url));}
function safeJob(j){return{id:j.id,state:j.state,pct:j.pct,title:j.title,detail:j.detail,error:j.error,files:j.files,mode:j.mode};}
async function work(){if(active||!queue.length)return;active=true;const j=queue.shift();j.state='running';const dir=path.join(ROOT,j.id);fs.mkdirSync(dir,{recursive:true});
 const args=['--ignore-config','--no-simulate','--newline','--no-colors','--no-overwrites','--restrict-filenames','--no-symlinks','--max-filesize','2G','--socket-timeout','30','--retries','3','--paths',dir,'-o','%(playlist_index&{} - |)s%(title).160B [%(id)s].%(ext)s','--progress-template','download:EMBER_PROGRESS %(progress._percent_str)s','--print','after_move:EMBER_FILE %(filepath)s'];
 if(j.playlist)args.push('--yes-playlist','--playlist-end',String(j.limit),'--ignore-errors');else args.push('--no-playlist');
 if(j.mode==='audio')args.push('-f','bestaudio/best','-x','--audio-format','m4a','--embed-metadata');else args.push('-f','bv*+ba/b','--merge-output-format','mp4');
 args.push('--',j.url);
 try{await execute(args,line=>{if(line.startsWith('EMBER_PROGRESS ')){const p=parseFloat(line.slice(15));if(Number.isFinite(p))j.pct=Math.min(99,Math.max(0,p));}if(line.startsWith('EMBER_FILE ')){const f=path.resolve(line.slice(11).trim());if(f.startsWith(dir+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()&&!j.paths.includes(f)){j.paths.push(f);j.files.push({name:path.basename(f),size:fs.statSync(f).size});j.detail=j.files.length+' files saved';}}},7200000);if(!j.files.length)throw new Error('No files downloaded. Check unavailable/private entries and your network.');j.state='done';j.pct=100;j.detail=j.files.length+' files saved. Unavailable playlist entries may have been skipped.';}catch(e){j.state='failed';j.error=e.message;}finally{active=false;work();}}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>16000)throw new Error('Request too large');}return JSON.parse(raw||'{}');}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;if(origin&&!origins.has(origin))return send(res,403,{error:'Origin not allowed. Add your exact Ember origin to EMBER_ALLOWED_ORIGINS.'});
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Private-Network','true');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const auth=req.headers.authorization||'',expected='Bearer '+TOKEN;const a=Buffer.from(auth),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return send(res,401,{error:'Bridge token required'});
 try{
 const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;
 if(p==='/health'&&req.method==='GET'){let version='';try{version=(await execute(['--version'])).trim();}catch(e){return send(res,503,{error:e.message});}return send(res,200,{ok:true,engine:'yt-dlp',version,directory:ROOT});}
 const file=p.match(/^\/files\/([a-f0-9-]+)\/(\d+)$/);if(file&&req.method==='GET'){const j=JOBS.get(file[1]),f=j?.paths[Number(file[2])];if(!f||!fs.existsSync(f))return send(res,404,{error:'File not found'});res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+path.basename(f).replace(/["\r\n]/g,'_')+'"','Content-Length':fs.statSync(f).size});fs.createReadStream(f).pipe(res);return;}
 const state=p.match(/^\/jobs\/([a-f0-9-]+)$/);if(state&&req.method==='GET'){const j=JOBS.get(state[1]);return send(res,j?200:404,j?safeJob(j):{error:'Job not found. Files already saved on disk are not deleted by server restarts.'});}
 if(req.method!=='POST')return send(res,404,{error:'Route not found'});
 const x=await body(req);
 if(p==='/search'){const q=String(x.query||'').trim().slice(0,200);if(!q)return send(res,400,{error:'Search query required'});const prefix=x.service==='soundcloud'?'scsearch10:':'ytsearch10:';const j=await info(prefix+q,10);return send(res,200,{results:items(j)});}
 if(!validURL(x.url))return send(res,400,{error:'Only HTTPS YouTube / SoundCloud URLs are allowed'});
 if(p==='/playlist'){const j=await info(x.url,limit(x.limit));return send(res,200,{title:j.title||'Playlist',tracks:items(j)});}
 if(p==='/download'){
  if(queue.length>=50)return send(res,429,{error:'Queue full; wait for downloads to finish'});
  if(JOBS.size>500){for(const[id,j]of JOBS){if(['done','failed'].includes(j.state))JOBS.delete(id);if(JOBS.size<400)break;}}
  const j={id:crypto.randomUUID(),url:x.url,playlist:x.playlist===true,mode:x.mode==='video'?'video':'audio',limit:limit(x.limit),state:'queued',pct:0,title:String(x.title||'').slice(0,200)||'yt-dlp '+(x.playlist?'playlist':'download'),detail:'Queued',files:[],paths:[]};JOBS.set(j.id,j);queue.push(j);work();return send(res,202,{jobId:j.id,title:j.title});
 }
 send(res,404,{error:'Route not found'});
 }catch(e){send(res,400,{error:e.message});}
});
if(require.main===module)server.listen(PORT,'127.0.0.1',()=>console.log('Ember yt-dlp bridge: http://127.0.0.1:'+PORT+'\nToken (paste in AI Features): '+TOKEN+'\nFiles: '+ROOT));
module.exports={server,validURL,items};
