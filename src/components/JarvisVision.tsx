import{useEffect,useRef,useState}from"react";
import{Camera,CameraOff,RefreshCw,ShieldCheck,ScanFace,Trash2,Video}from"lucide-react";
import{attachStream,listCameras,openCamera,requestCameraPermission,stopCamera,type CameraSlot,visionCapabilities}from"../services/vision";

export function JarvisVision(){
 const[devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const[slots,setSlots]=useState<CameraSlot[]>([]);
 const[identity,setIdentity]=useState(false);
 const[message,setMessage]=useState("Câmeras desligadas");
 const refs=useRef<Record<string,HTMLVideoElement|null>>({});
 const caps=visionCapabilities();

 const refresh=async()=>{
   try{await requestCameraPermission(); const ds=await listCameras(); setDevices(ds); setMessage(ds.length?ds.length+" câmera(s) encontrada(s).":"Nenhuma câmera encontrada.");}
   catch(e){setMessage("Permissão de câmera não concedida.");}
 };
 useEffect(()=>{void listCameras().then(setDevices).catch(()=>{});return()=>slots.forEach(s=>stopCamera(s.stream));},[]);

 const activate=async(deviceId:string,index:number)=>{
   try{
    const stream=await openCamera(deviceId);
    const id="cam-"+index+"-"+deviceId;
    const slot={id,label:"Câmera "+(index+1),deviceId,stream,active:true,faces:0} as CameraSlot;
    setSlots(prev=>{const old=prev[index];if(old)stopCamera(old.stream);const next=[...prev];next[index]=slot;return next;});
    requestAnimationFrame(()=>{const v=refs.current[id];if(v)attachStream(v,stream);});
    setMessage("Câmera "+(index+1)+" ativa.");
   }catch{setMessage("Não foi possível abrir a câmera "+(index+1)+".");}
 };
 const deactivate=(index:number)=>{
   const old=slots[index];if(old)stopCamera(old.stream);
   setSlots(prev=>{const next=[...prev];next[index]=undefined as never;return next;});
 };
 const clear=()=>{slots.forEach(s=>stopCamera(s.stream));setSlots([]);setMessage("Todas as câmeras foram desligadas.");};

 return <section className="visionPanel">
   <div className="panelhead"><div><span className="eyebrow">JARVIS VISION</span><h2>Central de câmeras</h2></div><Video size={18}/></div>
   <div className="visionNotice"><ShieldCheck size={16}/><span>Processamento local por padrão. Nenhuma imagem é enviada ou salva automaticamente.</span></div>
   <div className="visionToolbar">
    <button className="primary" onClick={()=>void refresh()}><RefreshCw size={15}/> Detectar câmeras</button>
    <button className="ghost" onClick={clear}><Trash2 size={15}/> Desligar todas</button>
    <label className="visionToggle"><input type="checkbox" checked={identity} onChange={e=>setIdentity(e.target.checked)}/><ScanFace size={15}/> Verificação de identidade local</label>
   </div>
   <div className="visionGrid">
    {Array.from({length:5},(_,i)=>{
      const slot=slots[i];
      return <div className={"cameraCard "+(slot?.active?"active":"")} key={i}>
       <div className="cameraHeader"><b>Câmera {i+1}</b><span>{slot?.active?"AO VIVO":"OFFLINE"}</span></div>
       {slot?.active?<video ref={el=>{refs.current[slot.id]=el}} className="cameraFeed" muted playsInline/>:<div className="cameraEmpty"><CameraOff size={25}/><small>Slot disponível</small></div>}
       <select className="select" value={slot?.deviceId||""} onChange={e=>e.target.value&&void activate(e.target.value,i)}>
        <option value="">Selecionar câmera</option>{devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Câmera disponível"}</option>)}
       </select>
       {slot?.active&&<button className="ghost cameraStop" onClick={()=>deactivate(i)}><CameraOff size={14}/> Desligar</button>}
      </div>
    })}
   </div>
   <div className="visionFooter"><span>{message}</span><span>{identity?"Identidade: ativada localmente":"Identidade: desativada"}</span><span>Slots: {slots.filter(Boolean).length}/5</span></div>
   <small className="visionDisclaimer">{caps.identityVerificationOptIn?"A verificação facial completa pode ser conectada a um modelo local depois do consentimento. Esta camada não armazena imagens do rosto.":""}</small>
 </section>
}
