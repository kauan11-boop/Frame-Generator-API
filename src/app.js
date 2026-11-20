import { EventBus } from './core/EventBus.js';
import { ModuleRegistry } from './core/ModuleRegistry.js';
import { LifecycleManager } from './core/LifecycleManager.js';
import { ApiController } from './core/ApiController.js';
import { JsonManager } from './configuration/JsonManager.js';
import { SettingsManager } from './configuration/SettingsManager.js';
import { MetadataLoader } from './models/MetadataLoader.js';
import { ModelLoader } from './models/ModelLoader.js';
import { ModelRegistry } from './models/ModelRegistry.js';
import { ModelCompatibility } from './models/ModelCompatibility.js';
import { QuantizationAnalyzer } from './quantization/QuantizationAnalyzer.js';
import { QuantizationManager } from './quantization/QuantizationManager.js';
import { FrameGenerator } from './generators/FrameGenerator.js';
import { ImageGenerator } from './generators/ImageGenerator.js';
import { VideoGenerator } from './generators/VideoGenerator.js';
import { GeneratorRegistry } from './generators/GeneratorRegistry.js';
import { ImageProcessor } from './processing/ImageProcessor.js';
import { VideoProcessor } from './processing/VideoProcessor.js';
import { FrameProcessor } from './processing/FrameProcessor.js';
import { WebGPUEngine } from './engines/WebGPUEngine.js';
import { WebCodecsEngine } from './engines/WebCodecsEngine.js';
import { ONNXEngine } from './engines/ONNXEngine.js';
import { BackendAdapter } from './engines/BackendAdapter.js';
import { ManifestLoader } from './repacks/ManifestLoader.js';
import { ToolRegistry } from './repacks/ToolRegistry.js';
import { RepackManager } from './repacks/RepackManager.js';
import { AuthenticationManager } from './security/AuthenticationManager.js';
import { PermissionManager } from './security/PermissionManager.js';
import { ValidationManager } from './security/ValidationManager.js';
import { IndexedDBManager } from './storage/IndexedDBManager.js';
import { CacheManager } from './storage/CacheManager.js';
import { HistoryManager } from './storage/HistoryManager.js';

