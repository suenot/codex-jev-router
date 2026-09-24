import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from 'jevrouter';
import { nativeRequest, nativeResponse } from './alternative-backends.mjs';

const HTTP_PRESETS = {
  laya: 'http://127.0.0.1:8000/v1/systemone',
  kev: 'http://127.0.0.1:8009/v1/systemone',
  'simple-jev': 'http://127.0.0.1:8000/v1/classifier',
  nanojev: 'http://127.0.0.1:8765/api/evaluate',
  minojev: 'http://127.0.0.1:8000/score',
  'mini-jev': 'http://127.0.0.1:8765/run',
  'open-jev-zefan': 'http://127.0.0.1:8791/v1/systemone',
  'open-jev-dasein': 'http://127.0.0.1:8000/v1/systemone',
};
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 1_000_000;
const BRIDGE_KINDS = new Set(['semif', 'jevlike', 'anyjev', 'open-jev-nico']);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function deciderConfig(env = process.env) {
  const kind = (env.CODEX_ROUTER_DECIDER || 'jev').trim().toLowerCase();
  const timeout = Number(env.CODEX_ROUTER_DECIDER_TIMEOUT_MS || (BRIDGE_KINDS.has(kind) ? 120_000 : TIMEOUT_MS));
  const validTimeout = Number.isInteger(timeout) && timeout >= 1000 && timeout <= 600_000;
  if (kind === 'jev') {
    return { kind, configured: Boolean(env.TYPESAFE_API_KEY || env.JEV_API_KEY || env.OPENROUTER_API_KEY) };
  }
  if (Object.hasOwn(HTTP_PRESETS, kind) || kind === 'http') {
    const url = env.CODEX_ROUTER_DECIDER_URL || HTTP_PRESETS[kind] || '';
    let valid = false;
    try { valid = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* Invalid URL. */ }
    return { kind, configured: valid && validTimeout, url, timeout };
  }
  if (BRIDGE_KINDS.has(kind)) {
    const ready = kind === 'semif' ? Boolean(env.CODEX_ROUTER_SEMIF_MODEL && env.CODEX_ROUTER_SEMIF_REVISION) :
      kind === 'jevlike' ? Boolean(env.CODEX_ROUTER_JEVLIKE_CHECKPOINT) :
        kind === 'anyjev' ? Boolean(env.CODEX_ROUTER_ANYJEV_MODEL) : true;
    const python = env.CODEX_ROUTER_PYTHON || 'python3';
    const command = ['jevlike', 'anyjev'].includes(kind) ? python : process.execPath;
    const script = ['jevlike', 'anyjev'].includes(kind) ? 'python-bridge.py' : 'node-bridge.mjs';
    return { kind, configured: validTimeout && ready, command, args: [resolve(ROOT, 'scripts', script), kind], timeout };
  }
  if (kind === 'command') {
    let args = [];
    let valid = true;
    try { args = JSON.parse(env.CODEX_ROUTER_DECIDER_ARGS || '[]'); } catch { valid = false; }
    return { kind, configured: validTimeout && valid && Boolean(env.CODEX_ROUTER_DECIDER_COMMAND?.trim()) && Array.isArray(args) && args.every(arg => typeof arg === 'string'), args, timeout };
  }
  return { kind, configured: false };
}

async function evaluateHttp(input, config, env) {
  const headers = { 'content-type': 'application/json' };
  if (env.CODEX_ROUTER_DECIDER_API_KEY) headers.authorization = `Bearer ${env.CODEX_ROUTER_DECIDER_API_KEY}`;
  const translated = nativeRequest(config.kind, input);
  const model = env.CODEX_ROUTER_DECIDER_MODEL || (config.kind === 'simple-jev' ? 'Qwen/Qwen3.5-0.8B' : '');
  const body = model && !['nanojev', 'minojev', 'mini-jev'].includes(config.kind) ? { ...translated, model } : translated;
  const response = await fetch(config.url, {
    method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(config.timeout),
  });
  if (!response.ok) throw new Error(`Decider HTTP ${response.status}`);
  const data = await response.text();
  if (Buffer.byteLength(data) > MAX_OUTPUT_BYTES) throw new Error('Decider response too large');
  return nativeResponse(config.kind, input, JSON.parse(data));
}

function evaluateCommand(input, config, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command || env.CODEX_ROUTER_DECIDER_COMMAND, config.args, {
      shell: false, stdio: ['pipe', 'pipe', 'ignore'], timeout: config.timeout,
    });
    const chunks = [];
    let size = 0;
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) child.kill();
      else chunks.push(chunk);
    });
    child.on('close', code => {
      if (size > MAX_OUTPUT_BYTES) reject(new Error('Decider response too large'));
      else if (code !== 0) reject(new Error(`Decider command exited ${code}`));
      else {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (error) { reject(error); }
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

export async function evaluateDecision(input, env = process.env) {
  const config = deciderConfig(env);
  if (!config.configured) throw new Error(`Decider ${config.kind} is not configured`);
  if (config.kind === 'jev') return evaluate(input);
  if (config.kind === 'command' || BRIDGE_KINDS.has(config.kind)) return evaluateCommand(input, config, env);
  return evaluateHttp(input, config, env);
}
