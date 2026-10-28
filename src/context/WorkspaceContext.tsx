import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  CodeProject,
  SupportedLanguage,
} from '../types';
import {
  getStoredProjects,
  saveStoredProjects,
  LANGUAGE_META,
} from '../services/storage';

export interface VfsFile {
  id: string;
  name: string;
  path: string;
  folder: string;
  language: SupportedLanguage;
  content: string;
  headContent: string;
  isModified: boolean;
  isStaged: boolean;
  isBinaryExe?: boolean;
  lastCompiledAt?: string;
}

interface FileCheckpoint {
  id: string;
  fileId: string;
  label: string;
  timestamp: string;
  content: string;
}

export interface GitCommitRecord {
  hash: string;
  message: string;
  timestamp: string;
  author: string;
  filesChanged: number;
}

interface WorkspaceContextValue {
  files: VfsFile[];
  openTabIds: string[];
  activeFileId: string;
  activeFile: VfsFile;
  openFile: (id: string) => void;
  closeTab: (id: string) => void;
  updateFileContent: (id: string, newContent: string) => void;
  createFile: (
    folder: string,
    fileName: string,
    language?: SupportedLanguage,
    initialContent?: string
  ) => string;
  upsertFileByPath: (
    folder: string,
    fileName: string,
    language: SupportedLanguage,
    content: string
  ) => string;
  renameFile: (id: string, newName: string) => void;
  deleteFile: (id: string) => void;
  compileSourceToExe: (
    sourceFileId: string,
    executionLogs?: string[],
    durationMs?: number
  ) => VfsFile | null;
  toggleStageFile: (id: string) => void;
  discardFileChanges: (id: string) => void;
  commitStagedChanges: (message: string) => boolean;
  checkpoints: FileCheckpoint[];
  saveFileCheckpoint: (fileId: string, label?: string) => void;
  restoreFileCheckpoint: (checkpointId: string) => boolean;
  importWorkspaceBundle: (jsonStr: string) => boolean;
  resetWorkspaceToDefaults: () => void;
  commits: GitCommitRecord[];
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  resetToLanguageStarter: (lang?: SupportedLanguage) => void;
  projects: CodeProject[];
  saveCurrentAsProject: (title?: string, notes?: string) => void;
  loadProjectIntoWorkspace: (project: CodeProject) => void;
  deleteProject: (id: string) => void;
}

const VFS_STORAGE_KEY = 'codepilot_vfs_files_v10_complete';
const COMMITS_STORAGE_KEY = 'codepilot_vfs_commits_v10';
const CHECKPOINTS_STORAGE_KEY = 'codepilot_vfs_checkpoints_v10';

export function buildExeBinaryContent(
  sourceFileName: string,
  sourceCode: string,
  logs: string[] = ['Countdown: 5', 'Countdown: 4', 'Blast off!'],
  durationMs: number = 0.38
): string {
  const exeName = sourceFileName.replace(/\.(c|cpp|cc|cxx)$/i, '') + '.exe';
  const timestamp = new Date().toLocaleTimeString();

  return `// ============================================================================
// ⚙️ PE64 / ELF EXECUTABLE BINARY ARTIFACT: ${exeName}
// Compiler: GCC 14.2.0 (x86_64-w64-mingw32 / WebAssembly Sandbox)
// Source:   ${sourceFileName}
// Built:    ${timestamp}  |  Execution Time: ${durationMs}ms
// ============================================================================

/* [LAST EXECUTION STDOUT]
${logs.length > 0 ? logs.map((l) => '   > ' + l).join('\n') : '   > (No stdout output)'}
*/
`;
}

const DEFAULT_MAIN_C = `#include <stdio.h>

int main() {
    int count = 5;
    
    while (count > 0) {
        printf("Countdown: %d\\n", count);
        count--;
    }
    
    printf("Blast off!\\n");
    return 0;
}`;

const DEFAULT_PYTHON_SCRIPT = `count = 5

while count > 0:
    print("Python Countdown:", count)
    count -= 1

print("Python Execution Complete!")
`;

const DEFAULT_TS_SCRIPT = `let count = 5;

while (count > 0) {
  console.log("TypeScript Countdown:", count);
  count--;
}

console.log("TypeScript Execution Complete!");
`;

