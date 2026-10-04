export type ComputerSnapshot = {
  online: boolean;
  secureContext: boolean;
  viewport:{width:number;height:number};
  visibility:DocumentVisibilityState;
  cameraAvailable:boolean;
  screenCaptureSupported:boolean;
  speechRecognitionSupported:boolean;
  speechSynthesisSupported:boolean;
  timestamp:number;
};

export function getComputerSnapshot():ComputerSnapshot {
  const media=typeof navigator!=="undefined"&&navigator.mediaDevices;
  const recognition=typeof window!=="undefined"&&("SpeechRecognition" in window||"webkitSpeechRecognition" in window);
  return {
    online:typeof navigator!=="undefined"?navigator.onLine:true,
    secureContext:typeof window!=="undefined"?window.isSecureContext:false,
    viewport:{width:typeof window!=="undefined"?window.innerWidth:0,height:typeof window!=="undefined"?window.innerHeight:0},
    visibility:typeof document!=="undefined"?document.visibilityState:"visible",
    cameraAvailable:Boolean(media?.getUserMedia),
    screenCaptureSupported:Boolean(media?.getDisplayMedia),
    speechRecognitionSupported:Boolean(recognition),
    speechSynthesisSupported:typeof window!=="undefined"&&"speechSynthesis" in window,
    timestamp:Date.now()
  };
}

export function describeComputer(snapshot=getComputerSnapshot()) {
  const capabilities:string[]=[];
  if(snapshot.online) capabilities.push("internet");
  if(snapshot.cameraAvailable) capabilities.push("camera");
  if(snapshot.screenCaptureSupported) capabilities.push("tela");
  if(snapshot.speechRecognitionSupported) capabilities.push("reconhecimento de voz");
  if(snapshot.speechSynthesisSupported) capabilities.push("voz");
  return "Computador "+(snapshot.online?"online":"offline")+". Capacidades disponíveis: "+(capabilities.join(", ")||"nenhuma detectada")+".";
}
