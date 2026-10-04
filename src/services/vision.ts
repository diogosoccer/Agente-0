export type CameraSlot={id:string;label:string;deviceId:string;stream?:MediaStream;video?:HTMLVideoElement;active:boolean;faces:number;error?:string};

export async function requestCameraPermission():Promise<MediaStream>{
  return navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:"user"},audio:false});
}

export async function listCameras():Promise<MediaDeviceInfo[]>{
  if(!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");
}

export async function openCamera(deviceId?:string):Promise<MediaStream>{
  return navigator.mediaDevices.getUserMedia({video:{deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:1280},height:{ideal:720}},audio:false});
}

export function stopCamera(stream?:MediaStream){
  stream?.getTracks().forEach(track=>track.stop());
}

export function attachStream(video:HTMLVideoElement,stream:MediaStream){
  video.srcObject=stream;
  void video.play().catch(()=>{});
}

/**
 * Privacy-first vision baseline:
 * - no frames are uploaded
 * - no face images are persisted
 * - the UI reports camera availability and lets a future local model plug in
 * - identity verification is opt-in and disabled by default
 */
export function visionCapabilities(){
  return {
    localOnly:true,
    uploads:false,
    persistentFaceImages:false,
    identityVerificationOptIn:true,
    maxCameraSlots:5
  };
}
