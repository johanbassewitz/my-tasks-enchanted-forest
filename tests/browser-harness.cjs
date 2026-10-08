// Test-only transport. Exercises the production SQLite command layer without
// pretending that browser checks prove Electron IPC or Windows notifications.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const {Repository}=require('../dist-electron/electron/repository');
const {applyCommand}=require('../dist-electron/electron/commands');
const {ReminderScheduler}=require('../dist-electron/electron/scheduler');
const root=path.resolve(__dirname,'..');const dir=path.join(root,'.browser-test-data');fs.mkdirSync(dir,{recursive:true});
const repo=new Repository(path.join(dir,'tests.sqlite'));const scheduler=new ReminderScheduler(repo,()=>{});
const bridge=`window.desktop={getData:()=>fetch('/api/data').then(r=>r.json()),command:async c=>{const r=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});const data=await r.json();if(!r.ok)throw Error(data.error);return data},window:async()=>{},onData:()=>()=>{},onAlert:()=>()=>{}};`;
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:5175');
 if(req.headers.host!=='127.0.0.1:5175')throw Error('Invalid host');
 if(url.pathname==='/api/data'){scheduler.tick();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(repo.getData()))}
 if(url.pathname==='/api/command'){
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:5175')throw Error('Invalid origin');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1_000_000)throw Error('Request too large')}
  const c=JSON.parse(body);if(c.type.startsWith('google.')||c.type.startsWith('data.'))throw Error('Native-only action is not available in this integration harness.');
  if(c.type==='reminder.snooze')scheduler.snooze(c.id);else if(c.type==='reminder.dismiss')scheduler.dismiss(c.id);else applyCommand(repo,c);
  scheduler.tick();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(repo.getData()));
 }
 if(url.pathname==='/test-bridge.js'){res.setHeader('Content-Type','text/javascript');return res.end(bridge)}
 const file=path.resolve(root,'dist','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(path.join(root,'dist')+path.sep))throw Error('Invalid path');
 let content=fs.readFileSync(file);if(file.endsWith('index.html'))content=Buffer.from(content.toString().replace('<body>','<body><script src="/test-bridge.js"></script>'));
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(content);
 }catch(e){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.message}))}
}).listen(5175,'127.0.0.1',()=>console.log('SQLite browser integration harness http://127.0.0.1:5175'));
