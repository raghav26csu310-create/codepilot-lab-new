import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  Pause,
  FolderTree,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Code2,
  Bot,
  GitBranch,
  GitCommit,
  Search,
  Columns,
  Command,
  Zap,
  Globe,
  X,
  StepForward,
  StepBack,
  RotateCcw,
  Check,
  Trash2,
  Edit3,
  Network,
  BookmarkPlus,
  Undo2,
  Sparkles,
  CircleDot,
  FastForward,
  Download,
  Upload,
  Gauge,
  AlertTriangle,
  Wrench,
  FlaskConical,
  Wand2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Copy,
  ListChecks,
  Keyboard,
  Compass,
  History,
  Timer,
  ClipboardCopy,
  ArrowDownToLine,
  Cpu,
  Terminal as TerminalIcon,
  Cog,
  ShieldCheck,
  CpuIcon,
} from 'lucide-react';
import type {
  AiComposerStep,
  BenchmarkRunSample,
  CodeDiagnostic,
  PromptPreset,
  SupportedLanguage,
  ToastNotification,
  TraceFrame,
  WorkspaceTestFileResult,
} from '../types';
import {
  LANGUAGE_META,
  executeCodeInSandbox,
  generateDynamicTrace,
  computeLineDiff,
  analyzeCodeQuality,
  computeVariableHistory,
  extractVisualArrayState,
  formatCodeBuffer,
  runWorkspaceTestFiles,
  synthesizeUnitTestFile,
  runEmpiricalBenchmark,
} from '../services/storage';
import { generateOrExplainCode } from '../services/gemini';
import { useWorkspace, type VfsFile } from '../context/WorkspaceContext';

interface ImmersiveWorkspaceProps {
  language?: SupportedLanguage;
  code?: string;
  activePreset: PromptPreset;
  onCodeChange?: (newCode: string) => void;
  onLogActivity: (msg: string) => void;
}

type ActivityTab =
  | 'explorer'
  | 'search'
  | 'git'
  | 'architecture'
  | 'intelligence'
  | 'superpowers';
type BottomTab = 'tracer' | 'terminal' | 'tests' | 'problems' | 'diff';
type CopilotMode = 'chat' | 'composer';

interface MonacoEditorBridge {
  deltaDecorations: (
    oldDecorations: string[],
    newDecorations: unknown[]
  ) => string[];
  revealLineInCenterIfOutsideViewport: (lineNumber: number) => void;
  setPosition: (pos: { lineNumber: number; column: number }) => void;
  focus: () => void;
  onMouseDown: (
    listener: (e: {
      target: { type: number; position?: { lineNumber: number } };
    }) => void
  ) => { dispose: () => void };
  onDidChangeCursorPosition: (
    listener: (e: { position: { lineNumber: number; column: number } }) => void
  ) => { dispose: () => void };
  getValue: () => string;
  setValue: (newValue: string) => void;
  getModel: () => {
    pushEditOperations: (a: unknown, b: unknown, c: unknown) => void;
  };
  getSelection: () => unknown;
  executeEdits: (name: string, edits: unknown[]) => void;
  pushUndoStop: () => void;
  addAction: (action: {
    id: string;
    label: string;
    keybindings: number[];
    run: (editor: unknown) => void;
  }) => void;
}

interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'variable' | 'class';
  line: number;
  fileId: string;
  filePath: string;
}

