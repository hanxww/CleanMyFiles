# Contributing

Thanks for helping improve CleanMyFiles.

## Before opening a pull request

- Keep cleanup behavior review-first and non-destructive by default.
- Do not introduce telemetry or remote file processing without a separate design discussion.
- Avoid platform-specific behavior unless there is a fallback or the limitation is documented.
- Prefer small, testable changes over large mixed refactors.

## Local setup

```bash
npm install
npm run tauri dev
```

A browser-only UI preview is available with `npm run dev`.

## Rust changes

Scanner changes should preserve these invariants:

- symbolic links are not followed;
- unreadable files are skipped rather than aborting the whole scan;
- duplicate groups require an exact content hash match;
- deletion goes through the operating system Trash / Recycle Bin.

## Pull requests

Include:

- what changed;
- why it changed;
- how you tested it;
- platform-specific notes when relevant.

Large features are easier to review when split into an engine change and a UI change where practical.
