import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const plugin = await import(pathToFileURL(path.resolve(import.meta.dirname, '..', 'lib', 'index.js')).href);

function makeCtx() {
  const handlers = new Map();
  const sections = [];
  const disposers = [];
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    effect(fn) {
      const dispose = fn();
      if (typeof dispose === 'function') disposers.push(dispose);
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
      if (name === 'workingDirectory') return { get: () => cwd };
      return undefined;
    },
    systemPrompt: {
      section(section) {
        sections.push(section);
        return () => {};
      },
    },
  };
  let cwd = null;
  return { ctx, sections, setCwd(value) { cwd = value; }, handlers, disposers };
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-safety-memory-'));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-safety-memory-project-'));
const { ctx, sections, setCwd } = makeCtx();
setCwd(project);

plugin.apply(ctx, { dataDir, maxBytes: 65536 });

// Seeding
for (const name of ['rules.md', 'memory-workflow.md', 'templates.md', 'README.md']) {
  assert.ok(fs.existsSync(path.join(dataDir, name)), `seed ${name}`);
}

assert.equal(sections.length, 2, 'two sections registered');
assert.equal(sections[0].name, 'safety-memory:rules');
assert.equal(sections[0].interpolate, false);
assert.equal(sections[1].name, 'safety-memory:workflow');

const context = { agent: { session: { id: 'session-test-1' } } };

// Before any agent/created event: ongoing + no MEMO.
let rules = sections[0].text(context);
let workflow = sections[1].text(context);
assert.match(rules, /底层安全守则/);
assert.match(rules, /维度八/);
assert.match(workflow, /未初始化/);
assert.match(workflow, /templates\.md/);
assert.ok(!workflow.includes('__TEMPLATES_PATH__'), 'placeholder replaced');

// New startup conversation, no MEMO -> startup mode.
ctx.emit('agent/created', { agent: { session: { id: 'session-test-1' } }, source: 'startup' });
workflow = sections[1].text(context);
assert.match(workflow, /启动模式/);
assert.match(workflow, /三个问题/);
assert.match(workflow, /创建四个记忆文件/);

// Create MEMO.md -> continuation mode.
fs.writeFileSync(path.join(project, 'MEMO.md'), '# MEMO\n');
workflow = sections[1].text(context);
assert.match(workflow, /续接模式/);
assert.match(workflow, /已经自动读取 MEMO\.md/);
assert.match(workflow, /自动读取的项目记忆/);
assert.match(workflow, /# MEMO/);
assert.match(workflow, /MEMO\.md ✅/);

// Editing the file is picked up on the next read (mtime cache invalidation).
const rulesPath = path.join(dataDir, 'rules.md');
const future = new Date(Date.now() + 5000);
fs.writeFileSync(rulesPath, '# 自定义守则\n\n- 测试规则\n');
fs.utimesSync(rulesPath, future, future);
rules = sections[0].text(context);
assert.match(rules, /测试规则/);

// Disabled config registers nothing.
const second = makeCtx();
plugin.apply(second.ctx, { dataDir, enabled: false });
assert.equal(second.sections.length, 0, 'disabled registers no sections');

// A plugin reload must not turn an established session back into a fresh one.
const project2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-safety-memory-project2-'));
const third = makeCtx();
third.setCwd(project2);
plugin.apply(third.ctx, { dataDir, maxBytes: 65536 });
third.ctx.emit('agent/created', { agent: { session: { id: 'session-test-1' } }, source: 'startup' });
const reloadedWorkflow = third.sections[1].text({ agent: { session: { id: 'session-test-1' } } });
assert.ok(!reloadedWorkflow.includes('### 本会话状态：新会话 / 启动模式'), 'reloaded plugin keeps established session out of startup mode');

// A genuinely new session id still gets startup mode.
third.ctx.emit('agent/created', { agent: { session: { id: 'session-test-2' } }, source: 'startup' });
const newWorkflow = third.sections[1].text({ agent: { session: { id: 'session-test-2' } } });
assert.match(newWorkflow, /### 本会话状态：新会话 \/ 启动模式/, 'new session id gets startup mode');

// A delegated subagent never gets the user-facing startup protocol.
const subagent = { session: { id: 'subagent-test-1', header: { origin: 'subagent', parentSession: 'session-test-2' } } };
third.ctx.emit('agent/created', { agent: subagent, source: 'startup' });
const subagentWorkflow = third.sections[1].text({ agent: subagent });
assert.match(subagentWorkflow, /子代理/);
assert.ok(!subagentWorkflow.includes('### 本会话状态：新会话 / 启动模式'));

fs.rmSync(project2, { recursive: true, force: true });

fs.rmSync(dataDir, { recursive: true, force: true });
fs.rmSync(project, { recursive: true, force: true });

console.log('dsh-safety-memory unit test: ok');
