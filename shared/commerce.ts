export const productKeys=['midnight-observatory','amber-hearth','study','creator','freelancer','habits','journal','supporter-monthly','supporter-yearly'] as const;
export type ProductKey=typeof productKeys[number];
export interface CommerceStatus {mode:'preview'|'store'|'unavailable';owned:ProductKey[];prices:Partial<Record<ProductKey,string>>;error?:string}
export const catalog:ReadonlyArray<{key:ProductKey;name:string;description:string;kind:'theme'|'pack'|'subscription'}>=[
 {key:'midnight-observatory',name:'Midnight Observatory',description:'Indigo nights and silver constellations. Own this theme permanently.',kind:'theme'},
 {key:'amber-hearth',name:'Amber Hearth',description:'A warm fireside workspace. Own this theme permanently.',kind:'theme'},
 {key:'study',name:'Study Pack',description:'Subjects, chapters, exam planning and study focus totals.',kind:'pack'},
 {key:'creator',name:'Creator Pack',description:'Move ideas through production to publication.',kind:'pack'},
 {key:'freelancer',name:'Freelancer Pack',description:'Clients, projects, billable time and payment status.',kind:'pack'},
 {key:'habits',name:'Habits Pack',description:'Daily and weekly targets, history and streaks.',kind:'pack'},
 {key:'journal',name:'Journal Pack',description:'Dated reflections, moods and weekly review.',kind:'pack'},
 {key:'supporter-monthly',name:'Supporter — monthly',description:'Ad-free planning and access to both premium themes while subscribed. Packs sold separately.',kind:'subscription'},
 {key:'supporter-yearly',name:'Supporter — yearly',description:'Ad-free planning and access to both premium themes while subscribed. Packs sold separately.',kind:'subscription'}
];
export function hasAccess(status:CommerceStatus,key:ProductKey):boolean {
 if(status.mode==='preview')return true;
 if(status.owned.includes(key))return true;
 return (key==='midnight-observatory'||key==='amber-hearth')&&status.owned.some(p=>p==='supporter-monthly'||p==='supporter-yearly');
}
export function isSupporter(status:CommerceStatus):boolean{return status.owned.some(p=>p==='supporter-monthly'||p==='supporter-yearly')}
