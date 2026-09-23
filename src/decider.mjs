import { spawn } from 'node:child_process';
import { evaluate } from 'jevrouter';

const LAYA_URL = 'http://127.0.0.1:8000/v1/systemone';
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 1_000_000;

export function deciderConfig(env = process.env) {
  const kind = (env.CODEX_ROUTER_DECIDER || 'jev').trim().toLowerCase();
  if (kind === 'jev') {
    return { kind, configured: Boolean(env.TYPESAFE_API_KEY || env.JEV_API_KEY || env.OPENROUTER_API_KEY) };
  }
  if (kind === 'laya' || kind === 'http') {
    const url = env.CODEX_ROUTER_DECIDER_URL || (kind === 'laya' ? LAYA_URL : '');
    let valid = false;
    try { valid = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* Invalid URL. */ }
    return { kind, configured: valid, url };
  }
  if (kind === 'command') {
    let args = [];
    let valid = true;
    try { args = JSON.parse(env.CODEX_ROUTER_DECIDER_ARGS || '[]'); } catch { valid = false; }
    return { kind, configured: valid && Boolean(env.CODEX_ROUTER_DECIDER_COMMAND?.trim()) && Array.isArray(args) && args.every(arg => typeof arg === 'string'), args };
  }
  return { kind, configured: false };
}

async function evaluateHttp(input, config, env) {
  const headers = { 'content-type': 'application/json' };
  if (env.CODEX_ROUTER_DECIDER_API_KEY) headers.authorization = `Bearer ${env.CODEX_ROUTER_DECIDER_API_KEY}`;
  const body = env.CODEX_ROUTER_DECIDER_MODEL ? { ...input, model: env.CODEX_ROUTER_DECIDER_MODEL } : input;
  const response = await fetch(config.url, {
    method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Decider HTTP ${response.status}`);
  const data = await response.text();
  if (Buffer.byteLength(data) > MAX_OUTPUT_BYTES) throw new Error('Decider response too large');
  return JSON.parse(data);
}

function evaluateCommand(input, config, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(env.CODEX_ROUTER_DECIDER_COMMAND, config.args, {
      shell: false, stdio: ['pipe', 'pipe', 'ignore'], timeout: TIMEOUT_MS,
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
  if (config.kind === 'command') return evaluateCommand(input, config, env);
  return evaluateHttp(input, config, env);
}
