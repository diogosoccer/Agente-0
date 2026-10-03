export type Risk="low"|"medium"|"high"|"critical";
export type ApprovalRequest={id:string,action:string,risk:Risk,reason:string,createdAt:number,status:"pending"|"approved"|"rejected"};
const pending=new Map<string,ApprovalRequest>();
export function requestApproval(action:string,risk:Risk,reason:string){const r={id:crypto.randomUUID(),action,risk,reason,createdAt:Date.now(),status:"pending" as const};pending.set(r.id,r);return r}
export function approve(id:string){const r=pending.get(id);if(!r)throw Error("Aprovação não encontrada");const next={...r,status:"approved" as const};pending.set(id,next);return next}
export function reject(id:string){const r=pending.get(id);if(!r)throw Error("Aprovação não encontrada");const next={...r,status:"rejected" as const};pending.set(id,next);return next}
export function listApprovals(){return [...pending.values()].sort((a,b)=>b.createdAt-a.createdAt)}
export function assertApproved(id:string){const r=pending.get(id);if(!r||r.status!=="approved")throw Error("Ação bloqueada: aprovação explícita necessária");return r}
