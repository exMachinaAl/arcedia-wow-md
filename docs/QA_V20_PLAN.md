# QA v2.0 — flags

AUTO WAJIB: node --experimental-sqlite scripts/qa-runner.mjs; expected 261/261 and OFFLINE GATE PASS. Stage installer upgrade and rollback separately. 

LIVE WAJIB: `.world event` → `.world quest` → `.wow wallet` verifies daily V increase and second claim rejected.

LIVE OPSIONAL: `.stats card` renders readable PNG in direct chat. `.smart on` + `.mine` + `.smart recommend` + `.smart off` works and feedback updates suggestions. Group `.stats card` should be rejected.

PREVIOUS LIVE: V Shop was user-reported PASS on v1.9; don't silently carry PASS into v2.0 report.

LIMITATIONS: image text font is a compact bitmap; usernames with non-ASCII glyphs display as stripped title on PNG only. Online learner is an opt-in beta, not trained deep ML. Game RNG independent.
