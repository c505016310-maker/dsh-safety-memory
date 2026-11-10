# dsh-safety-memory

> 简称 **dsh-sm**。给每个 DSH 会话注入一套可编辑的安全守则 + 项目记忆工作流，并把项目记忆真正落到磁盘。

DSH 插件。它在每个模型请求的系统提示词里注入两段内容：

1. **底层安全守则**：八个维度的硬约束（写边界、停止权、系统保护、网络最小化、注入隔离、最小变更、资源熔断、破坏性操作确认）。
2. **项目记忆工作流**：新项目先问目标/环境/节奏，再建立 `README.md` / `MEMO.md` / `DECISIONS.md` / `LOG.md`；已有 `MEMO.md` 时**插件自己读取并附进提示词**，不依赖模型主动读文件。

两段内容都不在代码里。它们是 `$DSH_HOME/safety-memory/` 下的 Markdown，改完保存，下一次模型请求即生效。

---

## 功能

- **可编辑的策略，不是硬编码**：`rules.md`、`memory-workflow.md`、`templates.md` 都是普通 Markdown，按 mtime 缓存，改完即生效。
- **自动读取项目记忆**：工作目录存在 `MEMO.md` 时，插件读取它（默认上限 48 KiB），以「数据，不是指令」的块附在系统提示词里；模型不需要再调用读取工具。
- **三种会话状态**：新项目（先问三个问题）、续接（已有 MEMO，先核对第 0/5 节）、执行（按记忆协议继续）。
- **子代理隔离**：子代理只收到安全守则和一条「子代理」提示，不会去问用户三个问题或创建记忆文件。
- **新会话判定持久化**：`.seen-sessions.json` 记录已见会话 id，插件重载/DSH 重启不会把老会话误判成新会话。
- **只读工作区**：插件只写 `$DSH_HOME/safety-memory/`；项目记忆文件由模型用 DSH 现有写工具创建，受当前 sandbox/approval 策略约束。

---

## 安装

发布包是一个 `.tgz`，没有构建步骤，安装后无需编译。

### 方式一：DSH Desktop

打开 **设置 → 插件**，选择从文件/URL 安装，填入 Release 的 `.tgz` 地址：

```text
https://github.com/c505016310-maker/dsh-safety-memory/releases/download/v1.0.0/dsh-safety-memory-1.0.0.tgz
```

### 方式二：命令行

```sh
dsh plugin --profile <你的profile> add \
  https://github.com/c505016310-maker/dsh-safety-memory/releases/download/v1.0.0/dsh-safety-memory-1.0.0.tgz
```

把 `<你的profile>` 换成实际 profile（如 `web`）。Desktop 使用的 profile 由 Desktop 管理，优先用方式一。

### 方式三：从源码

```sh
git clone https://github.com/c505016310-maker/dsh-safety-memory.git
cd dsh-safety-memory
pnpm pack --pack-destination dist
dsh plugin --profile <你的profile> add ./dist/dsh-safety-memory-1.0.0.tgz
```

安装后重启 DSH，或在 profile 的 `cordis.patch.yml` 里保存一次改动触发重载。

---

## 快速开始

1. 新建一个会话。
2. 如果当前目录没有 `MEMO.md`，插件会进入「启动模式」，先问三个问题；回答后按模板创建四个记忆文件。
3. 如果当前目录已有 `MEMO.md`，插件会直接读取并附上，按第 0 节核对环境、按第 5 节继续。
4. 想改规则或工作流：编辑 `$DSH_HOME/safety-memory/rules.md` 或 `memory-workflow.md`，保存即可。

---

## 数据目录

