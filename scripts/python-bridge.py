"""Optional one-shot bridges for AnyJev and jevlike installed in this Python environment."""

import json
import os
import sys


def choices(question):
    return list(question["criteria"]) if question["type"] == "choice" else ["false", "true"]


def context(state, question):
    rendered = state if isinstance(state, str) else json.dumps(state, ensure_ascii=False)
    criteria = "; ".join(f"{key}: {value}" for key, value in question.get("criteria", {}).items())
    return f"{rendered}\n{question['instructions']}\n{criteria}"


def answer(question, probabilities):
    options = choices(question)
    if set(probabilities) != set(options) or len(probabilities) != len(options):
        raise ValueError("Decision backend returned different candidates")
    if any(not isinstance(probabilities[key], (float, int)) or not 0 <= probabilities[key] <= 1 for key in options):
        raise ValueError("Decision backend returned invalid probabilities")
    if abs(sum(probabilities.values()) - 1) > 0.01:
        raise ValueError("Decision backend probabilities do not sum to one")
    if question["type"] == "noul":
        return {"type": "noul", "noul": probabilities["true"]}
    selected = max(options, key=probabilities.get)
    return {"type": "choice", "choice": selected, "confidence": probabilities[selected], "probabilities": probabilities}


def anyjev(input_data):
    from anyjev import Decider, Question
    from anyjev.backends.hf import HFBackend

    backend = HFBackend(os.environ["CODEX_ROUTER_ANYJEV_MODEL"],
                        device=os.environ.get("CODEX_ROUTER_ANYJEV_DEVICE", "cpu"),
                        dtype=os.environ.get("CODEX_ROUTER_ANYJEV_DTYPE", "float32"))
    specs = []
    for key, question in input_data["questions"].items():
        criteria = "; ".join(f"{name}: {description}" for name, description in question.get("criteria", {}).items())
        prompt = f"{question['instructions']} {criteria}"
        specs.append(Question.choice(prompt, choices(question), name=key) if question["type"] == "choice"
                     else Question.noul(prompt, name=key))
    decisions = Decider(backend).decide(input_data["state"], specs)
    answers = {}
    for key, question in input_data["questions"].items():
        decision = decisions[key]
        probabilities = decision.distribution if question["type"] == "choice" else {
            "false": 1 - decision.p_true, "true": decision.p_true}
        answers[key] = answer(question, probabilities)
    return {"answers": answers}


def jevlike(input_data):
    import torch
    from jevlike.data import ChoiceExample
    from jevlike.model import load_checkpoint, select_device
    from jevlike.train import move

    device = select_device(os.environ.get("CODEX_ROUTER_JEVLIKE_DEVICE", "auto"))
    model, collator, _ = load_checkpoint(os.environ["CODEX_ROUTER_JEVLIKE_CHECKPOINT"], device)
    model.eval()
    answers = {}
    with torch.no_grad():
        for key, question in input_data["questions"].items():
            options = choices(question)
            batch = move(collator([ChoiceExample(context(input_data["state"], question), tuple(options), 0)]), device)
            values = model(batch).softmax(-1)[0, :len(options)].cpu().tolist()
            answers[key] = answer(question, dict(zip(options, values)))
    return {"answers": answers}


def main():
    input_data = json.load(sys.stdin)
    result = anyjev(input_data) if sys.argv[1] == "anyjev" else jevlike(input_data)
    json.dump(result, sys.stdout, allow_nan=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
