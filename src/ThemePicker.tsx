import {useState} from 'react';
import {themes,type ThemeId} from '../shared/themes';
import {Modal} from './ui';
export interface ThemePickerProps {
 value:ThemeId;
 onSelect:(theme:ThemeId)=>void|Promise<unknown>;
 canActivate?:(theme:ThemeId)=>boolean;
 onUnlock?:(theme:ThemeId)=>void;
}
/** Previews are deliberately local: opening one never changes saved preferences. */
export function ThemePicker({value,onSelect,canActivate=()=>true,onUnlock}:ThemePickerProps){
 const [preview,setPreview]=useState<ThemeId|null>(null),[saving,setSaving]=useState(false);
 const selected=themes.find(t=>t.id===preview);
 const activate=async(id:ThemeId)=>{setSaving(true);try{const result=await onSelect(id);if(result!==false)setPreview(null)}finally{setSaving(false)}};
 return <><p className="settings-description theme-intro">Choose the atmosphere for your day. Preview a theme before applying it.</p><div className="theme-picker" aria-label="Appearance themes">{themes.map(t=><article className={`theme-option ${value===t.id?'is-selected':''}`} key={t.id}>
 <button className={`theme-art theme-art--${t.id}`} onClick={()=>setPreview(t.id)} aria-label={`Preview ${t.name}`}><span className="theme-art-orbit"/><span className="theme-art-window"/><span className="theme-art-caption">{t.eyebrow}</span></button>
 <div className="theme-option-copy"><div className="theme-option-heading"><h4>{t.name}</h4>{value===t.id?<span className="badge">Active</span>:<span className="badge">{t.premium?'Premium':'Included'}</span>}</div><p>{t.description}</p><button className="secondary" onClick={()=>setPreview(t.id)}>Preview theme</button></div></article>)}</div>
 {selected&&<Modal title={selected.name} onClose={()=>!saving&&setPreview(null)} footer={<><button className="secondary" disabled={saving} onClick={()=>setPreview(null)}>Close preview</button>{value===selected.id?<span className="badge">Currently active</span>:canActivate(selected.id)?<button className="primary" disabled={saving} onClick={()=>activate(selected.id)}>{saving?'Applying…':'Use this theme'}</button>:<button className="primary" disabled={!onUnlock} onClick={()=>{setPreview(null);onUnlock?.(selected.id)}}>Explore theme access</button>}</>}><div className={`theme-art theme-preview theme-art--${selected.id}`} aria-hidden="true"><span className="theme-art-orbit"/><span className="theme-art-window"/><div className="theme-preview-panel"><span>YOUR DAILY SANCTUARY</span><h4>A little space for what matters.</h4><div className="theme-preview-task">○ &nbsp; Make room for a fresh idea</div><div className="theme-preview-task">✓ &nbsp; Take a quiet moment</div><div className="theme-preview-progress"/></div></div><p className="theme-preview-description">{selected.description} This preview does not change your saved theme.</p></Modal>}</>;
}
