# Codex Jev Router

[English](README.md) · [Русский](README.ru.md) · [繁體中文](README.zh-Hant.md)

<p align="center">
  <img src="assets/subagent-routing-comic.png" alt="一个轻量决策器将简单查找交给 Luna，普通错误修复交给 Sol，复杂任务交给采用更高推理强度的 Sol。" width="820">
</p>

每次启动子代理前，路由器会做一次简短决策：选择 Luna low 或 medium、Sol low 或 high；只有特殊的高难度任务才选择 Sol ultra。

本仓库使用 [JevRouter](https://github.com/BillionsBobby/JevRouter) 或其他类型化决策引擎，复现我的 Codex 子代理配置。你可以把本仓库交给今后的 Codex 会话，并要求它：**阅读本文、克隆仓库、运行安装程序并验证结果**。安装程序只修改本地 Codex 配置，修改前会创建备份；无需部署服务器。

[基准报告（英文）](BENCHMARK.md)现在包含真实的 Django 源码任务，Jev 分别选择了 Luna low、Luna medium 和 Sol low。另有一项 SWE-bench Verified Django 修复任务：Luna medium 和独立运行的 Sol high 在三次重复中均通过官方测试。报告分别统计 Codex 与 Jev 的令牌、估算 API 成本、工具调用和小样本的局限；早期合成结果标为历史数据。

## 安装后会配置什么

| 场景 | 模型与推理强度 |
| --- | --- |
| 普通子代理任务或回退方案 | `gpt-6-sol`，`high` |
| 非常简单且范围明确的子代理任务 | `gpt-6-luna`，`low`，仅在决策器高度确信时使用 |
| 步骤不多、范围明确的任务或已有明确做法的小改动 | `gpt-6-luna`，`medium`，在决策器有足够把握时使用 |
| 需要 Sol 判断能力的简短、聚焦任务 | `gpt-6-sol`，`low`，仅在决策器高度确信时使用 |
| 特别困难的任务或已确认 Sol 未能解决的任务 | `gpt-6-sol`，`ultra` |

安装程序只设置子代理的默认模型，在 `~/.codex/AGENTS.md` 中加入路由规则，并从 `explorer`、`reviewer`、`worker` 角色文件中移除固定模型。角色文件不存在时会创建。父代理在调用 `spawn_agent` 前，先根据简短的任务摘要进行路由，再显式传入选定的 `model` 和 `reasoning_effort`。`reviewer` 角色默认使用 Sol high，只有符合特殊高难度条件时才使用 Sol ultra。

### 搜索与研究

路由器也会为**委派给子代理的**网络研究、文件搜索和日志搜索选择模型。它选择的是整个子代理会话的模型，而不是每次网页或命令行搜索的模型。父代理直接搜索时仍使用其当前模型。只有当研究工作适合作为独立任务时才委派：网络研究使用 `default` 角色；只读的文件或日志搜索使用 `explorer`。

| 委派任务 | 预期路由 |
| --- | --- |
| 查找一个指定符号、准确的日志记录，或已知官方页面上的一项事实 | 决策器确信时使用 Luna low |
| 从少数指定文件或日志中提取事实，形成结构化摘要 | 决策器确信时使用 Luna medium |
| 对照权威页面核实一项具体说法，或比较两个已有文档说明的选项 | 决策器确信时使用 Sol low |
| 比较最新资料、解决资料冲突，或综合研究结果 | Sol high |
| 关联多个服务的日志，或在文件中追踪原因不明的问题 | Sol high |
| 特别困难的调查，或已确认 Sol 未能解决的问题 | Sol ultra |

交给决策器的摘要应描述搜索目标和范围，不要复制私人日志、源代码或凭据。决策不确定时回退到 Sol high。

这是一套**依赖代理遵循说明的工作流程**。在本地 Codex CLI 0.156.1 的冒烟测试中，`collaboration.spawn_agent` 没有触发 `PreToolUse` 钩子，而且任务消息是加密的。因此，本配置不声称能在工具调用边界强制执行路由。[Codex 子代理文档](https://learn.chatgpt.com/docs/agent-configuration/subagents)介绍了显式传入模型参数和角色覆盖设置。

## 给 Codex 的操作说明

用户要求按本仓库配置 Codex 时：

1. 阅读本文和本地 `AGENTS.md` 指令，确认用户没有指定其他模型选择。
2. 将仓库克隆到单独的本地目录；不要把凭据复制到仓库中。
3. 执行以下命令，查看试运行列出的文件，然后安装。安装程序修改文件前会创建带时间戳的备份。
4. 选择下文所述的决策后端，运行诊断命令。报告缺失的后端配置或连接故障，并告知用户现有 Codex 会话需要重启才能加载新配置。
5. 不要声称钩子会自动强制执行路由，也不要声称一定能节省成本。提出性能结论前，请阅读实测报告中的准确率和令牌用量。如果当前 Codex 版本允许，实际启动一个子代理进行冒烟测试。

```sh
gh repo clone suenot/codex-jev-router
cd codex-jev-router
npm ci
npm run check
node scripts/install.mjs --dry-run
node scripts/install.mjs
npm run doctor -- --live
```

`npm ci` 使用锁定到特定提交的 JevRouter 依赖；npm 可能通过 GitHub SSH 获取它。需要 Node.js 20+ 和 GitHub 访问权限。若要配置非默认 Codex 配置目录，可向 `install.mjs` 和 `doctor.mjs` 传入 `--codex-home /absolute/path`，或设置 `CODEX_HOME`。

## 决策后端

`CODEX_ROUTER_DECIDER` 指定决策引擎。请在 Codex 命令继承的环境中设置该变量。默认值为 `jev`，以保留现有安装的行为。**改变的只有决策器；子代理始终使用 Codex 提供的模型。** `http` 和 `command` 是接入方式，并非 Jev 的替代项目。兼容服务器必须接受 JSON 状态，以及 `choice` 和 `noul` 两种问题；仅有相同的 URL 路径并不够。

| 值 | 接入方式 | 配置 |
| --- | --- | --- |
| `jev`（默认） | 通过 JevRouter 使用托管 Jev | `TYPESAFE_API_KEY`、`JEV_API_KEY` 或 `OPENROUTER_API_KEY` |
| `laya` | 本地 [Laya](https://github.com/NandhaKishorM/laya) 服务器 | 默认 `http://127.0.0.1:8000/v1/systemone`；可选 `CODEX_ROUTER_DECIDER_URL` |
| `kev` | 本地 [Kev](https://github.com/jaredpalmer/kev) 服务器 | 默认 `http://127.0.0.1:8009/v1/systemone`；可选 `CODEX_ROUTER_DECIDER_URL` |
| `simple-jev`、`open-jev-zefan`、`open-jev-dasein` | 返回 Jev 格式的本地服务器 | 内置本机地址；可选 `CODEX_ROUTER_DECIDER_URL` |
| `nanojev`、`minojev`、`mini-jev` | 具有协议转换的本地服务器 | 内置本机地址；可选 `CODEX_ROUTER_DECIDER_URL` |
| `semif`、`jevlike`、`anyjev`、`open-jev-nico` | 本地命令或程序库桥接器 | 安装上游运行环境，并设置模型或检查点变量 |
| `http` | 任意兼容 Jev 的 `POST /v1/systemone` 服务 | 必填 `CODEX_ROUTER_DECIDER_URL` |
| `command` | 通过本地可执行适配器接入其他引擎 | 必填 `CODEX_ROUTER_DECIDER_COMMAND`；可选 JSON 字符串数组 `CODEX_ROUTER_DECIDER_ARGS` |

[十种替代项目的配置说明（英文）](BACKENDS.md)列出了真实接口、环境变量和限制。默认仍为托管 Jev。HTTP 请求默认超时 15 秒，单次命令桥接器默认超时 120 秒；可用 `CODEX_ROUTER_DECIDER_TIMEOUT_MS` 调整。其他模型的概率未经针对本路由器的校准，使用低成本路由前应先在自己的任务上验证。

对 HTTP 后端，`CODEX_ROUTER_DECIDER_API_KEY` 会添加 bearer 令牌，`CODEX_ROUTER_DECIDER_MODEL` 可设置请求中的 `model` 字段（如果支持）；`simple-jev` 默认使用 `Qwen/Qwen3.5-0.8B`。`command` 适配器从 stdin 接收一条 JSON 请求，并向 stdout 输出一条符合 Jev 格式的 JSON 响应。它不会通过 shell 启动。请求包含 `state` 和 `questions`；响应必须包含 `answers.tier`（`choice`、`confidence`、`probabilities`）和 `answers.exceptional`（`noul`）。`tier` 可选择 `luna_low`、`luna_medium`、`sol_low` 或 `sol_high`；旧版适配器返回的 `luna` 仍会选中 Luna low。路由器使用 JevRouter 的类型化辅助函数验证答案。失败或格式错误时会回退到 Sol high。

适配器响应示例：

```json
{"answers":{"tier":{"type":"choice","choice":"sol_low","confidence":0.9,"probabilities":{"luna_low":0.02,"luna_medium":0.03,"sol_low":0.9,"sol_high":0.05}},"exceptional":{"type":"noul","noul":0.02}}}
```

如需使用本地 Laya，请单独安装并启动其[兼容 Jev 的 HTTP 服务器](https://github.com/NandhaKishorM/laya#self-hosting-http-server-jev-compatible)：

```sh
python3 -m venv .venv-laya
.venv-laya/bin/python -m pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_DEVICE=cpu .venv-laya/bin/laya-serve
```

然后，在启动 Codex 的环境中设置 `export CODEX_ROUTER_DECIDER=laya`，并运行 `npm run doctor -- --live`。如果任务摘要应留在本机，请让 Laya 只监听回环地址。首次使用时可能需要下载模型权重；运行实时检查前先让服务器完成预热。Laya 模型的输入长度有限，因此路由摘要应保持简短。写在 `.zshrc` 中的 export 只会传给继承该 shell 环境的进程；从图形界面启动的 Codex 可能需要单独设置环境变量。

对于 Kev，请按照其[本地服务器启动说明](https://github.com/jaredpalmer/kev/blob/main/README.md#quick-start)在 8009 端口启动服务，再在 Codex 的环境中设置 `export CODEX_ROUTER_DECIDER=kev`。Kev 的默认模型是 `kev-latest`；其服务器接受此处使用的文本状态和类型化问题。如果服务器要求 `KEV_API_KEY`，请在客户端将相同的值设为 `CODEX_ROUTER_DECIDER_API_KEY`。模型权重和运行环境由 Kev 管理，而非本仓库。

[PlayJev](https://github.com/OmniJev/PlayJev/blob/main/playjev/serve.py) 也提供 `/v1/systemone`，但它要求图像帧且只支持 `choice`，会拒绝本路由器使用的文本状态和 `noul` 问题。它是游戏模型，不适合在这里充当决策后端。

对于不兼容的引擎，可以配置本地包装程序，例如 `CODEX_ROUTER_DECIDER=command`、`CODEX_ROUTER_DECIDER_COMMAND=/absolute/path/to/adapter`，以及可选的 `CODEX_ROUTER_DECIDER_ARGS='["--model","local"]'`。包装程序负责转换请求并返回类型化响应。决策失败、响应格式错误或超时，都会安全回退到 Sol high。

## 托管 Jev 的凭据与隐私

默认的托管 Jev 后端需要在 **Codex 命令的环境中**提供 `TYPESAFE_API_KEY`、`JEV_API_KEY` 或 `OPENROUTER_API_KEY`。通过现有密钥管理器或 shell 环境提供凭据。不要把凭据写入本仓库、`AGENTS.md` 或 `config.toml`。`npm run doctor` 会报告所选后端是否已配置；`npm run doctor -- --live` 会检查真实决策，但不会显示凭据。

路由器会把角色和最多 4,000 个字符的任务摘要发给选定的决策器。使用托管 Jev 时，摘要会离开本机；使用绑定回环地址的 Laya 时，摘要留在本机。常见凭据模式或加密消息会触发本地 Sol 回退。这些检查无法发现所有密钥，因此调用者仍须清理摘要。摘要本身不会保存；`~/.codex/router-decisions.jsonl` 只记录所选模型、角色、原因、时间戳和截断的任务哈希。决策器不可用时，路由器返回 Sol high。在已测试的 Codex `read-only` 沙箱中，无法访问外部 Jev，因此同样回退到 Sol。安装程序不会放宽沙箱或网络设置。

## 直接路由与失败重试

```sh
printf '%s\n' 'Find the definition of calculateTotal and report its path.' \
  | node src/route.mjs --role=explorer
```

命令输出包含 `model`、`reasoning_effort` 和 `reason` 的 JSON。将前两个字段传给 `spawn_agent`。只有决策器充分确认任务特别困难时，才会一开始就选择 Sol `ultra`。在 **Sol 确实出现了可观察的实质性失败** 后，以 `[codex-router:sol-failed]` 开始新的路由摘要，并说明失败情况。父代理必须核实失败；该标记本身不能证明失败。

## 可选的技能推荐

[Claude Code 的 Jev Skill Suggestion 模组](https://www.aitmpl.com/component/mods/productivity/jev-skill-suggestion)依赖 Claude 专用钩子。本仓库提供 Codex `UserPromptSubmit` 钩子：先按 `SKILL.md` 描述排序，再检查最多三个候选的说明，每轮最多加入一个技能。[Codex 本身已按需加载完整技能说明](https://learn.chatgpt.com/docs/build-skills)；仅启用推荐不会删除初始的技能名称和描述列表。

指定本地技能目录。`--hide-skills` 会在 Codex 原生目录中禁用这些技能，由钩子按需加入一个，从而省去它们在初始上下文中的列表。未指定此参数时不会隐藏技能。隐藏模式请使用可信的本地 Laya、Kev 或命令适配器：

```sh
export CODEX_ROUTER_DECIDER=laya
node scripts/install-skill-suggestion.mjs --skills-dir "$HOME/.codex/skills" --skills-dir "$HOME/.agents/skills" --hide-skills --dry-run
node scripts/install-skill-suggestion.mjs --skills-dir "$HOME/.codex/skills" --skills-dir "$HOME/.agents/skills" --hide-skills
```

可重复传入 `--skills-dir`。不使用 `--hide-skills` 时只有推荐功能，不节省初始列表的 token。安装程序会备份修改过的文件、保留现有钩子，并写入 `~/.codex/skill-suggestion.json`。重启 Codex 后用 `/hooks` 审核并信任新钩子；未经信任的钩子不会运行。新增技能后需再次运行安装程序。被禁用的技能不能通过原生 `$skill` 调用；可在请求中写 `$技能名称`，由此钩子直接加载。插件和系统技能不受影响。

默认不会把请求发送给托管决策器。如需主动允许，请在 Codex 环境中以及使用 `--hide-skills` 安装时设置 `CODEX_ROUTER_SKILL_ALLOW_HOSTED=1`。此时最多 4000 个请求字符、技能描述以及每个入围技能最多 700 个字符可能发送给该后端。检测到常见凭据格式或决策器失败时，钩子会显示本地备用目录，该轮不节省列表 token。检测无法保证发现所有私人数据。此可选模式尚未测量 Codex 的 token 节省或技能选择准确率。

## 回滚

每次安装都会生成一份清单，并将每个将被修改的现有文件复制到 `~/.codex/backups/codex-jev-router/<timestamp>/`。只恢复清单列出的文件。如果某文件标记为 `existed: false`，只有在后续修改不依赖该文件时才删除它。对于安装后的其他修改，应合并而不是覆盖。恢复配置后重启 Codex。

此目录有独立的 Git 仓库。安装过程修改的是 Git 仓库之外的本地 Codex 文件；安装程序不会提交或发布这些本地配置。
