export type FileItem = {
  path: string;
  name: string;
  size: number;
  modified: number | null;
  category: string;
  extension: string;
};

export type CategoryBreakdown = {
  category: string;
  size: number;
  files: number;
};

export type FolderBreakdown = {
  path: string;
  name: string;
  size: number;
  files: number;
};

export type DuplicateGroup = {
  size: number;
  wasted: number;
  files: FileItem[];
};

export type CleanupCandidate = {
  file: FileItem;
  reason: "Cache" | "Temporary" | "Installer";
  note: string;
};

export type DriveInfo = {
  path: string;
  label: string;
  totalSpace: number;
  availableSpace: number;
};

export type ScanProgress = {
  phase: "walking" | "hashing" | "finishing";
  files: number;
  bytes: number;
  currentPath: string;
  groupsDone: number;
  groupsTotal: number;
};

export type ScanResult = {
  root: string;
  totalSize: number;
  totalFiles: number;
  durationMs: number;
  categories: CategoryBreakdown[];
  topFolders: FolderBreakdown[];
  largest: FileItem[];
  duplicates: DuplicateGroup[];
  duplicateWaste: number;
  oldFiles: FileItem[];
  downloads: FileItem[];
  cleanupCandidates: CleanupCandidate[];
  reviewableBytes: number;
  skipped: number;
  drive: DriveInfo | null;
};

export type ScanOptions = {
  minimumDuplicateSize: number;
  largeFileThreshold: number;
  oldFileDays: number;
  ignoredNames: string[];
};
