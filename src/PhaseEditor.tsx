import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import type {AppData,Command,Item,Phase} from '../shared/types';
import {validatePhase,isDone} from '../shared/domain';
import {phaseColors} from '../shared/defaults';
import {Icon,IconButton} from './ui';
export interface PhaseSelection {phase:Phase;isNew:boolean}
export default function PhaseEditor({selection,data,onSave,onClose,onDelete,onChangeDirty,onAddTask,onOpenTask,taskDate,busy}:{selection:PhaseSelection;data:AppData;onSave:(c:Command)=>Promise<boolean>;onClose:()=>void;onDelete:()=>void;onChangeDirty:(dirty:boolean)=>void;onAddTask:(phaseId:string)=>void;onOpenTask:(item:Item)=>void;taskDate:(item:Item)=>string;busy:boolean}){
 const others=[...data.phases].filter(p=>p.id!==selection.phase.id).sort((a,b)=>a.order-b.order);
 const after=others.findIndex(p=>p.order>selection.phase.order),startPosition=selection.isNew||after<0?others.length:after;
 const [phase,setPhase]=useState<Phase>(selection.phase),[position,setPosition]=useState(startPosition),[error,setError]=useState('');
 useEffect(()=>{setPhase(selection.phase);setPosition(startPosition);setError('');onChangeDirty(false)},[selection]);
 const edit=<K extends keyof Phase>(key:K,value:Phase[K])=>{setPhase(p=>({...p,[key]:value}));setError('');onChangeDirty(true)};
 const field=(icon:string,label:string,control:ReactNode)=><label className="field"><Icon name={icon}/><span>{label}</span>{control}</label>;
 const tasks=data.items.filter(i=>!i.deletedAt&&i.kind==='task'&&i.phaseId===phase.id).sort((a,b)=>a.order-b.order);
 const ordinal=(n:number)=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
 const submit=async(e:FormEvent)=>{e.preventDefault();try{const valid=validatePhase(phase);if(await onSave({type:'phase.save',phase:valid,position})){onChangeDirty(false);setError('')}}catch(err){setError((err as Error).message)}};
 return <section className="panel ornate editor"><div className="editor-header"><h3><Icon name="layers"/>{selection.isNew?'New Phase':'Phase Details'}</h3><IconButton icon="x" label="Cancel editing" onClick={onClose}/></div><form id="phase-form" onSubmit={submit}>
  <input className="form-title" aria-label="Phase name" placeholder="Phase name…" value={phase.title} onChange={e=>edit('title',e.target.value)} required maxLength={200}/>
  {field('list-ordered','Order',<select aria-label="Phase order" value={position} onChange={e=>{setPosition(Number(e.target.value));onChangeDirty(true)}}>{Array.from({length:others.length+1},(_,i)=><option key={i} value={i}>{ordinal(i+1)}{i===others.length?' (last)':` · before ${others[i].title}`}</option>)}</select>)}
  {field('calendar-days','Starts',<input type="date" aria-label="Phase start date" value={phase.start} onChange={e=>edit('start',e.target.value)}/>)}
  {field('calendar-check','Ends',<input type="date" aria-label="Phase end date" value={phase.end} onChange={e=>edit('end',e.target.value)}/>)}
  {field('tags','Category',<select aria-label="Phase category" value={phase.category} onChange={e=>edit('category',e.target.value)}><option value="">No category</option>{data.categories.map(c=><option key={c.id}>{c.name}</option>)}{phase.category&&!data.categories.some(c=>c.name===phase.category)&&<option>{phase.category}</option>}</select>)}
  <div className="field"><Icon name="palette"/><span>Colour</span><div className="swatches" role="radiogroup" aria-label="Phase colour">{phaseColors.map(c=><button type="button" key={c} role="radio" aria-checked={phase.color===c} aria-label={`Colour ${c}`} className={phase.color===c?'on':''} style={{background:c}} onClick={()=>edit('color',c)}/>)}</div></div>
  <div className="steps-editor"><div className="steps-head"><span><Icon name="list-checks"/>Tasks in this phase</span><small>{tasks.length}</small></div>
   {tasks.map(t=>{const done=isDone(t,taskDate(t));return <div className="step-line" key={t.id}><button type="button" className={`check ${done?'checked':''}`} role="checkbox" aria-checked={done} aria-label={`${done?'Uncomplete':'Complete'} ${t.title}`} onClick={()=>onSave({type:'item.complete',id:t.id,date:taskDate(t)})}>{done&&<Icon name="check"/>}</button><button type="button" className={`phase-task-link ${done?'done':''}`} onClick={()=>onOpenTask(t)}>{t.title}</button></div>})}
   {selection.isNew?<small className="steps-hint">Add the phase first, then add its tasks.</small>:<button type="button" className="add-inline" onClick={()=>onAddTask(phase.id)}><Icon name="plus"/>Add a task…</button>}
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary ornate" disabled={busy} type="submit">{busy?'Saving…':selection.isNew?'Add Phase':'Save Changes'}</button>
  {!selection.isNew&&<div className="btn-row editor-actions"><button className="danger" type="button" onClick={onDelete}><Icon name="trash"/>Delete phase</button></div>}
  <button type="button" className="cancel-edit" onClick={onClose}>Cancel</button><div className="editor-foot"><Icon name="hard-drive"/> Saved on this device</div>
 </form></section>
}
