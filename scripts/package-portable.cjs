const fs=require('node:fs');
const path=require('node:path');
const {NtExecutable,NtExecutableResource,Resource,Data}=require('resedit');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'release','My Tasks Portable');
const updateOnly=process.argv.includes('--update-app-only');
if(!fs.existsSync(path.join(root,'dist-electron','electron','main.js')))throw Error('Run npm run build first.');
fs.mkdirSync(target,{recursive:true});
if(updateOnly&&!fs.existsSync(path.join(target,'My Tasks.exe')))throw Error('Build the full portable application first.');
if(!updateOnly)fs.cpSync(path.join(root,'node_modules','electron','dist'),target,{recursive:true});
const appDir=path.join(target,'resources','app');fs.mkdirSync(appDir,{recursive:true});
for(const folder of ['dist','dist-electron','build']){
 const destination=path.resolve(appDir,folder);
 if(!destination.startsWith(target+path.sep))throw Error('Invalid packaging destination');
 // Keep prior hashed assets available to a currently open window during updates.
 if(!updateOnly)fs.rmSync(destination,{recursive:true,force:true});
 fs.cpSync(path.join(root,folder),destination,{recursive:true});
}
fs.mkdirSync(path.join(appDir,'node_modules'),{recursive:true});
for(const dependency of ['luxon','zod'])fs.cpSync(path.join(root,'node_modules',dependency),path.join(appDir,'node_modules',dependency),{recursive:true});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
fs.writeFileSync(path.join(appDir,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,productName:'My Tasks'},null,2));
const exePath=path.join(target,'My Tasks.exe');
if(!updateOnly){
fs.copyFileSync(path.join(target,'electron.exe'),exePath);
const exe=NtExecutable.from(fs.readFileSync(exePath));const resources=NtExecutableResource.from(exe);
const vi=Resource.VersionInfo.fromEntries(resources.entries)[0]||Resource.VersionInfo.createEmpty();
vi.setStringValues({lang:1033,codepage:1200},{CompanyName:'My Tasks',FileDescription:'My Tasks — Enchanted Forest',ProductName:'My Tasks',InternalName:'MyTasks',OriginalFilename:'My Tasks.exe',FileVersion:'1.0.0',ProductVersion:'1.0.0'});vi.setFileVersion(1,0,0,0);vi.setProductVersion(1,0,0,0);vi.outputToResourceEntries(resources.entries);
const icon=Data.IconFile.from(fs.readFileSync(path.join(root,'build','icon.ico')));
Resource.IconGroupEntry.replaceIconsForResource(resources.entries,1,1033,icon.icons.map(i=>i.data));resources.outputResource(exe);fs.writeFileSync(exePath,Buffer.from(exe.generate()));
fs.unlinkSync(path.join(target,'electron.exe'));
}
fs.copyFileSync(path.join(root,'README.md'),path.join(target,'README.md'));
fs.cpSync(path.join(root,'docs'),path.join(target,'docs'),{recursive:true});
fs.writeFileSync(path.join(target,'READ-ME-FIRST.txt'),'My Tasks - Enchanted Forest\r\n\r\nDouble-click My Tasks.exe. Keep this entire folder together.\r\nNo Node.js or administrator access is required.\r\nData is stored separately in %APPDATA%\\My Tasks.\r\n\r\nThis portable build is unsigned. Native tray and notification behavior could not\r\nbe verified in the restricted build environment. See docs/VERIFICATION.md.\r\nGoogle sign-in requires your own Desktop OAuth client; see docs/GOOGLE-CALENDAR.md.\r\n');
console.log(`Windows portable application: ${exePath}`);
