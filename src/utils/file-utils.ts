import {
  access,
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  copyFile,
  unlink,
  chmod
} from 'fs/promises';
import { join, dirname, basename, extname, resolve, relative } from 'path';
import { homedir } from 'os';

/**
 * File operation result interface
 */
export interface FileOperationResult {
  success: boolean;
  path: string;
  message?: string;
  error?: Error;
}

/**
 * Directory scan result interface
 */
export interface DirectoryInfo {
  path: string;
  exists: boolean;
  files: string[];
  directories: string[];
  totalSize: number;
}

/**
 * File backup options
 */
export interface BackupOptions {
  suffix?: string;
  preserveTimestamp?: boolean;
  createBackupDir?: boolean;
}

/**
 * Safely checks if a file or directory exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<FileOperationResult> {
  try {
    const exists = await pathExists(dirPath);

    if (!exists) {
      await mkdir(dirPath, { recursive: true });
      return {
        success: true,
        path: dirPath,
        message: 'Directory created successfully'
      };
    }

    return {
      success: true,
      path: dirPath,
      message: 'Directory already exists'
    };
  } catch (error) {
    return {
      success: false,
      path: dirPath,
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to create directory'
    };
  }
}

/**
 * Safely reads a file with error handling
 */
export async function safeReadFile(
  filePath: string,
  encoding: BufferEncoding = 'utf8'
): Promise<{ success: boolean; content?: string; error?: Error }> {
  try {
    const content = await readFile(filePath, encoding);
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Safely writes a file with error handling and backup
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  options: {
    backup?: boolean;
    mode?: string | number;
    encoding?: BufferEncoding;
  } = {}
): Promise<FileOperationResult> {
  const { backup = false, mode, encoding = 'utf8' } = options;

  try {
    // Ensure parent directory exists
    const parentDir = dirname(filePath);
    await ensureDirectory(parentDir);

    // Create backup if requested and file exists
    if (backup && await pathExists(filePath)) {
      const backupResult = await createBackup(filePath);
      if (!backupResult.success) {
        return backupResult;
      }
    }

    // Write the file
    await writeFile(filePath, content, encoding);

    // Set permissions if specified
    if (mode !== undefined) {
      await chmod(filePath, mode);
    }

    return {
      success: true,
      path: filePath,
      message: 'File written successfully'
    };
  } catch (error) {
    return {
      success: false,
      path: filePath,
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to write file'
    };
  }
}

/**
 * Creates a backup of an existing file
 */
export async function createBackup(
  filePath: string,
  options: BackupOptions = {}
): Promise<FileOperationResult> {
  const {
    suffix = '.backup',
    preserveTimestamp = true,
    createBackupDir = false
  } = options;

  try {
    const exists = await pathExists(filePath);
    if (!exists) {
      return {
        success: false,
        path: filePath,
        message: 'Source file does not exist'
      };
    }

    let backupPath: string;

    if (createBackupDir) {
      const dir = dirname(filePath);
      const name = basename(filePath);
      const backupDir = join(dir, '.backups');
      await ensureDirectory(backupDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = join(backupDir, `${name}.${timestamp}${suffix}`);
    } else {
      backupPath = `${filePath}${suffix}`;
    }

    await copyFile(filePath, backupPath);

    if (preserveTimestamp) {
      const stats = await stat(filePath);
      const { utimes } = await import('fs/promises');
      await utimes(backupPath, stats.atime, stats.mtime);
    }

    return {
      success: true,
      path: backupPath,
      message: 'Backup created successfully'
    };
  } catch (error) {
    return {
      success: false,
      path: filePath,
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to create backup'
    };
  }
}

/**
 * Safely deletes a file or directory
 */
export async function safeDelete(path: string): Promise<FileOperationResult> {
  try {
    const exists = await pathExists(path);
    if (!exists) {
      return {
        success: true,
        path,
        message: 'Path does not exist (nothing to delete)'
      };
    }

    const stats = await stat(path);

    if (stats.isDirectory()) {
      const { rmdir } = await import('fs/promises');
      await rmdir(path, { recursive: true });
    } else {
      await unlink(path);
    }

    return {
      success: true,
      path,
      message: stats.isDirectory() ? 'Directory deleted successfully' : 'File deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      path,
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to delete path'
    };
  }
}

/**
 * Scans a directory and returns information about its contents
 */
export async function scanDirectory(dirPath: string): Promise<DirectoryInfo> {
  const result: DirectoryInfo = {
    path: dirPath,
    exists: false,
    files: [],
    directories: [],
    totalSize: 0
  };

  try {
    const exists = await pathExists(dirPath);
    if (!exists) {
      return result;
    }

    result.exists = true;
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        result.directories.push(entry);
      } else {
        result.files.push(entry);
        result.totalSize += stats.size;
      }
    }
  } catch (error) {
    // Return partial results even if some entries fail
  }

  return result;
}

