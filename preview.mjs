#!/usr/bin/env node
/**
 * Preview exactly what dsh-safety-memory injects, without starting DSH.
 *
 *   node preview.mjs
 *   node preview.mjs --cwd D:\work\my-project
 *   node preview.mjs --data-dir D:\policies --json
 *
 * It mounts the plugin against a fake Cordis context, emits one `startup`
 * event for a synthetic session, and prints the two rendered system-prompt
 * sections.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith('--') ? fallback : value;
}

const cwd = path.resolve(option('--cwd', process.cwd()));
const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim()
  ? process.env.DSH_HOME.trim()
  : path.join(os.homedir(), '.dsh');
const dataDir = path.resolve(option('--data-dir', path.join(dshHome, 'safety-memory')));
const asJson = args.includes('--json');

const plugin = await import(pathToFileURL(path.resolve(import.meta.dirname, 'lib', 'index.js')).href);

const handlers = new Map();
const sections = [];
let directory = cwd;
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) {
    const dispose = fn();
    return dispose;
  },
  on(event, callback) {
    const list = handlers.get(event) ?? [];
    list.push(callback);
    handlers.set(event, list);
    return () => {};
  },
  emit(event, payload) {
    for (const callback of handlers.get(event) ?? []) callback(payload);
  },
  get(name) {
    return name === 'workingDirectory' ? { get: () => directory } : undefined;
  },
  systemPrompt: {
    section(section) {
      sections.push(section);
      return () => {};
    },
  },
};

plugin.apply(ctx, { dataDir, persistSeen: false });
const session = { id: `preview-${process.pid}`, header: { cwd } };
ctx.emit('agent/created', { agent: { session }, source: 'startup' });

const ruleSection = sections.find((section) => section.name === 'safety-memory:rules');
const workflowSection = sections.find((section) => section.name === 'safety-memory:workflow');
if (ruleSection === undefined || workflowSection === undefined) {
  console.error('dsh-safety-memory: sections were not registered (is the plugin disabled?)');
  process.exit(1);
}

const rules = ruleSection.text({ agent: { session } });
const workflow = workflowSection.text({ agent: { session } });

if (asJson) {
  console.log(JSON.stringify({ dataDir, cwd, rulesBytes: Buffer.byteLength(rules), workflowBytes: Buffer.byteLength(workflow), workflow }, null, 2));
} else {
  console.log(`dataDir: ${dataDir}`);
  console.log(`cwd:     ${cwd}`);
  console.log(`mode:    ${workflow.includes('### 本会话状态：新会话 / 启动模式') ? 'startup (no MEMO.md)' : workflow.includes('续接模式') ? 'continue (MEMO.md exists)' : 'established / uninitialized'}`);
  console.log(`sizes:   rules=${Buffer.byteLength(rules)}B workflow=${Buffer.byteLength(workflow)}B`);
  console.log(`MEMO:    ${fs.existsSync(path.join(cwd, 'MEMO.md')) ? 'found' : 'missing'}`);
  console.log('');
  console.log('--- rules ---');
  console.log(rules);
  console.log('');
  console.log('--- workflow (head) ---');
  console.log(workflow.split('\n').slice(0, 12).join('\n'));
  console.log('...');
}