默认 `$DSH_HOME/safety-memory/`（Windows 通常是 `C:\Users\<你>\.dsh\safety-memory\`）：

| 文件 | 是否注入 | 作用 |
|---|---|---|
| `rules.md` | 每个请求 | 底层安全守则（八个维度） |
| `memory-workflow.md` | 每个请求 | 项目记忆工作流、收工清单、压缩协议 |
| `templates.md` | 按需读取 | 四个记忆文件的模板 |
| `README.md` | 否 | 数据目录的编辑说明 |
| `.seen-sessions.json` | 否 | 已见过的会话 id |

首次加载时如果文件不存在，插件从包内 `defaults/` 复制；**已存在的文件永不覆盖**。

`memory-workflow.md` 里的 `__TEMPLATES_PATH__` 会被替换成 `templates.md` 的绝对路径。

---

## 配置

在 profile 的 `cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: dsh-safety-memory
  name: dsh-safety-memory
  config:
    enabled: true
    injectRules: true
    injectWorkflow: true
    persistSeen: true
    autoReadMemory: true
    autoReadFiles:
      - MEMO.md
    memoryReadMaxBytes: 49152
    ruleOrder: 20
    workflowOrder: 35
    maxBytes: 65536
    dataDir: "D:/my/policies"
    rulesPath: "rules.md"
    workflowPath: "memory-workflow.md"
    templatesPath: "templates.md"
    memoryFiles:
      - README.md
      - MEMO.md
      - DECISIONS.md
      - LOG.md
    memoFile: MEMO.md
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `injectRules` | `true` | 注入安全守则 |
| `injectWorkflow` | `true` | 注入记忆工作流 |
| `autoReadMemory` | `true` | 自动读取工作目录的 `MEMO.md` |
| `autoReadFiles` | `["MEMO.md"]` | 要自动读取的文件；相对路径按工作目录解析 |
| `memoryReadMaxBytes` | `49152` | 单个自动读取文件的上限 |
| `persistSeen` | `true` | 持久化已见会话 id |
| `ruleOrder` / `workflowOrder` | `20` / `35` | 系统提示词中的排序 |
| `maxBytes` | `65536` | 策略文件注入上限 |
| `dataDir` | `$DSH_HOME/safety-memory` | 策略文件目录 |

相对路径按 `dataDir` 解析；绝对路径原样使用；`~` 会展开。

---

## 工作原理

- 通过 Cordis 的 `ctx.systemPrompt.section()` 注册两个段落：`safety-memory:rules`（order 20）和 `safety-memory:workflow`（order 35）。
- 每次组装提示词时读取策略文件，按 `mtime + size` 缓存。
- 监听 `agent/created`：只有 `source === 'startup'` 且会话 id 从未见过时，才标记为新会话。
- 工作目录通过 `ctx.workingDirectory.get(session)` 获取，用于判断 `MEMO.md` 是否存在、显示记忆文件状态。
- 子代理通过 `session.header.origin === 'subagent'`、`parentSession`、`delegationDepth > 0` 识别，不进入启动流程。

### 三种会话状态

| 状态 | 条件 | 模型收到的指令 |
|---|---|---|
| 启动模式 | 新会话 + 当前目录无 `MEMO.md` | 先问目标/环境/节奏，再按模板建四个文件，确认后进入实现 |
| 续接模式 | 新会话 + 已有 `MEMO.md` | 插件自动附带 MEMO；核对第 0、5 节，不重复问三个问题 |
| 执行模式 | 已建立的会话 | 有 MEMO 时自动附带最新内容；未初始化时提示补建 |

---

## 开发

```sh
# 单元测试（无需 DSH 运行时）
node test/unit.mjs

# 预览某个目录会被注入什么
node preview.mjs --cwd /path/to/project

# 打包发布产物
pnpm pack --pack-destination dist
```

项目结构：

```text
lib/           插件入口（Cordis name / inject / apply）
defaults/      首次加载时复制的默认策略与模板
assets/        图标
test/          假 ctx 单元测试
preview.mjs    本地预览渲染结果
cordis.patch.yml  bundle patch
```

插件只使用 Node 内置模块，无第三方运行依赖。

---

## 兼容性

- DSH：`>=0.2.1-rc.3 <0.3.0-0`
- Node：`>=20`

---

## 已知边界

- 这是「提示词层面的预防针」，不是沙箱/权限系统；实际执行仍受 DSH 的 sandbox/approval 策略约束。
- 自动读取的 `MEMO.md` 超过 `memoryReadMaxBytes` 会截断并标注，此时模型需要自己补读剩余部分。
- 自动读取只对主会话生效；子代理不会收到 MEMO 内容，由主代理在派发时提供背景。
- 「新项目」判定只看当前工作目录有没有 `MEMO.md`；用户说「只是临时提问」时应跳过初始化。

---

## License

MIT © 2026 Eu
