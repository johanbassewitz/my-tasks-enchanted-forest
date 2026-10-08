import {useState} from 'react';
import type {GoogleStatus,Command} from '../shared/types';
import type {GoogleSetupDestination} from '../shared/google-guide';
import {Modal,Icon} from './ui';

const steps:{title:string;instructions:string[];destination?:GoogleSetupDestination;action?:string;tip:string}[]=[
 {title:'Create a Google project',instructions:['Open Google Cloud and sign in with your Google account.','Name the project “My Tasks”, create it, then select it in the project picker at the top.'],destination:'project',action:'Open Google Cloud',tip:'Keep this same project selected for the next steps. Your local tasks keep working during setup.'},
 {title:'Enable Google Calendar',instructions:['Open the Calendar API page for your selected project.','Click Enable. If you see Manage instead, the API is already enabled.'],destination:'api',action:'Open Calendar API',tip:'This lets your app connect to Calendar. You do not need a Google Tasks API key.'},
 {title:'Name the sign-in screen',instructions:['Open Google Auth Platform → Branding. If prompted, choose Get Started.','Use “My Tasks” as the app name and your email for support and contact.','For a personal Gmail account, choose External as the audience. Review Google’s terms and finish the setup.'],destination:'branding',action:'Open Branding',tip:'External is the normal choice for personal Gmail. Internal is for eligible Workspace organizations.'},
 {title:'Allow your own account',instructions:['Open Audience and keep the app in Testing while setting it up.','Under Test users, choose Add users. Add the Google email you will use for Calendar and save.'],destination:'audience',action:'Open Audience',tip:'If another person uses this setup, add their Google account too. Testing authorizations may expire and need reconnecting.'},
 {title:'Download the client file',instructions:['Open Clients → Create client. Choose Desktop app as the application type.','Name it “My Tasks desktop” and create it. Open the new client if needed, then choose Download JSON.'],destination:'clients',action:'Open Clients',tip:'Look in Downloads for client_secret_…apps.googleusercontent.com.json. A Web application client, API key or calendar export will not work.'},
 {title:'Import and sign in',instructions:['Click the button below and select the JSON file you just downloaded.','Your browser opens Google login. Choose the account added as a test user and review the requested Calendar access.','Return here, choose your default calendar, then enable Google sync on the tasks or events you want to share.'],tip:'You select the file only once. Your Google password is entered on Google’s website, never in My Tasks.'}
];

export function GoogleSetupGuide({google,busy,onClose,onConnect,command}:{google:GoogleStatus;busy:boolean;onClose:()=>void;onConnect:()=>Promise<void>;command:(c:Command)=>Promise<boolean>}){
 const [step,setStep]=useState(google.configured?5:0),current=steps[step];
 return <Modal title="Connect Google Calendar — setup guide" onClose={onClose} footer={<><button className="secondary" disabled={step===0} onClick={()=>setStep(step-1)}>Back</button>{step<5?<button className="primary" onClick={()=>setStep(step+1)}>Next step</button>:<button className="secondary" onClick={onClose}>Close guide</button>}</>}>
  <div className="google-guide">
   <p className="settings-description">One-time setup for your own Google account. Keep this guide open while you follow the steps in your browser.</p>
   <nav aria-label="Google setup steps" className="google-guide-steps">{steps.map((s,index)=><button key={s.title} aria-label={`Step ${index+1}: ${s.title}`} aria-current={index===step?'step':undefined} onClick={()=>setStep(index)}>{index+1}</button>)}</nav>
   <section aria-labelledby="google-guide-heading" aria-live="polite">
    <small className="muted">Step {step+1} of {steps.length}</small><h4 id="google-guide-heading">{current.title}</h4>
    <ol>{current.instructions.map(text=><li key={text}>{text}</li>)}</ol>
    <p className="google-guide-tip"><Icon name="info"/>{current.tip}</p>
    {current.destination&&<button className="primary" onClick={()=>command({type:'google.openSetup',destination:current.destination!})}><Icon name="external-link"/>{current.action}</button>}
    {step===5&&(google.connected?<p className="google-guide-success"><Icon name="check"/>Connected as {google.account}</p>:<><button className="primary" disabled={busy||!google.secureStorage} onClick={onConnect}><Icon name="calendar-check"/>{busy?'Finish signing in in your browser…':google.configured?'Open Google login':'Choose JSON and sign in'}</button>{!google.secureStorage&&<p className="form-error">Windows secure storage is unavailable. Sign-in cannot start on this device.</p>}</>)}
    {google.error&&<p className="form-error" role="alert">{google.error}</p>}
   </section>
   <details className="google-guide-help"><summary>Something went wrong?</summary><dl>
    <dt>Access blocked or error 403</dt><dd>Check Audience → Test users. Add the exact account you chose at login. A managed work or school account may also need its administrator’s permission.</dd>
    <dt>Invalid client or redirect mismatch</dt><dd>Create a Desktop app client in the same project, download its JSON and import that file. Do not add a custom redirect URL.</dd>
    <dt>Calendar API disabled</dt><dd>Enable Google Calendar API in the project that owns your client, wait briefly, then try again.</dd>
    <dt>Wrong file selected</dt><dd>Download the JSON from Google Auth Platform → Clients. Do not use a task backup, calendar .ics export or an access-token file.</dd>
    <dt>Google shows a security warning</dt><dd>Check that the project belongs to you and the requested access matches this app. Stop if anything looks unfamiliar. This guide does not bypass Google’s warnings.</dd>
    <dt>Sign-in timed out or expired</dt><dd>Try Sign in with Google again. Testing-mode authorization can expire; reconnect when prompted.</dd>
   </dl></details>
   <button className="cancel-edit" onClick={()=>command({type:'google.openSetup',destination:'docs'})}>Open Google’s official setup instructions <Icon name="external-link"/></button>
  </div>
 </Modal>;
}
