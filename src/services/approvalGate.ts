import { listJarvisRecords, upsertJarvisRecord } from "./jarvisPersistence";

export type Risk = "low" | "medium" | "high" | "critical";
export type ApprovalRequest = { id:string; action:string; risk:Risk; reason:string; createdAt:number; status:"pending"|"approved"|"rejected" };

const pending = new Map<string, ApprovalRequest>();
const persist = (request: ApprovalRequest) => { void upsertJarvisRecord("approval", request.id, request as unknown as Record<string, unknown>); };

export function requestApproval(action:string, risk:Risk, reason:string) {
  const request: ApprovalRequest = { id:crypto.randomUUID(), action, risk, reason, createdAt:Date.now(), status:"pending" };
  pending.set(request.id, request); persist(request); return request;
}
export function approve(id:string) {
  const request=pending.get(id); if(!request) throw Error("Aprovação não encontrada");
  const next={...request,status:"approved" as const}; pending.set(id,next); persist(next); return next;
}
export function reject(id:string) {
  const request=pending.get(id); if(!request) throw Error("Aprovação não encontrada");
  const next={...request,status:"rejected" as const}; pending.set(id,next); persist(next); return next;
}
export function listApprovals(){ return [...pending.values()].sort((a,b)=>b.createdAt-a.createdAt); }
export function assertApproved(id:string){ const request=pending.get(id); if(!request||request.status!=="approved") throw Error("Ação bloqueada: aprovação explícita necessária"); return request; }
export async function hydrateApprovals(){
  const rows=await listJarvisRecords("approval",300);
  for(const row of rows){ const request=row.data as unknown as ApprovalRequest; if(request?.id&&request?.action&&request?.status) pending.set(request.id,request); }
}