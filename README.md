<div align="center">

<img src="docs/assets/readme-hero.svg" alt="CleanMyFiles — Understand your disk before deleting anything" width="100%" />

<br />

[![English](https://img.shields.io/badge/README-English-111827?style=for-the-badge)](README.md)
[![Русский](https://img.shields.io/badge/README-Русский-111827?style=for-the-badge)](README_RU.md)

<br />

[![Release](https://img.shields.io/github/v/release/hanxww/CleanMyFiles?display_name=tag&style=flat-square&label=release)](https://github.com/hanxww/CleanMyFiles/releases)
[![Stars](https://img.shields.io/github/stars/hanxww/CleanMyFiles?style=flat-square&logo=github&label=stars)](https://github.com/hanxww/CleanMyFiles/stargazers)
[![Windows build](https://img.shields.io/github/actions/workflow/status/hanxww/CleanMyFiles/windows-release.yml?style=flat-square&label=windows%20build)](https://github.com/hanxww/CleanMyFiles/actions/workflows/windows-release.yml)
[![Frontend](https://img.shields.io/github/actions/workflow/status/hanxww/CleanMyFiles/frontend-check.yml?style=flat-square&label=frontend)](https://github.com/hanxww/CleanMyFiles/actions/workflows/frontend-check.yml)
[![License](https://img.shields.io/github/license/hanxww/CleanMyFiles?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-native%20core-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)

### See what is taking your disk space. Verify what is actually duplicated. Remove only what you choose.

**Local-first · No account · No cloud scan · No automatic purge**

[**Download**](https://github.com/hanxww/CleanMyFiles/releases) · [**Roadmap**](ROADMAP.md) · [**Report a bug**](https://github.com/hanxww/CleanMyFiles/issues/new?template=bug_report.yml) · [**Request a feature**](https://github.com/hanxww/CleanMyFiles/issues/new?template=feature_request.yml)

</div>

---

## CleanMyFiles in one sentence

**CleanMyFiles is a local-first desktop disk analyzer that helps you understand storage usage, verify exact duplicates, review large and old files, and move only explicitly selected items to the system Trash / Recycle Bin.**

It is intentionally built around a simple rule:

> **Understand first. Clean second.**

Many cleanup utilities optimize for the biggest possible “You can free 87 GB” number. CleanMyFiles optimizes for something more useful: **confidence about what you are looking at before anything disappears.**

---

## Why it exists

A full disk is easy to notice and surprisingly hard to understand.

You can open Explorer and sort one folder at a time. You can install a one-click cleaner and trust its definition of “junk”. Or you can spend an afternoon searching for copies of the same video, abandoned installers, oversized downloads and old project files.

CleanMyFiles puts those jobs into one review flow:

```text
Choose a drive or folder
          ↓
Scan locally on your machine
          ↓
Understand storage by file type and top-level folder
          ↓
Review exact duplicates, large files, old files and cleanup candidates
          ↓
Select only what you want to remove
          ↓
Move selected files to the system Trash / Recycle Bin
```

No remote file processing is required for the scan.

---

## The core idea

<table>
<tr>
<td width="25%" align="center"><b>🔒 Local-first</b><br/><sub>Scanning and duplicate verification happen on your machine.</sub></td>
<td width="25%" align="center"><b>🧬 Exact duplicates</b><br/><sub>Final duplicate groups require full BLAKE3 content verification.</sub></td>
<td width="25%" align="center"><b>🗑️ Safer removal</b><br/><sub>Selected items go to the operating system Trash / Recycle Bin.</sub></td>
<td width="25%" align="center"><b>👀 Review before action</b><br/><sub>Nothing is automatically selected for deletion after a scan.</sub></td>
</tr>
</table>

---

# Features

## Storage overview

CleanMyFiles can scan an entire drive root or a folder you choose and turn the result into a readable storage overview.

- analyzed bytes and file count
- available / total drive space when available
- file-type breakdown
- top-level folder aggregation
- largest surfaced files
- duplicate waste estimate
- reviewable cleanup bytes
- scan duration and skipped entries

The goal is not to show every filesystem statistic imaginable. The goal is to answer the question:

> **Where did my space go?**

---

## Exact duplicate detection

Duplicate detection is deliberately stricter than “same filename” or “same file size”.

```text
all scanned files
      │
      ├── group candidates by exact size
      │
      ├── quick BLAKE3 fingerprint
      │   (beginning + end of the file)
      │
      └── full BLAKE3 content hash
              │
              └── exact duplicate group
```

This avoids full-file hashing for files that can be rejected earlier while still requiring a complete content hash before a duplicate group is reported as exact.

Full hashes are cached for the current app session using path + size + modification time metadata, which makes repeated scans cheaper when files have not changed.

> [!NOTE]
> Byte-for-byte identical files are not automatically “safe to delete”. An application may still expect a specific copy at a specific path. CleanMyFiles therefore leaves the final decision to you.

---

## Large files

The **Large files** view surfaces the heaviest files discovered during the scan.

Instead of hunting manually through folders, you get one focused list with:

- filename
- full path
- size
- modification date
- file category
- reveal-in-file-manager action
- explicit selection control

The current v0.2 interface surfaces the top 100 files from the scanned location.

---

## Old large files

Some of the easiest storage wins are files that are both **large** and **untouched for a long time**.

The threshold is configurable:

- large-file threshold: `25 MB` / `100 MB` / `500 MB` / `1 GB`
- age threshold: `90 days` / `180 days` / `1 year` / `2 years`

CleanMyFiles shows them for review; it does not infer that old means useless.

---

## Downloads review

When a scanned path contains a `Downloads` directory, CleanMyFiles provides a focused Downloads view.

This is useful for finding things such as:

- forgotten installers
- ISO images
- archives
- exported videos
- duplicated downloads
- large files that were only needed once

---

## Conservative cleanup candidates

The **Cleanup** view intentionally uses conservative rules. It can surface files found in recognized cache / temporary locations and old installer candidates under Downloads.

It does **not** claim that every surfaced file is disposable.

> [!IMPORTANT]
> Cleanup candidates are suggestions for review, not an automatic purge list.

Nothing in this section is selected by default.

---

## Live scanning

Long scans should not feel like the application froze.

CleanMyFiles emits progress from the native Rust core back to the UI while it is working:

```text
Scanning
├─ files discovered
├─ bytes analyzed
├─ current path
└─ duplicate verification progress
```

A running scan can be cancelled from the interface.

Heavy filesystem work runs outside the webview thread.

---

## Reveal before removing

Every surfaced file can be opened in the native file manager before you decide what to do with it.

On Windows, this means you can jump directly to the file in Explorer and inspect the surrounding folder instead of making a decision from a filename alone.

---

# Safety model

CleanMyFiles is designed more like a **disk inspector with cleanup tools** than a one-click optimizer.

| Safety rule | Behavior |
|---|---|
| **No automatic selection** | A finished scan does not preselect files for deletion |
| **No deletion during scan** | Scanning is read-only |
| **Exact duplicate verification** | Duplicate groups require a complete content-hash match |
| **Keep one copy visible** | “Select extra copies” leaves one file in each group unselected |
| **Manual cleanup review** | Cache / temp / installer candidates require explicit selection |
| **No symlink traversal** | Symbolic links are not followed recursively during scanning |
| **Trash / Recycle Bin** | Removal uses the operating system trash mechanism |
| **Local scan data** | Paths and analyzed file contents are processed locally by the desktop app |

CleanMyFiles does not try to outsmart the user with aggressive “safe to remove” scores.

That restraint is a feature.

---

# App layout

```text
CleanMyFiles
│
├── Overview
│   ├── drive usage
│   ├── analyzed data
│   ├── duplicate waste
│   ├── file-type breakdown
│   └── top-level folder map
│
├── Duplicates
│   ├── exact content-match groups
│   └── select extra copies
│
├── Large files
│   └── top 100 surfaced files
│
├── Old files
│   └── large files older than your threshold
│
├── Downloads
│   └── focused review of Downloads content
│
├── Cleanup
│   └── conservative cache / temp / installer candidates
│
└── Settings
    ├── minimum duplicate size
    ├── large-file threshold
    ├── old-file age
    └── ignored folder names
```

---

# Quick start

## Download a release

The official v0.2 packaging target is currently **Windows**.

### **[→ Download the latest CleanMyFiles release](https://github.com/hanxww/CleanMyFiles/releases)**

Typical Windows assets:

```text
CleanMyFiles_*_x64-setup.exe   ← recommended for most users
CleanMyFiles_*_x64_en-US.msi   ← MSI package
```

The native core includes platform-aware code paths beyond Windows, but macOS and Linux are not yet part of the official release workflow.

---

# Run from source

## Requirements

### Windows

- Node.js **20+**
- Rust **stable-msvc**
- Microsoft C++ Build Tools with **Desktop development with C++**
- WebView2 (normally already present on current Windows 10/11 systems)

Install Rust if needed:

```powershell
winget install --id Rustlang.Rustup
```

Reopen your terminal and select the MSVC toolchain:

```powershell
rustup default stable-msvc
```

Clone and run:

```powershell
git clone https://github.com/hanxww/CleanMyFiles.git
cd CleanMyFiles
npm install
npm run desktop:dev
```

Or use the Windows helper:

```text
dev-windows.cmd
```

---

# Build Windows installers

```powershell
npm install
npm run desktop:build
```

Or simply run:

```text
build-windows.cmd
```

The helper attempts to locate Visual Studio Build Tools automatically and initialize the MSVC environment if `link.exe` is not already available in the current shell.

Successful bundles are written under:

```text
src-tauri\target\release\bundle\
├── nsis\
│   └── CleanMyFiles_*_x64-setup.exe
└── msi\
    └── CleanMyFiles_*_x64_en-US.msi
```

> [!NOTE]
> MSI creation may depend on Windows optional components. The NSIS setup executable is the simplest distribution format for most users.

---

# Browser UI preview

Frontend contributors can work on the interface without native filesystem access:

```bash
npm install
npm run dev
```

The browser build uses representative demo data by design. A normal browser does not have the same unrestricted recursive disk access as the Tauri desktop process.

---

# Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                 React 19 + TypeScript                    │
│                                                          │
│   navigation · scan state · review lists · selection     │
└──────────────────────────┬───────────────────────────────┘
                           │
                     Tauri IPC + events
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                     Rust native core                     │
│                                                          │
│   WalkDir traversal                                      │
│   file categorization                                    │
│   top-level folder aggregation                           │
│   large / old / Downloads classification                 │
│   cleanup candidate classification                       │
│   quick BLAKE3 fingerprints                              │
│   full BLAKE3 verification                               │
│   in-session hash cache                                  │
│   native Trash / Recycle Bin operations                  │
└──────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| Desktop shell | **Tauri 2** |
| Native core | **Rust** |
| UI | **React 19 + TypeScript** |
| Frontend tooling | **Vite** |
| Filesystem traversal | **walkdir** |
| Duplicate hashing | **BLAKE3** |
| Safe removal | **trash** |
| Disk space information | **fs2** |

---

# Project structure

```text
CleanMyFiles/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── docs/
│   └── assets/
├── src/
│   ├── lib/
│   ├── App.tsx
│   ├── styles.css
│   └── types.ts
├── src-tauri/
│   ├── capabilities/
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── build-windows.cmd
├── dev-windows.cmd
├── CHANGELOG.md
├── CONTRIBUTING.md
├── ROADMAP.md
├── SECURITY.md
└── README.md
```

---

# What CleanMyFiles deliberately does **not** do

Trust matters more than a longer feature list.

CleanMyFiles currently does not pretend to be:

- a registry cleaner
- an antivirus
- a secure file shredder
- a system optimizer
- an automatic “delete everything marked junk” utility
- a guarantee that cache / temp files are always safe to remove

If a future feature can destroy data, its safety model should be clear before it ships.

---

# Roadmap

### v0.3 — deeper inspection

- persistent scan database
- persistent hash cache
- hierarchical treemap with drill-down
- directory-level inspection and selection
- search and sort controls across file lists
- path-pattern exclusions
- scan history and comparisons
- improved mounted-volume discovery on macOS/Linux

### v0.4 — broader review tools

- documented application-cache rules
- empty-folder review
- broken-shortcut review
- very large directory detection
- exportable scan reports
- portable Windows build

### Later

- signed release pipeline
- auto updater
- localization
- accessibility audit
- plugin API for third-party analyzers

See **[ROADMAP.md](ROADMAP.md)** for the maintained roadmap.

---

# Contributing

CleanMyFiles is still young, which means focused contributions can have a visible impact.

Useful contributions include:

- reproducible bug reports
- Windows hardware / filesystem testing
- macOS and Linux validation
- performance profiling on large directory trees
- safer cleanup-detection rules backed by documentation
- UI accessibility improvements
- small, focused pull requests

Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**.

Security-sensitive reports should follow **[SECURITY.md](SECURITY.md)** rather than being posted publicly first.

---

# License

CleanMyFiles is released under the **[MIT License](LICENSE)**.

---

<div align="center">

## Understand first. Clean second.

If CleanMyFiles saves you time or disk space, consider leaving a **⭐ star**.

It helps other people discover the project and gives the repository a signal that this kind of careful, local-first utility is worth continuing.

[**Download**](https://github.com/hanxww/CleanMyFiles/releases) · [**Roadmap**](ROADMAP.md) · [**Issues**](https://github.com/hanxww/CleanMyFiles/issues) · [**Contribute**](CONTRIBUTING.md)

</div>
