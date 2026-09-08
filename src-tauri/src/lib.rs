use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};
use walkdir::{DirEntry, WalkDir};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanOptions {
    minimum_duplicate_size: u64,
    large_file_threshold: u64,
    old_file_days: u64,
    ignored_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileItem {
    path: String,
    name: String,
    size: u64,
    modified: Option<u64>,
    category: String,
    extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CategoryBreakdown {
    category: String,
    size: u64,
    files: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderBreakdown {
    path: String,
    name: String,
    size: u64,
    files: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DuplicateGroup {
    size: u64,
    wasted: u64,
    files: Vec<FileItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CleanupCandidate {
    file: FileItem,
    reason: String,
    note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DriveInfo {
    path: String,
    label: String,
    total_space: u64,
    available_space: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    phase: String,
    files: u64,
    bytes: u64,
    current_path: String,
    groups_done: u64,
    groups_total: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    root: String,
    total_size: u64,
    total_files: u64,
    duration_ms: u128,
    categories: Vec<CategoryBreakdown>,
    top_folders: Vec<FolderBreakdown>,
    largest: Vec<FileItem>,
    duplicates: Vec<DuplicateGroup>,
    duplicate_waste: u64,
    old_files: Vec<FileItem>,
    downloads: Vec<FileItem>,
    cleanup_candidates: Vec<CleanupCandidate>,
    reviewable_bytes: u64,
    skipped: u64,
    drive: Option<DriveInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TrashResult {
    moved: usize,
    failed: Vec<String>,
}

#[derive(Debug, Clone)]
struct HashCacheEntry {
    size: u64,
    modified: Option<u64>,
    hash: String,
}

struct AppState {
    cancel: Arc<AtomicBool>,
    hash_cache: Arc<Mutex<HashMap<String, HashCacheEntry>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

fn should_skip(entry: &DirEntry, ignored: &HashSet<String>) -> bool {
    if entry.depth() == 0 {
        return false;
    }
    entry
        .file_name()
        .to_str()
        .map(|name| ignored.contains(&name.to_ascii_lowercase()))
        .unwrap_or(false)
}

fn category_for(extension: &str) -> &'static str {
    match extension {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "heic" | "heif" | "bmp" | "tif" | "tiff" | "raw" | "cr2" | "nef" | "svg" => "Images",
        "mp4" | "mov" | "mkv" | "webm" | "avi" | "m4v" | "wmv" | "flv" => "Video",
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "opus" | "wma" => "Audio",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "md" | "csv" | "odt" | "ods" | "epub" => "Documents",
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "tgz" => "Archives",
        "exe" | "msi" | "app" | "dmg" | "pkg" | "deb" | "rpm" | "appimage" => "Applications",
        "iso" | "img" | "vhd" | "vhdx" => "Disk images",
        "ttf" | "otf" | "woff" | "woff2" => "Fonts",
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "java" | "kt" | "c" | "cpp" | "h" | "hpp" | "cs" | "php" | "rb" | "swift" | "html" | "css" | "scss" | "json" | "yaml" | "yml" | "toml" => "Code",
        _ => "Other",
    }
}

fn file_item(path: &Path, size: u64, modified: Option<u64>) -> FileItem {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    FileItem {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Unnamed file")
            .to_string(),
        size,
        modified,
        category: category_for(&extension).to_string(),
        extension,
    }
}

fn path_has_component(path: &Path, names: &[&str]) -> bool {
    path.components().any(|component| {
        if let Component::Normal(value) = component {
            let value = value.to_string_lossy().to_ascii_lowercase();
            names.iter().any(|name| value == *name)
        } else {
            false
        }
    })
}

fn first_level_folder(root: &Path, path: &Path) -> (String, String) {
    if let Ok(relative) = path.strip_prefix(root) {
        let mut components = relative.components();
        if let Some(Component::Normal(first)) = components.next() {
            if components.next().is_some() {
                let name = first.to_string_lossy().to_string();
                let full = root.join(first).to_string_lossy().into_owned();
                return (full, name);
            }
        }
    }
    (root.to_string_lossy().into_owned(), "Root files".to_string())
}

fn push_top(list: &mut Vec<FileItem>, item: FileItem, keep: usize) {
    list.push(item);
    if list.len() > keep * 2 {
        list.sort_unstable_by(|a, b| b.size.cmp(&a.size));
        list.truncate(keep);
    }
}

fn modified_secs(metadata: &std::fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
}

fn full_hash_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("{}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn quick_hash_file(path: &Path, size: u64) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = vec![0_u8; 64 * 1024];

    let read = file
        .read(&mut buffer)
        .map_err(|error| format!("{}: {error}", path.display()))?;
    hasher.update(&buffer[..read]);

    if size > 128 * 1024 {
        file.seek(SeekFrom::End(-(64_i64 * 1024)))
            .map_err(|error| format!("{}: {error}", path.display()))?;
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("{}: {error}", path.display()))?;
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

fn hash_with_cache(
    item: &FileItem,
    cache: &Arc<Mutex<HashMap<String, HashCacheEntry>>>,
) -> Result<String, String> {
    if let Ok(cache_guard) = cache.lock() {
        if let Some(entry) = cache_guard.get(&item.path) {
            if entry.size == item.size && entry.modified == item.modified {
                return Ok(entry.hash.clone());
            }
        }
    }

    let hash = full_hash_file(Path::new(&item.path))?;
    if let Ok(mut cache_guard) = cache.lock() {
        cache_guard.insert(
            item.path.clone(),
            HashCacheEntry {
                size: item.size,
                modified: item.modified,
                hash: hash.clone(),
            },
        );
    }
    Ok(hash)
}

fn drive_info_for(path: &Path) -> Option<DriveInfo> {
    let total_space = fs2::total_space(path).ok()?;
    let available_space = fs2::available_space(path).ok()?;
    Some(DriveInfo {
        path: path.to_string_lossy().into_owned(),
        label: path.to_string_lossy().into_owned(),
        total_space,
        available_space,
    })
}

fn emit_progress(app: &AppHandle, progress: ScanProgress) {
    let _ = app.emit("scan-progress", progress);
}

fn scan_folder_blocking(
    path: String,
    options: ScanOptions,
    app: AppHandle,
    cancel: Arc<AtomicBool>,
    hash_cache: Arc<Mutex<HashMap<String, HashCacheEntry>>>,
) -> Result<ScanResult, String> {
    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err("The selected path is not a readable directory.".to_string());
    }

    cancel.store(false, Ordering::Relaxed);
    let started = Instant::now();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let old_threshold = options.old_file_days.saturating_mul(86_400);
    let ignored: HashSet<String> = options
        .ignored_names
        .iter()
        .map(|name| name.to_ascii_lowercase())
        .collect();
    let walker = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !should_skip(entry, &ignored));

    let mut total_size = 0_u64;
    let mut total_files = 0_u64;
    let mut skipped = 0_u64;
    let mut categories: HashMap<String, (u64, u64)> = HashMap::new();
    let mut folders: HashMap<String, (String, u64, u64)> = HashMap::new();
    let mut largest: Vec<FileItem> = Vec::new();
    let mut old_files: Vec<FileItem> = Vec::new();
    let mut downloads: Vec<FileItem> = Vec::new();
    let mut cleanup_candidates: Vec<CleanupCandidate> = Vec::new();
    let mut duplicate_candidates: HashMap<u64, Vec<FileItem>> = HashMap::new();

    for entry in walker {
        if cancel.load(Ordering::Relaxed) {
            return Err("Scan cancelled.".to_string());
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        let size = metadata.len();
        let modified = modified_secs(&metadata);
        let item = file_item(entry.path(), size, modified);

        total_size = total_size.saturating_add(size);
        total_files += 1;

        let category = categories.entry(item.category.clone()).or_insert((0, 0));
        category.0 = category.0.saturating_add(size);
        category.1 += 1;

        let (folder_path, folder_name) = first_level_folder(&root, entry.path());
        let folder = folders.entry(folder_path).or_insert((folder_name, 0, 0));
        folder.1 = folder.1.saturating_add(size);
        folder.2 += 1;

        if size >= options.minimum_duplicate_size {
            duplicate_candidates.entry(size).or_default().push(item.clone());
        }
        push_top(&mut largest, item.clone(), 100);

        let is_old = modified
            .map(|modified| now.saturating_sub(modified) >= old_threshold)
            .unwrap_or(false);
        if is_old && size >= options.large_file_threshold {
            push_top(&mut old_files, item.clone(), 150);
        }

        let is_download = path_has_component(entry.path(), &["downloads"]);
        if is_download {
            push_top(&mut downloads, item.clone(), 200);
        }

        let is_cache = path_has_component(entry.path(), &["cache", ".cache", "caches", "thumbnails"]);
        let is_temp = path_has_component(entry.path(), &["temp", "tmp"]);
        let is_installer = matches!(item.extension.as_str(), "exe" | "msi" | "dmg" | "pkg" | "deb" | "rpm" | "appimage")
            && is_download
            && modified.map(|m| now.saturating_sub(m) >= 30 * 86_400).unwrap_or(false);

        if size > 0 && (is_cache || is_temp || is_installer) {
            let (reason, note) = if is_cache {
                ("Cache", "Located inside a cache directory. Review before removing.")
            } else if is_temp {
                ("Temporary", "Located inside a temporary directory. Review before removing.")
            } else {
                ("Installer", "Older installer found in Downloads.")
            };
            cleanup_candidates.push(CleanupCandidate {
                file: item.clone(),
                reason: reason.to_string(),
                note: note.to_string(),
            });
            if cleanup_candidates.len() > 400 {
                cleanup_candidates.sort_unstable_by(|a, b| b.file.size.cmp(&a.file.size));
                cleanup_candidates.truncate(200);
            }
        }

        if total_files % 250 == 0 {
            emit_progress(
                &app,
                ScanProgress {
                    phase: "walking".to_string(),
                    files: total_files,
                    bytes: total_size,
                    current_path: item.path,
                    groups_done: 0,
                    groups_total: 0,
                },
            );
        }
    }

    largest.sort_unstable_by(|a, b| b.size.cmp(&a.size));
    largest.truncate(100);
    old_files.sort_unstable_by(|a, b| b.size.cmp(&a.size));
    old_files.truncate(150);
    downloads.sort_unstable_by(|a, b| b.size.cmp(&a.size));
    downloads.truncate(200);
    cleanup_candidates.sort_unstable_by(|a, b| b.file.size.cmp(&a.file.size));
    cleanup_candidates.truncate(200);

    let candidate_groups: Vec<(u64, Vec<FileItem>)> = duplicate_candidates
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .collect();
    let groups_total = candidate_groups.len() as u64;
    let mut duplicates = Vec::new();

    for (group_index, (size, candidates)) in candidate_groups.into_iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            return Err("Scan cancelled.".to_string());
        }

        emit_progress(
            &app,
            ScanProgress {
                phase: "hashing".to_string(),
                files: total_files,
                bytes: total_size,
                current_path: candidates.first().map(|f| f.path.clone()).unwrap_or_default(),
                groups_done: group_index as u64,
                groups_total,
            },
        );

        let mut quick_groups: HashMap<String, Vec<FileItem>> = HashMap::new();
        for item in candidates {
            match quick_hash_file(Path::new(&item.path), item.size) {
                Ok(hash) => quick_groups.entry(hash).or_default().push(item),
                Err(_) => skipped += 1,
            }
        }

        for quick_matches in quick_groups.into_values().filter(|files| files.len() > 1) {
            let mut full_groups: HashMap<String, Vec<FileItem>> = HashMap::new();
            for item in quick_matches {
                match hash_with_cache(&item, &hash_cache) {
                    Ok(hash) => full_groups.entry(hash).or_default().push(item),
                    Err(_) => skipped += 1,
                }
            }
            for mut files in full_groups.into_values().filter(|files| files.len() > 1) {
                files.sort_by(|a, b| a.path.cmp(&b.path));
                let wasted = size.saturating_mul((files.len() - 1) as u64);
                duplicates.push(DuplicateGroup { size, wasted, files });
            }
        }
    }

    duplicates.sort_unstable_by(|a, b| b.wasted.cmp(&a.wasted));
    duplicates.truncate(150);
    let duplicate_waste = duplicates
        .iter()
        .fold(0_u64, |sum, group| sum.saturating_add(group.wasted));

    let mut category_list: Vec<CategoryBreakdown> = categories
        .into_iter()
        .map(|(category, (size, files))| CategoryBreakdown { category, size, files })
        .collect();
    category_list.sort_unstable_by(|a, b| b.size.cmp(&a.size));

    let mut top_folders: Vec<FolderBreakdown> = folders
        .into_iter()
        .map(|(path, (name, size, files))| FolderBreakdown { path, name, size, files })
        .collect();
    top_folders.sort_unstable_by(|a, b| b.size.cmp(&a.size));
    top_folders.truncate(12);

    let mut reviewable_paths: HashMap<String, u64> = HashMap::new();
    for group in &duplicates {
        for file in group.files.iter().skip(1) {
            reviewable_paths.insert(file.path.clone(), file.size);
        }
    }
    for candidate in &cleanup_candidates {
        reviewable_paths.insert(candidate.file.path.clone(), candidate.file.size);
    }
    let reviewable_bytes = reviewable_paths
        .values()
        .fold(0_u64, |sum, size| sum.saturating_add(*size));

    emit_progress(
        &app,
        ScanProgress {
            phase: "finishing".to_string(),
            files: total_files,
            bytes: total_size,
            current_path: root.to_string_lossy().into_owned(),
            groups_done: groups_total,
            groups_total,
        },
    );

    Ok(ScanResult {
        root: root.to_string_lossy().into_owned(),
        total_size,
        total_files,
        duration_ms: started.elapsed().as_millis(),
        categories: category_list,
        top_folders,
        largest,
        duplicates,
        duplicate_waste,
        old_files,
        downloads,
        cleanup_candidates,
        reviewable_bytes,
        skipped,
        drive: drive_info_for(&root),
    })
}

fn move_to_trash_blocking(paths: Vec<String>) -> TrashResult {
    let mut moved = 0;
    let mut failed = Vec::new();
    for path in paths {
        let value = PathBuf::from(&path);
        if !value.exists() || !value.is_file() {
            failed.push(path);
            continue;
        }
        match trash::delete(&value) {
            Ok(()) => moved += 1,
            Err(_) => failed.push(path),
        }
    }
    TrashResult { moved, failed }
}

#[tauri::command]
fn list_roots() -> Vec<DriveInfo> {
    #[cfg(target_os = "windows")]
    {
        let mut drives = Vec::new();
        for letter in b'C'..=b'Z' {
            let path = format!("{}:\\", letter as char);
            let root = PathBuf::from(&path);
            if root.exists() {
                let total_space = fs2::total_space(&root).unwrap_or(0);
                let available_space = fs2::available_space(&root).unwrap_or(0);
                drives.push(DriveInfo {
                    path: path.clone(),
                    label: format!("Local Disk ({}:)", letter as char),
                    total_space,
                    available_space,
                });
            }
        }
        drives
    }

    #[cfg(not(target_os = "windows"))]
    {
        let root = PathBuf::from("/");
        vec![DriveInfo {
            path: "/".to_string(),
            label: "Root filesystem".to_string(),
            total_space: fs2::total_space(&root).unwrap_or(0),
            available_space: fs2::available_space(&root).unwrap_or(0),
        }]
    }
}

#[tauri::command]
async fn scan_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: ScanOptions,
) -> Result<ScanResult, String> {
    let cancel = state.cancel.clone();
    let cache = state.hash_cache.clone();
    tauri::async_runtime::spawn_blocking(move || {
        scan_folder_blocking(path, options, app, cancel, cache)
    })
    .await
    .map_err(|error| format!("Scan worker failed: {error}"))?
}

#[tauri::command]
fn cancel_scan(state: State<'_, AppState>) {
    state.cancel.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn move_to_trash(paths: Vec<String>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || move_to_trash_blocking(paths))
        .await
        .map_err(|error| format!("Trash worker failed: {error}"))
}

#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let value = PathBuf::from(&path);
    if !value.exists() {
        return Err("The file no longer exists.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", value.to_string_lossy()))
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&value)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = value.parent().unwrap_or_else(|| Path::new("/"));
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{category_for, path_has_component};
    use std::path::Path;

    #[test]
    fn categorizes_common_extensions() {
        assert_eq!(category_for("mp4"), "Video");
        assert_eq!(category_for("png"), "Images");
        assert_eq!(category_for("pdf"), "Documents");
        assert_eq!(category_for("zip"), "Archives");
        assert_eq!(category_for("unknown"), "Other");
    }

    #[test]
    fn detects_special_directories_case_insensitively() {
        assert!(path_has_component(Path::new("C:/Users/Alex/Downloads/file.zip"), &["downloads"]));
        assert!(path_has_component(Path::new("/home/alex/.cache/item"), &[".cache"]));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_roots,
            scan_folder,
            cancel_scan,
            move_to_trash,
            reveal_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CleanMyFiles");
}
