const fs=require('node:fs');
const base=require('js-yaml').load(fs.readFileSync(require('node:path').join(__dirname,'electron-builder.yml'),'utf8'));
const store=require('./config/store.json');
const cloud=require('./config/cloud.json');
const preview=cloud.preview||!store.identityName||!store.publisher||!store.publisherDisplayName;
module.exports={...base,
 directories:{...base.directories,output:'release-store'},
 win:{...base.win,target:['appx']},
 extraResources:[{from:'native/Daywhisper.Store/publish',to:'store',filter:['**/*']}],
 appx:{identityName:store.identityName||'Daywhisper.Preview',publisher:store.publisher||'CN=DaywhisperPreview',publisherDisplayName:store.publisherDisplayName||'Daywhisper Preview',applicationId:'Daywhisper',displayName:'Daywhisper',backgroundColor:'#102015',languages:['en-US'],minVersion:'10.0.19041.0',maxVersionTested:'10.0.26100.0',customManifestPath:'store-manifest.xml',artifactName:`Daywhisper-${preview?'PREVIEW-':''}\${version}-x64.appx`}
};
