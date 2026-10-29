'use strict';
const { chromium } = require(process.env.PW || 'playwright');
const assert = require('node:assert/strict'), http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.join(__dirname,'../www'); let passed=0;
function check(name, condition) { assert(condition,name); console.log('PASS '+name); passed++; }
const server=http.createServer((req,res)=>{
  if(req.url==='/test-terminal-stream') {
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    res.write('event: stdout\ndata: {"source":"Test Runner","text":"live stdout from test relay"}\n\n');
    res.write('event: stderr\ndata: {"source":"Test Runner","text":"live stderr from test relay"}\n\n');
    res.write('event: end\ndata: {}\n\n'); res.end(); return;
  }
  const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__ember && window.__ember.ready && window.EmberCommandCenter);
  check('app loads with original timeline and separate new components',await page.evaluate(()=>!!EmberTimeline && !document.querySelector('#log #emberTerminal') && !document.querySelector('#log #emberCommandCenter')));
  check('panel initially inert and terminal collapsed',await page.evaluate(()=>document.querySelector('#emberCommandCenter').inert && document.querySelector('#eccTerminalBody').hidden));
  await page.click('#bCommandCenter');
  check('header button opens sliding panel',await page.getAttribute('#bCommandCenter','aria-expanded')==='true' && await page.locator('#eccTitle').isVisible());
  check('desktop workspace docks without making chat inert', await page.evaluate(()=>document.body.classList.contains('ecc-docked') && !document.querySelector('#app').inert));
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(100);
  await page.focus('[data-ecc-action="push"]'); await page.keyboard.press('Tab'); check('panel focus trap loops to close',await page.evaluate(()=>document.activeElement.id==='eccClose'));
  await page.setViewportSize({width:1280,height:900});
  await page.keyboard.press('Escape');check('escape closes and restores header focus',await page.getAttribute('#bCommandCenter','aria-expanded')==='false' && await page.evaluate(()=>document.activeElement.id==='bCommandCenter'));
  await page.evaluate(()=>{
    EmberTimeline.begin();EmberTimeline.note('Original timeline is still running','cc-test');EmberTimeline.note('Existing timeline events unchanged','cc-test-2');EmberTimeline.flush();
    window.__tl=EmberTimeline.snapshot();
    EmberCommandCenter.inspect('Phase 1: Architecture/Constraint Check.\nKeep the existing timeline intact.\nPhase 2: Tactical Execution Plan.\nAdd independent event listeners.\nPhase 3: Edge-Case Mitigation.\nBound logs and escape output.\nImplementation:\n<artifact type="code">not part of summary</artifact>');
    EmberCommandCenter.open();
  });
  check('thought inspector shows actual public phase block only',(await page.innerText('#eccThought')).includes('Phase 3: Edge-Case Mitigation.') && !(await page.innerText('#eccThought')).includes('not part of summary'));
  check('panel and inspector leave timeline content intact',await page.evaluate(()=>JSON.stringify(EmberTimeline.snapshot().lines)===JSON.stringify(window.__tl.lines)));
  await page.evaluate(()=>{
    EmberCommandCenter.registerContext({id:'attached',name:'architecture.md',scope:'Document excerpt · part 2',needle:'A unique actual excerpt in the request.'});
    EmberCommandCenter.registerContext({id:'cached',name:'not-in-context.md',needle:'Cached but absent'});
    EmberCommandCenter.observeRequest({system:'FINAL CHECK:\nA unique actual excerpt in the request.',messages:[]});
  });
  check('matrix includes actual request excerpt, not unused library file',(await page.innerText('#eccMemory')).includes('architecture.md') && !(await page.innerText('#eccMemory')).includes('not-in-context.md'));
  await page.evaluate(()=>EmberCommandCenter.observeRequest({system:'FINAL CHECK: no excerpts now',messages:[]}));
  check('matrix removes files evicted from latest payload',await page.innerText('#eccMemoryCount')==='0');
  await page.evaluate(()=>EmberCommandCenter.observeRequest({system:'FINAL CHECK:',messages:[{role:'user',content:'Tool: read_document_chunk\nResult: '+JSON.stringify({fileId:'id2',name:'live-notes.md',chunk:3,text:'read chunk'})}]}));
  check('tool-injected chunk appears in matrix',(await page.innerText('#eccMemory')).includes('live-notes.md'));
  await page.evaluate(()=>{
    EmberCommandCenter.close();
    window.dispatchEvent(new CustomEvent('ember-dl',{detail:{id:'np-test',title:'Sample track',state:'running',pct:42,detail:'Reading audio'}}));
    window.dispatchEvent(new CustomEvent('ember-runner-status',{detail:{id:'gh:real',text:'Compiling Android',state:'run',pct:60}}));
    EmberCommandCenter.write({stream:'stdout',source:'Test',text:'<img src=x onerror="alert(1)">\nAuthorization: Bearer super-secret-token\nghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
    EmberCommandCenter.write({stream:'stderr',source:'Test',text:'compiler warning example'});
  });
  await page.click('#eccTerminalToggle');
  await page.waitForFunction(()=>document.querySelector('#eccTerminalOutput').textContent.includes('compiler warning example'));
  check('real NewPipe and runner events stream to distinct terminal',(await page.innerText('#eccTerminalOutput')).includes('42%') && (await page.innerText('#eccTerminalOutput')).includes('Compiling Android'));
  check('terminal escapes markup and redacts common secrets',await page.locator('#eccTerminalOutput img').count()===0 && !(await page.innerText('#eccTerminalOutput')).includes('super-secret-token') && !(await page.innerText('#eccTerminalOutput')).includes('ghp_aaa'));
  await page.selectOption('#eccTerminalFilter','stderr');await page.waitForTimeout(60);
  check('stderr filter excludes stdout',!(await page.innerText('#eccTerminalOutput')).includes('<img') && (await page.innerText('#eccTerminalOutput')).includes('compiler warning'));
  await page.selectOption('#eccTerminalFilter','all');
  await page.evaluate(()=>{
    window.dispatchEvent(new CustomEvent('ember-dl',{detail:{id:'np-test',title:'Sample track',state:'done',pct:100}}));
    window.dispatchEvent(new CustomEvent('ember-runner-output',{detail:{runId:'real',source:'GitHub Runner',stream:'merged',text:'Published merged command output',state:'done'}}));
    EmberCommandCenter.connectStream('/test-terminal-stream');
  });
  await page.waitForFunction(()=>document.querySelector('#eccTerminalOutput').textContent.includes('live stderr from test relay'));
  check('SSE stdout and stderr arrive from a real test server',(await page.innerText('#eccTerminalOutput')).includes('live stdout from test relay'));
  check('published runner logs are labelled merged',(await page.innerText('#eccTerminalOutput')).includes('GitHub Runner/merged'));
  check('live stream rejects external URLs and query credentials',await page.evaluate(()=>{let n=0;for(const u of ['https://outside.example/logs','/stream?token=secret'])try{EmberCommandCenter.connectStream(u);}catch(_){n++;}return n===2;}));
  await page.evaluate(()=>{
    window.__apiCalls=[];window.__cache=[];window.__saved='preserve-me';localStorage.setItem('cc_saved_test',__saved);
    EmberGithub.on=()=>true; EmberRepoRunner.config=()=>({target:'me/output',branch:'main',buildWorkflow:'build.yml'});
    EmberGithub.managerRequest=async(p,o)=>{__apiCalls.push({path:p,method:o&&o.method||'GET',body:o&&o.body});return {ok:true,json:p==='/repos/me/output'?{default_branch:'main'}:{}};};
    EmberRepoRunner.sync=async()=>{__apiCalls.push({path:'sync',method:'POST'});return {ok:true};};
    EmberGithub.knowledgeSources=()=>[{id:'one'},{id:'two'}];EmberGithub.clearCache=async s=>__cache.push(s.id);EmberGithub.syncState=()=>({running:false});
    window.confirm=()=>false; EmberCommandCenter.open();
  });
  await page.click('[data-ecc-action="build"]');check('cancelled build performs no network writes',await page.evaluate(()=>__apiCalls.length===0));
  await page.evaluate(()=>window.confirm=()=>true);await page.click('[data-ecc-action="build"]');
  await page.waitForFunction(()=>document.querySelector('#eccActionStatus').textContent.includes('dispatched'));
  check('build dispatches configured workflow and ref',await page.evaluate(()=>__apiCalls.some(c=>c.path==='/repos/me/output/actions/workflows/build.yml/dispatches' && c.method==='POST' && c.body.ref==='main')));
  await page.click('[data-ecc-action="push"]');await page.waitForFunction(()=>__apiCalls.some(c=>c.path==='sync'));
  check('push reuses installed repo sync, not arbitrary writes',await page.evaluate(()=>__apiCalls.some(c=>c.path==='sync')));
  await page.click('[data-ecc-action="cache"]');await page.waitForFunction(()=>__cache.length===2);
  check('clear cache preserves saved settings',await page.evaluate(()=>localStorage.getItem('cc_saved_test')==='preserve-me'));
  await page.evaluate(()=>{for(let i=0;i<1100;i++)EmberCommandCenter.write({stream:'stdout',source:'Bound test',text:'line '+i});});
  check('terminal buffer stays bounded',await page.evaluate(()=>EmberCommandCenter.snapshot().lineCount===1000));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  check('mobile panel fits viewport',await page.evaluate(()=>{const r=document.querySelector('#emberCommandCenter').getBoundingClientRect();return r.width<=innerWidth && r.left>=-1;}));
  await page.screenshot({path:process.env.CC_SHOT||path.join(require('node:os').tmpdir(),'ember-command-center-test.png'),fullPage:true});
  await page.evaluate(()=>{EmberCommandCenter.close();EmberCommandCenter.destroy();EmberTimeline.drop();});
  check('no uncaught browser errors',errors.length===0 || (console.log(errors),false));
  console.log(passed+' Command Center browser checks passed. All GitHub operations mocked; no real build or push performed.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
