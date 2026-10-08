const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),lock=require('../package-lock.json');
const config=require('js-yaml').load(fs.readFileSync(path.join(root,'electron-builder.yml'),'utf8'));
const schema=require('app-builder-lib/scheme.json');
require('app-builder-lib/out/util/config/schemaValidator').validateSchema(schema,config);
assert.equal(config.nsis.oneClick,true);assert.equal(config.nsis.perMachine,false);
assert.equal(config.nsis.createDesktopShortcut,'always');assert.equal(config.nsis.createStartMenuShortcut,true);
assert.equal(config.asar,true);assert.equal(config.win.signAndEditExecutable,true);
assert.equal(config.nsis.deleteAppDataOnUninstall,false);
assert.equal(lock.version,pkg.version);
for(const [name,entry]of Object.entries(lock.packages)){
 if(!entry.resolved)continue;
 assert.match(entry.resolved,/^https:\/\/registry\.npmjs\.org\//,'Nonportable dependency resolution: '+name);
 assert.equal(entry.link,undefined,'Unexpected local package link: '+name);
}
for(const file of ['build/icon.ico','build/icon.png','.github/workflows/windows-release.yml','docs/GITHUB-RELEASE.md'])assert.ok(fs.existsSync(path.join(root,file)),file+' is missing');
// Exercise old minimatch consumers against the modern brace expansion export.
const legacy=require('@electron/asar/node_modules/minimatch');
assert.equal(legacy('file1','file{1,2}'),true);assert.equal(legacy('file3','file{1,2}'),false);
assert.equal(require('minimatch').minimatch('file1','file{1,2}'),true);
assert.equal(require('@electron/universal/node_modules/minimatch').minimatch('file1','file{1,2}'),true);
console.log('Installer schema, shortcuts, icon, package lock and build compatibility verified.');
