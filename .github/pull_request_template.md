<!-- Thanks for contributing! Keep it short — the checklist is the important part. -->

## What this changes

<!-- One or two sentences. Link the issue it closes: "Closes #123". -->

## Why

<!-- The reason, not the diff. What was wrong, or what this makes possible. -->

## How it was tested

<!-- Which suites / manual steps. Screenshots or a clip for visual changes. -->

## Checklist

- [ ] `npm run build` is clean
- [ ] `npm run smoke` reports **0 errors**
- [ ] `node --experimental-vm-modules scripts/drive.cjs` is green (168 steps)
- [ ] The matching `tests/*.py` suite(s) are green (serve `build/` on :4180 first)
- [ ] No new network calls, trackers or remote scripts
- [ ] Boots with storage blocked (private window) — the sandboxed-frame path still works
- [ ] Apache-2.0 header on new source files; borrowed code attributed in `NOTICE`
- [ ] Docs updated if behaviour, an app or a build step changed
