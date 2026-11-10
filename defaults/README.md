# dsh-safety-memory 数据目录

这个目录是插件的「优化接口」：改这里的 Markdown 文件，就能改插件注入给模型的内容，不需要改代码，也不需要重启 DSH。

| 文件 | 作用 | 生效时机 |
|---|---|---|
| `rules.md` | 底层安全守则，逐字注入系统提示词（每个模型请求） | 保存后下一次模型请求 |
| `memory-workflow.md` | 项目记忆工作流，逐字注入系统提示词（每个模型请求） | 保存后下一次模型请求 |
| `templates.md` | README/MEMO/DECISIONS/LOG 的模板，不注入；开工建文件时由模型读取 | 保存后下一次读取 |

`memory-workflow.md` 里的 `__TEMPLATES_PATH__` 会被替换成 `templates.md` 的绝对路径，可以保留，也可以删掉。

## 怎么优化

1. 用任意编辑器打开对应文件，直接改。
2. 保存。插件按修改时间（mtime）判断变化，下一次模型请求就会用新内容。
3. 想确认当前实际注入的文本：新建一个会话，问一句「复述当前安全守则的八个维度标题」即可。

## 设计约定

- `rules.md` 保持每条规则「可判定、可执行、可触发停止」；不要写成愿望清单。
- `memory-workflow.md` 只负责「怎么建记忆、怎么收口」，不负责具体项目怎么做。
- 两处都避免重复同一事实；需要引用时写路径，不要复述。
- 插件只读取本目录，不会改写这些文件（首次安装时除外：文件不存在才写入默认内容）。
- 想换位置：在 profile 的 `cordis.patch.yml` 里配置 `dataDir` / `rulesPath` / `workflowPath` / `templatesPath`。

## 来源

- `rules.md` 整理自 `D:\Users\Admin\Desktop\底层安全守则.txt`
- `memory-workflow.md` 整理自 `D:\DSH\通用-项目记忆初始化提示词.md`

原始文件保留不动，作为内容来源和对照。这个目录里的副本才是运行时真正生效的版本。
