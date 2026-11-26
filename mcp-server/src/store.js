import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DEFAULTS_FILE, STORE_FILE, ensureDirs } from './config.js';

let cache = null;
let queue = Promise.resolve();

function seed() {
  ensureDirs();
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: defaults.settings || {},
    presets: defaults.presets || [],
    prompts: defaults.prompts || [],
    jobs: [],
  };
}

function write(db) {
  ensureDirs();
  const temp = path.join(DATA_DIR, `store.${process.pid}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, STORE_FILE);
  cache = db;
}

export function read() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    cache = seed();
    write(cache);
  }
  return cache;
}

export function mutate(fn) {
  const run = queue.then(async () => {
    const db = read();
    const result = await fn(db);
    db.updatedAt = new Date().toISOString();
    write(db);
    return result;
  });
  queue = run.then(() => {}, () => {});
  return run;
}

export const uid = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

export function listPresets(kind) {
  const all = read().presets || [];
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export function getPreset(id) {
  return read().presets.find((p) => p.id === id) || null;
}

export async function savePreset(preset) {
  if (!preset?.id || typeof preset.id !== 'string') throw new Error('preset.id é obrigatório');
  return mutate((db) => {
    const index = db.presets.findIndex((p) => p.id === preset.id);
    const record = { ...preset, updatedAt: new Date().toISOString() };
    if (index >= 0) db.presets[index] = record;
    else db.presets.push(record);
    return record;
  });
}

export async function deletePreset(id) {
  return mutate((db) => {
    const before = db.presets.length;
    db.presets = db.presets.filter((p) => p.id !== id);
    return { id, removed: db.presets.length < before };
  });
}

export function listPrompts() {
  return read().prompts || [];
}

export function getPrompt(id) {
  return read().prompts.find((p) => p.id === id) || null;
}

export async function savePrompt(prompt) {
  if (!prompt?.id || typeof prompt.id !== 'string') throw new Error('prompt.id é obrigatório');
  return mutate((db) => {
    const index = db.prompts.findIndex((p) => p.id === prompt.id);
    const record = { ...prompt, updatedAt: new Date().toISOString() };
    if (index >= 0) db.prompts[index] = record;
    else db.prompts.push(record);
    return record;
  });
}

export async function deletePrompt(id) {
  return mutate((db) => {
    const before = db.prompts.length;
    db.prompts = db.prompts.filter((p) => p.id !== id);
    return { id, removed: db.prompts.length < before };
  });
}

export function renderPrompt(id, variables = {}) {
  const prompt = getPrompt(id);
  if (!prompt) throw new Error(`Prompt não encontrado: ${id}`);
  return (prompt.body || '').replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match,
  );
}

export function getSettings() {
  return { ...read().settings };
}

export async function updateSettings(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('patch deve ser um objeto');
  return mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    return { ...db.settings };
  });
}

export function listJobs() {
  return (read().jobs || []).map(({ history, ...job }) => ({ ...job, hasHistory: Array.isArray(history) }));
}

export function getJob(id) {
  return read().jobs.find((j) => j.id === id) || null;
}

export async function createJob(job) {
  const record = { ...job, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mutate((db) => { db.jobs.unshift(record); });
  return record;
}

export async function updateJob(id, patch) {
  return mutate((db) => {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    return job;
  });
}

export function resetForTests() {
  cache = null;
  queue = Promise.resolve();
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* noop */ }
}
