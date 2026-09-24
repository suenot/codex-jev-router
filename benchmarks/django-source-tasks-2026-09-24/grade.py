"""Check recorded answers and optionally verify ground truth against Django source."""

import argparse
import json
import re
from pathlib import Path


HERE = Path(__file__).resolve().parent


def source_line(checkout, path, number):
    return (checkout / path).read_text().splitlines()[number - 1].strip()


def verify_source(checkout, expected):
    exact = expected["exact-symbol"]
    assert source_line(checkout, exact["path"], exact["line"]) == exact["source"]
    bounded = expected["bounded-config"]
    for key, item in bounded["settings"].items():
        assert source_line(checkout, bounded["settings_path"], item["line"]) == f"{key} = {item['value']}"
    assert bounded["signature"] in source_line(
        checkout, bounded["signature_path"], bounded["signature_line"]
    )
    cycle = expected["cycle-key-claim"]
    assert source_line(checkout, cycle["path"], cycle["start_line"]) == cycle["source"]
    body = "\n".join(
        (checkout / cycle["path"]).read_text().splitlines()[
            cycle["start_line"] - 1 : cycle["end_line"]
        ]
    )
    assert all(text in body for text in ("data = self._session", "self.create()", "self._session_cache = data", "self.delete(key)"))


def correct(run, expected):
    answer = run["answer"]
    task = run["task"]
    if run["tool_calls"] < 1 or run["exit_code"] != 0:
        return False
    if task == "exact-symbol":
        item = expected[task]
        return f"{item['path']}:{item['line']}" in answer
    if task == "bounded-config":
        item = expected[task]
        for key, setting in item["settings"].items():
            if key not in answer or setting["value"] not in answer:
                return False
            if f"{item['settings_path']}:{setting['line']}" not in answer:
                return False
        return item["signature"] in answer and f"{item['signature_path']}:{item['signature_line']}" in answer
    if task == "cycle-key-claim":
        item = expected[task]
        return (
            bool(re.search(r"\bTrue\b", answer, re.I))
            and f"{item['path']}:{item['start_line']}" in answer
            and str(item["end_line"]) in answer
            and any(word in answer.lower() for word in ("preserv", "retain", "keep", "restor"))
        )
    raise ValueError(f"Unknown task: {task}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, help="Django checkout at the recorded base commit")
    args = parser.parse_args()
    expected = json.loads((HERE / "ground-truth.json").read_text())
    if args.source:
        assert (args.source / ".git").exists() or (args.source / ".git").is_file()
        verify_source(args.source, expected)
    runs = json.loads((HERE / "results.json").read_text())["runs"]
    assert len(runs) == 18
    failures = [f"{run['task']} repetition {run['repetition']} {run['arm']}" for run in runs if not correct(run, expected)]
    print(f"Correct with file-tool use: {len(runs) - len(failures)}/{len(runs)}")
    if failures:
        raise SystemExit("Failed: " + ", ".join(failures))


if __name__ == "__main__":
    main()