const DEFAULT_VFS_FILES: VfsFile[] = [
  {
    id: 'file-main-c',
    name: 'main.c',
    path: 'c-workspace/main.c',
    folder: 'c-workspace',
    language: 'cpp',
    content: DEFAULT_MAIN_C,
    headContent: DEFAULT_MAIN_C,
    isModified: false,
    isStaged: false,
  },
  {
    id: 'file-main-exe',
    name: 'main.exe',
    path: 'c-workspace/main.exe',
    folder: 'c-workspace',
    language: 'cpp',
    content: buildExeBinaryContent('main.c', DEFAULT_MAIN_C),
    headContent: buildExeBinaryContent('main.c', DEFAULT_MAIN_C),
    isModified: false,
    isStaged: false,
    isBinaryExe: true,
    lastCompiledAt: 'Ready (GCC 14.2)',
  },
  {
    id: 'file-solver-py',
    name: 'solver.py',
    path: 'python-scripts/solver.py',
    folder: 'python-scripts',
    language: 'python',
    content: DEFAULT_PYTHON_SCRIPT,
    headContent: DEFAULT_PYTHON_SCRIPT,
    isModified: false,
    isStaged: false,
  },
  {
    id: 'file-index-ts',
    name: 'index.ts',
    path: 'web-app/index.ts',
    folder: 'web-app',
    language: 'typescript',
    content: DEFAULT_TS_SCRIPT,
    headContent: DEFAULT_TS_SCRIPT,
    isModified: false,
    isStaged: false,
  },
];

const DEFAULT_COMMITS: GitCommitRecord[] = [
  {
    hash: 'a8f4c21',
    message: 'feat: initialize polyglot workspace with dynamic language explorers',
    timestamp: '1h ago',
    author: 'Developer',
    filesChanged: 4,
  },
];

