# Controlled Codex subagent routing benchmark

Measured on 2026-09-24 with `codex-cli 0.156.1`: 24 Codex runs and 12 hosted Jev decisions across four synthetic tasks. The [runner](scripts/benchmark.mjs) and [raw results](benchmarks/results-2026-09-24.json) are public. The baseline uses `gpt-6-sol` at `high` effort. The routed arm uses Jev to choose a Codex model and effort before each run.

## Correction to the first experiment

Our first file-based experiment had two Luna-low responses saying the files were unavailable. It did not establish whether the tool was unavailable to the session or the model failed to use it. Those runs cannot support a model-quality comparison. We [preserve the original data](benchmarks/diagnostic-2026-09-24-file-access.json) as a diagnostic record, but withdraw its accuracy, speed, and savings claims. Four later Luna-low repetitions in the same CLI mode successfully read a fixture through shell commands; this confirms that the first result was not stable enough to attribute to the model.

The controlled experiment below puts the same labeled file excerpts directly in each task prompt. It asks both models to answer without tools and records their tool-call count. This isolates model selection and Jev overhead from file-tool access. It does **not** test actual file search or a full agent workflow.

## Test data

These four examples were written for this benchmark in [the runner](scripts/benchmark.mjs). They are synthetic: no user repository, production log, or external evaluation dataset was used. The full text sent to Codex is also recorded as `evidence` in the [raw results](benchmarks/results-2026-09-24.json). Jev received each task's short summary; both Codex arms received the same prompt and evidence.

| Task | Evidence supplied to Codex | Expected answer |
| --- | --- | --- |
| Function lookup | A short `src/billing.mjs` excerpt with `calculateTotal` defined on line 6 | `src/billing.mjs:6` |
| Config extraction | Three JSON excerpts: server port `8123`, cache timeout `4500` ms, retry limit `4` | `port=8123 timeout_ms=4500 retry_limit=4` |
| Contract check | A rule requiring discount before tax and an implementation that subtracts discount after tax | `FAIL` |
| Cross-file diagnosis | Gateway key `a-17`, worker key `A-17`, two accepted charges, and a note that provider keys are case-sensitive | `KEY_MISMATCH` |

## Controlled results

Each task ran three times per arm. All **24 answers were correct**, and none of the runs called a tool. Medians include both Codex and Jev tokens and elapsed time for the routed arm.

| Task | Jev route | Correct, baseline / routed | Median tokens, baseline / routed | Median elapsed, baseline / routed |
| --- | --- | ---: | ---: | ---: |
| Locate a function in a labeled source excerpt | Luna low | 3/3 / 3/3 | 15,860 / 16,382 | 8.37 / 7.16 s |
| Extract settings from three labeled JSON excerpts | Luna medium | 3/3 / 3/3 | 15,865 / 16,384 | 6.25 / 6.98 s |
| Check code against a contract excerpt | Sol low | 3/3 / 3/3 | 15,885 / 16,582 | 6.29 / 6.99 s |
| Diagnose conflicting identifiers across code and log excerpts | Sol high | 3/3 / 3/3 | 15,903 / 16,596 | 5.00 / 6.27 s |

Across all 12 paired tasks, the Sol-high baseline used **190,774 tokens** and **82.49 seconds**. Routing used **189,775 Codex tokens** plus **8,373 Jev tokens**, or **198,148 total tokens** and **85.71 seconds**. That is **7,374 more tokens (+3.9%)** and **3.21 more seconds (+3.9%)**. Jev took 0.78–2.07 seconds per decision. The routed lookup was faster, while the other three task types were slower after including the decision.

## Estimated API cost

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

This is an **illustrative API-price estimate**, not a measured Codex subscription charge or production forecast. Cache hits varied between runs. The observed total is about 52% lower mainly because six tasks used Luna's lower per-token rate, despite the routed arm using more total tokens and time.

## Reproduction

The runner defines the synthetic source, config, contract, and log excerpts and exact-answer graders. For each task and repetition, it calls the real `routeSubagent` path using the configured decision backend, captures Jev's `usage`, and runs independent `codex exec --json` sessions for the Sol-high baseline and routed profile. Run order alternates. Codex sessions use `--ephemeral`, `--ignore-user-config`, and a read-only sandbox. The JSON records the answer, tool-call count, `turn.completed.usage`, and wall-clock duration. It contains no credentials or private project data.

```sh
npm ci
node scripts/benchmark.mjs --repetitions 3 --output /tmp/codex-router-benchmark.json
```

A working Codex CLI login and hosted Jev configuration are needed to reproduce these numbers. Other decision backends can run through the same script, but their response may omit token usage. Codex's `input_tokens` already includes the `cached_input_tokens` subset; output tokens can include non-visible reasoning, as explained in the [OpenAI token-counting documentation](https://developers.openai.com/api/docs/guides/token-counting).

## Interpretation and limits

This benchmark does **not** show a token or end-to-end latency saving from routing on these tasks. It does show lower illustrative API cost at equal accuracy for this small inlined-evidence sample. A more useful claim would require a larger, preregistered mix of real subagent tasks, including edits, web and file tools, retries, answer grading, and the parent agent's work. Three repetitions per task cannot establish a reliable quality difference.

The skeptic's broader point remains open: choosing a model before a subagent starts does not improve task understanding, tool descriptions, intermediate state, arguments, step dependencies, or error recovery inside that subagent. This project measures model selection, not Jev's ability to choose between tools. The controlled run does not support a general claim of “faster agent decisions.”
