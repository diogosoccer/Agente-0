export type VerificationResult = {
  ok: boolean;
  confidence: number;
  message: string;
  checks: string[];
};

export function verifyResult(expected:string, actual:unknown): VerificationResult {
  const checks:string[]=[];
  const text=typeof actual==="string"?actual:JSON.stringify(actual);
  const hasOutput=Boolean(text && text.trim().length>0);
  checks.push(hasOutput?"saída presente":"saída ausente");
  const normalizedExpected=expected.toLowerCase().trim();
  const normalizedText=text.toLowerCase();
  const mentionsGoal=normalizedExpected.length>8
    ? normalizedExpected.split(/\s+/).filter(w=>w.length>5).slice(0,4).some(w=>normalizedText.includes(w))
    : true;
  checks.push(mentionsGoal?"objetivo parcialmente refletido":"objetivo não refletido");
  const ok=hasOutput&&mentionsGoal;
  return {ok,confidence:ok?0.8:0.25,message:ok?"Resultado contém evidências básicas do objetivo.":"Resultado insuficiente para considerar a missão verificada.",checks};
}