export function detectLanguageFromFileName(
  fileName: string,
  fallback: SupportedLanguage = 'cpp'
): SupportedLanguage {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.c') || lower.endsWith('.cpp') || lower.endsWith('.h') || lower.endsWith('.exe')) {
    return 'cpp';
  }
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.java')) return 'java';
  return fallback;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [files, setFiles] = useState<VfsFile[]>(() => {
    try {
      const saved = localStorage.getItem(VFS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_VFS_FILES;
  });

  const [openTabIds, setOpenTabIds] = useState<string[]>(() => [
    'file-main-c',
    'file-solver-py',
    'file-index-ts',
  ]);
  const [activeFileId, setActiveFileId] = useState<string>('file-main-c');

  const [commits, setCommits] = useState<GitCommitRecord[]>(() => {
    try {
      const raw = localStorage.getItem(COMMITS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_COMMITS;
    } catch {
      return DEFAULT_COMMITS;
    }
  });

  const [checkpoints, setCheckpoints] = useState<FileCheckpoint[]>([]);
  const [projects, setProjects] = useState<CodeProject[]>(getStoredProjects);

  useEffect(() => {
    try {
      localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(files));
    } catch {
      // ignore
    }
  }, [files]);

  const activeFile =
    files.find((f) => f.id === activeFileId) || files[0] || DEFAULT_VFS_FILES[0];

  const [language, setLanguageState] = useState<SupportedLanguage>(
    activeFile.language
  );

  useEffect(() => {
    if (activeFile && activeFile.language !== language) {
      setLanguageState(activeFile.language);
    }
  }, [activeFile, language]);

  const openFile = useCallback((id: string) => {
    setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveFileId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setOpenTabIds((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (next.length === 0) {
          const fallbackId = files[0]?.id || 'file-main-c';
          setActiveFileId(fallbackId);
          return [fallbackId];
        }
        if (id === activeFileId) {
          setActiveFileId(next[next.length - 1]);
        }
        return next;
      });
    },
    [activeFileId, files]
  );

  const updateFileContent = useCallback((id: string, newContent: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              content: newContent,
              isModified: newContent !== f.headContent,
            }
          : f
      )
    );
  }, []);

  const createFile = useCallback(
    (
      folder: string,
      fileName: string,
      lang?: SupportedLanguage,
      initialContent?: string
    ): string => {
      const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'c-workspace';
      const cleanName = fileName.trim();
      if (!cleanName) return '';
      const fullPath = `${cleanFolder}/${cleanName}`;
      const detectedLang = detectLanguageFromFileName(
        cleanName,
        lang || language
      );
      const isExe = cleanName.toLowerCase().endsWith('.exe');

      const existing = files.find((f) => f.path === fullPath);
      if (existing) {
        openFile(existing.id);
        return existing.id;
      }

      const defaultBody =
        initialContent !== undefined
          ? initialContent
          : isExe
          ? buildExeBinaryContent(cleanName.replace(/\.exe$/i, '.c'), DEFAULT_MAIN_C)
          : LANGUAGE_META[detectedLang]?.defaultCode || '// New file buffer\n';

      const newId = `file-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      const newFile: VfsFile = {
        id: newId,
        name: cleanName,
        path: fullPath,
        folder: cleanFolder,
        language: detectedLang,
        content: defaultBody,
        headContent: defaultBody,
        isModified: false,
        isStaged: false,
        isBinaryExe: isExe,
        lastCompiledAt: isExe ? new Date().toLocaleTimeString() : undefined,
      };

      setFiles((prev) => [...prev, newFile]);
      setOpenTabIds((prev) => [...prev, newId]);
      setActiveFileId(newId);
      return newId;
    },
    [files, language, openFile]
  );

  const upsertFileByPath = useCallback(
    (
      folder: string,
      fileName: string,
      lang: SupportedLanguage,
      content: string
    ): string => {
      const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'c-workspace';
      const fullPath = `${cleanFolder}/${fileName}`;
      const existing = files.find((f) => f.path === fullPath);

      if (existing) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === existing.id
              ? {
                  ...f,
                  content,
                  isModified: content !== f.headContent,
                }
              : f
          )
        );
        openFile(existing.id);
        return existing.id;
      }

      return createFile(cleanFolder, fileName, lang, content);
    },
    [createFile, files, openFile]
  );

  const compileSourceToExe = useCallback(
    (
      sourceFileId: string,
      executionLogs: string[] = [],
      durationMs: number = 0.35
    ): VfsFile | null => {
      const srcFile = files.find((f) => f.id === sourceFileId);
      if (!srcFile) return null;

      const isCOrCpp = /\.(c|cpp|cc|cxx)$/i.test(srcFile.name);
      if (!isCOrCpp) return null;

      const exeName = srcFile.name.replace(/\.(c|cpp|cc|cxx)$/i, '') + '.exe';
      const exePath = `${srcFile.folder}/${exeName}`;
      const exeBody = buildExeBinaryContent(
        srcFile.name,
        srcFile.content,
        executionLogs,
        durationMs
      );
      const nowTime = new Date().toLocaleTimeString();

      let resultExe: VfsFile | null = null;

      setFiles((prev) => {
        const existingExe = prev.find((f) => f.path === exePath);
        if (existingExe) {
          const updated: VfsFile = {
            ...existingExe,
            content: exeBody,
            headContent: exeBody,
            isBinaryExe: true,
            lastCompiledAt: `Compiled ${nowTime}`,
          };
          resultExe = updated;
          return prev.map((f) => (f.id === existingExe.id ? updated : f));
        } else {
          const created: VfsFile = {
            id: `file-exe-${Date.now()}`,
            name: exeName,
            path: exePath,
            folder: srcFile.folder,
            language: 'cpp',
            content: exeBody,
            headContent: exeBody,
            isModified: false,
            isStaged: false,
            isBinaryExe: true,
            lastCompiledAt: `Compiled ${nowTime}`,
          };
          resultExe = created;
          return [...prev, created];
        }
      });

      return resultExe;
    },
    [files]
  );

  const renameFile = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const folderPrefix = f.path.includes('/')
          ? f.path.split('/')[0]
          : f.folder || 'c-workspace';
        return {
          ...f,
          name: trimmed,
          path: `${folderPrefix}/${trimmed}`,
          language: detectLanguageFromFileName(trimmed, f.language),
          isBinaryExe: trimmed.toLowerCase().endsWith('.exe'),
        };
      })
    );
  }, []);

  const deleteFile = useCallback(
    (id: string) => {
      if (files.length <= 1) return;
      setFiles((prev) => prev.filter((f) => f.id !== id));
      closeTab(id);
    },
    [closeTab, files.length]
  );

  const toggleStageFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isStaged: !f.isStaged } : f))
    );
  }, []);

  const discardFileChanges = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, content: f.headContent, isModified: false, isStaged: false }
          : f
      )
    );
  }, []);

  const commitStagedChanges = useCallback(
    (message: string): boolean => {
      const modified = files.filter((f) => f.isModified);
      if (modified.length === 0) return false;

      const commitMsg = message.trim() || 'chore: update workspace files';
      const newCommit: GitCommitRecord = {
        hash: Math.random().toString(16).slice(2, 9),
        message: commitMsg,
        timestamp: 'Just now',
        author: 'Developer',
        filesChanged: modified.length,
      };

      setCommits((prev) => [newCommit, ...prev]);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          headContent: f.content,
          isModified: false,
          isStaged: false,
        }))
      );
      return true;
    },
    [files]
  );

  const saveFileCheckpoint = useCallback(
    (fileId: string, label?: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;
      const cp: FileCheckpoint = {
        id: `cp-${Date.now()}`,
        fileId: target.id,
        label: label || `${target.name} (${new Date().toLocaleTimeString()})`,
        timestamp: new Date().toLocaleTimeString(),
        content: target.content,
      };
      setCheckpoints((prev) => [cp, ...prev.slice(0, 19)]);
    },
    [files]
  );

  const restoreFileCheckpoint = useCallback(
    (checkpointId: string): boolean => {
      const cp = checkpoints.find((c) => c.id === checkpointId);
      if (!cp) return false;
      updateFileContent(cp.fileId, cp.content);
      return true;
    },
    [checkpoints, updateFileContent]
  );

  const importWorkspaceBundle = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        setFiles(parsed.files);
        setOpenTabIds([parsed.files[0].id]);
        setActiveFileId(parsed.files[0].id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const resetWorkspaceToDefaults = useCallback(() => {
    localStorage.removeItem(VFS_STORAGE_KEY);
    setFiles(DEFAULT_VFS_FILES);
    setOpenTabIds(['file-main-c']);
    setActiveFileId('file-main-c');
  }, []);

  // DYNAMIC LANGUAGE SWITCHER: Switches or creates matching file explorer for selected language
  const setLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      setLanguageState(newLang);
      const matchingFile = files.find((f) => f.language === newLang);
      if (matchingFile) {
        openFile(matchingFile.id);
      } else {
        const folderName =
          newLang === 'python'
            ? 'python-scripts'
            : newLang === 'typescript' || newLang === 'javascript'
            ? 'web-app'
            : 'c-workspace';
        const ext = LANGUAGE_META[newLang]?.extension || 'txt';
        createFile(folderName, `main.${ext}`, newLang);
      }
    },
    [createFile, files, openFile]
  );

  const resetToLanguageStarter = useCallback(
    (lang?: SupportedLanguage) => {
      const targetLang = lang || activeFile.language;
      const starter = LANGUAGE_META[targetLang]?.defaultCode || '';
      updateFileContent(activeFile.id, starter);
    },
    [activeFile.id, activeFile.language, updateFileContent]
  );

  const saveCurrentAsProject = useCallback(
    (title?: string, notes?: string) => {
      const newProj: CodeProject = {
        id: `proj-${Date.now()}`,
        title: title || activeFile.name,
        language: activeFile.language,
        code: activeFile.content,
        notes: notes || `Snapshot saved at ${new Date().toLocaleTimeString()}`,
        tags: [activeFile.folder, activeFile.name],
        updatedAt: new Date().toISOString(),
      };
      const updated = [newProj, ...projects];
      setProjects(updated);
      saveStoredProjects(updated);
    },
    [activeFile, projects]
  );

  const loadProjectIntoWorkspace = useCallback(
    (project: CodeProject) => {
      const folderName =
        project.language === 'python'
          ? 'python-scripts'
          : project.language === 'cpp'
          ? 'c-workspace'
          : 'web-app';
      const ext = LANGUAGE_META[project.language]?.extension || 'txt';
      upsertFileByPath(folderName, `script.${ext}`, project.language, project.code);
    },
    [upsertFileByPath]
  );

  const deleteProject = useCallback(
    (id: string) => {
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      saveStoredProjects(updated);
    },
    [projects]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        files,
        openTabIds,
        activeFileId,
        activeFile,
        openFile,
        closeTab,
        updateFileContent,
        createFile,
        upsertFileByPath,
        renameFile,
        deleteFile,
        compileSourceToExe,
        toggleStageFile,
        discardFileChanges,
        commitStagedChanges,
        checkpoints,
        saveFileCheckpoint,
        restoreFileCheckpoint,
        importWorkspaceBundle,
        resetWorkspaceToDefaults,
        commits,
        language,
        setLanguage,
        resetToLanguageStarter,
        projects,
        saveCurrentAsProject,
        loadProjectIntoWorkspace,
        deleteProject,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
};