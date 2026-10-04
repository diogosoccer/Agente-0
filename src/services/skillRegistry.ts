export type SkillStatus="proposed"|"approved"|"active"|"disabled";
export type Skill={id:string,name:string,description:string,trigger:string,version:number,uses:number,status:SkillStatus,createdAt:string,updatedAt:string};
const KEY="jarvis.skills.v1";
const seed:Skill[]=[];
const read=():Skill[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=(v:Skill[])=>localStorage.setItem(KEY,JSON.stringify(v));
export const skillRegistry={
 list:()=>read(),
 recordUse:(name:string)=>{const v=read().map(s=>s.name===name?{...s,uses:s.uses+1,updatedAt:new Date().toISOString()}:s);write(v);return v},
 propose:(name:string,description:string,trigger:string)=>{const now=new Date().toISOString();const s:Skill={id:crypto.randomUUID(),name,description,trigger,version:1,uses:0,status:"proposed",createdAt:now,updatedAt:now};const v=[...read(),s];write(v);return s},
 approve:(id:string)=>{const v=read().map(s=>s.id===id?{...s,status:"active" as const,updatedAt:new Date().toISOString()}:s);write(v);return v.find(s=>s.id===id)},
 disable:(id:string)=>{const v=read().map(s=>s.id===id?{...s,status:"disabled" as const,updatedAt:new Date().toISOString()}:s);write(v)}
};
export function detectRepeatedTask(history:string[],threshold=7){const counts=new Map<string,number>();for(const x of history){const k=x.trim().toLowerCase();counts.set(k,(counts.get(k)||0)+1)}const hit=[...counts.entries()].find(([,n])=>n>=threshold);return hit?{goal:hit[0],count:hit[1]}:null}
