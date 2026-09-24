# Codex subagent routing benchmarks

## Cheaper routes on real Django source tasks

On 2026-09-24, we tested three read-only subagent tasks against the real Django checkout at commit [`9b224579875e30203d079cc2fee83b116d98eb78`](https://github.com/django/django/commit/9b224579875e30203d079cc2fee83b116d98eb78). The tasks required finding a method definition, extracting four setting defaults and one method signature from two files, and checking one claim about `SessionBase.cycle_key()`. Each task ran three times with clean Sol high and three times with the profile selected by Jev. Every Codex run used shell tools to read the repository; **all 18 answers were correct** against the pinned source. The [manifest, answers, traces, and results](benchmarks/django-source-tasks-2026-09-24/) are public. Run `python3 benchmarks/django-source-tasks-2026-09-24/grade.py --source /path/to/django` against that checkout to check the answers and source facts.

| Task | Jev route | Correct, baseline / routed | Codex tokens, baseline / routed | Estimated API price for three runs: baseline / routed Codex + Jev | Estimated saving |
| --- | --- | ---: | ---: | ---: | ---: |
| Exact symbol lookup | Luna low | 3/3 / 3/3 | 146,711 / 127,742 | $0.064169 / $0.002899 + $0.000081 | 95.4% |
| Settings and signature from two files | Luna medium | 3/3 / 3/3 | 134,900 / 133,255 | $0.067515 / $0.003895 + $0.000085 | 94.1% |
| Check `cycle_key()` behavior | Sol low | 3/3 / 3/3 | 168,629 / 118,268 | $0.083122 / $0.055277 + $0.000081 | 33.4% |
| **All nine pairs** | | **9/9 / 9/9** | **450,240 / 379,265** | **$0.214806 / $0.062071 + $0.000246** | **71.0%** |

Jev used **5,865 input and 645 output tokens separately** across the nine repeated decisions. Those tokens are **not added to either Codex token total**. Adding the separately measured Jev decision time to each routed Codex run gives 142.570 seconds for the nine routed runs versus 169.331 seconds for the baselines. This is an additive end-to-end estimate: the repeated Jev calls confirmed the same profiles but were measured separately from the Codex sessions. A fourth preselected task, diagnosis from a failing auth log, was routed to Sol high and excluded from this cheaper-route comparison; the [selection audit](benchmarks/routing-selection-audit-2026-09-24.json) records it.

### A code change that Luna medium passed

We also used [`django__django-16527`](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified), rated **15 minutes to 1 hour** in SWE-bench Verified. The issue specifies that Django admin's `show_save_as_new` control must require add permission. Three clean Sol-high runs and three Luna-medium runs started from the same [Django base commit](https://github.com/django/django/commit/bd366ca2aeffa869b7dbc0b0aa01caea75e6dc31), received the same [issue prompt](benchmarks/swe-bench-verified-django-16527/prompt.txt), edited separate worktrees, and could run tests. The official test patch was hidden until after the agents finished. Its test failed on the base checkout and passed with the reference patch **and all six generated patches**. The related five-test class also passed in all six runs. This is a local official-test check, **not a full SWE-bench Docker-harness grade**.

| Measure, three runs per arm | Clean Sol high | Routed Luna medium |
| --- | ---: | ---: |
| Official test and related class | 3/3 passes | 3/3 passes |
| Codex tokens | 1,355,801 | 422,815 |
| Median Codex time | 93.494 s | 32.288 s |
| Estimated Codex API price | $0.555916 | $0.009588 |
| Jev decision | — | 1,917 input and 216 output tokens; $0.000081; median total time 33.559 s |

For this **one small, explicitly scoped fix**, the illustrative API price including Jev is **98.3% lower** for the routed arm, and the median elapsed time including a separately measured Jev decision is **64.1% lower**. The first Luna run was an experimental profile based on Jev's preferred `luna_medium` choice before the router threshold changed; three later live decisions under the new policy selected Luna medium. The [case directory](benchmarks/swe-bench-verified-django-16527/) includes all six patches and traces, the official test patch, control and reference verdicts, and [machine-readable usage and cost](benchmarks/swe-bench-verified-django-16527/results.json).

Previously, a single confidence threshold kept all six short SWE-bench issue descriptions in the audit on Sol high, even when Jev preferred Luna medium. We lowered **only the Luna-medium gate** to `confidence ≥ 0.60` and `luna_medium probability ≥ 0.70`, while retaining the exception check, reviewer exclusion, and Sol-high fallback. The route for `django__django-16527` selected Luna medium on three of three repeated live decisions. Another public task, [`django__django-15103`](benchmarks/swe-bench-verified-django-15103/), had an experimental Luna-medium solution that passed both official tests, but live routing chose Luna medium on only **one of three** repeats and Sol high on the others; it is **not counted as a stable routed saving**. Both its baseline and Luna patch passed 19 related tests. The [selection audit](benchmarks/routing-selection-audit-2026-09-24.json) preserves the candidate routes before and after the gate change.

Prices apply [OpenAI's Standard short-context rates](https://developers.openai.com/api/docs/pricing): Sol $2 input, $0.20 cached input, $10 output per million tokens; Luna $0.10 input, $0.01 cached input, $0.50 output. Jev is priced separately at [TypeSafe's published $0.042 per million input tokens](https://typesafe.ai/blog/introducing-system-one-models-and-jev), with no output charge. Codex input counts include cached input. The estimate is `(input − cached input) × input rate + cached input × cached rate + output × output rate`, divided by one million, plus Jev input cost where shown. It is **not an observed Codex subscription bill**. All sessions used a temporary `CODEX_HOME` with only an `auth.json` symlink, no global or project `AGENTS.md`, `--ignore-user-config`, `--ignore-rules`, and `--ephemeral`. Read-only tasks used a read-only sandbox; code tasks used separate workspace-write checkouts. These deliberately selected tasks show that cheaper profiles can complete bounded real work; they do **not** establish the success rate or savings across an unselected workload. The code fix is narrowly specified, and three repetitions per arm are too few for a general latency claim.

## Passing real repository task: Django secret-key rotation

After the failed pytest candidate below, we selected [`django__django-16631`](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified), another public SWE-bench Verified task rated **1–4 hours**. The bug logs users out when `SECRET_KEY` is rotated even though the previous key is in `SECRET_KEY_FALLBACKS`. Both agents started from Django commit [`9b224579875e30203d079cc2fee83b116d98eb78`](https://github.com/django/django/commit/9b224579875e30203d079cc2fee83b116d98eb78), received the [same issue prompt](benchmarks/swe-bench-verified-django-16631/prompt.txt), and had independent worktrees and matching Python 3.10 dependencies. Neither agent saw the benchmark's test patch or reference solution during its run.

The baseline was **clean Codex with `gpt-6-sol` at `high` effort**. It had an isolated `CODEX_HOME` containing only an authentication symlink, so the installed global router instructions could not enter its context. Jev separately chose **Sol high** for the routed worker; that Codex run used the same isolation and prompt. The router did not choose a cheaper model on this task.

| Measure | Clean Sol high | Jev route, including decision |
| --- | ---: | ---: |
| Official `FAIL_TO_PASS` test | **Passed** | **Passed** |
| Auth and session suite | 984 run; suite OK | 984 run; suite OK |
| Shell tool calls / file-change events | 25 / 7 | 41 / 3 |
| Codex input + output tokens | 898,994 | 581,761 |
| Jev input + output tokens | — | 727 |
| Total elapsed time | 241.180 s | 241.574 s |
| Illustrative Standard API price | $0.318095 | $0.246697 |

The official test **failed on the base checkout** and **passed with the dataset's reference patch**. It also passed with each generated production patch. Both agents edited the same test file that the official test patch touches. We saved their full patches first, restored only that test file to its base version, and then applied the official test patch; the generated production code stayed in place. The full auth and session suites passed afterward: 984 tests each, including 12 skips and one expected failure. This is a **local run of the official test and related suites, not the full SWE-bench Docker-harness grade**.

The routed run's calculated API price is **22.4% lower** in this pair, while elapsed time is **0.2% longer**. Both arms used the **same model and effort**; the large token and price difference is run-to-run variation and cache behavior, **not evidence that routing saved 22.4%**. The measured Jev decision itself added 1,331 ms, 656 input tokens, 71 output tokens, and about $0.000028 at TypeSafe's published input rate. The estimate uses [OpenAI's Standard short-context Sol rates](https://developers.openai.com/api/docs/models/gpt-6-sol) of $2 per million input tokens, $0.20 per million cached input tokens, and $10 per million output tokens, plus [TypeSafe's published Jev input rate](https://typesafe.ai/blog/introducing-system-one-models-and-jev) of $0.042 per million. It is **not an observed Codex subscription bill**; aggregate CLI usage cannot establish whether every request qualified for short-context pricing.

The [case files](benchmarks/swe-bench-verified-django-16631/) include the exact public issue, prompt, route decision, both generated patches, official test patch, path-sanitized Codex traces, test logs, environment, and [machine-readable results](benchmarks/swe-bench-verified-django-16631/results.json). To reproduce the verdict, check out the recorded Django base commit, install it on Python 3.10, apply an agent's production changes and `test.patch`, then run `python runtests.py auth_tests.test_basic.TestGetUser.test_get_user_fallback_secret --noinput` from `tests/`. The earlier failed pytest candidate is retained below to show the selection sequence. Two selected tasks and one run per arm cannot establish a general success rate or economic benefit.

## Earlier real repository candidate: pytest markers

On 2026-09-24, we ran the public [`pytest-dev__pytest-10356` instance](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified) from SWE-bench Verified. The dataset rates it a **1–4 hour** fix. The issue asks pytest to preserve markers from both parent classes under multiple inheritance. Both agents started from pytest commit [`3c1534944cbd34e8a41bc9e76818018fadefc9a1`](https://github.com/pytest-dev/pytest/commit/3c1534944cbd34e8a41bc9e76818018fadefc9a1), received the same [benchmark prompt](benchmarks/swe-bench-verified-pytest-10356/prompt.txt), could edit the repository and run tests, and used separate worktrees with matching dependencies. The benchmark's test patch and reference solution were not available to either agent during its run.

Jev selected **`gpt-6-sol` at `high` effort** for the routed worker task, the same profile as the baseline. This is a conservative decision for this task; there is no cheaper-model route to evaluate in this pair.

| Measure | Baseline Codex | Jev route, including decision |
| --- | ---: | ---: |
| Official `FAIL_TO_PASS` test | **Failed** | **Failed** |
| Codex tool calls | 23 shell commands, 2 file changes | 23 shell commands, 3 file changes |
| Codex input + output tokens | 388,090 | 460,781 |
| Jev input + output tokens | — | 713 |
| Total elapsed time | 171.514 s | 210.890 s |
| Illustrative Standard API price | $0.174644 | $0.205739 |

The routed run used **18.7% more Codex tokens**, took **23.0% longer**, and had a **17.8% higher illustrative API price**. Jev tokens are reported separately. Both Codex runs used the same model and effort, so the difference between their Codex token counts and durations is run-to-run variation, not an effect that can be assigned to Jev. The measured Jev decision itself added **885 ms**, **642 input tokens**, **71 output tokens**, and about **$0.000027** at TypeSafe's published input rate.

We applied the dataset's [test patch](benchmarks/swe-bench-verified-pytest-10356/test.patch) only after both agents finished. Its `testing/test_mark.py::test_mark_mro` test **failed on the original checkout**, **passed with the dataset's reference patch**, and **failed with both generated patches**. Both agents used a generator where this test expects a list. Both agents reported passing their own tests, which did not catch the API mismatch. This is a local run of the official `FAIL_TO_PASS` test, **not a full SWE-bench Docker-harness grade**. One paired task cannot estimate a general success rate, latency difference, or cost saving.

The API-price calculation applies [OpenAI's GPT-6 Sol Standard short-context rates](https://developers.openai.com/api/docs/models/gpt-6-sol) of $2 per million input tokens, $0.20 per million cached input tokens, and $10 per million output tokens. It adds [TypeSafe's published Jev rate](https://typesafe.ai/blog/introducing-system-one-models-and-jev) of $0.042 per million input tokens, with no output charge. Codex's reported input count includes cached input. This is **not an observed Codex subscription bill**. The CLI reports aggregate turn usage rather than every request's context size, so the short-context price is an explicit assumption.

### Clean Codex isolation

The user's installed routing instructions live in `~/.codex/AGENTS.md`. According to [OpenAI Docs on instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), `--ignore-user-config` does **not** by itself disable that file; it only ignores `config.toml` according to `codex exec --help`. For this experiment, both `codex exec` processes used a separate `CODEX_HOME` containing only an `auth.json` symlink, with no global `AGENTS.md` or config. The pytest worktrees had no project `AGENTS.md`. Both commands used `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, and a `workspace-write` sandbox. The routed arm added a Jev decision **outside** its Codex session; it received the selected model and effort explicitly. This isolates the comparison from the user's installed routing instructions.

The [case directory](benchmarks/swe-bench-verified-pytest-10356/) contains the exact public dataset input, identical prompt, both agent patches, the test patch, matching dependency versions, path-sanitized Codex event logs, and [machine-readable results](benchmarks/swe-bench-verified-pytest-10356/results.json). To reproduce the test verdict, check out the recorded pytest base commit, install its `testing` extra on Python 3.9, apply either agent patch and then `test.patch`, and run `python -m pytest testing/test_mark.py::test_mark_mro -q`. The event logs preserve usage and tool activity; only local temporary paths were replaced with placeholders.

## Earlier synthetic experiment (historical)

The earlier inline-evidence run below **did not isolate `CODEX_HOME`**. With the default Codex home, both arms loaded the user's global routing instructions despite `--ignore-user-config`. Its measured answers, tokens, and illustrative prices remain available as historical data, but the Sol-high arm must **not** be described as a clean Codex baseline or used to claim a 52% real-world saving. The real-repository experiment above corrects that isolation error and exercises editing, shell tools, and a benchmark test. The [synthetic runner](scripts/benchmark.mjs) now creates an isolated Codex home for future runs; the archived numbers were generated before that fix.

Measured on 2026-09-24 with `codex-cli 0.156.1`: 24 Codex runs and 12 hosted Jev decisions across four synthetic tasks. The [runner](scripts/benchmark.mjs) and [raw results](benchmarks/results-2026-09-24.json) are public. The baseline uses `gpt-6-sol` at `high` effort. The routed arm uses Jev to choose a Codex model and effort before each run.

### Correction to the first experiment

Our first file-based experiment had two Luna-low responses saying the files were unavailable. It did not establish whether the tool was unavailable to the session or the model failed to use it. Those runs cannot support a model-quality comparison. We [preserve the original data](benchmarks/diagnostic-2026-09-24-file-access.json) as a diagnostic record, but withdraw its accuracy, speed, and savings claims. Four later Luna-low repetitions in the same CLI mode successfully read a fixture through shell commands; this confirms that the first result was not stable enough to attribute to the model.

The controlled experiment below puts the same labeled file excerpts directly in each task prompt. It asks both models to answer without tools and records their tool-call count. This isolates model selection and Jev overhead from file-tool access. It does **not** test actual file search or a full agent workflow.

### Test data

These four examples were written for this benchmark in [the runner](scripts/benchmark.mjs). They are synthetic: no user repository, production log, or external evaluation dataset was used. The full text sent to Codex is also recorded as `evidence` in the [raw results](benchmarks/results-2026-09-24.json). Jev received each task's short summary; both Codex arms received the same prompt and evidence.

| Task | Evidence supplied to Codex | Expected answer |
| --- | --- | --- |
| Function lookup | A short `src/billing.mjs` excerpt with `calculateTotal` defined on line 6 | `src/billing.mjs:6` |
| Config extraction | Three JSON excerpts: server port `8123`, cache timeout `4500` ms, retry limit `4` | `port=8123 timeout_ms=4500 retry_limit=4` |
| Contract check | A rule requiring discount before tax and an implementation that subtracts discount after tax | `FAIL` |
| Cross-file diagnosis | Gateway key `a-17`, worker key `A-17`, two accepted charges, and a note that provider keys are case-sensitive | `KEY_MISMATCH` |

### Recorded results

Each task ran three times per arm. All **24 answers were correct**, and none of the runs called a tool. Token medians below count **Codex only**; Jev tokens are separate. Routed elapsed time includes the Jev decision.

| Task | Jev route | Correct, baseline / routed | Median tokens, baseline / routed | Median elapsed, baseline / routed |
| --- | --- | ---: | ---: | ---: |
| Locate a function in a labeled source excerpt | Luna low | 3/3 / 3/3 | 15,860 / 15,681 | 8.37 / 7.16 s |
| Extract settings from three labeled JSON excerpts | Luna medium | 3/3 / 3/3 | 15,865 / 15,686 | 6.25 / 6.98 s |
| Check code against a contract excerpt | Sol low | 3/3 / 3/3 | 15,885 / 15,885 | 6.29 / 6.99 s |
| Diagnose conflicting identifiers across code and log excerpts | Sol high | 3/3 / 3/3 | 15,903 / 15,901 | 5.00 / 6.27 s |

Across all 12 paired tasks, the Sol-high baseline used **190,774 Codex tokens** and **82.49 seconds**. Routing used **189,775 Codex tokens** and **85.71 seconds**, with **8,373 Jev tokens reported separately**. That is **999 fewer Codex tokens (−0.5%)** and **3.21 more seconds (+3.9%)**. Jev took 0.78–2.07 seconds per decision. The routed lookup was faster, while the other three task types were slower after including the decision.

### Estimated API cost

The table applies published **Standard, short-context API prices** to the measured token counts. Each task row totals **three runs per arm**; the last row totals all 12 runs. The routed amounts include Jev. Positive percentages mean the routed arm's calculated price was lower; a negative percentage means it was higher.

| Task | Sol-high baseline | Jev route, including decision | Estimated saving |
| --- | ---: | ---: | ---: |
| Function lookup, Luna low | $0.03218 | $0.00257 | 92.0% |
| Config extraction, Luna medium | $0.04906 | $0.00295 | 94.0% |
| Contract check, Sol low | $0.04633 | $0.04917 | **−6.1%** |
| Cross-file diagnosis, Sol high | $0.02534 | $0.01860 | 26.6%* |
| **All 12 tasks** | **$0.15291** | **$0.07329** | **52.1%** |

\* Both diagnosis arms used **Sol high**. Their price difference reflects variation in token usage and cache hits, **not a cheaper model selected by Jev**. The Sol-low contract row also uses the same Sol token prices as its baseline. These small samples cannot isolate the effect of reasoning effort from run-to-run variation.

The calculation uses [OpenAI's published rates](https://developers.openai.com/api/docs/pricing) per million tokens: Sol input **$2**, cached input **$0.20**, output **$10**; Luna input **$0.10**, cached input **$0.01**, output **$0.50**. [TypeSafe publishes](https://typesafe.ai/blog/introducing-system-one-models-and-jev) Jev input at **$0.042 per million tokens** and output at no charge. For each Codex run, the estimate is `(input_tokens − cached_input_tokens) × input rate + cached_input_tokens × cached rate + output_tokens × output rate`, divided by one million; routed runs add `Jev input_tokens × $0.042 / 1,000,000`. All measured cache-write counts were zero. The percentage is `(baseline − routed) / baseline × 100`.

This is an **illustrative API-price estimate**, not a measured Codex subscription charge or production forecast. Cache hits varied between runs. The calculated price is about 52% lower mainly because six tasks used Luna's lower per-token rate; the routed arm took more time.

### Reproduction

The runner defines the synthetic source, config, contract, and log excerpts and exact-answer graders. For each task and repetition, it calls the real `routeSubagent` path using the configured decision backend, captures Jev's `usage`, and runs independent `codex exec --json` sessions for the Sol-high baseline and routed profile. Run order alternates. **Current** Codex sessions use `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, an isolated `CODEX_HOME`, and a read-only sandbox. The temporary home contains only a symlink to the active profile's `auth.json` when present. The JSON records the answer, tool-call count, `turn.completed.usage`, and wall-clock duration. It contains no credentials or private project data. The historical results above predate this isolation fix.

```sh
npm ci
node scripts/benchmark.mjs --repetitions 3 --output /tmp/codex-router-benchmark.json
```

A working Codex CLI login and hosted Jev configuration are needed to reproduce these numbers. Other decision backends can run through the same script, but their response may omit token usage. Codex's `input_tokens` already includes the `cached_input_tokens` subset; output tokens can include non-visible reasoning, as explained in the [OpenAI token-counting documentation](https://developers.openai.com/api/docs/guides/token-counting).

### Interpretation and limits

This historical sample does **not** show a token or end-to-end latency saving. Its lower illustrative API cost at equal accuracy is specific to these inlined-evidence tasks and an unisolated Codex home; it is not a clean comparison or a production saving. A useful general claim would require a larger, preregistered mix of real subagent tasks, including edits, web and file tools, retries, answer grading, and the parent agent's work. Three repetitions per task cannot establish a reliable quality difference.

The skeptic's broader point remains open: choosing a model before a subagent starts does not improve task understanding, tool descriptions, intermediate state, arguments, step dependencies, or error recovery inside that subagent. This project measures model selection, not Jev's ability to choose between tools. The controlled run does not support a general claim of “faster agent decisions.”
