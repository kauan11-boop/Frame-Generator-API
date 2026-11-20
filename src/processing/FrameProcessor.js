export class FrameProcessor {
  constructor(){ this.stats={processed:0,dropped:0}; }
  validateSequence(frames=[]){ const issues=[]; for(let i=1;i<frames.length;i++){ if(frames[i].timestamp!=null && frames[i-1].timestamp!=null && frames[i].timestamp < frames[i-1].timestamp) issues.push({index:i,issue:'out-of-order'}); } return { ok: issues.length===0, issues, count: frames.length }; }
  planInterpolation(inputFps,targetFps){ const ratio=(inputFps&&targetFps)?targetFps/inputFps:null; return { inputFps,targetFps,ratio,framesPerGap: ratio&&ratio>1?Math.round(ratio-1):0, valid:!!(ratio&&ratio>0) }; }
}
export default FrameProcessor;
