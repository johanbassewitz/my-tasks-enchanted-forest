const tones=['moonbell','woodland','starlight'];
let current:HTMLAudioElement|undefined;
let lastPlay=0;
/** One gentle chime at a time, including batches of overdue reminders. */
export async function playChime(tone:string,volume:number){
 if(Date.now()-lastPlay<1500)return;
 lastPlay=Date.now();current?.pause();
 current=new Audio(new URL(`../public/audio/${tones.includes(tone)?tone:'moonbell'}.wav`,import.meta.url).href);
 current.volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:0.35));
 try{await current.play()}catch{/* Audio output can be unavailable; never interrupt a reminder. */}
}