/**
 * Finds files matching a pattern recursively
 */
export async function findFiles(
  searchDir: string,
  pattern: RegExp | string,
  options: {
    maxDepth?: number;
    includeDirectories?: boolean;
    followSymlinks?: boolean;
  } = {}
): Promise<string[]> {
  const { maxDepth = 10, includeDirectories = false, followSymlinks = false } = options;
  const results: string[] = [];
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  async function search(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        let stats = await stat(fullPath);

        // Handle symlinks
        if (stats.isSymbolicLink()) {
          if (!followSymlinks) continue;
          stats = await stat(fullPath); // Follow the symlink
        }

        if (stats.isDirectory()) {
          if (includeDirectories && regex.test(entry)) {
            results.push(fullPath);
          }
          await search(fullPath, depth + 1);
        } else if (regex.test(entry)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  await search(searchDir, 0);
  return results;
}

/**
 * Calculates directory size recursively
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Return 0 if directory can't be read
  }

  return totalSize;
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Resolves a path relative to home directory
 */
export function resolveHomePath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return resolve(path);
}

/**
 * Gets relative path between two absolute paths
 */
export function getRelativePath(from: string, to: string): string {
  return relative(from, to);
}

/**
 * Validates that a path is safe (no directory traversal)
 */
export function isSafePath(basePath: string, targetPath: string): boolean {
  const resolved = resolve(basePath, targetPath);
  const normalized = resolve(basePath);
  return resolved.startsWith(normalized);
}

/**
 * Gets file extension without the dot
 */
export function getFileExtension(filePath: string): string {
  return extname(filePath).slice(1).toLowerCase();
}

/**
 * Gets filename without extension
 */
export function getBasename(filePath: string): string {
  const ext = extname(filePath);
  return basename(filePath, ext);
}

/**
 * Checks if a path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Checks if a path is a file
 */
export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Creates a temporary file with unique name
 */
export async function createTempFile(
  content: string,
  options: {
    prefix?: string;
    suffix?: string;
    dir?: string;
    encoding?: BufferEncoding;
  } = {}
): Promise<FileOperationResult> {
  const { prefix = 'temp', suffix = '.tmp', dir, encoding = 'utf8' } = options;
  const tempDir = dir ?? join(homedir(), '.cache');

  try {
    await ensureDirectory(tempDir);

    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const tempPath = join(tempDir, `${prefix}-${timestamp}-${random}${suffix}`);

    await writeFile(tempPath, content, encoding);

    return {
      success: true,
      path: tempPath,
      message: 'Temporary file created successfully'
    };
  } catch (error) {
    return {
      success: false,
      path: tempDir,
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to create temporary file'
    };
  }
}

/**
 * Watches a file for changes (basic implementation)
 */
export function watchFile(
  filePath: string,
  callback: (eventType: string, filename: string | null) => void
): () => void {
  const { watchFile, unwatchFile } = require('fs');

  watchFile(filePath, (current: any, previous: any) => {
    if (current.mtime !== previous.mtime) {
      callback('change', basename(filePath));
    }
  });

  return () => unwatchFile(filePath);
}