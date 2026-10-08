export interface DesktopClient {clientId:string;clientSecret:string}

/** Only reads application client configuration, never passwords or user tokens. */
export function parseDesktopClient(raw:string):DesktopClient {
 const message='Choose the Desktop app client JSON downloaded from Google Cloud → Google Auth Platform → Clients. Web clients and token files cannot be used.';
 try{
  if(raw.length>100000)throw new Error();
  const installed=JSON.parse(raw)?.installed;
  if(!installed||typeof installed.client_id!=='string'||!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(installed.client_id)||installed.client_id.length>1000)throw new Error();
  if(installed.client_secret!==undefined&&(typeof installed.client_secret!=='string'||installed.client_secret.length>1000))throw new Error();
  return {clientId:installed.client_id,clientSecret:installed.client_secret||''};
 }catch{throw new Error(message);}
}

export async function connectGoogleWithSetup(options:{
 configured:boolean;secureStorage:boolean;
 pickClientFile:()=>Promise<string|null>;
 saveClient:(client:DesktopClient)=>Promise<void>;
 connect:()=>Promise<unknown>;
}):Promise<void>{
 if(!options.secureStorage)throw new Error('Windows secure credential storage is unavailable. Google sign-in is disabled.');
 if(!options.configured){
  const raw=await options.pickClientFile();
  if(raw===null)return;
  await options.saveClient(parseDesktopClient(raw));
 }
 await options.connect();
}
