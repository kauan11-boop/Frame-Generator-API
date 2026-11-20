import { QuantizationAnalyzer } from './QuantizationAnalyzer.js';
function uid(p='qjob'){return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
export class QuantizationManager {
  constructor(options={}){ this.analyzer=new QuantizationAnalyzer(); this.jobs=new Map(); this.events=options.events||null; }
  getProfiles(){ return this.analyzer.getProfiles(); }
  analyze(modelMeta,target){ return this.analyzer.analyze(modelMeta,target); }
  async plan(modelMeta={}, target='Q4_K', provider=null){
    const analysis=this.analyze(modelMeta,target);
    return { ok:true, plan:{ id:uid('qplan'), createdAt:new Date().toISOString(), modelId:modelMeta?.id||null, target, analysis, steps:['validate-input','inspect-tensors','select-profile','delegate-conversion-runtime','validate-output','register-result'], canExecuteInBrowser:false, requiresRuntime:true, provider:provider?.id||null } };
  }
  async execute(modelMeta={}, target='Q4_K', options={}){
    const job={ id:uid('qjob'), state:'analyzing', modelId:modelMeta?.id||null, target, createdAt:new Date().toISOString(), result:null, error:null };
    this.jobs.set(job.id, job);
    const analysis=this.analyze(modelMeta,target);
    if(!options.provider || !options.provider.supportsQuantization){
      job.state='unavailable'; job.result={analysis}; job.completedAt=new Date().toISOString();
      job.error={ code:'RUNTIME_REQUIRED', message:'Conversão requer runtime/provedor compatível. Nenhuma conversão fictícia executada; arquivo original preservado.' };
      return { ok:false, job };
    }
    job.state='unavailable'; job.completedAt=new Date().toISOString();
    job.error={ code:'NOT_IMPLEMENTED_PROVIDER', message:'Delegação ao provedor informado não implementada neste cliente.' };
    return { ok:false, job };
  }
  getJob(id){ return this.jobs.get(id)||null; }
  listJobs(){ return [...this.jobs.values()]; }
}
export default QuantizationManager;