// Task/Job manager simples (fila e estados) para o núcleo
class JobManager {
  constructor(events){ this.events=events; this.tasks=new Map(); this.queue=[]; this.running=0; this.concurrency=2; }
  create(spec={}){ const t={ id:`job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, category:spec.category||'general', engine:spec.engine||null, model:spec.model||null, state:'Pending', progress:0, createdAt:new Date().toISOString(), completedAt:null, result:null, errors:[], _run:spec.run||null }; this.tasks.set(t.id,t); this.queue.push(t.id); this._pump(); return this._pub(t); }
  list(){ return [...this.tasks.values()].map(t=>this._pub(t)); }
  get(id){ const t=this.tasks.get(id); return t?this._pub(t):null; }
  async cancel(id){ const t=this.tasks.get(id); if(t&&t.state==='Pending'){t.state='Cancelled';t.completedAt=new Date().toISOString();} return this.get(id); }
  _pub(t){ const {_run,...r}=t; return {...r}; }
  async _pump(){ while(this.running<this.concurrency){ const id=this.queue.find(i=>this.tasks.get(i)?.state==='Pending'); if(!id) break; this.queue=this.queue.filter(x=>x!==id); this._runTask(this.tasks.get(id)); } }
  async _runTask(t){ this.running++; t.state='Running'; t.startedAt=new Date().toISOString(); this.events?.emit('task.progress', this._pub(t)); try{ const update=(p,extra={})=>{t.progress=Math.max(0,Math.min(100,p));Object.assign(t,extra); this.events?.emit('task.progress',this._pub(t));}; if(t._run) t.result=await t._run({update}); else {t.progress=100; t.result={status:'unavailable',message:'Nenhum executor associado.'};} t.state='Completed'; t.progress=100; }catch(e){ t.state='Failed'; t.errors.push({message:e.message}); } finally{ t.completedAt=new Date().toISOString(); this.running--; this._pump(); } }
}

class ProviderManager {
  constructor(events){ this.events=events; this.providers=new Map(); }
  register(p={}){ const pr={ id:p.id||`provider_${Date.now().toString(36)}`, name:p.name||'Provider', type:p.type||'Remote REST API', url:p.url||null, capabilities:p.capabilities||[], formats:p.formats||[], state:p.state||'registered', authRequired:!!p.authRequired, headers:p.headers||{}, ...p }; this.providers.set(pr.id,pr); this.events?.emit('provider.registered',{id:pr.id}); return pr; }
  list(){ return [...this.providers.values()]; }
  get(id){ return this.providers.get(id)||null; }
  select(criteria={}){ const list=this.list(); if(criteria.id) return list.find(p=>p.id===criteria.id)||null; if(criteria.type) return list.find(p=>p.type===criteria.type)||list[0]||null; return list[0]||null; }
}

export async function createApp() {
  const events = new EventBus();
  const lifecycle = new LifecycleManager({ events, version: '1.0.0' });
  const api = new ApiController({ mode: 'demo' });
  const json = new JsonManager();
  const settings = new SettingsManager();
  const db = new IndexedDBManager();
  const cache = new CacheManager();
  const history = new HistoryManager();
  const modelRegistry = new ModelRegistry();
  const modelLoader = new ModelLoader({ registry: modelRegistry, events });
  const modelCompatibility = new ModelCompatibility();
  const quantizationAnalyzer = new QuantizationAnalyzer();
  const quantization = new QuantizationManager({ events });
  const generatorRegistry = new GeneratorRegistry();
  const frameGenerator = new FrameGenerator();
  const imageGenerator = new ImageGenerator();
  const videoGenerator = new VideoGenerator();
  const imageProcessor = new ImageProcessor();
  const videoProcessor = new VideoProcessor();
  const frameProcessor = new FrameProcessor();
  const webgpu = new WebGPUEngine();
  const webcodecs = new WebCodecsEngine();
  const onnx = new ONNXEngine();
  const backend = new BackendAdapter({ id: 'default-backend', name: 'Default Backend', type: 'remote' });
  const manifestLoader = new ManifestLoader();
  const tools = new ToolRegistry();
  const repacks = new RepackManager({ toolRegistry: tools });
  const auth = new AuthenticationManager();
  const permissions = new PermissionManager();
  const validation = new ValidationManager();
  const tasks = new JobManager(events);
  const providers = new ProviderManager(events);

  // logger simples
  const logger = { entries:[], _e(l,m,d,s){ const e={ts:new Date().toISOString(),level:l,scope:s||'app',message:m,data:d||null}; this.entries.push(e); if(this.entries.length>500)this.entries.splice(0,this.entries.length-500); try{(console[l]||console.log)(`[${l}] ${m}`,d||'');}catch{} return e; }, info(m,d,s){return this._e('info',m,d,s)}, warn(m,d,s){return this._e('warn',m,d,s)}, error(m,d,s){return this._e('error',m,d,s)}, debug(m,d,s){return this._e('debug',m,d,s)}, getRecent(n=100){return this.entries.slice(-n);} };

  lifecycle.registerModule('ApiController', api, {category:'core'});
  lifecycle.registerModule('SettingsManager', settings, {category:'configuration'});
  lifecycle.registerModule('ModelLoader', modelLoader, {category:'models'});
  lifecycle.registerModule('ModelRegistry', modelRegistry, {category:'models'});
  lifecycle.registerModule('QuantizationManager', quantization, {category:'quantization'});
  lifecycle.registerModule('FrameGenerator', frameGenerator, {category:'generators'});
  lifecycle.registerModule('ImageGenerator', imageGenerator, {category:'generators'});
  lifecycle.registerModule('VideoGenerator', videoGenerator, {category:'generators'});
  lifecycle.registerModule('WebGPUEngine', webgpu, {category:'engines'});
  lifecycle.registerModule('WebCodecsEngine', webcodecs, {category:'engines'});
  lifecycle.registerModule('ONNXEngine', onnx, {category:'engines'});
  lifecycle.registerModule('BackendAdapter', backend, {category:'engines'});
  lifecycle.registerModule('RepackManager', repacks, {category:'repacks'});
  lifecycle.registerModule('ToolRegistry', tools, {category:'repacks'});
  lifecycle.registerModule('AuthenticationManager', auth, {category:'security'});
  lifecycle.registerModule('PermissionManager', permissions, {category:'security'});
  lifecycle.registerModule('ValidationManager', validation, {category:'security'});
  lifecycle.registerModule('IndexedDBManager', db, {category:'storage'});
  lifecycle.registerModule('CacheManager', cache, {category:'storage'});
  lifecycle.registerModule('HistoryManager', history, {category:'storage'});
  lifecycle.registerModule('JobManager', tasks, {category:'jobs'});
  lifecycle.registerModule('ProviderManager', providers, {category:'providers'});

  // registrar geradores
  generatorRegistry.register({id:'frame-generator',name:'Universal Frame Generator',category:'unified',engine:'auto'});
  generatorRegistry.register({id:'image-generator',name:'Image Generator',category:'image',engine:'image'});
  generatorRegistry.register({id:'video-generator',name:'Video Generator',category:'video',engine:'video'});
  generatorRegistry.register({id:'game-frame-generator',name:'Game Frame Generator',category:'game',engine:'game'});

  // usuário padrão
  auth.createUser({ name:'Administrator', role:'Administrator' });

  // carregar configs (best effort)
  const cfgNames = ['api','models','generators','repacks','permissions','settings','system','providers','tools','controllers','presets'];
  for(const n of cfgNames){ try{ await settings.load(n, `./configs/${n}.json`); }catch{ /* opcional */ } }

  // provedores/controllers a partir de configs se existirem
  const provCfg = settings.get('providers'); for(const p of (provCfg?.providers||[])) providers.register(p);
  if(!providers.list().length){ providers.register({id:'browser-local',name:'Browser Local',type:'Browser Local',state:'available',capabilities:['analysis','ui']}); providers.register({id:'webgpu-local',name:'WebGPU Local',type:'WebGPU',state:'detect',capabilities:['gpu-detect']}); providers.register({id:'external-backend',name:'External Backend',type:'Remote REST API',state:'unconfigured',url:null}); }

  const webgpuInfo = await webgpu.detect();
  const codecsInfo = webcodecs.detect();
  const caps = { capabilities:{ webgpu: !!webgpuInfo.available, wasm: typeof WebAssembly==='object', webcodecs: !!codecsInfo.available, workers: typeof Worker!=='undefined', indexedDB: typeof indexedDB!=='undefined', offscreenCanvas: typeof OffscreenCanvas!=='undefined' }, webgpu: webgpuInfo, webcodecs: codecsInfo, hardware:{ deviceMemoryGB: navigator.deviceMemory||null, hardwareConcurrency: navigator.hardwareConcurrency||null }, browser:{ userAgent: navigator.userAgent, platform: navigator.platform } };

  await lifecycle.initialize({ caps });

  const enginesManager = { list: ()=>[webgpu.getStatus(), webcodecs.getStatus(), onnx.getStatus(), backend.getStatus()], select: (c={})=>null, get:(id)=>({webgpu,webcodecs,onnx,backend}[id]||null) };
  const universalGenerator = frameGenerator;

  const app = {
    core: lifecycle, lifecycle, events, logger, api, json, config: settings, settings,
    db, storage: db, cache, history, modelRegistry, modelLoader, modelCompatibility,
    quantization, quantizationAnalyzer, generatorRegistry, frameGenerator, imageGenerator, videoGenerator, universalGenerator,
    imageProcessor, videoProcessor, frameProcessor, webgpu, webcodecs, onnx, backend,
    engines: enginesManager, manifestLoader, tools, repacks, auth, users: auth, permissions, validation, security: validation,
    tasks, providers, caps, webgpuInfo, codecsInfo,
    getStatus(){
      const s=lifecycle.getStatus();
      return { ...s, capabilities:caps, webgpu:webgpuInfo, webcodecs:codecsInfo, counts:{ models:modelRegistry.list().length, loadedModels:modelLoader.listLoaded().length, tasks:tasks.list().length, providers:providers.list().length, engines:enginesManager.list().length, tools:tools.list().length, repacks:repacks.list().length, users:auth.listUsers().length, generators:generatorRegistry.list().length } };
    }
  };

  if(typeof window!=='undefined') window.FGUA = app;
  logger.info('Núcleo FGUA inicializado', {status: lifecycle.status});
  return app;
}

export default createApp;
