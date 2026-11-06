const fs=require('node:fs'),assert=require('node:assert/strict');
const config=require('../electron-builder.store.cjs'),store=require('../config/store.json'),pkg=require('../package.json');
require('app-builder-lib/out/util/config/schemaValidator').validateSchema(require('app-builder-lib/scheme.json'),config);
assert.equal(config.appx.applicationId,'Daywhisper');assert.equal(config.appx.minVersion,'10.0.19041.0');
assert.equal(config.appx.setBuildNumber,undefined,'Store version fourth segment must remain zero');
assert.match(fs.readFileSync('build/store-manifest.xml','utf8'),/TaskId="DaywhisperStartup" Enabled="false"/);
if(process.argv.includes('--submission')){
 for(const key of ['identityName','publisher','publisherDisplayName'])assert.ok(store[key]&&!/preview/i.test(store[key]),`Reserve Daywhisper and configure ${key}`);
 assert.ok(store.enabled,'Configure and verify Store commerce before this monetized release');
 for(const [key,value] of Object.entries(store.products))assert.match(value,/^[A-Za-z0-9]{6,32}$/,`Configure Store product: ${key}`);
 assert.equal(new Set(Object.values(store.products)).size,Object.values(store.products).length,'Product IDs must be unique');
 assert.match(pkg.feedbackEndpoint,/^https:\/\//,'Deploy and verify feedback service');
 console.log('Submission configuration checks passed. Native certification, rights, privacy and account verification still require release checklist sign-off.');
}else console.log('Store packaging configuration valid. Test identity/disabled services are allowed for preview builds only.');
