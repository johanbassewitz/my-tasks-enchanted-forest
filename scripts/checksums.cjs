const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const name=`My-Tasks-Setup-${version}-x64.exe`,file=path.join(root,'release',name);
if(!fs.existsSync(file))throw Error('Expected installer was not built: '+name);
const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(root,'release','SHA256SUMS-installer.txt'),`${hash}  ${name}\n`);
console.log('Installer SHA-256 recorded for '+name);