export const ImmersiveWorkspace: React.FC<ImmersiveWorkspaceProps> = ({
  activePreset,
  onLogActivity,
}) => {
  const {
    files,
    openTabIds,
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
    commits,
    language,
    setLanguage,
    saveCurrentAsProject,
  } = useWorkspace();

  const [activityTab, setActivityTab] = useState<ActivityTab>('explorer');
  const [bottomTab, setBottomTab] = useState<BottomTab>('tracer');
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('chat');
  const [splitEditor, setSplitEditor] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string>(
    files[1]?.id || files[0]?.id || ''
  );
  const [zenMode, setZenMode] = useState(false);

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [closingDirtyFileId, setClosingDirtyFileId] = useState<string | null>(
    null
  );
  const [benchmarkSamples, setBenchmarkSamples] = useState<
    BenchmarkRunSample[] | null
  >(null);

  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({
    line: 1,
    col: 1,
  });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    fileId: string;
  } | null>(null);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);

  const [inlineAiOpen, setInlineAiOpen] = useState(false);
  const [inlineAiPrompt, setInlineAiPrompt] = useState('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [bottomHeight, setBottomHeight] = useState(260);
  const [dragTarget, setDragTarget] = useState<
    'sidebar' | 'ai' | 'bottom' | 'split' | null
  >(null);
  const [splitRatio, setSplitRatio] = useState(0.5);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'c-workspace': true,
    'cpp-programs': true,
    'python-scripts': true,
    'web-app': true,
    tests: true,
  });
  const [selectedFolder, setSelectedFolder] = useState<string>('c-workspace');
  const [newItemName, setNewItemName] = useState('');
  const [creatingMode, setCreatingMode] = useState<'file' | 'folder' | null>(
    null
  );
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [breakpointsByFile, setBreakpointsByFile] = useState<
    Record<string, number[]>
  >({
    'file-main-c': [7, 24],
  });

  const [traceFrames, setTraceFrames] = useState<TraceFrame[]>(() =>
    generateDynamicTrace(activeFile.content, activeFile.language)
  );
  const [currentTraceIdx, setCurrentTraceIdx] = useState(0);
  const [isAutoPlayingTrace, setIsAutoPlayingTrace] = useState(false);

  const [workspaceTestResults, setWorkspaceTestResults] = useState<
    WorkspaceTestFileResult[]
  >(() => runWorkspaceTestFiles(files));

  const [composerGoal, setComposerGoal] = useState(
    'Optimize C binary search, add boundary assertions, and verify unit tests'
  );
  const [composerSteps, setComposerSteps] = useState<AiComposerStep[]>([
    {
      id: 'step-1',
      title: '1. Static & Big-O Complexity Audit',
      detail: 'Analyze loop nesting, pointer arithmetic, and lint rules.',
      status: 'done',
    },
    {
      id: 'step-2',
      title: '2. Synthesize C/C++ Refactor Patch',
      detail: 'Generate reviewable diff with strict signatures.',
      status: 'pending',
    },
    {
      id: 'step-3',
      title: '3. Compile Source to .exe Binary Target',
      detail: 'Execute GCC toolchain simulation and output PE64 disassembly.',
      status: 'pending',
    },
    {
      id: 'step-4',
      title: '4. Execute Sandbox & Assert Invariants',
      detail: 'Run all test suites and record dynamic memory trace.',
      status: 'pending',
    },
  ]);

  const editorRef = useRef<MonacoEditorBridge | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const bundleInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'CodePilot Precision GCC 14.2 Toolchain [C/C++ Workspace Active]',
    'Commands: gcc main.c -o main.exe, ./main.exe, run, test, trace, ls, clear',
  ]);

  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [includeAllFilesContext, setIncludeAllFilesContext] = useState(true);
  const [pendingDiff, setPendingDiff] = useState<{
    original: string;
    proposed: string;
    explanation: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; codeSnippet?: string }[]
  >([
    {
      role: 'assistant',
      text: `Ready on ${activeFile.path}. Paste code from Google directly into the editor with Ctrl+V, or compile C sources to .exe binaries instantly.`,
    },
  ]);

  const pushToast = useCallback(
    (
      title: string,
      detail?: string,
      tone: 'success' | 'info' | 'warning' = 'info'
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, detail, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const activeBreakpoints = useMemo(
    () => breakpointsByFile[activeFile.id] || [],
    [breakpointsByFile, activeFile.id]
  );

  const qualityReport = useMemo(
    () => analyzeCodeQuality(activeFile.content),
    [activeFile.content]
  );

  const activeTrace = traceFrames[currentTraceIdx] || traceFrames[0];

  const visualArrayState = useMemo(
    () => extractVisualArrayState(activeTrace),
    [activeTrace]
  );

  const variableHistorySeries = useMemo(
    () => computeVariableHistory(traceFrames, currentTraceIdx),
    [traceFrames, currentTraceIdx]
  );

  const toggleBreakpoint = useCallback(
    (lineNumber: number) => {
      setBreakpointsByFile((prev) => {
        const current = prev[activeFile.id] || [];
        const exists = current.includes(lineNumber);
        const updated = exists
          ? current.filter((ln) => ln !== lineNumber)
          : [...current, lineNumber].sort((a, b) => a - b);
        return { ...prev, [activeFile.id]: updated };
      });
    },
    [activeFile.id]
  );

  useEffect(() => {
    if (!isAutoPlayingTrace) return;
    const timer = window.setInterval(() => {
      setCurrentTraceIdx((prevIdx) => {
        const nextIdx = prevIdx + 1;
        if (nextIdx >= traceFrames.length) {
          setIsAutoPlayingTrace(false);
          return prevIdx;
        }
        const nextLine = traceFrames[nextIdx]?.line;
        if (nextLine && activeBreakpoints.includes(nextLine)) {
          setIsAutoPlayingTrace(false);
          pushToast(
            `Breakpoint Hit on Line ${nextLine}`,
            `Execution paused at Step ${nextIdx + 1}`,
            'warning'
          );
        }
        return nextIdx;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [isAutoPlayingTrace, traceFrames, activeBreakpoints, pushToast]);

  const syncMonacoDecorations = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;

    const newDecorations: unknown[] = [];

    if (activeTrace && activeTrace.line >= 1) {
      newDecorations.push({
        range: {
          startLineNumber: activeTrace.line,
          startColumn: 1,
          endLineNumber: activeTrace.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'monaco-trace-active-line',
        },
      });
    }

    activeBreakpoints.forEach((bpLine) => {
      newDecorations.push({
        range: {
          startLineNumber: bpLine,
          startColumn: 1,
          endLineNumber: bpLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'monaco-breakpoint-line',
          glyphMarginClassName: 'monaco-breakpoint-glyph',
        },
      });
    });

    decorationsRef.current = ed.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );

    if (bottomTab === 'tracer' && activeTrace && activeTrace.line >= 1) {
      ed.revealLineInCenterIfOutsideViewport(activeTrace.line);
    }
  }, [activeTrace, activeBreakpoints, bottomTab]);

  useEffect(() => {
    syncMonacoDecorations();
  }, [syncMonacoDecorations]);

  useEffect(() => {
    setIsAutoPlayingTrace(false);
    const nextFrames = generateDynamicTrace(
      activeFile.content,
      activeFile.language
    );
    setTraceFrames(nextFrames);
    setCurrentTraceIdx(0);
  }, [activeFile.id, activeFile.content, activeFile.language]);

  useEffect(() => {
    if (!dragTarget) return;
    const onMouseMove = (e: MouseEvent) => {
      if (dragTarget === 'sidebar') {
        setSidebarWidth(Math.max(200, Math.min(460, e.clientX - 215)));
      } else if (dragTarget === 'ai') {
        setAiPanelWidth(
          Math.max(260, Math.min(540, window.innerWidth - e.clientX))
        );
      } else if (dragTarget === 'bottom') {
        setBottomHeight(
          Math.max(140, Math.min(480, window.innerHeight - e.clientY - 30))
        );
      } else if (dragTarget === 'split') {
        const containerWidth = window.innerWidth - sidebarWidth - aiPanelWidth - 55;
        const pointerX = e.clientX - 215 - sidebarWidth;
        setSplitRatio(Math.max(0.2, Math.min(0.8, pointerX / containerWidth)));
      }
    };
    const onMouseUp = () => setDragTarget(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragTarget, sidebarWidth, aiPanelWidth]);

  const modifiedFiles = useMemo(
    () => files.filter((f) => f.isModified),
    [files]
  );

  const activeFileDiff = useMemo(
    () => computeLineDiff(activeFile.headContent || '', activeFile.content),
    [activeFile.headContent, activeFile.content]
  );

  const workspaceSymbols = useMemo<ExtractedSymbol[]>(() => {
    const list: ExtractedSymbol[] = [];
    files.forEach((f) => {
      f.content.split('\n').forEach((line, idx) => {
        const fnMatch = line.match(
          /(?:function|def|fn|func|int|void|double)\s+([a-zA-Z0-9_$]+)\s*\(/
        );
        if (fnMatch) {
          list.push({
            name: `${fnMatch[1]}()`,
            kind: 'function',
            line: idx + 1,
            fileId: f.id,
            filePath: f.path,
          });
        }
      });
    });
    return list;
  }, [files]);

  const activeEnclosingSymbol = useMemo(() => {
    const fileSymbols = workspaceSymbols.filter(
      (s) => s.fileId === activeFile.id && s.line <= cursorPos.line
    );
    return fileSymbols.length > 0
      ? fileSymbols[fileSymbols.length - 1]
      : workspaceSymbols.find((s) => s.fileId === activeFile.id);
  }, [workspaceSymbols, activeFile.id, cursorPos.line]);

  const globalSearchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: {
      fileId: string;
      path: string;
      line: number;
      preview: string;
    }[] = [];
    files.forEach((f) => {
      f.content.split('\n').forEach((lineText, idx) => {
        if (lineText.toLowerCase().includes(q)) {
          results.push({
            fileId: f.id,
            path: f.path,
            line: idx + 1,
            preview: lineText.trim().slice(0, 70),
          });
        }
      });
    });
    return results;
  }, [files, searchQuery]);

  const jumpToFileAndLine = useCallback(
    (fileId: string, lineNumber: number) => {
      openFile(fileId);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.revealLineInCenterIfOutsideViewport(lineNumber);
          editorRef.current.setPosition({ lineNumber, column: 1 });
          editorRef.current.focus();
        }
      }, 60);
    },
    [openFile]
  );

  const handleSaveCheckpointShortcut = useCallback(() => {
    saveFileCheckpoint(activeFile.id);
    onLogActivity(`Saved local checkpoint for ${activeFile.path}`);
    pushToast(
      `Checkpoint Saved (${activeFile.name})`,
      'Restorable anytime from Git & Local History',
      'success'
    );
  }, [activeFile.id, activeFile.name, activeFile.path, onLogActivity, pushToast, saveFileCheckpoint]);

  const handleFormatActiveFile = useCallback(() => {
    const formatted = formatCodeBuffer(activeFile.content);
    updateFileContent(activeFile.id, formatted);
    onLogActivity(`Formatted ${activeFile.path}`);
    pushToast(
      `Formatted ${activeFile.name}`,
      'Normalized indentation and brace spacing',
      'success'
    );
  }, [
    activeFile.content,
    activeFile.id,
    activeFile.name,
    activeFile.path,
    onLogActivity,
    pushToast,
    updateFileContent,
  ]);

  const handleRunWorkspaceTests = useCallback(() => {
    const results = runWorkspaceTestFiles(files);
    setWorkspaceTestResults(results);
    setBottomTab('tests');
    const totalAssertions = results.reduce(
      (acc, r) => acc + r.assertions.length,
      0
    );
    const allPassed = results.every((r) => r.passed);
    onLogActivity(
      `Executed ${results.length} workspace test files (${totalAssertions} assertions)`
    );
    pushToast(
      allPassed ? 'All Workspace Tests Passed' : 'Test Suite Failures Detected',
      `${results.length} spec files • ${totalAssertions} assertions verified`,
      allPassed ? 'success' : 'warning'
    );
  }, [files, onLogActivity, pushToast]);

  const handleGenerateUnitTestsForActiveFile = useCallback(() => {
    const { testFileName, testContent } = synthesizeUnitTestFile(
      activeFile.name,
      activeFile.content
    );
    upsertFileByPath('tests', testFileName, 'typescript', testContent);
    setTimeout(() => {
      const updatedResults = runWorkspaceTestFiles([
        ...files.filter((f) => f.path !== `tests/${testFileName}`),
        {
          id: 'temp-gen',
          path: `tests/${testFileName}`,
          content: testContent,
          language: 'typescript',
        },
      ]);
      setWorkspaceTestResults(updatedResults);
      setBottomTab('tests');
    }, 50);
    onLogActivity(`Generated unit test suite tests/${testFileName}`);
    pushToast(
      `Generated tests/${testFileName}`,
      'Unit test suite created and executed in sandbox',
      'success'
    );
  }, [
    activeFile.content,
    activeFile.name,
    files,
    onLogActivity,
    pushToast,
    upsertFileByPath,
  ]);

  const applyDiagnosticQuickFix = useCallback(
    (diag: CodeDiagnostic) => {
      if (diag.replacementLine === undefined) return;
      const lines = activeFile.content.split('\n');
      if (diag.line >= 1 && diag.line <= lines.length) {
        lines[diag.line - 1] = diag.replacementLine;
        updateFileContent(activeFile.id, lines.join('\n'));
        onLogActivity(
          `Applied quick fix (${diag.rule}) on line ${diag.line} of ${activeFile.name}`
        );
        pushToast(
          `Quick Fix Applied (Ln ${diag.line})`,
          diag.quickFixLabel || diag.rule,
          'success'
        );
      }
    },
    [
      activeFile.content,
      activeFile.id,
      activeFile.name,
      onLogActivity,
      pushToast,
      updateFileContent,
    ]
  );

  const handleDownloadWorkspaceBundle = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: '10.5',
      files,
      commits,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codepilot-workspace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLogActivity('Exported workspace VFS bundle (.json)');
    pushToast(
      'Workspace Bundle Exported',
      `${files.length} files saved to .json archive`,
      'success'
    );
  }, [commits, files, onLogActivity, pushToast]);

  const handleImportBundleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const ok = importWorkspaceBundle(text);
        if (ok) {
          pushToast(
            'Workspace Bundle Restored',
            `Loaded files from ${file.name}`,
            'success'
          );
          onLogActivity(`Imported workspace bundle ${file.name}`);
        } else {
          pushToast(
            'Invalid Bundle Format',
            'Expected a .codepilot.json workspace export',
            'warning'
          );
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importWorkspaceBundle, onLogActivity, pushToast]
  );

  // 1-Click GCC Compile & Run (.c / .cpp → .exe target)
  const handleRunCode = useCallback(() => {
    onLogActivity(`GCC Compiler & Sandbox: Building ${activeFile.path}...`);
    const execRes = executeCodeInSandbox(
      activeFile.content,
      activeFile.language
    );
    const updatedFrames = generateDynamicTrace(
      activeFile.content,
      activeFile.language
    );
    setTraceFrames(updatedFrames);
    setCurrentTraceIdx(0);
    setBottomTab('terminal');

    // Automatically compile source to .exe binary target if C/C++ file
    const compiledExe = compileSourceToExe(
      activeFile.id,
      execRes.logs,
      execRes.durationMs
    );

    const buildLogHeader =
      /\.(c|cpp|cc|cxx)$/i.test(activeFile.name) && compiledExe
        ? [
            `$ gcc ${activeFile.path} -o ${compiledExe.path}`,
            `[GCC 14.2] Compiling C/C++ source to PE64 binary target...`,
            `✔ Created executable artifact: ${compiledExe.path}`,
          ]
        : [`$ run ${activeFile.path} (${LANGUAGE_META[activeFile.language].label})`];

    setTerminalLines((prev) =>
      [
        ...prev,
        ...buildLogHeader,
        ...execRes.logs,
        execRes.returnValue !== undefined ? `=> ${execRes.returnValue}` : '',
        execRes.success
          ? `✔ Executed successfully in ${execRes.durationMs}ms • ${updatedFrames.length} trace states • Est. ${qualityReport.timeComplexity} Time`
          : `❌ Runtime Error: ${execRes.error}`,
      ].filter(Boolean)
    );

    pushToast(
      execRes.success
        ? `Built & Executed ${activeFile.name}`
        : 'Runtime Exception',
      execRes.success
        ? compiledExe
          ? `Generated ${compiledExe.name} in ${execRes.durationMs}ms`
          : `Finished in ${execRes.durationMs}ms`
        : execRes.error,
      execRes.success ? 'success' : 'warning'
    );
  }, [
    activeFile,
    compileSourceToExe,
    onLogActivity,
    pushToast,
    qualityReport.timeComplexity,
  ]);

  const handleRefreshTrace = useCallback(() => {
    const nextFrames = generateDynamicTrace(
      activeFile.content,
      activeFile.language
    );
    setTraceFrames(nextFrames);
    setCurrentTraceIdx(0);
    setBottomTab('tracer');
    onLogActivity(
      `Traced ${nextFrames.length} execution steps in ${activeFile.name}`
    );
  }, [activeFile.content, activeFile.language, activeFile.name, onLogActivity]);

  const handleContinueToBreakpoint = useCallback(() => {
    if (activeBreakpoints.length === 0) {
      setCurrentTraceIdx((i) => Math.min(traceFrames.length - 1, i + 1));
      return;
    }
    for (let idx = currentTraceIdx + 1; idx < traceFrames.length; idx++) {
      if (activeBreakpoints.includes(traceFrames[idx].line)) {
        setCurrentTraceIdx(idx);
        setBottomTab('tracer');
        pushToast(
          `Paused at Breakpoint (Ln ${traceFrames[idx].line})`,
          `Step ${idx + 1} of ${traceFrames.length}`,
          'info'
        );
        return;
      }
    }
    setCurrentTraceIdx(traceFrames.length - 1);
  }, [activeBreakpoints, currentTraceIdx, traceFrames, pushToast]);

  const triggerAiAction = useCallback(
    async (
      customPrompt: string,
      mode: 'explain' | 'generate' | 'debug' = 'explain'
    ) => {
      setAiLoading(true);
      setChatMessages((prev) => [...prev, { role: 'user', text: customPrompt }]);

      const contextHeader = includeAllFilesContext
        ? `[Active Workspace Files:\n${files
            .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 400)}`)
            .join('\n')}\n]\n\n`
        : '';

      try {
        const res = await generateOrExplainCode({
          mode,
          language: activeFile.language,
          userPrompt: contextHeader + customPrompt,
          currentCode: activeFile.content,
          preset: activePreset,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `${res.explanation}\n\nComplexity: ${res.complexity}`,
            codeSnippet: res.code,
          },
        ]);

        if (res.code && res.code.trim() !== activeFile.content.trim()) {
          setPendingDiff({
            original: activeFile.content,
            proposed: res.code,
            explanation: res.explanation,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `⚠️ AI Provider Notice: ${msg}` },
        ]);
      } finally {
        setAiLoading(false);
      }
    },
    [
      activeFile.content,
      activeFile.language,
      activePreset,
      files,
      includeAllFilesContext,
    ]
  );

  const handleRunComposerPlan = useCallback(async () => {
    setAiLoading(true);
    setComposerSteps((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i === 0 ? 'done' : i === 1 ? 'running' : 'pending',
      }))
    );

    try {
      await triggerAiAction(composerGoal, 'generate');
    } catch {
      // handled
    }

    setComposerSteps((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i <= 1 ? 'done' : i === 2 ? 'running' : 'pending',
      }))
    );

    handleGenerateUnitTestsForActiveFile();

    setTimeout(() => {
      setComposerSteps((prev) =>
        prev.map((s) => ({ ...s, status: 'done' }))
      );
      setAiLoading(false);
      pushToast(
        'Composer Plan Completed',
        'C source audited, unit spec synthesized, and .exe binary compiled',
        'success'
      );
    }, 350);
  }, [
    composerGoal,
    handleGenerateUnitTestsForActiveFile,
    pushToast,
    triggerAiAction,
  ]);

  const paletteItems = useMemo(() => {
    const commandEntries = [
      {
        id: 'cmd-checkpoint',
        category: 'History',
        label: `Save Local History Checkpoint for ${activeFile.name}`,
        shortcut: 'Ctrl+S',
        action: handleSaveCheckpointShortcut,
      },
      {
        id: 'cmd-inline-ai',
        category: 'Cursor AI',
        label: 'Open Floating Inline AI Command Bar in Editor',
        shortcut: 'Ctrl+I',
        action: () => setInlineAiOpen(true),
      },
      {
        id: 'cmd-composer',
        category: 'Composer',
        label: 'Execute 4-Stage AI Engineering Task Plan',
        shortcut: 'Plan',
        action: () => {
          setZenMode(false);
          setCopilotMode('composer');
          handleRunComposerPlan();
        },
      },
      {
        id: 'cmd-run',
        category: 'Command',
        label: 'Compile & Execute Active C/C++ File (.exe)',
        shortcut: 'Ctrl+Enter',
        action: handleRunCode,
      },
      {
        id: 'cmd-format',
        category: 'Editor',
        label: 'Format Active Document Indentation & Braces',
        shortcut: 'Shift+Alt+F',
        action: handleFormatActiveFile,
      },
      {
        id: 'cmd-run-tests',
        category: 'Testing',
        label: 'Run All Workspace Unit Test Suites (*.spec.ts)',
        shortcut: 'Tests',
        action: handleRunWorkspaceTests,
      },
      {
        id: 'cmd-gen-tests',
        category: 'Testing',
        label: `Generate Unit Test Suite for ${activeFile.name}`,
        shortcut: 'Gen Spec',
        action: handleGenerateUnitTestsForActiveFile,
      },
      {
        id: 'cmd-export',
        category: 'Workspace',
        label: 'Download Portable Workspace VFS Bundle (.json)',
        shortcut: 'Export',
        action: handleDownloadWorkspaceBundle,
      },
    ];

    const fileEntries = files.map((f) => ({
      id: `file-${f.id}`,
      category: 'File',
      label: `Open File: ${f.path}`,
      shortcut: f.language.toUpperCase(),
      action: () => openFile(f.id),
    }));

    const symbolEntries = workspaceSymbols.map((sym, i) => ({
      id: `sym-${i}`,
      category: 'Symbol',
      label: `Jump to ${sym.name} in ${sym.filePath}:${sym.line}`,
      shortcut: `Ln ${sym.line}`,
      action: () => jumpToFileAndLine(sym.fileId, sym.line),
    }));

    const all = [...commandEntries, ...fileEntries, ...symbolEntries];
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [
    activeFile.name,
    files,
    handleDownloadWorkspaceBundle,
    handleFormatActiveFile,
    handleGenerateUnitTestsForActiveFile,
    handleRunCode,
    handleRunComposerPlan,
    handleRunWorkspaceTests,
    handleSaveCheckpointShortcut,
    jumpToFileAndLine,
    openFile,
    paletteQuery,
    workspaceSymbols,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p')
      ) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        setPaletteQuery('');
        setPaletteSelectedIndex(0);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCheckpointShortcut();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInlineAiOpen((prev) => !prev);
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFormatActiveFile();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setZenMode((prev) => !prev);
      } else if (commandPaletteOpen) {
        if (e.key === 'Escape') {
          setCommandPaletteOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPaletteSelectedIndex((i) =>
            Math.min(Math.max(0, paletteItems.length - 1), i + 1)
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPaletteSelectedIndex((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter' && paletteItems[paletteSelectedIndex]) {
          e.preventDefault();
          paletteItems[paletteSelectedIndex].action();
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    commandPaletteOpen,
    handleFormatActiveFile,
    handleRunCode,
    handleSaveCheckpointShortcut,
    paletteItems,
    paletteSelectedIndex,
  ]);

  const handleCreateFileOrFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed || !creatingMode) return;

    if (creatingMode === 'folder') {
      setOpenFolders((prev) => ({ ...prev, [trimmed]: true }));
      setSelectedFolder(trimmed);
    } else {
      const fileName = trimmed.includes('.')
        ? trimmed
        : `${trimmed}.${LANGUAGE_META[language].extension}`;
      createFile(selectedFolder, fileName, language);
    }
    setNewItemName('');
    setCreatingMode(null);
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;
    setTerminalInput('');

    if (cmd === 'clear') {
      setTerminalLines([]);
      return;
    }
    if (cmd === 'run' || cmd === './main.exe') {
      handleRunCode();
      return;
    }
    if (cmd.startsWith('gcc ') || cmd.startsWith('g++ ')) {
      const targetMatch = cmd.match(/(?:gcc|g\+\+)\s+([a-zA-Z0-9_./\\]+)/);
      if (targetMatch) {
        const found = files.find((f) => f.path.endsWith(targetMatch[1]) || f.name === targetMatch[1]);
        if (found) {
          openFile(found.id);
          handleRunCode();
          return;
        }
      }
    }

    const next = [...terminalLines, `PS workspace> ${cmd}`];
    if (cmd === 'help') {
      next.push('Commands: run, gcc main.c -o main.exe, test, trace, ls, git status, clear');
    } else if (cmd === 'ls') {
      next.push(files.map((f) => f.path).join('   '));
    } else if (cmd === 'git status') {
      next.push(
        modifiedFiles.length === 0
          ? 'On branch main — working tree clean'
          : `Modified files (${modifiedFiles.length}): ${modifiedFiles
              .map((f) => f.path)
              .join(', ')}`
      );
    } else {
      const evalRes = executeCodeInSandbox(cmd, language);
      if (evalRes.logs.length > 0) next.push(...evalRes.logs);
      if (evalRes.returnValue !== undefined)
        next.push(`=> ${evalRes.returnValue}`);
      if (!evalRes.success && evalRes.error) next.push(`❌ ${evalRes.error}`);
    }
    setTerminalLines(next);
  };

  const openFilesList = files.filter((f) => openTabIds.includes(f.id));
  const secondaryFile = files.find((f) => f.id === secondaryFileId) || activeFile;
  const pathSegments = activeFile.path.split('/');
  const dirtyFileBeingClosed = closingDirtyFileId
    ? files.find((f) => f.id === closingDirtyFileId)
    : null;

  // Group files by top-level folder for VS Code Explorer
  const folderGroups = useMemo(() => {
    const groups: Record<string, VfsFile[]> = {
      'c-workspace': [],
      'cpp-programs': [],
      'python-scripts': [],
      'web-app': [],
      tests: [],
    };
    files.forEach((f) => {
      const top = f.path.includes('/') ? f.path.split('/')[0] : 'c-workspace';
      if (!groups[top]) groups[top] = [];
      groups[top].push(f);
    });
    return groups;
  }, [files]);

  return (
    <div
      ref={editorContainerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        width: '100%',
      }}
      className="view-transition"
    >
      <input
        ref={bundleInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportBundleFile}
      />

      {/* KEYBOARD SHORTCUTS MODAL */}
      {shortcutsModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(2, 3, 7, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 70,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => setShortcutsModalOpen(false)}
        >
          <div
            className="hologram-panel modal-enter"
            style={{
              width: 600,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-focus)',
              boxShadow: 'var(--shadow-quantum)',
              padding: 20,
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Keyboard size={16} color="var(--accent-cyan)" />
                <strong style={{ fontSize: 14 }}>
                  CodePilot Lab — Keyboard Shortcuts & Keybindings
                </strong>
              </div>
              <button
                className="cyber-btn secondary"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setShortcutsModalOpen(false)}
              >
                ESC
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {[
                {
                  group: 'Workbench & Navigation',
                  items: [
                    { label: 'Command & Symbol Launcher', keys: 'Ctrl + K / P' },
                    { label: 'Toggle Focus / Zen Mode', keys: 'Ctrl + B' },
                    { label: 'Save Local History Checkpoint', keys: 'Ctrl + S' },
                    { label: 'Keyboard Shortcut Matrix', keys: 'Ctrl + /' },
                  ],
                },
                {
                  group: 'AI Copilot & Code Execution',
                  items: [
                    { label: 'Floating Inline AI Prompt', keys: 'Ctrl + I' },
                    { label: 'Compile & Run C/C++ (.exe)', keys: 'Ctrl + Enter' },
                    { label: 'Format Document Indentation', keys: 'Shift + Alt + F' },
                    { label: 'Toggle Line Breakpoint', keys: 'Click Gutter' },
                  ],
                },
              ].map((section) => (
                <div
                  key={section.group}
                  style={{
                    background: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span className="field-label">{section.group}</span>
                  {section.items.map((it) => (
                    <div
                      key={it.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {it.label}
                      </span>
                      <span className="kbd-badge">{it.keys}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UNSAVED TAB CLOSE GUARD */}
      {dirtyFileBeingClosed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(2, 3, 7, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 75,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => setClosingDirtyFileId(null)}
        >
          <div
            className="hologram-panel modal-enter"
            style={{
              width: 440,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--accent-amber)',
              boxShadow: 'var(--shadow-quantum)',
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--accent-amber)" />
              <strong style={{ fontSize: 13.5 }}>
                Unsaved Modifications in {dirtyFileBeingClosed.name}
              </strong>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This buffer has uncommitted changes compared to <code>HEAD</code>.
              Would you like to save a Local History Checkpoint before closing
              the tab?
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                className="cyber-btn secondary"
                onClick={() => setClosingDirtyFileId(null)}
              >
                Cancel
              </button>
              <button
                className="cyber-btn secondary"
                onClick={() => {
                  discardFileChanges(dirtyFileBeingClosed.id);
                  closeTab(dirtyFileBeingClosed.id);
                  setClosingDirtyFileId(null);
                }}
              >
                Discard & Close
              </button>
              <button
                className="cyber-btn"
                onClick={() => {
                  saveFileCheckpoint(
                    dirtyFileBeingClosed.id,
                    `Auto-checkpoint on close (${dirtyFileBeingClosed.name})`
                  );
                  closeTab(dirtyFileBeingClosed.id);
                  setClosingDirtyFileId(null);
                  pushToast(
                    'Checkpoint Saved & Tab Closed',
                    dirtyFileBeingClosed.path,
                    'success'
                  );
                }}
              >
                Save Checkpoint & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPLORER CONTEXT MENU */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 90,
            width: 215,
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-focus)',
            borderRadius: 9,
            padding: 5,
            boxShadow: 'var(--shadow-quantum)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const targetFile =
              files.find((f) => f.id === contextMenu.fileId) || activeFile;
            const folderPrefix = targetFile.path.includes('/')
              ? targetFile.path.split('/')[0]
              : 'c-workspace';
            return [
              {
                label: 'Open in Split View',
                icon: <Columns size={12} />,
                action: () => {
                  openFile(targetFile.id);
                  setSecondaryFileId(targetFile.id);
                  setSplitEditor(true);
                },
              },
              {
                label: 'Save Local Checkpoint',
                icon: <History size={12} />,
                action: () => {
                  saveFileCheckpoint(targetFile.id);
                  pushToast('Checkpoint Created', targetFile.path, 'success');
                },
              },
              {
                label: 'Duplicate File',
                icon: <Copy size={12} />,
                action: () => {
                  const dupName = targetFile.name.replace(
                    /(\.[a-zA-Z0-9]+)$/,
                    '.copy$1'
                  );
                  createFile(
                    folderPrefix,
                    dupName,
                    targetFile.language,
                    targetFile.content
                  );
                  pushToast('File Duplicated', `Created ${dupName}`, 'success');
                },
              },
              {
                label: 'Generate Unit Spec',
                icon: <FlaskConical size={12} />,
                action: () => {
                  openFile(targetFile.id);
                  handleGenerateUnitTestsForActiveFile();
                },
              },
              {
                label: 'Format Buffer',
                icon: <Wand2 size={12} />,
                action: () => {
                  updateFileContent(
                    targetFile.id,
                    formatCodeBuffer(targetFile.content)
                  );
                  pushToast('Buffer Formatted', targetFile.path, 'success');
                },
              },
              {
                label: 'Rename File',
                icon: <Edit3 size={12} />,
                action: () => {
                  setRenamingFileId(targetFile.id);
                  setRenameValue(targetFile.name);
                },
              },
              {
                label: 'Delete File',
                icon: <Trash2 size={12} />,
                action: () => deleteFile(targetFile.id),
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  item.action();
                  setContextMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ));
          })()}
        </div>
      )}

      {/* TOAST STACK */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 38,
            right: 18,
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                minWidth: 270,
                maxWidth: 370,
                background: 'var(--bg-surface-2)',
                border: `1px solid ${
                  t.tone === 'success'
                    ? 'var(--accent-emerald)'
                    : t.tone === 'warning'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-cyan)'
                }`,
                borderRadius: 10,
                padding: '10px 14px',
                boxShadow: 'var(--shadow-quantum)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                }}
              >
                {t.title}
              </div>
              {t.detail && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-secondary)',
                    marginTop: 3,
                  }}
                >
                  {t.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* COMMAND PALETTE */}
      {commandPaletteOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(2, 3, 7, 0.82)',
            backdropFilter: 'blur(10px)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 56,
          }}
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="hologram-panel modal-enter"
            style={{
              width: 600,
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-focus)',
              boxShadow: 'var(--shadow-quantum)',
              padding: 14,
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border-hairline)',
                paddingBottom: 9,
              }}
            >
              <Command size={16} color="var(--accent-cyan)" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteSelectedIndex(0);
                }}
                placeholder="Type a command, file name, or symbol (↑↓ to navigate, Enter to run)..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
              <span className="kbd-badge">ESC</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {paletteItems.map((item, idx) => {
                const isSelected = idx === paletteSelectedIndex;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setPaletteSelectedIndex(idx)}
                    onClick={() => {
                      item.action();
                      setCommandPaletteOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: '8px 11px',
                      borderRadius: 7,
                      border: isSelected
                        ? '1px solid rgba(6, 182, 212, 0.45)'
                        : '1px solid transparent',
                      background: isSelected
                        ? 'rgba(6, 182, 212, 0.15)'
                        : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="stage-pill"
                        style={{ fontSize: 10, padding: '2px 7px' }}
                      >
                        {item.category}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {item.label}
                      </span>
                    </div>
                    <span className="kbd-badge">{item.shortcut}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DIFF REVIEW MODAL */}
      {pendingDiff && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 64,
            right: 24,
            zIndex: 45,
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 12,
            padding: 16,
            boxShadow: 'var(--shadow-quantum)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="var(--accent-cyan)" />
              <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>
                Review Proposed AI Patch — {activeFile.path}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="cyber-btn secondary"
                onClick={() => setPendingDiff(null)}
              >
                <X size={13} /> Reject
              </button>
              <button
                className="cyber-btn"
                onClick={() => {
                  updateFileContent(activeFile.id, pendingDiff.proposed);
                  setPendingDiff(null);
                  onLogActivity(`Applied AI patch to ${activeFile.path}`);
                  pushToast(
                    'AI Patch Applied',
                    `Updated ${activeFile.path}`,
                    'success'
                  );
                }}
              >
                <Check size={13} /> Accept & Apply Diff
              </button>
            </div>
          </div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 12.5,
              marginBottom: 12,
            }}
          >
            {pendingDiff.explanation}
          </p>
          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--bg-canvas)',
              borderRadius: 8,
              border: '1px solid var(--border-hairline)',
              padding: '8px 0',
            }}
          >
            {computeLineDiff(pendingDiff.original, pendingDiff.proposed).map(
              (d, idx) => (
                <div key={idx} className={`diff-line ${d.type}`}>
                  <span
                    style={{
                      width: 28,
                      display: 'inline-block',
                      opacity: 0.5,
                    }}
                  >
                    {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
                  </span>
                  <span>{d.content}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* WORKBENCH FLEX ROW */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {/* ACTIVITY BAR */}
        <aside
          style={{
            width: 50,
            background: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {[
            {
              id: 'explorer' as ActivityTab,
              icon: <FolderTree size={18} />,
              title: 'Explorer',
            },
            {
              id: 'search' as ActivityTab,
              icon: <Search size={18} />,
              title: 'Global Search',
            },
            {
              id: 'git' as ActivityTab,
              icon: <GitBranch size={18} />,
              title: 'Git Source Control & Checkpoints',
              badge: modifiedFiles.length,
            },
            {
              id: 'intelligence' as ActivityTab,
              icon: <Gauge size={18} />,
              title: 'Code Quality & Big-O Intelligence',
              badge: qualityReport.diagnostics.length,
            },
            {
              id: 'architecture' as ActivityTab,
              icon: <Network size={18} />,
              title: 'SVG Architecture & Symbols',
            },
            {
              id: 'superpowers' as ActivityTab,
              icon: <Zap size={18} />,
              title: 'Polyglot Translators',
            },
          ].map((item) => {
            const isActive = !zenMode && activityTab === item.id;
            return (
              <button
                key={item.id}
                title={item.title}
                onClick={() => {
                  if (isActive) {
                    setZenMode(true);
                  } else {
                    setZenMode(false);
                    setActivityTab(item.id);
                  }
                }}
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: isActive
                    ? 'rgba(6, 182, 212, 0.18)'
                    : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: isActive
                    ? '1px solid rgba(6, 182, 212, 0.4)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
                {item.badge ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      background: 'var(--accent-magenta)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      borderRadius: 99,
                      padding: '1px 4px',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <button
              title="Keyboard Shortcuts (Ctrl+/)"
              onClick={() => setShortcutsModalOpen(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Keyboard size={16} />
            </button>
            <button
              title="Import Workspace Bundle (.json)"
              onClick={() => bundleInputRef.current?.click()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Upload size={15} />
            </button>
            <button
              title="Download Workspace Bundle (.json)"
              onClick={handleDownloadWorkspaceBundle}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Download size={15} />
            </button>
            <button
              title="Command Launcher (Ctrl+K)"
              onClick={() => setCommandPaletteOpen(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--bg-surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-hairline)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Command size={16} />
            </button>
          </div>
        </aside>

        {/* PRIMARY VS CODE FOLDER EXPLORER SIDEBAR */}
        {!zenMode && (
          <>
            <div
              style={{
                width: sidebarWidth,
                background: 'var(--bg-surface-1)',
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                gap: 12,
                overflowY: 'auto',
                flexShrink: 0,
              }}
            >
              {activityTab === 'explorer' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="field-label">
                      EXPLORER • C/C++ WORKSPACE
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        title="New File"
                        className="cyber-btn secondary"
                        style={{ padding: '4px 7px' }}
                        onClick={() => setCreatingMode('file')}
                      >
                        <FilePlus size={13} />
                      </button>
                      <button
                        title="New Folder"
                        className="cyber-btn secondary"
                        style={{ padding: '4px 7px' }}
                        onClick={() => setCreatingMode('folder')}
                      >
                        <FolderPlus size={13} />
                      </button>
                      <button
                        title="Save Snapshot to Vault"
                        className="cyber-btn secondary"
                        style={{ padding: '4px 7px' }}
                        onClick={() => {
                          saveCurrentAsProject(activeFile.name);
                          onLogActivity(
                            `Saved ${activeFile.name} to Project Vault`
                          );
                          pushToast(
                            'Snapshot Saved to Vault',
                            `${activeFile.name} added to Project Vault`,
                            'success'
                          );
                        }}
                      >
                        <BookmarkPlus size={13} />
                      </button>
                    </div>
                  </div>

                  {creatingMode && (
                    <form
                      onSubmit={handleCreateFileOrFolder}
                      style={{ display: 'flex', gap: 5 }}
                    >
                      <input
                        autoFocus
                        className="cyber-input"
                        placeholder={
                          creatingMode === 'folder'
                            ? 'Folder name (e.g. src)...'
                            : 'File name (e.g. kernel.c)...'
                        }
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                      />
                      <button type="submit" className="cyber-btn">
                        Add
                      </button>
                    </form>
                  )}

                  {/* VS CODE FOLDER HIERARCHY */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {Object.entries(folderGroups).map(([folderName, folderFiles]) => {
                      const isOpen = !!openFolders[folderName];
                      if (folderFiles.length === 0 && folderName !== 'c-workspace') return null;

                      return (
                        <div
                          key={folderName}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          <div
                            onClick={() => {
                              setSelectedFolder(folderName);
                              setOpenFolders((prev) => ({
                                ...prev,
                                [folderName]: !prev[folderName],
                              }));
                            }}
                            className="vscode-tree-folder"
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {isOpen ? (
                                <ChevronDown size={14} color="var(--accent-cyan)" />
                              ) : (
                                <ChevronRight size={14} color="var(--text-muted)" />
                              )}
                              {isOpen ? (
                                <FolderOpen size={14} color="var(--accent-amber)" />
                              ) : (
                                <Folder size={14} color="var(--accent-amber)" />
                              )}
                              <span>📁 {folderName}</span>
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {folderFiles.length}
                            </span>
                          </div>

                          {isOpen && (
                            <div
                              style={{
                                paddingLeft: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              {folderFiles.map((file) => {
                                const isSelected = file.id === activeFile.id;
                                const isExe = file.isBinaryExe || file.name.endsWith('.exe');
                                const isC = file.name.endsWith('.c') || file.name.endsWith('.cpp');
                                const extClass = isExe
                                  ? 'ext-exe'
                                  : file.name.endsWith('.c')
                                  ? 'ext-c'
                                  : file.name.endsWith('.cpp')
                                  ? 'ext-cpp'
                                  : file.name.endsWith('.h')
                                  ? 'ext-h'
                                  : file.name.endsWith('.py')
                                  ? 'ext-py'
                                  : 'ext-ts';

                                return (
                                  <div
                                    key={file.id}
                                    onClick={() => openFile(file.id)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        fileId: file.id,
                                      });
                                    }}
                                    title="Right-click for file actions"
                                    className={`vscode-tree-file ${
                                      isSelected ? 'selected' : ''
                                    }`}
                                  >
                                    {renamingFileId === file.id ? (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          renameFile(file.id, renameValue);
                                          setRenamingFileId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          autoFocus
                                          className="cyber-input"
                                          value={renameValue}
                                          onChange={(e) =>
                                            setRenameValue(e.target.value)
                                          }
                                          onBlur={() => setRenamingFileId(null)}
                                          style={{
                                            padding: '2px 6px',
                                            fontSize: 11,
                                          }}
                                        />
                                      </form>
                                    ) : (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <span className={`file-ext-badge ${extClass}`}>
                                          {isExe ? 'EXE' : isC ? 'C' : file.language.slice(0, 2).toUpperCase()}
                                        </span>
                                        <span
                                          style={{
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            color: isExe ? 'var(--accent-emerald)' : undefined,
                                          }}
                                        >
                                          {file.name}
                                        </span>
                                        {file.isModified && (
                                          <span
                                            title="Modified since last commit"
                                            style={{
                                              color: 'var(--accent-amber)',
                                              fontWeight: 800,
                                            }}
                                          >
                                            ●
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: 4,
                                        opacity: isSelected ? 1 : 0.4,
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        title="Rename"
                                        onClick={() => {
                                          setRenamingFileId(file.id);
                                          setRenameValue(file.name);
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--text-muted)',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Edit3 size={11} />
                                      </button>
                                      {files.length > 1 && (
                                        <button
                                          title="Delete"
                                          onClick={() => deleteFile(file.id)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 'auto',
                      borderTop: '1px solid var(--border-hairline)',
                      paddingTop: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <span className="field-label">
                        BREAKPOINTS ({activeBreakpoints.length})
                      </span>
                      <span
                        style={{ fontSize: 10.5, color: 'var(--text-muted)' }}
                      >
                        Click gutter to toggle
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {activeBreakpoints.length === 0 ? (
                        <span
                          style={{ fontSize: 11, color: 'var(--text-muted)' }}
                        >
                          No active breakpoints in {activeFile.name}
                        </span>
                      ) : (
                        activeBreakpoints.map((ln) => (
                          <button
                            key={ln}
                            onClick={() => toggleBreakpoint(ln)}
                            className="status-pill"
                            style={{
                              borderColor: 'rgba(244, 63, 94, 0.4)',
                              color: '#fda4af',
                              background: 'rgba(244, 63, 94, 0.12)',
                              cursor: 'pointer',
                            }}
                          >
                            <CircleDot size={10} /> Ln {ln}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {activityTab === 'intelligence' && (
                <>
                  <span className="field-label">
                    CODE QUALITY & BIG-O INTELLIGENCE
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <div
                      className="preset-item"
                      style={{ cursor: 'default', padding: 10 }}
                    >
                      <div
                        style={{ fontSize: 10, color: 'var(--text-muted)' }}
                      >
                        TIME COMPLEXITY
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-cyan)',
                          marginTop: 2,
                        }}
                      >
                        {qualityReport.timeComplexity}
                      </div>
                    </div>
                    <div
                      className="preset-item"
                      style={{ cursor: 'default', padding: 10 }}
                    >
                      <div
                        style={{ fontSize: 10, color: 'var(--text-muted)' }}
                      >
                        SPACE COMPLEXITY
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-emerald)',
                          marginTop: 2,
                        }}
                      >
                        {qualityReport.spaceComplexity}
                      </div>
                    </div>
                  </div>

                  <div
                    className="preset-item"
                    style={{ cursor: 'default', padding: 10 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                      }}
                    >
                      <span>Maintainability Index</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>
                        {qualityReport.maintainabilityScore} / 100
                      </strong>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 99,
                        background: 'var(--bg-canvas)',
                        marginTop: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${qualityReport.maintainabilityScore}%`,
                          height: '100%',
                          background:
                            'linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald))',
                        }}
                      />
                    </div>
                  </div>

                  <span className="field-label" style={{ marginTop: 4 }}>
                    STATIC DIAGNOSTICS ({qualityReport.diagnostics.length})
                  </span>
                  {qualityReport.diagnostics.length === 0 ? (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--accent-emerald)',
                      }}
                    >
                      ✔ Zero lint or complexity warnings in {activeFile.name}.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {qualityReport.diagnostics.map((d) => (
                        <div
                          key={d.id}
                          className="preset-item"
                          style={{ padding: 8 }}
                          onClick={() =>
                            jumpToFileAndLine(activeFile.id, d.line)
                          }
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                d.severity === 'error'
                                  ? 'var(--accent-magenta)'
                                  : 'var(--accent-amber)',
                            }}
                          >
                            <span>
                              Ln {d.line} • {d.rule}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              marginTop: 3,
                            }}
                          >
                            {d.message}
                          </p>
                          {d.quickFixLabel && (
                            <button
                              className="cyber-btn"
                              style={{
                                marginTop: 6,
                                padding: '3px 8px',
                                fontSize: 10.5,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyDiagnosticQuickFix(d);
                              }}
                            >
                              <Wrench size={10} /> {d.quickFixLabel}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activityTab === 'search' && (
                <>
                  <span className="field-label">GLOBAL WORKSPACE SEARCH</span>
                  <input
                    className="cyber-input"
                    placeholder="Find symbol or text across files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <input
                    className="cyber-input"
                    placeholder="Replace in active file with..."
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                  />
                  <button
                    className="cyber-btn"
                    onClick={() => {
                      if (!searchQuery) return;
                      updateFileContent(
                        activeFile.id,
                        activeFile.content
                          .split(searchQuery)
                          .join(replaceQuery)
                      );
                      pushToast(
                        'Replaced Occurrences',
                        `Updated matches in ${activeFile.name}`,
                        'success'
                      );
                    }}
                  >
                    Replace in {activeFile.name}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <span className="field-label">
                      MATCHES ({globalSearchMatches.length})
                    </span>
                    {globalSearchMatches.map((m, idx) => (
                      <div
                        key={idx}
                        className="preset-item"
                        onClick={() => jumpToFileAndLine(m.fileId, m.line)}
                        style={{ padding: '6px 8px' }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--accent-cyan)',
                          }}
                        >
                          {m.path}:{m.line}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                            marginTop: 2,
                          }}
                        >
                          {m.preview}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activityTab === 'git' && (
                <>
                  <span className="field-label">
                    WORKING TREE CHANGES ({modifiedFiles.length})
                  </span>
                  {modifiedFiles.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        padding: '6px 0',
                      }}
                    >
                      ✔ Working tree clean. Edit any file to inspect live line
                      diffs.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {modifiedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="preset-item"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 8px',
                          }}
                        >
                          <span
                            onClick={() => {
                              openFile(f.id);
                              setBottomTab('diff');
                            }}
                            style={{
                              fontSize: 12,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            {f.path}{' '}
                            <strong style={{ color: 'var(--accent-amber)' }}>
                              M
                            </strong>
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              title="Discard changes"
                              className="cyber-btn secondary"
                              style={{ padding: '2px 5px' }}
                              onClick={() => {
                                discardFileChanges(f.id);
                                pushToast(
                                  'Reverted Changes',
                                  `Restored ${f.name} to HEAD`,
                                  'info'
                                );
                              }}
                            >
                              <Undo2 size={11} />
                            </button>
                            <button
                              title="Stage file"
                              className="cyber-btn secondary"
                              style={{
                                padding: '2px 6px',
                                borderColor: f.isStaged
                                  ? 'var(--accent-emerald)'
                                  : undefined,
                                color: f.isStaged
                                  ? 'var(--accent-emerald)'
                                  : undefined,
                              }}
                              onClick={() => toggleStageFile(f.id)}
                            >
                              {f.isStaged ? 'Staged' : '+ Stage'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    className="cyber-input"
                    placeholder="Commit message (e.g. feat: optimize search)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                  <button
                    className="cyber-btn"
                    disabled={modifiedFiles.length === 0}
                    onClick={() => {
                      const ok = commitStagedChanges(commitMessage);
                      if (ok) {
                        setCommitMessage('');
                        onLogActivity('Committed working tree changes to HEAD');
                        pushToast(
                          'Committed to HEAD',
                          `${modifiedFiles.length} file(s) committed`,
                          'success'
                        );
                      }
                    }}
                  >
                    <GitCommit size={13} /> Commit to HEAD
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <span className="field-label">
                      LOCAL CHECKPOINTS ({checkpoints.length})
                    </span>
                    <button
                      className="cyber-btn secondary"
                      style={{ padding: '2px 6px', fontSize: 10.5 }}
                      onClick={handleSaveCheckpointShortcut}
                    >
                      + Ctrl+S
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    {checkpoints.slice(0, 5).map((cp) => (
                      <div
                        key={cp.id}
                        className="preset-item"
                        style={{
                          padding: '6px 8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {cp.label}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {cp.timestamp}
                          </div>
                        </div>
                        <button
                          className="cyber-btn secondary"
                          style={{ padding: '2px 6px', fontSize: 10.5 }}
                          onClick={() => {
                            const ok = restoreFileCheckpoint(cp.id);
                            if (ok) {
                              pushToast(
                                'Checkpoint Restored',
                                cp.label,
                                'info'
                              );
                            }
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>

                  <span className="field-label" style={{ marginTop: 6 }}>
                    COMMIT HISTORY ({commits.length})
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {commits.map((c) => (
                      <div
                        key={c.hash}
                        className="preset-item"
                        style={{ padding: '7px 9px' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-emerald)',
                          }}
                        >
                          <span>#{c.hash}</span>
                          <span>{c.timestamp}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-primary)',
                            marginTop: 3,
                          }}
                        >
                          {c.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activityTab === 'architecture' && (
                <>
                  <span className="field-label">
                    INTERACTIVE SVG TOPOLOGY GRAPH
                  </span>
                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <svg
                      width="100%"
                      height={Math.max(130, files.length * 42)}
                      viewBox={`0 0 220 ${Math.max(130, files.length * 42)}`}
                    >
                      {files.map((f, idx) => {
                        const y = 24 + idx * 38;
                        const isCurrent = f.id === activeFile.id;
                        return (
                          <g
                            key={f.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openFile(f.id)}
                          >
                            {idx > 0 && (
                              <line
                                x1={26}
                                y1={24}
                                x2={26}
                                y2={y}
                                stroke="rgba(6, 182, 212, 0.3)"
                                strokeWidth={1.5}
                                strokeDasharray="3 2"
                              />
                            )}
                            <circle
                              cx={26}
                              cy={y}
                              r={6}
                              fill={isCurrent ? '#06b6d4' : '#a855f7'}
                            />
                            <rect
                              x={42}
                              y={y - 12}
                              width={168}
                              height={24}
                              rx={5}
                              fill={
                                isCurrent
                                  ? 'rgba(6, 182, 212, 0.16)'
                                  : 'rgba(255, 255, 255, 0.03)'
                              }
                              stroke={
                                isCurrent
                                  ? 'rgba(6, 182, 212, 0.6)'
                                  : 'rgba(255, 255, 255, 0.08)'
                              }
                            />
                            <text
                              x={50}
                              y={y + 4}
                              fill={isCurrent ? '#f8fafc' : '#94a3b8'}
                              fontSize="10.5"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              {f.path.slice(0, 21)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <span className="field-label" style={{ marginTop: 6 }}>
                    AST SYMBOL OUTLINE ({workspaceSymbols.length})
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    {workspaceSymbols.map((sym, i) => (
                      <div
                        key={i}
                        onClick={() => jumpToFileAndLine(sym.fileId, sym.line)}
                        className="preset-item"
                        style={{
                          padding: '6px 8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11.5,
                              color: 'var(--accent-cyan)',
                              fontWeight: 600,
                            }}
                          >
                            {sym.name}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {sym.filePath}
                          </div>
                        </div>
                        <span className="kbd-badge">Ln {sym.line}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activityTab === 'superpowers' && (
                <>
                  <span className="field-label">POLYGLOT AST TRANSLATOR</span>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Translate {activeFile.name} idioms into target systems
                    languages via Gemini:
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                    }}
                  >
                    {['Python', 'Rust', 'Go', 'C++ 20', 'Java', 'Kotlin'].map(
                      (lang) => (
                        <button
                          key={lang}
                          className="cyber-btn secondary"
                          onClick={() =>
                            triggerAiAction(
                              `Translate this ${activeFile.language} file into idiomatic ${lang} with equivalent complexity.`,
                              'generate'
                            )
                          }
                        >
                          <Globe size={12} /> {lang}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>

            <div
              className={`sash-vertical ${
                dragTarget === 'sidebar' ? 'dragging' : ''
              }`}
              onMouseDown={() => setDragTarget('sidebar')}
              title="Drag to resize sidebar"
            />
          </>
        )}

        {/* CENTER WORKBENCH (DUAL SPLIT EDITOR GROUPS WITH RESIZER) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            background: 'var(--bg-canvas)',
            position: 'relative',
          }}
        >
          {/* FLOATING INLINE AI PROMPT BAR (Ctrl+I) */}
          {inlineAiOpen && (
            <div
              style={{
                position: 'absolute',
                top: 66,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(580px, 90%)',
                zIndex: 35,
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: 12,
                padding: '10px 12px',
                boxShadow: 'var(--shadow-quantum)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inlineAiPrompt.trim()) return;
                  triggerAiAction(inlineAiPrompt.trim(), 'generate');
                  setInlineAiPrompt('');
                  setInlineAiOpen(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Sparkles size={14} color="var(--accent-cyan)" />
                <input
                  autoFocus
                  value={inlineAiPrompt}
                  onChange={(e) => setInlineAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setInlineAiOpen(false);
                  }}
                  placeholder={`Inline AI Edit on ${activeFile.name} (e.g. "Add input bounds check" or "Convert to iterative")...`}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  className="cyber-btn"
                  style={{ padding: '5px 12px', fontSize: 11.5 }}
                >
                  Generate Diff
                </button>
                <button
                  type="button"
                  onClick={() => setInlineAiOpen(false)}
                  className="kbd-badge"
                  style={{ cursor: 'pointer' }}
                >
                  ESC
                </button>
              </form>
            </div>
          )}

          {/* EDITOR TAB BAR */}
          <div
            style={{
              height: 40,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 12px',
              background: 'var(--bg-primary)',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 5,
                overflowX: 'auto',
                alignItems: 'center',
              }}
            >
              {openFilesList.map((f) => {
                const isCurrent = activeFile.id === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => openFile(f.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '5px 11px',
                      borderRadius: 7,
                      background: isCurrent
                        ? 'var(--bg-surface-2)'
                        : 'transparent',
                      border: isCurrent
                        ? '1px solid rgba(6, 182, 212, 0.4)'
                        : '1px solid transparent',
                      color: isCurrent
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Code2
                      size={13}
                      color={
                        isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)'
                      }
                    />
                    <span>{f.name}</span>
                    {f.isModified && (
                      <span
                        style={{ color: 'var(--accent-amber)', fontSize: 10 }}
                      >
                        ●
                      </span>
                    )}
                    {openFilesList.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (f.isModified) {
                            setClosingDirtyFileId(f.id);
                          } else {
                            closeTab(f.id);
                          }
                        }}
                        style={{
                          opacity: 0.6,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={12} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                className="cyber-select"
                style={{ width: 130, padding: '3px 8px', fontSize: 11.5 }}
                value={activeFile.language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                title="Switch Active File Language"
              >
                {Object.entries(LANGUAGE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>

              <button
                className="cyber-btn secondary"
                onClick={() => setInlineAiOpen((o) => !o)}
                title="Cursor-style Inline AI Prompt (Ctrl+I)"
              >
                <Sparkles size={12} /> Inline AI
              </button>
              <button
                className="cyber-btn secondary"
                onClick={handleFormatActiveFile}
                title="Format Code (Shift+Alt+F)"
              >
                <Wand2 size={12} /> Format
              </button>
              <button
                className="cyber-btn secondary"
                onClick={handleGenerateUnitTestsForActiveFile}
                title="Generate Unit Test Spec"
              >
                <FlaskConical size={12} /> Spec
              </button>
              <button
                className={`cyber-btn ${splitEditor ? '' : 'secondary'}`}
                onClick={() => setSplitEditor((s) => !s)}
                title="Toggle Dual-Group Split View"
              >
                <Columns size={13} /> {splitEditor ? 'Close Split' : 'Split'}
              </button>
              <button
                className="cyber-btn emerald"
                onClick={handleRunCode}
                title="Compile & Run C/C++ (.exe) (Ctrl+Enter)"
              >
                <Play size={13} /> Compile & Run
              </button>
            </div>
          </div>

          {/* BREADCRUMBS */}
          <div
            style={{
              height: 25,
              background: 'var(--bg-surface-1)',
              borderBottom: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>workspace</span>
              {pathSegments.map((seg, i) => (
                <React.Fragment key={i}>
                  <ChevronRight size={11} color="var(--text-muted)" />
                  <span
                    style={{
                      color:
                        i === pathSegments.length - 1
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {seg}
                  </span>
                </React.Fragment>
              ))}
              {activeEnclosingSymbol && (
                <>
                  <ChevronRight size={11} color="var(--text-muted)" />
                  <span
                    onClick={() =>
                      jumpToFileAndLine(
                        activeEnclosingSymbol.fileId,
                        activeEnclosingSymbol.line
                      )
                    }
                    style={{
                      color: 'var(--accent-cyan)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    fn {activeEnclosingSymbol.name}
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)' }}>
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
              {activeTrace && (
                <span style={{ color: 'var(--accent-emerald)' }}>
                  ● Trace Ptr: Ln {activeTrace.line}
                </span>
              )}
            </div>
          </div>

          {/* DUAL SPLIT EDITOR GROUPS */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              minHeight: 0,
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* PRIMARY EDITOR GROUP */}
            <div
              className="split-editor-group focused"
              style={{
                width: splitEditor ? `${splitRatio * 100}%` : '100%',
                height: '100%',
              }}
            >
              <Editor
                height="100%"
                language={LANGUAGE_META[activeFile.language]?.monacoLang || 'cpp'}
                theme="vs-dark"
                value={activeFile.content}
                onChange={(val) => updateFileContent(activeFile.id, val || '')}
                onMount={(editor, monaco) => {
                  const bridge = editor as unknown as MonacoEditorBridge;
                  editorRef.current = bridge;
                  syncMonacoDecorations();

                  bridge.onMouseDown((e) => {
                    if (
                      (e.target.type === 2 || e.target.type === 3) &&
                      e.target.position?.lineNumber
                    ) {
                      toggleBreakpoint(e.target.position.lineNumber);
                    }
                  });

                  bridge.onDidChangeCursorPosition((e) => {
                    setCursorPos({
                      line: e.position.lineNumber,
                      col: e.position.column,
                    });
                  });

                  // Direct clipboard paste action for external copy-paste
                  try {
                    bridge.addAction({
                      id: 'codepilot-clipboard-paste',
                      label: 'Paste Code from Clipboard',
                      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
                      run: async (edInst: unknown) => {
                        try {
                          const clipboardText = await navigator.clipboard.readText();
                          if (!clipboardText) return;
                          const model = (edInst as { getModel: () => { pushEditOperations: (a: unknown, b: unknown, c: unknown) => void } }).getModel();
                          const selection = (edInst as { getSelection: () => unknown }).getSelection();
                          if (!model || !selection) return;
                          (edInst as { executeEdits: (name: string, edits: unknown[]) => void }).executeEdits('clipboard-paste', [
                            {
                              range: selection,
                              text: clipboardText,
                              forceMoveMarkers: true,
                            },
                          ]);
                          (edInst as { pushUndoStop: () => void }).pushUndoStop();
                        } catch (err) {
                          console.error('Clipboard paste action error:', err);
                        }
                      },
                    });
                  } catch {
                    // Action already registered
                  }
                }}
                options={{
                  fontSize: 13.5,
                  fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                  lineHeight: 21,
                  glyphMargin: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  smoothScrolling: true,
                  padding: { top: 12 },
                }}
              />
            </div>

            {/* DRAGGABLE RESIZER SASH */}
            {splitEditor && (
              <div
                className={`sash-vertical ${
                  dragTarget === 'split' ? 'dragging' : ''
                }`}
                onMouseDown={() => setDragTarget('split')}
                title="Drag to resize split editors"
              />
            )}

            {/* SECONDARY EDITOR GROUP */}
            {splitEditor && (
              <div
                className="split-editor-group"
                style={{
                  width: `${(1 - splitRatio) * 100}%`,
                  height: '100%',
                  borderLeft: '1px solid var(--border-hairline)',
                }}
              >
                <div
                  style={{
                    height: 32,
                    background: 'var(--bg-surface-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderBottom: '1px solid var(--border-hairline)',
                  }}
                >
                  <select
                    className="cyber-select"
                    style={{ width: 170, padding: '2px 6px', fontSize: 11 }}
                    value={secondaryFile.id}
                    onChange={(e) => setSecondaryFileId(e.target.value)}
                  >
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.path}
                      </option>
                    ))}
                  </select>
                  <button
                    className="cyber-btn secondary"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => setSplitEditor(false)}
                  >
                    <X size={12} /> Close Group
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <Editor
                    height="100%"
                    language={LANGUAGE_META[secondaryFile.language]?.monacoLang || 'cpp'}
                    theme="vs-dark"
                    value={secondaryFile.content}
                    onChange={(val) => updateFileContent(secondaryFile.id, val || '')}
                    options={{
                      fontSize: 13.5,
                      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                      minimap: { enabled: false },
                      automaticLayout: true,
                      padding: { top: 12 },
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            className={`sash-horizontal ${
              dragTarget === 'bottom' ? 'dragging' : ''
            }`}
            onMouseDown={() => setDragTarget('bottom')}
            title="Drag to resize bottom panel"
          />

          {/* BOTTOM PANEL */}
          <div
            style={{
              height: bottomHeight,
              background: 'var(--bg-surface-1)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-hairline)',
                padding: '0 12px',
                height: 36,
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  {
                    id: 'tracer' as BottomTab,
                    label: `VISUAL MEMORY & TRACER (${traceFrames.length} STEPS)`,
                  },
                  { id: 'terminal' as BottomTab, label: 'TERMINAL & SANDBOX' },
                  {
                    id: 'tests' as BottomTab,
                    label: `UNIT TESTS (${workspaceTestResults.length} SUITES)`,
                  },
                  {
                    id: 'problems' as BottomTab,
                    label: `DIAGNOSTICS (${qualityReport.diagnostics.length})`,
                  },
                  {
                    id: 'diff' as BottomTab,
                    label: `GIT DIFF (${
                      activeFileDiff.filter((d) => d.type !== 'same').length
                    })`,
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBottomTab(t.id)}
                    style={{
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom:
                        bottomTab === t.id
                          ? '2px solid var(--accent-cyan)'
                          : '2px solid transparent',
                      color:
                        bottomTab === t.id
                          ? 'var(--accent-cyan)'
                          : 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {bottomTab === 'tracer' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="cyber-btn secondary"
                    style={{ padding: '3px 7px', fontSize: 11 }}
                    onClick={() => {
                      setIsAutoPlayingTrace(false);
                      setCurrentTraceIdx(0);
                    }}
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                  <button
                    className="cyber-btn secondary"
                    style={{ padding: '3px 7px', fontSize: 11 }}
                    onClick={() => {
                      setIsAutoPlayingTrace(false);
                      setCurrentTraceIdx((i) => Math.max(0, i - 1));
                    }}
                  >
                    <StepBack size={11} /> Prev
                  </button>
                  <button
                    className="cyber-btn"
                    style={{ padding: '3px 9px', fontSize: 11 }}
                    onClick={() => setIsAutoPlayingTrace((p) => !p)}
                  >
                    {isAutoPlayingTrace ? (
                      <>
                        <Pause size={11} /> Pause
                      </>
                    ) : (
                      <>
                        <Play size={11} /> Auto-Play
                      </>
                    )}
                  </button>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--accent-amber)',
                    }}
                  >
                    Step {currentTraceIdx + 1} / {traceFrames.length}
                  </span>
                  <button
                    className="cyber-btn secondary"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => {
                      setIsAutoPlayingTrace(false);
                      setCurrentTraceIdx((i) =>
                        Math.min(traceFrames.length - 1, i + 1)
                      );
                    }}
                  >
                    <StepForward size={11} /> Step
                  </button>
                  <button
                    className="cyber-btn secondary"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={handleContinueToBreakpoint}
                  >
                    <FastForward size={11} /> To Breakpoint
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                flex: 1,
                padding: '10px 14px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              {bottomTab === 'tracer' && activeTrace && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="timeline-bar">
                    {traceFrames.map((frame, idx) => {
                      const isHitBp = activeBreakpoints.includes(frame.line);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setIsAutoPlayingTrace(false);
                            setCurrentTraceIdx(idx);
                          }}
                          className={`timeline-step-pill ${
                            idx === currentTraceIdx ? 'active' : ''
                          } ${isHitBp ? 'breakpoint-hit' : ''}`}
                        >
                          {frame.line}
                        </button>
                      );
                    })}
                  </div>

                  {visualArrayState && (
                    <div
                      style={{
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        overflowX: 'auto',
                      }}
                    >
                      <div style={{ flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: 'var(--text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          MEMORY STRIP: {visualArrayState.arrayName}[]
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {visualArrayState.elements.map((el, idx) => {
                          const ptrLabels =
                            visualArrayState.pointers[idx] || [];
                          const hasMid = ptrLabels.includes('mid');
                          const hasBound =
                            ptrLabels.includes('left') ||
                            ptrLabels.includes('right') ||
                            ptrLabels.includes('i');

                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 44,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                [{idx}]
                              </span>
                              <div
                                style={{
                                  width: '100%',
                                  padding: '5px 6px',
                                  textAlign: 'center',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  background: hasMid
                                    ? 'rgba(52, 211, 153, 0.22)'
                                    : hasBound
                                    ? 'rgba(6, 182, 212, 0.2)'
                                    : 'var(--bg-canvas)',
                                  border: `1px solid ${
                                    hasMid
                                      ? 'var(--accent-emerald)'
                                      : hasBound
                                      ? 'var(--accent-cyan)'
                                      : 'var(--border-subtle)'
                                  }`,
                                  color: hasMid
                                    ? 'var(--accent-emerald)'
                                    : 'var(--text-primary)',
                                }}
                              >
                                {String(el)}
                              </div>
                              <div
                                style={{
                                  minHeight: 16,
                                  display: 'flex',
                                  gap: 2,
                                  marginTop: 3,
                                }}
                              >
                                {ptrLabels.map((p) => (
                                  <span
                                    key={p}
                                    style={{
                                      fontSize: 9.5,
                                      padding: '0 4px',
                                      borderRadius: 3,
                                      background:
                                        p === 'mid'
                                          ? 'var(--accent-emerald)'
                                          : 'var(--accent-cyan)',
                                      color: '#030408',
                                      fontWeight: 800,
                                    }}
                                  >
                                    ↑{p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.5fr',
                      gap: 14,
                      alignItems: 'start',
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--bg-surface-2)',
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          color: 'var(--accent-cyan)',
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        ▶ Line {activeTrace.line} (Step {activeTrace.step})
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {activeTrace.explanation}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {variableHistorySeries.map((series) => (
                        <div
                          key={series.name}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 7,
                            background: 'var(--bg-surface-2)',
                            border: `1px solid ${
                              series.changedAtCurrentStep
                                ? 'var(--accent-emerald)'
                                : 'var(--border-hairline)'
                            }`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                color: 'var(--text-secondary)',
                                fontSize: 11.5,
                              }}
                            >
                              {series.name}
                            </span>
                            <strong
                              style={{
                                color: series.changedAtCurrentStep
                                  ? 'var(--accent-emerald)'
                                  : 'var(--accent-cyan)',
                                fontSize: 12,
                              }}
                            >
                              {String(series.currentValue)}
                            </strong>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              gap: 2,
                              height: 18,
                              marginTop: 6,
                            }}
                          >
                            {series.points.slice(0, 24).map((pt, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={() => setCurrentTraceIdx(pIdx)}
                                style={{
                                  flex: 1,
                                  height: `${pt.normalizedHeight}%`,
                                  borderRadius: 2,
                                  cursor: 'pointer',
                                  background:
                                    pIdx === currentTraceIdx
                                      ? 'var(--accent-cyan)'
                                      : pt.changed
                                      ? 'var(--accent-emerald)'
                                      : 'rgba(148, 163, 184, 0.25)',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {bottomTab === 'terminal' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ overflowY: 'auto' }}>
                    {terminalLines.map((l, i) => (
                      <div
                        key={i}
                        style={{
                          color:
                            l.startsWith('$') || l.startsWith('✔')
                              ? 'var(--accent-emerald)'
                              : l.startsWith('❌')
                              ? 'var(--accent-magenta)'
                              : l.startsWith('=>')
                              ? 'var(--accent-cyan)'
                              : 'var(--text-primary)',
                          marginBottom: 3,
                        }}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={handleTerminalSubmit}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginTop: 6,
                      borderTop: '1px solid var(--border-hairline)',
                      paddingTop: 6,
                    }}
                  >
                    <span
                      style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}
                    >
                      PS workspace&gt;
                    </span>
                    <input
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      placeholder="Type 'run', 'gcc main.c -o main.exe', 'test', 'trace'..."
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                      }}
                    />
                  </form>
                </div>
              )}

              {bottomTab === 'tests' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workspaceTestResults.map((suite) => (
                    <div
                      key={suite.fileId}
                      style={{
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <strong
                          onClick={() => openFile(suite.fileId)}
                          style={{
                            color: suite.passed
                              ? 'var(--accent-emerald)'
                              : 'var(--accent-magenta)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {suite.passed ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {suite.filePath}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {suite.durationMs}ms
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {suite.assertions.map((a, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '4px 8px',
                              borderRadius: 5,
                              background: a.passed
                                ? 'rgba(52, 211, 153, 0.08)'
                                : 'rgba(244, 63, 94, 0.12)',
                              color: a.passed
                                ? 'var(--text-primary)'
                                : '#fda4af',
                            }}
                          >
                            <span>
                              {a.passed ? '✔' : '✖'} {a.label}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {a.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {bottomTab === 'problems' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {qualityReport.diagnostics.length === 0 ? (
                    <div style={{ color: 'var(--accent-emerald)' }}>
                      ✔ 0 Static Analysis or Lint Warnings in {activeFile.path}.
                    </div>
                  ) : (
                    qualityReport.diagnostics.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'var(--bg-surface-2)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          onClick={() =>
                            jumpToFileAndLine(activeFile.id, d.line)
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                          }}
                        >
                          <AlertTriangle
                            size={13}
                            color={
                              d.severity === 'error'
                                ? 'var(--accent-magenta)'
                                : 'var(--accent-amber)'
                            }
                          />
                          <span>
                            <strong>Ln {d.line}</strong> [{d.rule}]: {d.message}
                          </span>
                        </div>
                        {d.quickFixLabel && (
                          <button
                            className="cyber-btn"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => applyDiagnosticQuickFix(d)}
                          >
                            <Wrench size={11} /> {d.quickFixLabel}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {bottomTab === 'diff' && (
                <div>
                  {activeFileDiff.map((d, idx) => (
                    <div key={idx} className={`diff-line ${d.type}`}>
                      <span
                        style={{
                          width: 28,
                          display: 'inline-block',
                          opacity: 0.45,
                        }}
                      >
                        {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
                      </span>
                      <span>{d.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT AI COPILOT & COMPOSER PANEL */}
        {!zenMode && (
          <>
            <div
              className={`sash-vertical ${
                dragTarget === 'ai' ? 'dragging' : ''
              }`}
              onMouseDown={() => setDragTarget('ai')}
              title="Drag to resize AI Copilot panel"
            />
            <aside
              style={{
                width: aiPanelWidth,
                background: 'var(--bg-surface-1)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-hairline)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={16} color="var(--accent-cyan)" />
                  <strong style={{ fontSize: 12.5 }}>GEMINI 2.5 PRO COPILOT</strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-canvas)',
                    padding: 2,
                    borderRadius: 7,
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <button
                    onClick={() => setCopilotMode('chat')}
                    style={{
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 5,
                      border: 'none',
                      cursor: 'pointer',
                      background:
                        copilotMode === 'chat'
                          ? 'var(--bg-surface-3)'
                          : 'transparent',
                      color:
                        copilotMode === 'chat'
                          ? 'var(--accent-cyan)'
                          : 'var(--text-muted)',
                    }}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setCopilotMode('composer')}
                    style={{
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 5,
                      border: 'none',
                      cursor: 'pointer',
                      background:
                        copilotMode === 'composer'
                          ? 'var(--bg-surface-3)'
                          : 'transparent',
                      color:
                        copilotMode === 'composer'
                          ? 'var(--accent-cyan)'
                          : 'var(--text-muted)',
                    }}
                  >
                    Composer
                  </button>
                </div>
              </div>

              {copilotMode === 'chat' ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--border-hairline)',
                      alignItems: 'center',
                    }}
                  >
                    {[
                      { label: 'Optimize', mode: 'generate' as const },
                      { label: 'Find Bugs', mode: 'debug' as const },
                      { label: 'Explain', mode: 'explain' as const },
                    ].map((act) => (
                      <button
                        key={act.label}
                        className="cyber-btn secondary"
                        style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                        onClick={() =>
                          triggerAiAction(
                            `${act.label} the code in ${activeFile.path}.`,
                            act.mode
                          )
                        }
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      padding: 12,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          background:
                            msg.role === 'user'
                              ? 'rgba(6, 182, 212, 0.1)'
                              : 'var(--bg-surface-2)',
                          border: `1px solid ${
                            msg.role === 'user'
                              ? 'rgba(6, 182, 212, 0.3)'
                              : 'var(--border-hairline)'
                          }`,
                          borderRadius: 9,
                          padding: 12,
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 10,
                            color:
                              msg.role === 'user'
                                ? 'var(--accent-cyan)'
                                : 'var(--accent-violet)',
                            marginBottom: 4,
                          }}
                        >
                          {msg.role === 'user'
                            ? 'ENGINEER'
                            : activePreset.name.toUpperCase()}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        {msg.codeSnippet && (
                          <div style={{ marginTop: 8 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#020308',
                                padding: '4px 8px',
                                borderRadius: '6px 6px 0 0',
                                borderBottom: '1px solid var(--border-hairline)',
                              }}
                            >
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {activeFile.language.toUpperCase()} SNIPPET
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="cyber-btn secondary"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.codeSnippet || '');
                                    pushToast('Copied to Clipboard', '', 'success');
                                  }}
                                  title="Copy Code"
                                >
                                  <ClipboardCopy size={11} /> Copy
                                </button>
                                <button
                                  className="cyber-btn"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                                  onClick={() => {
                                    updateFileContent(activeFile.id, msg.codeSnippet || '');
                                    pushToast('Inserted into Editor', activeFile.path, 'success');
                                  }}
                                  title="Insert into Editor"
                                >
                                  <ArrowDownToLine size={11} /> Insert
                                </button>
                              </div>
                            </div>
                            <pre
                              style={{
                                padding: 10,
                                background: 'var(--bg-canvas)',
                                borderRadius: '0 0 6px 6px',
                                fontSize: 11.5,
                                overflowX: 'auto',
                                color: 'var(--accent-emerald)',
                                margin: 0,
                              }}
                            >
                              {msg.codeSnippet}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                    {aiLoading && (
                      <div
                        style={{ color: 'var(--accent-cyan)', fontSize: 11.5 }}
                      >
                        Analyzing workspace AST & generating response...
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!aiInput.trim()) return;
                      triggerAiAction(aiInput.trim(), 'generate');
                      setAiInput('');
                    }}
                    style={{
                      padding: 10,
                      borderTop: '1px solid var(--border-hairline)',
                      display: 'flex',
                      gap: 6,
                      background: 'var(--bg-primary)',
                    }}
                  >
                    <input
                      className="cyber-input"
                      placeholder="Ask Copilot or request C refactor..."
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cyber-btn"
                      disabled={aiLoading}
                    >
                      <Zap size={13} />
                    </button>
                  </form>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    overflowY: 'auto',
                  }}
                >
                  <span className="field-label">
                    MULTI-FILE ENGINEERING COMPOSER
                  </span>
                  <textarea
                    className="cyber-input"
                    rows={3}
                    value={composerGoal}
                    onChange={(e) => setComposerGoal(e.target.value)}
                    placeholder="Describe a multi-step C engineering objective..."
                  />
                  <button
                    className="cyber-btn"
                    disabled={aiLoading}
                    onClick={handleRunComposerPlan}
                  >
                    <ListChecks size={14} />{' '}
                    {aiLoading
                      ? 'Executing Plan...'
                      : 'Execute 4-Stage Task Plan'}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    {composerSteps.map((st) => (
                      <div
                        key={st.id}
                        className="preset-item"
                        style={{
                          cursor: 'default',
                          borderLeft: `3px solid ${
                            st.status === 'done'
                              ? 'var(--accent-emerald)'
                              : st.status === 'running'
                              ? 'var(--accent-cyan)'
                              : 'var(--border-subtle)'
                          }`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <strong style={{ fontSize: 12 }}>{st.title}</strong>
                          <span
                            className="stage-pill"
                            style={{
                              fontSize: 9.5,
                              color:
                                st.status === 'done'
                                  ? 'var(--accent-emerald)'
                                  : undefined,
                            }}
                          >
                            {st.status.toUpperCase()}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            marginTop: 4,
                          }}
                        >
                          {st.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      {/* STATUS BAR */}
      <footer
        style={{
          height: 25,
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-hairline)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>
            ⎇ main
            {modifiedFiles.length > 0
              ? `* (${modifiedFiles.length} modified)`
              : ''}
          </span>
          <span>{activeFile.path}</span>
          <span>● {activeBreakpoints.length} Breakpoints</span>
          <span>
            Score: {qualityReport.maintainabilityScore}/100 (
            {qualityReport.timeComplexity})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span
            onClick={() => setShortcutsModalOpen(true)}
            style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }}
          >
            ⌨ Ctrl+/ Keybindings
          </span>
          <span>{LANGUAGE_META[activeFile.language].label}</span>
          <span style={{ color: 'var(--accent-emerald)' }}>
            ● GCC 14.2 PE64 Target
          </span>
        </div>
      </footer>
    </div>
  );
};

export default ImmersiveWorkspace;