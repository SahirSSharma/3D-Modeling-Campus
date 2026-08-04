# RUNNING ON CURSOR — read this before anything above

You are a SINGLE agent. PROMPT.md above is addressed to a multi-agent runner with
sub-agent teams; you have no fan-out. Ignore every instruction to spawn agents or
to parallelise. The sharding is already done for you — an outer driver is feeding
you one geographic shard at a time, and this invocation owns exactly one shard.

## Your scope this invocation — pass @@PASS@@

@@SCOPE@@

Work ONLY inside those bounds. An entity whose centroid falls outside this shard
is another invocation's job; note it and move on.

## Hard prohibitions

1. **Do not push. Do not deploy. Do not touch GitHub Pages.** PROMPT.md's
   Definition of Done ends at "confirmed live" — that last step is Sahir's call
   and is NOT yours. A pre-push hook is armed and will reject you anyway. Do not
   try to work around it, disable it, or delete `gauntlet-loop/.no-push`.
   Committing locally is fine. Publishing is not.
2. **Do not loosen a gate to make a fix pass.** Stated in PROMPT.md, repeated
   here because it is the single most likely way this run produces damage.
3. **Better absent than wrong.** If no source resolves an entity to gate
   tolerance, leave it unbuilt and write down why.
4. **Do not edit files outside this repo.**

## What you must produce

Append your findings to `gauntlet-loop/runs/@@STAMP@@/FINDINGS.md` — create it if
absent. For every entity you touched, one row: what was wrong, which source
resolved it, the measured correction, the logged `fitError_m` / `fitCoverage`
where applicable, and the test that now pins it. For every entity you could NOT
resolve, one row saying so and why.

A pass that found nothing must say so explicitly rather than writing nothing —
a silent pass is indistinguishable from a pass that never ran.

## Verification is not optional

Run the suite before you finish and paste the real result, including a failure:

```bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
npm test
```

Never report a fix as done without it, and never paste output you did not
actually produce. If you could not run it, say that instead — clearly labelled
unverified.

Your final message is read by another agent, not by a human. Report outcomes and
numbers, not narration.
