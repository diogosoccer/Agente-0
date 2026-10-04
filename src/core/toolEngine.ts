export type ToolRisk = "low" | "medium" | "high" | "critical";
export type ToolContext = { missionId?: string; approved?: boolean; signal?: AbortSignal };
export type JarvisTool<TInput=unknown,TOutput=unknown> = {
  id: string;
  name: string;
  description: string;
  risk: ToolRisk;
  execute: (input:TInput, context:ToolContext)=>Promise<TOutput>;
};

const tools = new Map<string, JarvisTool>();

export function registerJarvisTool<TInput,TOutput>(tool: JarvisTool<TInput,TOutput>) {
  if (tools.has(tool.id)) throw new Error("Ferramenta já registrada: " + tool.id);
  tools.set(tool.id, tool as JarvisTool);
  return tool;
}

export function getJarvisTool(id:string) { return tools.get(id); }
export function listJarvisTools() { return [...tools.values()].map(({id,name,description,risk})=>({id,name,description,risk})); }

export async function executeJarvisTool(id:string,input:unknown,context:ToolContext={}) {
  const tool=getJarvisTool(id);
  if(!tool) throw new Error("Ferramenta não encontrada: "+id);
  if((tool.risk==="high"||tool.risk==="critical")&&!context.approved) {
    throw new Error("A ferramenta exige aprovação explícita: "+tool.name);
  }
  return tool.execute(input,context);
}
