import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Eye,
  LockKeyhole,
  PlayCircle,
  Shield,
  Square,
  Target,
  Zap,
} from "lucide-react";
import { listJarvisRecords } from "../services/jarvisPersistence";
import { cancelMission, type JarvisMission, type MissionStep } from "../services/jarvisMissionEngine";

export function JarvisMissionControl({ go }: { go: (p: string) => void }) {
  const [live, setLive] = useState<JarvisMission[]>([]);
  const [steps, setSteps] = useState<MissionStep[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [missionRows, taskRows] = await Promise.all([
          listJarvisRecords("mission", 50),
          listJarvisRecords("task", 500),
        ]);
        if (!active) return;
        const nextMissions = missionRows.map((r) => r.data as unknown as JarvisMission);
        const nextSteps = taskRows.map((r) => r.data as unknown as MissionStep);
        setLive(nextMissions);
        setSteps(nextSteps);
        setSelectedId((current) => current ?? nextMissions[0]?.id ?? null);
      } catch {
        if (active) {
          setLive([]);
          setSteps([]);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const selected = useMemo(
    () => live.find((mission) => mission.id === selectedId) ?? live[0],
    [live, selectedId],
  );

  const selectedSteps = useMemo(
    () => steps.filter((step) => step.missionId === selected?.id).sort((a, b) => a.index - b.index),
    [steps, selected?.id],
  );

  const activeCount = live.filter((m) =>
    ["pending", "running", "waiting_approval", "verifying", "recovering"].includes(m.status),
  ).length;
  const waitingCount = live.filter((m) => m.status === "waiting_approval").length;
  const completedCount = live.filter((m) => m.status === "completed").length;

  const handleCancel = async () => {
    if (!selected || busy) return;
    setBusy(selected.id);
    try {
      await cancelMission(selected.id);
      setRefresh((value) => value + 1);
    } finally {
      setBusy(null);
    }
  };

  const statusLabel = (status: string) => status.replaceAll("_", " ").toUpperCase();

  const missions = [
    ["Pesquisa de oportunidades", "Scout + Analyst", "PESQUISA", "/oportunidades"],
    ["Construção de solução", "Builder", "PREPARAÇÃO", "/projetos"],
    ["Memória e aprendizagem", "Archivist", "CONTÍNUO", "/memoria"],
    ["Segurança", "Sentinel", "ATIVO", "/aprovacoes"],
  ];

  return (
    <div>
      <div className="pagehead">
        <div>
          <span className="eyebrow">JARVIS // MISSION CONTROL 2.0</span>
          <h1>Centro de Missões</h1>
          <p>Acompanhe cada etapa, aprovação, verificação e estado do motor de missões.</p>
        </div>
        <button className="primary" onClick={() => go("/jarvis")}>
          <BrainCircuit size={16} /> Abrir JARVIS
        </button>
      </div>

      <div className="metrics">
        <div className="metric"><Activity size={18} /><span>ATIVAS</span><strong>{activeCount}</strong><small>Missões em execução</small></div>
        <div className="metric"><Shield size={18} /><span>APROVAÇÕES</span><strong>{waitingCount}</strong><small>Aguardando você</small></div>
        <div className="metric"><CheckCircle2 size={18} /><span>CONCLUÍDAS</span><strong>{completedCount}</strong><small>Verificadas pelo motor</small></div>
        <div className="metric"><LockKeyhole size={18} /><span>POLÍTICA</span><strong>DEFAULT DENY</strong><small>Ações externas protegidas</small></div>
      </div>

      <section className="panel">
        <div className="panelhead">
          <div><span className="eyebrow">PERSISTED MISSIONS</span><h2>Missões persistentes</h2></div>
          <button className="iconbtn" onClick={() => setRefresh((value) => value + 1)} title="Atualizar missões">↻</button>
        </div>
        <div className="cards">
          {live.length ? live.slice(0, 8).map((mission) => (
            <button
              className="miniCard"
              key={mission.id}
              onClick={() => setSelectedId(mission.id)}
              style={{ textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <h3>{mission.goal}</h3>
                <Eye size={16} />
              </div>
              <p>{mission.summary}</p>
              <span className="badge">
                {statusLabel(mission.status)} · {Math.min(mission.currentStep, mission.totalSteps)}/{mission.totalSteps}
              </span>
            </button>
          )) : (
            <div className="miniCard">
              <h3>Nenhuma missão persistida</h3>
              <p>As próximas missões criadas pelo JARVIS aparecerão aqui.</p>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <section className="panel">
          <div className="panelhead">
            <div>
              <span className="eyebrow">MISSION INSPECTOR</span>
              <h2>{selected.goal}</h2>
              <p>{selected.summary}</p>
            </div>
            <div className="actionsRow">
              <span className="badge">{statusLabel(selected.status)}</span>
              {!["completed", "failed", "cancelled"].includes(selected.status) && (
                <button className="ghost" onClick={() => void handleCancel()} disabled={busy === selected.id}>
                  <Square size={14} /> {busy === selected.id ? "Cancelando..." : "Cancelar"}
                </button>
              )}
            </div>
          </div>
          <div className="jSteps">
            {selectedSteps.length ? selectedSteps.map((step) => (
              <div key={step.id}>
                <i>{String(step.index + 1).padStart(2, "0")}</i>
                <span>{step.action.label}</span>
                <small>{statusLabel(step.status)} · {step.attempts}/{step.maxAttempts}</small>
              </div>
            )) : (
              <div className="miniCard">
                <h3>Etapas ainda não persistidas</h3>
                <p>O motor ainda não registrou as etapas desta missão.</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panelhead">
          <div><span className="eyebrow">ACTIVE MISSION GRAPH</span><h2>Fluxo operacional</h2></div>
          <Target size={18} />
        </div>
        <div className="cards">
          {missions.map(([title, owner, status, path]) => (
            <button className="miniCard" key={title} onClick={() => go(path)}>
              <h3>{title}</h3><p>{owner}</p><span className="badge">{status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelhead">
          <div><span className="eyebrow">AUTONOMY LOOP</span><h2>Observar → pensar → preparar → aprovar → executar → verificar</h2></div>
          <Zap size={18} />
        </div>
        <div className="cards">
          <div className="miniCard"><CheckCircle2 size={18} /><h3>Autonomia segura</h3><p>Pesquisa, análise e planejamento podem avançar sem intervenção a cada passo.</p></div>
          <div className="miniCard"><Shield size={18} /><h3>Human in the loop</h3><p>Contato externo, publicação, exclusão, gastos e credenciais exigem aprovação.</p></div>
          <div className="miniCard"><PlayCircle size={18} /><h3>Execução controlada</h3><p>O Worker local executa apenas tarefas permitidas pelo sistema.</p></div>
          <div className="miniCard"><Clock3 size={18} /><h3>Verificação</h3><p>Uma etapa só é considerada concluída quando seu resultado passa pela verificação.</p></div>
        </div>
      </section>
    </div>
  );
}
