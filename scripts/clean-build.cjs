// Do not package stale compiled modules after source files are removed.
const {rmSync}=require('node:fs');const {join}=require('node:path');
for(const directory of ['dist','dist-electron'])rmSync(join(__dirname,'..',directory),{recursive:true,force:true});
