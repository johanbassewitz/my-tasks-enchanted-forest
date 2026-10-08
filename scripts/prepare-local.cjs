// Vite's optional Windows mapped-drive discovery can fail in managed shells.
// Fall back to Node's native realpath; this neither changes sandbox settings
// nor enables any additional process permissions.
const fs=require('node:fs');const path=require('node:path');
// Legacy minimatch consumers expect brace-expansion's old function export.
// The pinned modern version exports expand; adapt only these development tools.
// No runtime application code or security settings are changed.
function adaptMinimatch(folder,legacy){
 for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const full=path.join(folder,entry.name);
  if(entry.isDirectory())adaptMinimatch(full,legacy);
  else if(entry.name.endsWith('.js')||entry.name.endsWith('.cjs')){
   const source=fs.readFileSync(full,'utf8');
   const adapter='((m) => typeof m === "function" ? m : m.expand)(require("brace-expansion")) /* my-tasks brace compatibility */';
   if(legacy&&source.includes('/* my-tasks brace compatibility */'))continue;
   const changed=legacy?source.replace(/require\((['"])brace-expansion\1\)/g,adapter):source.replaceAll(adapter,'require("brace-expansion")');
   if(changed!==source)fs.writeFileSync(full,changed);
  }
 }
}
function findMinimatch(folder){
 if(!fs.existsSync(folder))return;
 for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.isSymbolicLink())continue;
  const full=path.join(folder,entry.name);
  if(entry.name==='minimatch'){
   const manifest=JSON.parse(fs.readFileSync(path.join(full,'package.json'),'utf8'));
   adaptMinimatch(full,Number(manifest.version.split('.')[0])<10);
  }
  findMinimatch(full);
 }
}
findMinimatch(path.join(__dirname,'..','node_modules'));
const dir=path.join(__dirname,'..','node_modules','vite','dist','node','chunks');
if(fs.existsSync(dir))for(const file of fs.readdirSync(dir)){
 if(!file.endsWith('.js'))continue;const full=path.join(dir,file);let source=fs.readFileSync(full,'utf8');
 if(source.includes('function optimizeSafeRealPathSync()')&&!source.includes('try { exec("net use"')){
  source=source.replace('exec("net use", { windowsHide: true }, (error, stdout) => {','try { exec("net use", { windowsHide: true }, (error, stdout) => {').replace('else safeRealpathSync = windowsMappedRealpathSync;\n\t});','else safeRealpathSync = windowsMappedRealpathSync;\n\t}); } catch { safeRealpathSync = fs.realpathSync.native; }');
  fs.writeFileSync(full,source);
 }
}
