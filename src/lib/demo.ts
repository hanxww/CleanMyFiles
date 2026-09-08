import type { ScanResult } from "../types";

const now = Math.floor(Date.now() / 1000);
const f = (name: string, path: string, size: number, category: string, extension: string, days = 20) => ({
  name, path, size, category, extension, modified: now - days * 86400,
});

export const demoScan: ScanResult = {
  root: "C:\\",
  totalSize: 712_400_000_000,
  totalFiles: 284_319,
  durationMs: 18_430,
  categories: [
    { category: "Video", size: 218_200_000_000, files: 1147 },
    { category: "Applications", size: 141_600_000_000, files: 3260 },
    { category: "Images", size: 96_300_000_000, files: 57_410 },
    { category: "Archives", size: 84_800_000_000, files: 3821 },
    { category: "Documents", size: 48_200_000_000, files: 35_810 },
    { category: "Audio", size: 29_100_000_000, files: 8320 },
    { category: "Code", size: 21_700_000_000, files: 94_011 },
    { category: "Other", size: 72_500_000_000, files: 80_540 },
  ],
  topFolders: [
    { name: "Users", path: "C:\\Users", size: 312_000_000_000, files: 151_000 },
    { name: "Program Files", path: "C:\\Program Files", size: 168_000_000_000, files: 42_000 },
    { name: "Windows", path: "C:\\Windows", size: 98_000_000_000, files: 75_000 },
    { name: "Games", path: "C:\\Games", size: 88_000_000_000, files: 4100 },
    { name: "Other", path: "C:\\Other", size: 46_400_000_000, files: 12_219 },
  ],
  largest: [
    f("screen-recording-4k.mp4", "C:\\Users\\Alex\\Videos\\screen-recording-4k.mp4", 18_400_000_000, "Video", "mp4", 380),
    f("archive-2024.zip", "C:\\Users\\Alex\\Downloads\\archive-2024.zip", 11_200_000_000, "Archives", "zip", 510),
    f("ubuntu.iso", "C:\\Users\\Alex\\Downloads\\ubuntu.iso", 6_300_000_000, "Disk images", "iso", 230),
    f("camera-export.mov", "C:\\Users\\Alex\\Videos\\camera-export.mov", 5_850_000_000, "Video", "mov", 140),
  ],
  duplicates: [
    {
      size: 2_760_000_000,
      wasted: 5_520_000_000,
      files: [
        f("project-final.zip", "C:\\Users\\Alex\\Documents\\project-final.zip", 2_760_000_000, "Archives", "zip", 85),
        f("project-final (1).zip", "C:\\Users\\Alex\\Downloads\\project-final (1).zip", 2_760_000_000, "Archives", "zip", 82),
        f("project-final-copy.zip", "C:\\Users\\Alex\\Desktop\\project-final-copy.zip", 2_760_000_000, "Archives", "zip", 80),
      ],
    },
  ],
  duplicateWaste: 5_520_000_000,
  oldFiles: [
    f("screen-recording-4k.mp4", "C:\\Users\\Alex\\Videos\\screen-recording-4k.mp4", 18_400_000_000, "Video", "mp4", 380),
    f("archive-2024.zip", "C:\\Users\\Alex\\Downloads\\archive-2024.zip", 11_200_000_000, "Archives", "zip", 510),
  ],
  downloads: [
    f("archive-2024.zip", "C:\\Users\\Alex\\Downloads\\archive-2024.zip", 11_200_000_000, "Archives", "zip", 510),
    f("ubuntu.iso", "C:\\Users\\Alex\\Downloads\\ubuntu.iso", 6_300_000_000, "Disk images", "iso", 230),
    f("setup-old.exe", "C:\\Users\\Alex\\Downloads\\setup-old.exe", 1_180_000_000, "Applications", "exe", 120),
  ],
  cleanupCandidates: [
    { file: f("browser-cache.bin", "C:\\Users\\Alex\\AppData\\Local\\Browser\\Cache\\browser-cache.bin", 3_500_000_000, "Other", "bin", 5), reason: "Cache", note: "Located inside a cache directory. Review before removing." },
    { file: f("setup-old.exe", "C:\\Users\\Alex\\Downloads\\setup-old.exe", 1_180_000_000, "Applications", "exe", 120), reason: "Installer", note: "Older installer in Downloads." },
  ],
  reviewableBytes: 10_200_000_000,
  skipped: 132,
  drive: { path: "C:\\", label: "Local Disk (C:)", totalSpace: 1_000_000_000_000, availableSpace: 287_600_000_000 },
};
