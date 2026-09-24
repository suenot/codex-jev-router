# Routing benchmark: 24 Codex runs, 12 Jev decisions

Measured on 2026-09-24 with `codex-cli 0.156.1`, this is an exploratory benchmark of **subagent model selection**, not a benchmark of Jev choosing tools inside an agent. The baseline uses `gpt-6-sol` at `high` effort for every task. The routed arm asks hosted Jev to select a Codex model and effort before each run. The [raw results](benchmarks/results-2026-09-24.json) and [runner](scripts/benchmark.mjs) are public and reproducible.

## Results

Each task was run three times per arm against the same read-only fixture. The table reports correct answers and medians. Routed tokens include both Codex and Jev input/output tokens; routed time includes the Jev decision. A wrong answer is never counted as a saving.

| Task | Jev route | Correct, baseline / routed | Median tokens, baseline / routed | Median elapsed, baseline / routed |
| --- | --- | ---: | ---: | ---: |
| Exact function lookup | Luna low | 3/3 / **1/3** | 32,051 / 16,380* | 10.1 / 6.2 s* |
| Three-file config extraction | Luna medium | 3/3 / 3/3 | 32,317 / 32,411 | 15.1 / 11.5 s |
| One contract check | Sol low | 3/3 / 3/3 | 32,167 / 32,580 | 9.7 / 10.9 s |
| Cross-file diagnosis | Sol high | 3/3 / 3/3 | 32,439 / 32,909 | 13.1 / 15.4 s |

\* Two Luna-low runs answered that they could not inspect the files. They used about half as many tokens because they did not complete the task. The single correct routed lookup used **32,230** tokens including Jev, compared with the baseline median of **32,051**. Its end-to-end time was **16.1 seconds**, compared with the baseline median of **10.1 seconds**. The benchmark does not establish why those two runs did not inspect the fixture: it records the final answers, not tool availability in the model's context.

Across all 12 tasks, Sol high answered **12/12** correctly and routing answered **10/12** correctly. The raw aggregate token count is lower for routing, but it is confounded by the two failed lookups and one unusually long Sol run. On the three task types with 3/3 routed accuracy, the per-task median total token count was **higher** after adding Jev's usage. This experiment does **not** demonstrate net token savings or a general improvement in agent quality.

The useful result is narrower: for the three-file extraction, Luna medium retained 3/3 correctness and cut median end-to-end latency by **24%**. Jev took **0.8 to 1.4 seconds** per decision in these runs. Using the published [OpenAI standard API rates](https://developers.openai.com/api/docs/pricing) for Sol and Luna and TypeSafe's [Jev input rate](https://typesafe.ai/) of $42 per billion tokens, the **illustrative API price** of this task averaged about **$0.0223** with Sol high and **$0.00133** with routed Luna medium, including cached-input rates and Jev input. That is about **94% less** under those rates. It is **not** a measured Codex subscription charge, and the sample is too small to predict production costs.

## Method

The runner creates a temporary repository with a function lookup, three configuration files, a contract comparison, and a diagnosis that requires comparing gateway code, worker code, and logs. Its fixtures and exact-answer graders are defined in the runner. For each task and repetition, it calls the real `routeSubagent` path using the configured Jev backend, captures the provider's `usage`, and runs two independent `codex exec --json` sessions against the fixture: the Sol-high baseline and the routed profile. The order alternates. Codex sessions use `--ephemeral`, `--ignore-user-config`, and a read-only sandbox. Each run records the `turn.completed.usage` counters, final answer, and wall-clock duration. The raw JSON contains no credentials or private project content.

Run it with a working Codex CLI login and a configured Jev backend:

```sh
npm ci
node scripts/benchmark.mjs --repetitions 3 --output /tmp/codex-router-benchmark.json
```

The `input_tokens` counter includes `cached_input_tokens`; the latter is a subset, not an additional count. Output tokens include model reasoning and other non-visible tokens according to the [OpenAI token-counting documentation](https://developers.openai.com/api/docs/guides/token-counting). The fixture is intentionally small and synthetic, while the Codex run includes the local harness and instructions. Cache hits and tool behavior varied between runs. The result does not evaluate edits, web research, parent-agent detection of bad answers, retries, or other decision backends such as Laya and Kev.

## What the skeptical argument gets right

This router selects a **model for a whole subagent task**. It does not improve task interpretation, tool descriptions, intermediate state, tool arguments, dependency ordering, or recovery after a failed tool call. This benchmark gives no evidence for a broad claim of "faster agent decisions." It shows one bounded workload where selecting Luna medium can lower an estimated model bill and latency, and one simple workload where selecting Luna low harmed reliability. For this configuration, keep Sol high as the safe default and treat Luna-low file searches as unproven until a larger evaluation or an explicit validation-and-retry path exists.
