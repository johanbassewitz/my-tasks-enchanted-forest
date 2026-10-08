import {useEffect,useRef,type ReactNode} from 'react';
import {icons} from 'lucide-react';
export function Icon({name,className=''}:{name:string;className?:string}) {
 const key=name.split('-').map(s=>s[0]?.toUpperCase()+s.slice(1)).join('') as keyof typeof icons;
 const Component=icons[key]||icons.Leaf;
 return <Component className={className} aria-hidden="true" strokeWidth={1.6}/>;
}
export function IconButton({icon,label,onClick,disabled=false}:{icon:string;label:string;onClick:()=>void;disabled?:boolean}) {return <button className="icon-btn" title={label} aria-label={label} onClick={onClick} disabled={disabled}><Icon name={icon}/></button>}
export function Modal({title,children,onClose,footer}:{title:string;children:ReactNode;onClose:()=>void;footer?:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;const first=ref.current?.querySelector<HTMLElement>('input,select,button,[tabindex="0"]');first?.focus();return()=>previous?.focus()},[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}if(e.key==='Tab'){const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]')||[]);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}}><div className="modal-header"><h3>{title}</h3><IconButton icon="x" label="Close dialog" onClick={onClose}/></div>{children}{footer&&<div className="modal-actions">{footer}</div>}</div></div>
}
export function Toggle({label,checked,onChange,description,disabled=false}:{label:string;checked:boolean;onChange:(v:boolean)=>void;description?:string;disabled?:boolean}){return <label className="setting-row"><span>{label}{description&&<small>{description}</small>}</span><input className="toggle" type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>}
export function Select({label,value,values,onChange}:{label:string;value:string;values:(string|{value:string;label:string})[];onChange:(v:string)=>void}){return <label className="setting-row"><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{values.map(v=>typeof v==='string'?<option key={v}>{v}</option>:<option key={v.value} value={v.value}>{v.label}</option>)}</select></label>}
export const offsets=[0,5,10,15,30,60,120,1440];
export const reminderLabel=(m:number)=>m===0?'At event time':m>=1440?`${m/1440} day before`:m>=60?`${m/60} hour${m>60?'s':''} before`:`${m} minutes before`;
export const humanDate=(d:string,long=false)=>d?new Date(d+'T12:00:00').toLocaleDateString(undefined,long?{weekday:'long',month:'long',day:'numeric'}:{weekday:'short',month:'short',day:'numeric'}):'Anytime';
export const clockTime=(t:string,format='12')=>{if(!t)return 'Anytime';if(format==='24')return t;const [h,m]=t.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
export const mins=(t:string)=>{const [h,m]=(t||'00:00').split(':').map(Number);return h*60+m};
export const hm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
