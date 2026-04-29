---
name: debugging-report
description: Use when a bug, test failure, runtime error, or behavior mismatch needs diagnosis by comparing the intended goal against observed behavior, errors, logs, and reproduction evidence before fixing.
---

# Debugging Report

## Overview

Produce an evidence-based debugging report before proposing fixes. Verify the intended goal, reproduce the failure when possible, compare expected and observed behavior, separate facts from hypotheses, and explain what is happening and why.

Read [references/report-template.md](references/report-template.md) before writing the final report.

## Workflow

1. State the intended goal in one or two sentences.
2. Capture the exact observed behavior.
3. Capture the exact failure evidence: test output, stack trace, logs, screenshots, inputs, environment, and reproduction command.
4. Check whether the evidence actually contradicts the intended goal, or whether the goal, test, or expectation is wrong.
5. Trace the failure boundary-by-boundary until you can name the first confirmed point where reality diverges from expectation.
6. Separate confirmed facts from plausible hypotheses.
7. Recommend next investigations or minimal fix directions only when supported by the evidence.

## Investigation Rules

- Do not start with fixes. Start with verification.
- Quote exact errors, commands, and observed outputs when they matter.
- Distinguish these labels clearly:
  - `Confirmed`
  - `Likely`
  - `Unknown`
- If reproduction is not possible, say that and explain what evidence you used instead.
- If the test appears to encode the wrong expectation, say so explicitly.
- If multiple components are involved, identify which layer is failing and which layers have been ruled out.
- If confidence is low, say what missing evidence would raise it.

## What To Compare

- Intended goal vs actual test assertion
- Intended goal vs runtime behavior
- Error text vs current hypothesis
- Passing path vs failing path
- Similar working implementation vs broken implementation
- Input shape vs consumed shape
- Build-time state vs runtime state
- Local environment vs CI or alternate environment

## Report Requirements

The report must answer all of these:

- What was expected?
- What actually happened?
- What evidence proves that?
- Where does behavior first diverge from expectation?
- What is the most likely explanation?
- How confident are you?
- What should be checked next?

Use the structure in `references/report-template.md`. Keep the report concise, but do not omit uncertainty or missing evidence.

## Recommended Output Style

- Prefer short sections over long prose.
- Include exact file paths, commands, test names, and error excerpts when available.
- Use one `Summary` section for the highest-signal conclusion.
- Use one `Evidence` section for hard facts.
- Use one `Analysis` section for the reasoning from facts to conclusions.
- Use one `Next Steps` section for follow-up investigation or fix directions.

## Common Failure Patterns

- Goal/test mismatch: the system behaves consistently, but the assertion encodes the wrong contract.
- Symptom-only reasoning: the visible error is downstream of the real failure.
- Environment mismatch: the repro depends on cwd, config, dependency state, secrets, or platform.
- Partial reproduction: a command succeeds, but not under the same inputs, directory, or build artifact as the failing case.
- False certainty: the likely cause is presented as proven without sufficient evidence.
