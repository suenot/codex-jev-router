# Codex Jev Router

[English](README.md) · [Русский](README.ru.md) · [简体中文](README.zh-Hans.md)

<p align="center">
  <img src="assets/subagent-routing-comic.png" alt="一個輕量決策器將簡單查找交給 Luna、一般錯誤修復交給 Sol，複雜任務則交給採用更高推理強度的 Sol。" width="820">
</p>

每次啟動子代理前，路由器會做一次簡短決策：選擇 Luna low 或 medium、Sol low 或 high；只有特別困難的任務才選擇 Sol ultra。

本儲存庫使用 [JevRouter](https://github.com/BillionsBobby/JevRouter) 或其他具型別的決策引擎，重現我的 Codex 子代理設定。你可以把本儲存庫交給日後的 Codex 工作階段，要求它：**閱讀本文、複製儲存庫、執行安裝程式並驗證結果**。安裝程式只修改本機 Codex 設定，修改前會建立備份；無須部署伺服器。

## 安裝後會設定什麼

| 情境 | 模型與推理強度 |
| --- | --- |
| 一般子代理任務或備用方案 | `gpt-6-sol`，`high` |
| 非常簡單且範圍明確的子代理任務 | `gpt-6-luna`，`low`，僅在決策器高度確信時使用 |
| 步驟不多、清楚且範圍明確的任務 | `gpt-6-luna`，`medium`，僅在決策器高度確信時使用 |
| 需要 Sol 判斷能力的簡短、聚焦任務 | `gpt-6-sol`，`low`，僅在決策器高度確信時使用 |
| 特別困難的任務或已確認 Sol 未能解決的任務 | `gpt-6-sol`，`ultra` |

安裝程式只設定子代理的預設模型，在 `~/.codex/AGENTS.md` 中加入路由規則，並從 `explorer`、`reviewer`、`worker` 角色檔案中移除固定模型。若角色檔案不存在，安裝程式會建立它們。父代理在呼叫 `spawn_agent` 前，先根據簡短的任務摘要進行路由，再明確傳入選定的 `model` 和 `reasoning_effort`。`reviewer` 角色預設使用 Sol high，只有符合特別困難的條件時才使用 Sol ultra。

### 搜尋與研究

路由器也會為**委派給子代理的**網路研究、檔案搜尋和日誌搜尋選擇模型。它選擇的是整個子代理工作階段的模型，而非每次網頁或命令列搜尋所用的模型。父代理直接搜尋時仍使用目前的模型。只有研究工作適合作為獨立任務時才委派：網路研究使用 `default` 角色；唯讀的檔案或日誌搜尋使用 `explorer`。

| 委派任務 | 預期路由 |
| --- | --- |
| 查找一個指定符號、確切的日誌記錄，或已知官方頁面上的一項事實 | 決策器確信時使用 Luna low |
| 從少數指定檔案或日誌中擷取事實，形成結構化摘要 | 決策器確信時使用 Luna medium |
| 對照權威頁面核實一項具體說法，或比較兩個已有文件說明的選項 | 決策器確信時使用 Sol low |
| 比較最新資料、解決資料衝突，或綜合研究結果 | Sol high |
| 關聯多個服務的日誌，或在檔案中追查原因不明的問題 | Sol high |
| 特別困難的調查，或已確認 Sol 未能解決的問題 | Sol ultra |

交給決策器的摘要應描述搜尋目標和範圍，不要複製私人日誌、原始碼或憑證。決策不確定時回退至 Sol high。

這是一套**依賴代理遵循說明的工作流程**。在本機 Codex CLI 0.156.1 的基本測試中，`collaboration.spawn_agent` 沒有觸發 `PreToolUse` 掛鉤，而且任務訊息是加密的。因此，本設定不宣稱能在工具呼叫邊界強制執行路由。[Codex 子代理文件](https://learn.chatgpt.com/docs/agent-configuration/subagents)介紹了明確傳入模型參數和角色覆寫設定。

## 給 Codex 的操作說明

使用者要求依照本儲存庫設定 Codex 時：

1. 閱讀本文和本機 `AGENTS.md` 指示，確認使用者沒有指定其他模型選擇。
2. 將儲存庫複製到獨立的本機目錄；不要把憑證複製進儲存庫。
3. 執行以下命令，檢查試執行列出的檔案，然後安裝。安裝程式修改檔案前會建立附有時間戳記的備份。
4. 選擇下文所述的決策後端，執行診斷命令。回報缺少的後端設定或連線故障，並告知使用者現有 Codex 工作階段需要重新啟動才能載入新設定。
5. 不要宣稱掛鉤會自動強制執行路由，也不要宣稱已測得成本節省。如果目前 Codex 版本允許，實際啟動一個子代理進行基本測試。

```sh
gh repo clone suenot/codex-jev-router
cd codex-jev-router
npm ci
npm run check
node scripts/install.mjs --dry-run
node scripts/install.mjs
npm run doctor -- --live
```

`npm ci` 使用鎖定到特定提交的 JevRouter 相依套件；npm 可能透過 GitHub SSH 取得它。需要 Node.js 20+ 和 GitHub 存取權。若要設定非預設的 Codex 設定目錄，可向 `install.mjs` 和 `doctor.mjs` 傳入 `--codex-home /absolute/path`，或設定 `CODEX_HOME`。

## 決策後端

`CODEX_ROUTER_DECIDER` 指定決策引擎。請在 Codex 命令所繼承的環境中設定此變數。預設值為 `jev`，以維持現有安裝的行為。**變更的只有決策器；子代理始終使用 Codex 提供的模型。** `http` 和 `command` 是接入方式，並非 Jev 的替代專案。相容伺服器必須接受文字狀態，以及 `choice` 和 `noul` 兩種問題；只有相同的 URL 路徑並不足夠。

| 值 | 接入方式 | 設定 |
| --- | --- | --- |
| `jev`（預設） | 透過 JevRouter 使用代管 Jev | `TYPESAFE_API_KEY`、`JEV_API_KEY` 或 `OPENROUTER_API_KEY` |
| `laya` | 本機 [Laya](https://github.com/NandhaKishorM/laya) 伺服器 | 預設 `http://127.0.0.1:8000/v1/systemone`；可選 `CODEX_ROUTER_DECIDER_URL` |
| `kev` | 本機 [Kev](https://github.com/jaredpalmer/kev) 伺服器 | 預設 `http://127.0.0.1:8009/v1/systemone`；可選 `CODEX_ROUTER_DECIDER_URL` |
| `http` | 任意相容 Jev 的 `POST /v1/systemone` 服務 | 必填 `CODEX_ROUTER_DECIDER_URL` |
| `command` | 透過本機可執行轉接程式接入其他引擎 | 必填 `CODEX_ROUTER_DECIDER_COMMAND`；可選 JSON 字串陣列 `CODEX_ROUTER_DECIDER_ARGS` |

對於 `laya`、`kev` 和 `http`，`CODEX_ROUTER_DECIDER_API_KEY` 會加入 bearer 權杖，`CODEX_ROUTER_DECIDER_MODEL` 可設定請求中的可選 `model` 欄位。`command` 轉接程式從 stdin 接收一筆 JSON 請求，並向 stdout 輸出一筆符合 Jev 格式的 JSON 回應。它不會透過 shell 啟動。請求包含 `state` 和 `questions`；回應必須包含 `answers.tier`（`choice`、`confidence`、`probabilities`）和 `answers.exceptional`（`noul`）。`tier` 可選擇 `luna_low`、`luna_medium`、`sol_low` 或 `sol_high`；舊版轉接程式回傳的 `luna` 仍會選中 Luna low。路由器使用 JevRouter 的具型別輔助函式驗證答案。即使其他開源決策器不支援 Jev 的 HTTP 協定，也可透過小型轉接程式接入。這不表示 [awesome-jev](https://github.com/hellogumbo/awesome-jev) 中的每個專案都已直接支援此分類任務。

轉接程式回應範例：

```json
{"answers":{"tier":{"type":"choice","choice":"sol_low","confidence":0.9,"probabilities":{"luna_low":0.02,"luna_medium":0.03,"sol_low":0.9,"sol_high":0.05}},"exceptional":{"type":"noul","noul":0.02}}}
```

如需使用本機 Laya，請另外安裝並啟動其[相容 Jev 的 HTTP 伺服器](https://github.com/NandhaKishorM/laya#self-hosting-http-server-jev-compatible)：

```sh
python3 -m venv .venv-laya
.venv-laya/bin/python -m pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_DEVICE=cpu .venv-laya/bin/laya-serve
```

然後，在啟動 Codex 的環境中設定 `export CODEX_ROUTER_DECIDER=laya`，並執行 `npm run doctor -- --live`。如果任務摘要應留在本機，請讓 Laya 只監聽迴環位址。首次使用時可能需要下載模型權重；執行即時檢查前先讓伺服器完成預熱。Laya 模型的輸入長度有限，因此路由摘要應保持簡短。寫在 `.zshrc` 中的 export 只會傳給繼承該 shell 環境的程序；從圖形介面啟動的 Codex 可能需要另外設定環境變數。

對於 Kev，請依照其[本機伺服器啟動說明](https://github.com/jaredpalmer/kev/blob/main/README.md#quick-start)在 8009 連接埠啟動服務，再在 Codex 的環境中設定 `export CODEX_ROUTER_DECIDER=kev`。Kev 的預設模型是 `kev-latest`；其伺服器接受此處使用的文字狀態和具型別問題。如果伺服器要求 `KEV_API_KEY`，請在用戶端將相同的值設為 `CODEX_ROUTER_DECIDER_API_KEY`。模型權重和執行環境由 Kev 管理，而非本儲存庫。

[PlayJev](https://github.com/OmniJev/PlayJev/blob/main/playjev/serve.py) 也提供 `/v1/systemone`，但它要求影像影格且只支援 `choice`，會拒絕本路由器使用的文字狀態和 `noul` 問題。它是遊戲模型，不適合在這裡充當決策後端。

對於不相容的引擎，可以設定本機封裝程式，例如 `CODEX_ROUTER_DECIDER=command`、`CODEX_ROUTER_DECIDER_COMMAND=/absolute/path/to/adapter`，以及可選的 `CODEX_ROUTER_DECIDER_ARGS='["--model","local"]'`。封裝程式負責轉換請求並回傳具型別的回應。決策失敗、回應格式錯誤或逾時，都會安全回退至 Sol high。

## 代管 Jev 的憑證與隱私

預設的代管 Jev 後端需要在 **Codex 命令的環境中**提供 `TYPESAFE_API_KEY`、`JEV_API_KEY` 或 `OPENROUTER_API_KEY`。透過現有密鑰管理工具或 shell 環境提供憑證。不要把憑證寫入本儲存庫、`AGENTS.md` 或 `config.toml`。`npm run doctor` 會回報所選後端是否已設定；`npm run doctor -- --live` 會檢查真實決策，但不會顯示憑證。

路由器會把角色和最多 4,000 個字元的任務摘要傳給選定的決策器。使用代管 Jev 時，摘要會離開本機；使用繫結迴環位址的 Laya 時，摘要留在本機。常見憑證模式或加密訊息會觸發本機 Sol 回退。這些檢查無法發現所有密鑰，因此呼叫者仍須清理摘要。摘要本身不會儲存；`~/.codex/router-decisions.jsonl` 只記錄所選模型、角色、原因、時間戳記和截斷的任務雜湊。決策器無法使用時，路由器回傳 Sol high。在已測試的 Codex `read-only` 沙箱中，無法連線到外部 Jev，因此同樣回退至 Sol。安裝程式不會放寬沙箱或網路設定。

## 直接路由與失敗重試

```sh
printf '%s\n' 'Find the definition of calculateTotal and report its path.' \
  | node src/route.mjs --role=explorer
```

命令輸出包含 `model`、`reasoning_effort` 和 `reason` 的 JSON。將前兩個欄位傳給 `spawn_agent`。只有決策器充分確認任務特別困難時，才會一開始就選擇 Sol `ultra`。在 **Sol 確實出現可觀察的實質性失敗** 後，以 `[codex-router:sol-failed]` 開始新的路由摘要，並說明失敗情況。父代理必須核實失敗；此標記本身不能證明失敗。

## 復原

每次安裝都會產生一份清單，並將每個將被修改的現有檔案複製到 `~/.codex/backups/codex-jev-router/<timestamp>/`。只還原清單列出的檔案。如果某檔案標記為 `existed: false`，只有在後續修改不依賴該檔案時才刪除它。對於安裝後的其他修改，應合併而非覆蓋。復原設定後重新啟動 Codex。

此目錄有獨立的 Git 儲存庫。安裝過程修改的是 Git 儲存庫之外的本機 Codex 檔案；安裝程式不會提交或發布這些本機設定。
