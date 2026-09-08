# CleanMyFiles

**Understand your disk before deleting anything.**

CleanMyFiles is a local-first desktop disk analyzer for Windows, macOS and Linux. It explains where storage went, verifies exact duplicates, surfaces large and forgotten files, and lets you move selected items to the operating system Trash / Recycle Bin.

No account. No cloud scan. No automatic purge.

## Highlights

- Scan a folder or an entire drive
- Detect available drive roots from the desktop app
- Live scan progress with cancellation
- Storage breakdown by file type
- Largest top-level folder map
- Top 100 largest files
- Large files older than a configurable age
- Focused Downloads view
- Conservative cache / temporary / old-installer candidates
- Exact duplicate verification: size → quick fingerprint → full BLAKE3 hash
- In-session hash cache to speed up rescans
- Reveal any surfaced file in the native file manager
- Explicit selection + confirmation before removal
- Removal through the system Trash / Recycle Bin
- Configurable thresholds and ignored folder names
- Browser preview mode for contributors

## Safety model

CleanMyFiles intentionally behaves more like an analyzer than a one-click cleaner.

1. Nothing is selected automatically on startup.
2. Nothing is permanently deleted by a scan action.
3. Duplicate groups require a full content hash match.
4. “Select extra copies” keeps one path unselected for manual review.
5. Cache and temporary items are shown as candidates, not declared safe.
6. Symbolic links are not followed.
7. Paths and file contents used for analysis stay on the machine.

A duplicate can still matter because another application expects it at a specific path. Always review selections.

## Views

- **Overview** — drive usage, analyzed bytes, duplicate waste, file types and top-level folders
- **Duplicates** — exact content-match groups
- **Large files** — the heaviest surfaced files
- **Old files** — large files older than the configured threshold
- **Downloads** — files found under Downloads within the scan root
- **Cleanup** — conservative cache, temp and old installer candidates
- **Settings** — duplicate size, large-file size, age and exclusions

## Windows: run from source

Requirements:

- Node.js LTS
- Rust stable with the MSVC toolchain
- Microsoft C++ Build Tools with **Desktop development with C++**
- WebView2 (already present on modern Windows 10/11 in normal installations)

Install Rust:

```powershell
winget install --id Rustlang.Rustup
```

Reopen the terminal, then:

```powershell
rustup default stable-msvc
```

In the project folder:

```powershell
npm install
npm run desktop:dev
```

Or double-click `dev-windows.cmd`.

## Build a Windows installer

The repository is configured to generate both NSIS (`-setup.exe`) and MSI bundles on Windows:

```powershell
npm install
npm run desktop:build
```

Or double-click:

```text
build-windows.cmd
```

Built installers are placed under:

```text
src-tauri\target\release\bundle\
```

MSI creation may require the Windows VBSCRIPT optional feature. If MSI bundling is unavailable on a machine, the NSIS setup executable remains the simpler distribution format.

## GitHub release build

`.github/workflows/windows-release.yml` builds the Windows application on `windows-latest` and creates a draft GitHub Release when you push a `v*` tag or manually run the workflow.

This is useful when you do not want every contributor to install the Windows native build toolchain just to obtain an installer.

## Browser UI preview

```bash
npm install
npm run dev
```

The browser build intentionally shows representative sample data. Browsers cannot recursively inspect arbitrary disk roots with the same native capabilities as the Tauri desktop process.

## Architecture

```text
React / TypeScript UI
        │
        │ Tauri IPC + events
        ▼
Rust scan engine
  ├─ WalkDir traversal
  ├─ file categorization
  ├─ folder aggregation
  ├─ age / Downloads / cleanup classification
  ├─ quick duplicate fingerprinting
  ├─ BLAKE3 verification + session cache
  └─ native Trash / Recycle Bin operations
```

The heavy scan runs on Tauri's blocking worker pool rather than the webview thread. Progress is emitted back to the interface as the filesystem is traversed and duplicate candidate groups are verified.

## Project structure

```text
cleanmyfiles/
├─ src/
│  ├─ lib/
│  ├─ App.tsx
│  ├─ styles.css
│  └─ types.ts
├─ src-tauri/
│  ├─ capabilities/
│  ├─ src/
│  │  ├─ lib.rs
│  │  └─ main.rs
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ .github/workflows/
├─ build-windows.cmd
├─ dev-windows.cmd
├─ CONTRIBUTING.md
├─ SECURITY.md
└─ ROADMAP.md
```

## Tech

- Tauri 2
- Rust
- React 19 + TypeScript
- Vite
- BLAKE3
- `walkdir`
- `trash`
- `fs2`

## Contributing

Focused bug reports, platform testing and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before a large change.

## License

MIT
