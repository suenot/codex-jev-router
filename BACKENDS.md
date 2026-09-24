# Alternative decision backends

The decider classifies a short, sanitized subagent task. The chosen subagent still runs only a model available in Codex. Set `CODEX_ROUTER_DECIDER` in the environment inherited by Codex, start the upstream server or install its runtime, and run `npm run doctor -- --live`. Keep the existing `jev` setting if you have not validated an alternative on your own tasks. A live doctor check proves protocol compatibility, not routing accuracy or savings.

The HTTP presets use loopback by default. `CODEX_ROUTER_DECIDER_URL` overrides their address. `CODEX_ROUTER_DECIDER_API_KEY` adds a bearer token. `CODEX_ROUTER_DECIDER_MODEL` supplies a model ID only to Jev-shaped HTTP servers. `CODEX_ROUTER_DECIDER_TIMEOUT_MS` accepts 1,000–600,000 ms; default is 15 seconds for HTTP and 120 seconds for library/CLI bridges. A failed, malformed, or timed-out decision falls back to Sol high. The native adapters convert the selected option probability into Jev's `confidence`; this is a mathematical conversion, **not** calibration. The router's thresholds were tuned for hosted Jev.

| Project | Selector | Upstream interface | What this repository does |
| --- | --- | --- | --- |
| [TheoLeeCJ/SemIf-OpenJev](https://github.com/TheoLeeCJ/SemIf-OpenJev) (formerly Semif) | `semif` | `semif-score` JSONL CLI | Writes two question rows to a mode-0600 temporary file, runs direct scoring, converts output probabilities, deletes files. Requires `CODEX_ROUTER_SEMIF_MODEL` and `CODEX_ROUTER_SEMIF_REVISION`. Optional `CODEX_ROUTER_SEMIF_COMMAND`, `CODEX_ROUTER_SEMIF_BACKEND`, `CODEX_ROUTER_SEMIF_DEVICE`, `CODEX_ROUTER_SEMIF_GGUF`. |
| [TianyuCodings/NanoJev](https://github.com/TianyuCodings/NanoJev) | `nanojev` | `POST /api/evaluate` | Converts `noul` to `boolean` and its `p_true` distribution back. Default `127.0.0.1:8765`. Requires an upstream checkpoint. |
| [vinnylarouge/jevlike](https://github.com/vinnylarouge/jevlike) | `jevlike` | Python checkpoint API / `jevlike-predict` | Loads a checkpoint, scores both questions, returns typed probabilities. Requires `CODEX_ROUTER_JEVLIKE_CHECKPOINT`; optional `CODEX_ROUTER_JEVLIKE_DEVICE`, `CODEX_ROUTER_PYTHON`. Its default byte-level input limits are short; validate truncation and train on relevant tasks. |
| [featherless-ai/simple-jev](https://github.com/featherless-ai/simple-jev) | `simple-jev` | `POST /v1/classifier` | Sends the Jev-shaped request, default model `Qwen/Qwen3.5-0.8B`, default `127.0.0.1:8000`. Set `CODEX_ROUTER_DECIDER_MODEL` if the served ID differs. Use the self-hosted server to keep summaries local. |
| [nokia-applied-research/AnyJev](https://github.com/nokia-applied-research/AnyJev) | `anyjev` | Python `Decider` and `HFBackend` | Loads the configured HF model, converts choice and noul decisions. Requires `CODEX_ROUTER_ANYJEV_MODEL`; optional `CODEX_ROUTER_ANYJEV_DEVICE`, `CODEX_ROUTER_ANYJEV_DTYPE`, `CODEX_ROUTER_PYTHON`. |
| [r-ms/mini-jev](https://github.com/r-ms/mini-jev) | `mini-jev` | Demo `POST /run` | Sends a flat JSON schema with two fields, reads the `split` arm probabilities. Default `127.0.0.1:8765`. This is an experimental benchmark endpoint that also runs a JSON generation arm, so expect substantial latency and compute. |
| [nico-martin/open-jev](https://github.com/nico-martin/open-jev) | `open-jev-nico` | TypeScript `OpenJev.load().decide()` | Loads the local model through `open-jev` and converts its `probability` field for noul. Install optional `open-jev` and `@huggingface/transformers` packages. Optional `CODEX_ROUTER_OPENJEV_MODEL` (default `kev-0.6b`), `CODEX_ROUTER_OPENJEV_DEVICE`, `CODEX_ROUTER_OPENJEV_DTYPE`. |
| [zeredy879/minojev](https://github.com/zeredy879/minojev) | `minojev` | `POST /score` | Converts `noul` to `boolean` and its `records` into typed answers. Default `127.0.0.1:8000`. Requires a trained checkpoint. |
| [Zefan-Cai/Open-Jev](https://github.com/Zefan-Cai/Open-Jev) | `open-jev-zefan` | `POST /v1/systemone` | Uses the local server directly. Default `127.0.0.1:8791`; follow its Docker/CPU startup instructions. |
| [daseinlabs/open-jev](https://github.com/daseinlabs/open-jev) | `open-jev-dasein` | `POST /v1/systemone` | Uses the local server directly. Default `127.0.0.1:8000`; use `CODEX_ROUTER_DECIDER_API_KEY` if its server key is enabled. |

Example for a running NanoJev server:

```sh
export CODEX_ROUTER_DECIDER=nanojev
npm run doctor -- --live
```

Example for the SemIf CLI installed in a Python environment:

```sh
export CODEX_ROUTER_DECIDER=semif
export CODEX_ROUTER_SEMIF_COMMAND=/absolute/path/to/semif-score
export CODEX_ROUTER_SEMIF_MODEL=Qwen/Qwen3.5-4B
export CODEX_ROUTER_SEMIF_REVISION=851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a
export CODEX_ROUTER_SEMIF_BACKEND=mlx   # Apple Silicon; omit for the upstream Torch default
export CODEX_ROUTER_DECIDER_TIMEOUT_MS=300000
npm run doctor -- --live
```

Example for a Python bridge installed in a virtual environment:

```sh
export CODEX_ROUTER_DECIDER=anyjev
export CODEX_ROUTER_PYTHON=/absolute/path/to/venv/bin/python
export CODEX_ROUTER_ANYJEV_MODEL=Qwen/Qwen3-8B
export CODEX_ROUTER_ANYJEV_DEVICE=mps   # Or cuda/cpu as supported by the model runtime
npm run doctor -- --live
```

These bridges are one-shot: each decision loads the upstream model again. They provide a concrete integration path but may be much slower than a persistent server. Upstream model packages and checkpoints are intentionally optional; this repository does not install or bundle them. We verified request/response translation with local fixture servers and bridge mocks. We have **not** run all ten real checkpoints or measured their routing accuracy, latency, or cost in this repository.
