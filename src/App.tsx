import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Download,
  File,
  FileArchive,
  FileImage,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Layers3,
  LocateFixed,
  Music2,
  RefreshCw,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { demoScan } from "./lib/demo";
import { formatBytes, formatDate, formatDuration, shortPath } from "./lib/format";
import type { CleanupCandidate, DriveInfo, DuplicateGroup, FileItem, ScanOptions, ScanProgress, ScanResult } from "./types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const DEFAULT_OPTIONS: ScanOptions = {
  minimumDuplicateSize: 1024 * 1024,
  largeFileThreshold: 100 * 1024 * 1024,
  oldFileDays: 180,
  ignoredNames: ["node_modules", ".git", "target", "$recycle.bin", "system volume information"],
};

const iconByCategory: Record<string, typeof File> = {
  Video,
  Images: FileImage,
  Audio: Music2,
  Documents: FileText,
  Archives: Archive,
  Applications: FileArchive,
  "Disk images": HardDrive,
};

const navItems = [
  ["Overview", Gauge],
  ["Duplicates", Layers3],
  ["Large files", HardDrive],
  ["Old files", Clock3],
  ["Downloads", Download],
  ["Cleanup", Sparkles],
  ["Settings", Settings2],
] as const;

export default function App() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [roots, setRoots] = useState<DriveInfo[]>([]);
  const [active, setActive] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<ScanOptions>(() => {
    try {
      const saved = localStorage.getItem("cmf-options");
      return saved ? { ...DEFAULT_OPTIONS, ...JSON.parse(saved) } : DEFAULT_OPTIONS;
    } catch {
      return DEFAULT_OPTIONS;
    }
  });

  const data = scan ?? demoScan;
  const demo = scan === null;

  useEffect(() => {
    localStorage.setItem("cmf-options", JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    if (!isTauri) {
      setRoots(demoScan.drive ? [demoScan.drive] : []);
      return;
    }
    invoke<DriveInfo[]>("list_roots").then(setRoots).catch(() => setRoots([]));
    const stop = listen<ScanProgress>("scan-progress", (event) => setProgress(event.payload));
    return () => { void stop.then((unlisten) => unlisten()); };
  }, []);

  const fileSizes = useMemo(() => {
    const map = new Map<string, number>();
    const add = (file: FileItem) => map.set(file.path, file.size);
    data.largest.forEach(add);
    data.oldFiles.forEach(add);
    data.downloads.forEach(add);
    data.cleanupCandidates.forEach((item) => add(item.file));
    data.duplicates.forEach((group) => group.files.forEach(add));
    return map;
  }, [data]);

  const selectedBytes = useMemo(
    () => [...selected].reduce((total, path) => total + (fileSizes.get(path) ?? 0), 0),
    [fileSizes, selected],
  );

  async function scanPath(path: string) {
    if (!isTauri) {
      setStatus("Browser preview uses sample data. Run the desktop app for real scanning.");
      return;
    }
    setBusy(true);
    setProgress({ phase: "walking", files: 0, bytes: 0, currentPath: path, groupsDone: 0, groupsTotal: 0 });
    setStatus(null);
    setSelected(new Set());
    try {
      const result = await invoke<ScanResult>("scan_folder", { path, options });
      setScan(result);
      setActive("Overview");
    } catch (error) {
      const message = String(error);
      if (!message.toLowerCase().includes("cancelled")) setStatus(message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function pickAndScan() {
    if (!isTauri) return scanPath("C:\\");
    const directory = await open({ directory: true, multiple: false, title: "Choose a folder or drive to scan" });
    if (directory && !Array.isArray(directory)) await scanPath(directory);
  }

  async function cancelScan() {
    if (!isTauri || !busy) return;
    setStatus("Cancelling scan…");
    await invoke("cancel_scan");
  }

  async function moveSelectedToTrash() {
    if (!selected.size || !isTauri) return;
    if (!window.confirm(`Move ${selected.size} selected item${selected.size === 1 ? "" : "s"} (${formatBytes(selectedBytes)}) to the system Trash/Recycle Bin?`)) return;
    const paths = [...selected];
    setBusy(true);
    try {
      const result = await invoke<{ moved: number; failed: string[] }>("move_to_trash", { paths });
      setStatus(result.failed.length ? `Moved ${result.moved}. ${result.failed.length} item(s) could not be moved.` : `Moved ${result.moved} item(s) to Trash.`);
      setSelected(new Set());
      if (scan) await scanPath(scan.root);
    } catch (error) {
      setStatus(String(error));
      setBusy(false);
    }
  }

  function toggle(path: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  async function reveal(path: string) {
    if (!isTauri) return;
    try { await invoke("reveal_in_file_manager", { path }); } catch (error) { setStatus(String(error)); }
  }

  function selectDuplicateExtras(group: DuplicateGroup) {
    setSelected((current) => {
      const next = new Set(current);
      group.files.slice(1).forEach((file) => next.add(file.path));
      return next;
    });
  }

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main">
        <Topbar
          active={active}
          data={data}
          busy={busy}
          roots={roots}
          onScan={scanPath}
          onChoose={pickAndScan}
          onRescan={() => scanPath(data.root)}
          hasRealScan={Boolean(scan)}
        />

        {status && <div className="statusbar"><span>{status}</span><button onClick={() => setStatus(null)} aria-label="Dismiss"><X size={14} /></button></div>}
        {demo && <DemoBanner onChoose={pickAndScan} />}
        {busy && progress && <ScanProgressBar progress={progress} onCancel={cancelScan} />}

        {active === "Overview" && <Overview data={data} roots={roots} onNavigate={setActive} onScan={scanPath} />}
        {active === "Duplicates" && <Duplicates data={data} selected={selected} onToggle={toggle} onSelectExtras={selectDuplicateExtras} onReveal={reveal} />}
        {active === "Large files" && <FileSection kicker="Largest files" title="Heavy items worth checking" files={data.largest} selected={selected} onToggle={toggle} onReveal={reveal} empty="No large files were surfaced." />}
        {active === "Old files" && <FileSection kicker={`Older than ${options.oldFileDays} days`} title="Large files you may have forgotten" files={data.oldFiles} selected={selected} onToggle={toggle} onReveal={reveal} empty="No old large files matched your current threshold." />}
        {active === "Downloads" && <FileSection kicker="Downloads" title="What has accumulated in Downloads" files={data.downloads} selected={selected} onToggle={toggle} onReveal={reveal} empty="No Downloads directory was found inside this scan." />}
        {active === "Cleanup" && <Cleanup data={data} selected={selected} onToggle={toggle} onReveal={reveal} />}
        {active === "Settings" && <Settings options={options} onChange={setOptions} />}

        {selected.size > 0 && (
          <div className="selection-bar">
            <button className="icon-button" onClick={clearSelection} title="Clear selection"><X size={17} /></button>
            <div className="selection-copy"><strong>{selected.size} selected</strong><span>{formatBytes(selectedBytes)}</span></div>
            <button className="button danger" onClick={moveSelectedToTrash} disabled={busy}><Trash2 size={17} /> Move to Trash</button>
          </div>
        )}
      </main>
    </div>
  );
}

function Sidebar({ active, onSelect }: { active: string; onSelect: (value: string) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brandmark"><ScanSearch size={20} /></div><div><strong>CleanMyFiles</strong><span>Disk space, explained</span></div></div>
      <nav>
        <div className="nav-label">Analyze</div>
        {navItems.map(([label, Icon]) => <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => onSelect(label)}><Icon size={17} /><span>{label}</span>{active === label && <ChevronRight size={14} className="nav-arrow" />}</button>)}
      </nav>
      <div className="privacy-card"><ShieldCheck size={18} /><div><strong>Local by design</strong><p>No file list or file content is uploaded.</p></div></div>
      <div className="sidebar-footer">v0.2.0 · MIT</div>
    </aside>
  );
}

function Topbar({ active, data, busy, roots, onScan, onChoose, onRescan, hasRealScan }: { active: string; data: ScanResult; busy: boolean; roots: DriveInfo[]; onScan: (path: string) => void; onChoose: () => void; onRescan: () => void; hasRealScan: boolean }) {
  return (
    <header className="topbar">
      <div className="topbar-copy"><div className="eyebrow">{active}</div><h1>{active === "Overview" ? "See what is actually taking space." : active}</h1><p>{active === "Overview" ? shortPath(data.root, 84) : sectionSubtitle(active)}</p></div>
      <div className="topbar-actions">
        {hasRealScan && <button className="button secondary" onClick={onRescan} disabled={busy}><RefreshCw size={16} /> Rescan</button>}
        {roots.length > 0 && <button className="button secondary drive-button" onClick={() => onScan(roots[0].path)} disabled={busy}><HardDrive size={16} /> Scan {roots[0].path}</button>}
        <button className="button primary" onClick={onChoose} disabled={busy}><FolderOpen size={16} /> Choose location</button>
      </div>
    </header>
  );
}

function DemoBanner({ onChoose }: { onChoose: () => void }) {
  return <div className="demo-banner"><div><strong>Preview data</strong><span>This is the browser preview. Desktop scans use your real filesystem locally.</span></div><button className="text-button" onClick={onChoose}>Start a real scan <ChevronRight size={15} /></button></div>;
}

function ScanProgressBar({ progress, onCancel }: { progress: ScanProgress; onCancel: () => void }) {
  const phase = progress.phase === "walking" ? "Indexing files" : progress.phase === "hashing" ? "Verifying duplicates" : "Building report";
  const fraction = progress.phase === "hashing" && progress.groupsTotal > 0 ? Math.min(100, Math.round((progress.groupsDone / progress.groupsTotal) * 100)) : null;
  return (
    <section className="scan-card">
      <div className="scan-card-head"><div><span className="live-dot" /><strong>{phase}</strong><span>{progress.files.toLocaleString()} files · {formatBytes(progress.bytes)}</span></div><button className="button secondary small" onClick={onCancel}><CircleStop size={15} /> Cancel</button></div>
      <div className={`scan-track ${fraction === null ? "indeterminate" : ""}`}><i style={fraction === null ? undefined : { width: `${fraction}%` }} /></div>
      <p title={progress.currentPath}>{shortPath(progress.currentPath, 110)}</p>
    </section>
  );
}

function Overview({ data, roots, onNavigate, onScan }: { data: ScanResult; roots: DriveInfo[]; onNavigate: (value: string) => void; onScan: (path: string) => void }) {
  const drive = data.drive ?? roots[0] ?? null;
  const used = drive ? Math.max(0, drive.totalSpace - drive.availableSpace) : data.totalSize;
  const usedPct = drive?.totalSpace ? Math.min(100, (used / drive.totalSpace) * 100) : 0;
  const topFolder = data.topFolders[0]?.size || 1;
  return (
    <div className="content-stack">
      <section className="hero-card">
        <div className="hero-copy"><span className="section-kicker">Scan summary</span><h2>{formatBytes(data.reviewableBytes)} worth reviewing</h2><p>CleanMyFiles surfaces candidates. It does not automatically decide what you should delete.</p><div className="hero-actions"><button className="button primary" onClick={() => onNavigate("Cleanup")}>Review cleanup <ChevronRight size={16} /></button><button className="button secondary" onClick={() => onNavigate("Duplicates")}>Duplicates</button></div></div>
        <div className="disk-meter"><div className="meter-ring" style={{ "--used": `${usedPct * 3.6}deg` } as CSSProperties}><div><strong>{Math.round(usedPct)}%</strong><span>disk used</span></div></div><div className="meter-copy"><strong>{drive?.label ?? "Scanned location"}</strong><span>{drive ? `${formatBytes(used)} of ${formatBytes(drive.totalSpace)}` : `${formatBytes(data.totalSize)} analyzed`}</span></div></div>
      </section>

      <section className="stats-grid">
        <Stat label="Space analyzed" value={formatBytes(data.totalSize)} sub={`${data.totalFiles.toLocaleString()} files`} />
        <Stat label="Exact duplicate waste" value={formatBytes(data.duplicateWaste)} sub={`${data.duplicates.length} verified groups`} accent />
        <Stat label="Cleanup candidates" value={formatBytes(data.reviewableBytes)} sub={`${data.cleanupCandidates.length} cleanup items + duplicates`} />
        <Stat label="Scan time" value={formatDuration(data.durationMs)} sub={`${data.skipped.toLocaleString()} inaccessible items skipped`} />
      </section>

      {roots.length > 1 && <section className="drive-strip"><span>Drives</span>{roots.map((root) => <button key={root.path} onClick={() => onScan(root.path)}><HardDrive size={15} /><strong>{root.label}</strong><small>{formatBytes(root.availableSpace)} free</small></button>)}</section>}

      <div className="overview-grid">
        <section className="panel storage-panel">
          <div className="panel-heading"><div><span className="section-kicker">File types</span><h2>What is using your space</h2></div><span className="muted">{formatBytes(data.totalSize)}</span></div>
          <div className="category-list">{data.categories.slice(0, 9).map((item) => { const Icon = iconByCategory[item.category] ?? File; const width = Math.max(2, (item.size / Math.max(data.categories[0]?.size || 1, 1)) * 100); return <div className="category-row" key={item.category}><div className="category-icon"><Icon size={16} /></div><div className="category-meta"><div><strong>{item.category}</strong><span>{item.files.toLocaleString()}</span></div><div className="bar"><i style={{ width: `${width}%` }} /></div></div><strong className="category-size">{formatBytes(item.size)}</strong></div>; })}</div>
        </section>

        <section className="panel folder-panel">
          <div className="panel-heading"><div><span className="section-kicker">Disk map</span><h2>Largest top-level folders</h2></div></div>
          <div className="folder-map">{data.topFolders.slice(0, 8).map((folder, index) => <div className="folder-tile" key={folder.path} style={{ "--weight": Math.max(.18, folder.size / topFolder) } as CSSProperties}><span>{index + 1}</span><div><strong>{folder.name}</strong><small>{folder.files.toLocaleString()} files</small></div><b>{formatBytes(folder.size)}</b></div>)}</div>
        </section>
      </div>

      <div className="quick-grid">
        <QuickCard icon={Layers3} label="Duplicates" value={formatBytes(data.duplicateWaste)} text="Exact content matches, verified with BLAKE3." onClick={() => onNavigate("Duplicates")} />
        <QuickCard icon={Clock3} label="Old files" value={`${data.oldFiles.length} files`} text="Large files untouched past your age threshold." onClick={() => onNavigate("Old files")} />
        <QuickCard icon={Download} label="Downloads" value={formatBytes(data.downloads.reduce((n, f) => n + f.size, 0))} text="A focused view of Downloads inside this scan." onClick={() => onNavigate("Downloads")} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) { return <div className={`stat ${accent ? "accent" : ""}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>; }

function QuickCard({ icon: Icon, label, value, text, onClick }: { icon: typeof File; label: string; value: string; text: string; onClick: () => void }) { return <button className="quick-card" onClick={onClick}><div className="quick-icon"><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><p>{text}</p><ChevronRight size={16} className="quick-arrow" /></button>; }

function Duplicates({ data, selected, onToggle, onSelectExtras, onReveal }: { data: ScanResult; selected: Set<string>; onToggle: (path: string) => void; onSelectExtras: (group: DuplicateGroup) => void; onReveal: (path: string) => void }) {
  return <div className="content-stack"><section className="callout safe"><ShieldCheck size={20} /><div><strong>Only exact matches are grouped.</strong><p>Files are filtered by size, sampled, then verified with a full BLAKE3 content hash. “Select extra copies” leaves the first path untouched for review.</p></div></section>{data.duplicates.length === 0 ? <Empty title="No exact duplicates found" text="Try scanning a larger location or lower the duplicate threshold in Settings." /> : data.duplicates.map((group, index) => <section className="panel duplicate-group" key={`${group.size}-${index}`}><div className="panel-heading compact"><div><span className="section-kicker">Group {index + 1}</span><h2>{group.files.length} identical files</h2></div><div className="group-actions"><span>{formatBytes(group.wasted)} duplicate space</span><button className="button secondary small" onClick={() => onSelectExtras(group)}>Select extra copies</button></div></div><div className="file-table">{group.files.map((file, fileIndex) => <FileRow key={file.path} file={file} selected={selected.has(file.path)} onToggle={onToggle} onReveal={onReveal} note={fileIndex === 0 ? "Reference copy" : undefined} />)}</div></section>)}</div>;
}

function FileSection({ kicker, title, files, selected, onToggle, onReveal, empty }: { kicker: string; title: string; files: FileItem[]; selected: Set<string>; onToggle: (path: string) => void; onReveal: (path: string) => void; empty: string }) {
  return <section className="panel"><div className="panel-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><span className="muted">{files.length} surfaced</span></div>{files.length ? <div className="file-table flush">{files.map((file) => <FileRow key={file.path} file={file} selected={selected.has(file.path)} onToggle={onToggle} onReveal={onReveal} />)}</div> : <Empty title={empty} text="Run another scan or adjust your thresholds in Settings." />}</section>;
}

function Cleanup({ data, selected, onToggle, onReveal }: { data: ScanResult; selected: Set<string>; onToggle: (path: string) => void; onReveal: (path: string) => void }) {
  const byReason = data.cleanupCandidates.reduce<Record<string, number>>((acc, item) => { acc[item.reason] = (acc[item.reason] ?? 0) + item.file.size; return acc; }, {});
  return <div className="content-stack"><section className="callout warning"><ShieldCheck size={20} /><div><strong>Cleanup candidates are suggestions, not a one-click purge.</strong><p>Cache and temporary locations are detected conservatively. Review each path; selected files go to the system Trash/Recycle Bin.</p></div></section><section className="stats-grid compact-stats"><Stat label="Cache candidates" value={formatBytes(byReason.Cache ?? 0)} sub="Inside recognized cache folders" /><Stat label="Temporary files" value={formatBytes(byReason.Temporary ?? 0)} sub="Inside temp/tmp folders" /><Stat label="Old installers" value={formatBytes(byReason.Installer ?? 0)} sub="Installers in Downloads older than 30 days" /><Stat label="Total reviewable" value={formatBytes(data.reviewableBytes)} sub="Includes duplicate extra copies" accent /></section><section className="panel"><div className="panel-heading"><div><span className="section-kicker">Review queue</span><h2>Potential cleanup items</h2></div><span className="muted">Nothing selected automatically</span></div>{data.cleanupCandidates.length ? <div className="file-table flush">{data.cleanupCandidates.map((candidate) => <CleanupRow key={candidate.file.path} candidate={candidate} selected={selected.has(candidate.file.path)} onToggle={onToggle} onReveal={onReveal} />)}</div> : <Empty title="No cleanup candidates surfaced" text="This location did not contain recognized cache, temporary, or old installer files." />}</section></div>;
}

function CleanupRow({ candidate, selected, onToggle, onReveal }: { candidate: CleanupCandidate; selected: boolean; onToggle: (path: string) => void; onReveal: (path: string) => void }) {
  return <FileRow file={candidate.file} selected={selected} onToggle={onToggle} onReveal={onReveal} note={candidate.reason} detail={candidate.note} />;
}

function FileRow({ file, selected, onToggle, onReveal, note, detail }: { file: FileItem; selected: boolean; onToggle: (path: string) => void; onReveal: (path: string) => void; note?: string; detail?: string }) {
  const Icon = iconByCategory[file.category] ?? File;
  return <div className={`file-row ${selected ? "selected" : ""}`}><button className={`check-button ${selected ? "checked" : ""}`} onClick={() => onToggle(file.path)} aria-label={selected ? "Deselect" : "Select"}>{selected && <Check size={13} />}</button><span className="file-type"><Icon size={16} /></span><span className="file-copy"><strong>{file.name}</strong><small title={file.path}>{detail ?? shortPath(file.path, 74)}</small></span>{note ? <span className="keep-pill">{note}</span> : <span /> }<span className="file-date">{formatDate(file.modified)}</span><strong className="file-size">{formatBytes(file.size)}</strong><button className="reveal-button" onClick={() => onReveal(file.path)} title="Show in file manager"><LocateFixed size={15} /></button></div>;
}

function Settings({ options, onChange }: { options: ScanOptions; onChange: (next: ScanOptions) => void }) {
  const [ignored, setIgnored] = useState(options.ignoredNames.join(", "));
  return <div className="settings-grid"><section className="panel settings-card"><span className="section-kicker">Duplicates</span><h2>Minimum file size</h2><p>Smaller files skip duplicate hashing. Raising this makes full-drive scans faster.</p><select value={options.minimumDuplicateSize} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ ...options, minimumDuplicateSize: Number(e.target.value) })}><option value={256 * 1024}>256 KB</option><option value={1024 * 1024}>1 MB</option><option value={5 * 1024 * 1024}>5 MB</option><option value={25 * 1024 * 1024}>25 MB</option></select></section><section className="panel settings-card"><span className="section-kicker">Large files</span><h2>Large file threshold</h2><p>Controls which files qualify for the old-files review.</p><select value={options.largeFileThreshold} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ ...options, largeFileThreshold: Number(e.target.value) })}><option value={25 * 1024 * 1024}>25 MB</option><option value={100 * 1024 * 1024}>100 MB</option><option value={500 * 1024 * 1024}>500 MB</option><option value={1024 * 1024 * 1024}>1 GB</option></select></section><section className="panel settings-card"><span className="section-kicker">Age filter</span><h2>Old file age</h2><p>Large files older than this are surfaced under Old files.</p><select value={options.oldFileDays} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ ...options, oldFileDays: Number(e.target.value) })}><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={730}>2 years</option></select></section><section className="panel settings-card"><span className="section-kicker">Exclusions</span><h2>Ignored folder names</h2><p>Comma-separated folder names skipped anywhere in the tree.</p><input value={ignored} onChange={(e: ChangeEvent<HTMLInputElement>) => setIgnored(e.target.value)} onBlur={() => onChange({ ...options, ignoredNames: ignored.split(",").map((v) => v.trim()).filter(Boolean) })} /></section><section className="panel settings-card full"><div className="settings-row"><ShieldCheck size={21} /><div><h2>Safe deletion policy</h2><p>CleanMyFiles never permanently deletes files from scan results. Every remove action uses the operating system Trash/Recycle Bin and requires an explicit selection plus confirmation.</p></div></div></section></div>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><ScanSearch size={26} /><strong>{title}</strong><p>{text}</p></div>; }

function sectionSubtitle(section: string) {
  if (section === "Duplicates") return "Exact content matches verified during the latest scan.";
  if (section === "Large files") return "The heaviest files inside the selected location.";
  if (section === "Old files") return "Large files that have not changed for a long time.";
  if (section === "Downloads") return "A focused view of files found under Downloads.";
  if (section === "Cleanup") return "Conservative cleanup candidates. Review before removing.";
  if (section === "Settings") return "Tune scan depth while keeping safe defaults.";
  return "";
}
