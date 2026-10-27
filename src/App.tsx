import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  Sparkles,
  Wand2,
  FlaskConical,
  Columns,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Folder,
  FilePlus,
  FolderPlus,
  Bookmark,
  Edit3,
  Trash2,
  Search,
  GitBranch,
  Gauge,
  Network,
  Zap,
  Compass,
  Keyboard,
  Upload,
  Download,
  Command,
  Bot,
  Copy,
  ArrowDownToLine,
  X,
  LayoutGrid,
  Code2,
  Award,
  FolderKanban,
  Puzzle,
  Sliders,
  CheckCircle2,
  Key,
  Cpu,
} from 'lucide-react';
import type { SupportedLanguage, TraceFrame, IdeTheme } from './types';
import {
  LANGUAGE_META,
  CODING_EXERCISES,
  executeCodeInSandbox,
  generateDynamicTrace,
  formatCodeBuffer,
  analyzeCodeQuality,
  synthesizeUnitTestFile,
  getStoredTheme,
  saveStoredTheme,
  getStoredProjects,
  saveStoredProjects,
  getStoredExtensions,
  getStoredApiKey,
  saveStoredApiKey,
  getSolvedExercises,
  saveSolvedExercises,
  runExerciseTestSuite,
} from './services/storage';
import { generateOrExplainCode } from './services/gemini';

type ActiveView = 'command' | 'workbench' | 'dojo' | 'vault' | 'extensions' | 'settings';

interface VfsFile {
  id: string;
  name: string;
  folder: 'src' | 'tests' | 'docs';
  language: SupportedLanguage;
  content: string;
  dirty?: boolean;
}

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>('workbench');
  const [theme, setTheme] = useState<IdeTheme>(() => getStoredTheme());
  const [language, setLanguage] = useState<SupportedLanguage>('cpp');
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());

  // Apply theme attribute to HTML root immediately for instant theme switching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveStoredTheme(theme);
  }, [theme]);

  // Workspace VFS files matching Screenshot 2026-10-25 174710.png
  const [files, setFiles] = useState<VfsFile[]>([
    {
      id: 'f-main',
      name: 'main.cpp',
      folder: 'src',
      language: 'cpp',
      content: LANGUAGE_META.cpp.defaultCode,
      dirty: true,
    },
    {
      id: 'f-py',
      name: 'search.py',
      folder: 'src',
      language: 'python',
      content: LANGUAGE_META.python.defaultCode,
    },
    {
      id: 'f-ts',
      name: 'telemetry.ts',
      folder: 'src',
      language: 'typescript',
      content: LANGUAGE_META.typescript.defaultCode,
    },
    {
      id: 't-1',
      name: 'algorithm.spec.ts',
      folder: 'tests',
      language: 'typescript',
      content: '// Unit test suite for binarySearch\nconsole.log("PASS: algorithm.spec.ts");',
    },
    {
      id: 't-2',
      name: 'main.spec.ts',
      folder: 'tests',
      language: 'typescript',
      content: '// Auto-verified main spec\nconsole.log("PASS: main.spec.ts");',
      dirty: true,
    },
    {
      id: 't-3',
      name: 'main.spec.spec.rs',
      folder: 'tests',
      language: 'rust',
      content: 'fn main() { println!("Rust test suite verified"); }',
      dirty: true,
    },
    {
      id: 't-4',
      name: 'main.spec.spec.spec.ts',
      folder: 'tests',
      language: 'typescript',
      content: '// Deep boundary assertions',
      dirty: true,
    },
    {
      id: 't-5',
      name: 'main.spec.spec.spec.c',
      folder: 'tests',
      language: 'cpp',
      content: '#include <stdio.h>\nint main() { printf("C assertions passed\\n"); return 0; }',
      dirty: true,
    },
  ]);

  const [activeFileId, setActiveFileId] = useState<string>('f-main');
  const [openTabIds, setOpenTabIds] = useState<string[]>(['f-main', 'f-py']);
  const [breakpoints, setBreakpoints] = useState<number[]>([7]);
  const [splitView, setSplitView] = useState<boolean>(false);

  // Bottom Dock & Loop Dry-Run Tracer State
  const [dockTab, setDockTab] = useState<'tracer' | 'terminal' | 'tests' | 'diagnostics' | 'diff'>('tracer');
  const [traceFrames, setTraceFrames] = useState<TraceFrame[]>([
    {
      step: 1,
      line: 1,
      variables: { status: 'Ready' },
      explanation: 'Write a function or variable assignment to inspect live execution states.',
    },
  ]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[GCC 14.2 PE64] Ready on workspace/src/main.cpp',
  ]);

  // Copilot Right Sidebar State
  const [copilotMode, setCopilotMode] = useState<'chat' | 'composer'>('chat');
  const [chatInput, setChatInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; title: string; text: string; code?: string }>
  >([
    {
      id: 'welcome',
      title: 'INTERACTIVE SYSTEMS MENTOR',
      text: 'Ready on src/main.cpp. Click **📋 Copy** or **⬇️ Insert** on any AI code snippet to paste it directly into your editor.',
    },
  ]);

  // Vault, Dojo & Extensions State
  const [projects, setProjects] = useState(() => getStoredProjects());
  const [extensions, setExtensions] = useState(() => getStoredExtensions());
  const [solvedIds, setSolvedIds] = useState<string[]>(() => getSolvedExercises());
  const [activeExercise, setActiveExercise] = useState(CODING_EXERCISES[0]);
  const [dojoResults, setDojoResults] = useState<any[]>([]);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const currentFrame = traceFrames[currentStepIdx] || traceFrames[0];
  const complexity = analyzeCodeQuality(activeFile.content);

  // Auto-play timer for Dry-Run Tracer
  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev + 1 < traceFrames.length) return prev + 1;
        setAutoPlay(false);
        return prev;
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [autoPlay, traceFrames.length]);

  const updateActiveCode = (newCode: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: newCode, dirty: true } : f))
    );
  };

  // Dynamic Language Switcher -> updates Explorer & Active File
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const meta = LANGUAGE_META[newLang];
    const targetName = newLang === 'cpp' ? 'main.cpp' : `main.${meta.extension}`;
    const existing = files.find((f) => f.name === targetName || (f.folder === 'src' && f.language === newLang));

    if (existing) {
      setActiveFileId(existing.id);
      if (!openTabIds.includes(existing.id)) {
        setOpenTabIds((prev) => [...prev, existing.id]);
      }
    } else {
      const created: VfsFile = {
        id: `f-${Date.now()}`,
        name: targetName,
        folder: 'src',
        language: newLang,
        content: meta.defaultCode,
        dirty: true,
      };
      setFiles((prev) => [created, ...prev]);
      setActiveFileId(created.id);
      setOpenTabIds((prev) => [...prev, created.id]);
    }
  };

  // Run Code + C/C++ .exe Artifact Compilation + Loop Tracer Generation
  const handleRunCode = () => {
    const res = executeCodeInSandbox(activeFile.content, activeFile.language);
    const frames = generateDynamicTrace(activeFile.content, activeFile.language);
    setTraceFrames(frames);
    setCurrentStepIdx(0);

    const newLogs: string[] = [
      `$ gcc -O2 -std=c23 src/${activeFile.name} -o build/main.exe`,
      ...res.logs,
      res.error
        ? `[ERROR] ${res.error}`
        : `[EXIT 0] Executed in ${res.durationMs}ms | Return: ${res.returnValue ?? '0'}`,
    ];
    setTerminalLogs(newLogs);

    if (activeFile.language === 'cpp') {
      const exeContent = [
        '// PE64 / ELF EXECUTABLE BINARY ARTIFACT (GCC 14.2)',
        `// Source: src/${activeFile.name}`,
        '// Flags: -O2 -std=c23 -Wall',
        '// --------------------------------------------------',
        ...res.logs.map((l) => `// [STDOUT] ${l}`),
      ].join('\n');

      setFiles((prev) => {
        const exists = prev.some((f) => f.name === 'main.exe');
        if (exists) {
          return prev.map((f) => (f.name === 'main.exe' ? { ...f, content: exeContent, dirty: true } : f));
        }
        return [
          ...prev,
          {
            id: 'f-exe',
            name: 'main.exe',
            folder: 'src',
            language: 'cpp',
            content: exeContent,
            dirty: true,
          },
        ];
      });
    }
  };

  const handleFormat = () => {
    updateActiveCode(formatCodeBuffer(activeFile.content));
  };

  const handleGenerateSpec = () => {
    const spec = synthesizeUnitTestFile(activeFile.name, activeFile.content);
    const newSpec: VfsFile = {
      id: `spec-${Date.now()}`,
      name: spec.testFileName,
      folder: 'tests',
      language: 'typescript',
      content: spec.testContent,
      dirty: true,
    };
    setFiles((prev) => [...prev, newSpec]);
    setDockTab('tests');
  };

  const handleAskCopilot = async (mode: 'explain' | 'generate' | 'debug', customPrompt?: string) => {
    const promptText = customPrompt || chatInput.trim() || `Explain my ${activeFile.name} code simply.`;
    setAiLoading(true);
    setChatInput('');
    try {
      const resp = await generateOrExplainCode({
        mode,
        language: activeFile.language,
        userPrompt: promptText,
        currentCode: activeFile.content,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          title: `COPILOT MENTOR • ${resp.complexity}`,
          text: resp.explanation,
          code: resp.code,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleStepToBreakpoint = () => {
    const foundIdx = traceFrames.findIndex(
      (f, idx) => idx > currentStepIdx && breakpoints.includes(f.line)
    );
    if (foundIdx !== -1) {
      setCurrentStepIdx(foundIdx);
    } else if (traceFrames.length > 0) {
      setCurrentStepIdx(traceFrames.length - 1);
    }
  };

  const handleSaveToVault = () => {
    const newProj = {
      id: `proj-${Date.now()}`,
      title: `${activeFile.name} Snapshot`,
      language: activeFile.language,
      code: activeFile.content,
      notes: `Saved from IDE Workbench (${complexity.timeComplexity})`,
      tags: [LANGUAGE_META[activeFile.language].badge, activeFile.name],
      updatedAt: 'Just now',
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
  };

  const srcFiles = files.filter((f) => f.folder === 'src');
  const testFiles = files.filter((f) => f.folder === 'tests');
  const docFiles = files.filter((f) => f.folder === 'docs');

  return (
    <div className="ide-root" data-theme={theme}>
      {/* =========================================================
          TOP MASTER HEADER (MATCHES SCREENSHOT 100%)
         ========================================================= */}
      <header className="ide-header">
        <div className="ide-brand">
          <div className="cp-logo-box">CP</div>
          <span className="brand-title">CodePilot Lab</span>
          <span className="brand-version-pill">v10.0 Pro Platform</span>
        </div>

        <nav className="ide-mode-nav">
          <button
            className={`ide-mode-btn ${activeView === 'command' ? 'active' : ''}`}
            onClick={() => setActiveView('command')}
          >
            <LayoutGrid size={13} /> Command Center
          </button>
          <button
            className={`ide-mode-btn ${activeView === 'workbench' ? 'active' : ''}`}
            onClick={() => setActiveView('workbench')}
          >
            <Code2 size={13} /> IDE Workbench
          </button>
          <button
            className={`ide-mode-btn ${activeView === 'dojo' ? 'active' : ''}`}
            onClick={() => setActiveView('dojo')}
          >
            <Award size={13} /> Coding Dojo
          </button>
          <button
            className={`ide-mode-btn ${activeView === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveView('vault')}
          >
            <FolderKanban size={13} /> Project Vault ({projects.length})
          </button>
          <button
            className={`ide-mode-btn ${activeView === 'extensions' ? 'active' : ''}`}
            onClick={() => setActiveView('extensions')}
          >
            <Puzzle size={13} /> Extensions
          </button>
          <button
            className={`ide-mode-btn ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <Sliders size={13} /> AI & Settings
          </button>
        </nav>

        <div className="ide-header-right">
          <select
            className="header-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as IdeTheme)}
            title="Switch IDE Theme"
          >
            <option value="tokyo-night">Tokyo Night Cyb</option>
            <option value="obsidian">Obsidian Pro</option>
            <option value="vercel">Vercel Pitch</option>
          </select>

          <button
            className="gemini-status-pill"
            onClick={() => setActiveView('settings')}
            title="Configure Gemini API Key"
          >
            <Key size={12} /> Gemini Key Active
          </button>

          <select
            className="header-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
          >
            <option value="cpp">C++ 20</option>
            <option value="python">Python 3.13</option>
            <option value="typescript">TypeScript 5.6</option>
            <option value="javascript">JavaScript</option>
            <option value="rust">Rust 1.82</option>
            <option value="go">Go 1.23</option>
            <option value="java">Java 21</option>
          </select>
        </div>
      </header>

      {/* =========================================================
          SLIDE 1: IDE WORKBENCH (EXACT MATCH TO SCREENSHOT)
         ========================================================= */}
      {activeView === 'workbench' && (
        <div className="wb-shell">
          <div className="wb-main-grid">
            {/* Column 1: Left Activity Icon Rail */}
            <aside className="wb-activity-rail">
              <div className="wb-rail-group">
                <button className="wb-rail-btn active" title="Workspace Files">
                  <Folder size={15} />
                </button>
                <button className="wb-rail-btn" title="Search Files">
                  <Search size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Git Source Control"
                  onClick={() => setDockTab('diff')}
                >
                  <GitBranch size={15} />
                  <span className="wb-rail-badge">5</span>
                </button>
                <button
                  className="wb-rail-btn"
                  title="Complexity & Diagnostics"
                  onClick={() => setDockTab('diagnostics')}
                >
                  <Gauge size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Visual Memory Tracer"
                  onClick={() => setDockTab('tracer')}
                >
                  <Network size={15} />
                </button>
                <button className="wb-rail-btn" title="Quick Execute" onClick={handleRunCode}>
                  <Zap size={15} />
                </button>
              </div>

              <div className="wb-rail-group">
                <button className="wb-rail-btn" title="Command Center" onClick={() => setActiveView('command')}>
                  <Compass size={15} />
                </button>
                <button className="wb-rail-btn" title="Keybindings">
                  <Keyboard size={15} />
                </button>
                <button className="wb-rail-btn" title="Import Workspace">
                  <Upload size={15} />
                </button>
                <button className="wb-rail-btn" title="Save Snapshot" onClick={handleSaveToVault}>
                  <Download size={15} />
                </button>
                <button className="wb-rail-btn" title="Settings" onClick={() => setActiveView('settings')}>
                  <Command size={15} />
                </button>
              </div>
            </aside>

            {/* Column 2: Workspace Files Explorer */}
            <aside className="wb-explorer-panel">
              <div className="wb-explorer-header">
                <span className="wb-explorer-title">WORKSPACE FILES ({files.length})</span>
                <div className="wb-explorer-actions">
                  <button
                    className="wb-icon-mini-btn"
                    title="New Source File"
                    onClick={() => {
                      const ext = LANGUAGE_META[language].extension;
                      const nf: VfsFile = {
                        id: `f-${Date.now()}`,
                        name: `module_${srcFiles.length + 1}.${ext}`,
                        folder: 'src',
                        language,
                        content: LANGUAGE_META[language].starter,
                        dirty: true,
                      };
                      setFiles((prev) => [...prev, nf]);
                      setActiveFileId(nf.id);
                      setOpenTabIds((prev) => [...prev, nf.id]);
                    }}
                  >
                    <FilePlus size={13} />
                  </button>
                  <button className="wb-icon-mini-btn" title="New Spec File" onClick={handleGenerateSpec}>
                    <FolderPlus size={13} />
                  </button>
                  <button className="wb-icon-mini-btn" title="Save to Project Vault" onClick={handleSaveToVault}>
                    <Bookmark size={13} />
                  </button>
                </div>
              </div>

              <div className="wb-tree-scroll">
                {/* src folder */}
                <div className="wb-folder-row">
                  <div className="wb-folder-left">
                    <Folder size={14} className="wb-folder-icon" />
                    <span>src</span>
                  </div>
                  <span className="wb-folder-count">{srcFiles.length}</span>
                </div>
                <div className="wb-file-list">
                  {srcFiles.map((f) => (
                    <div
                      key={f.id}
                      className={`wb-file-row ${f.id === activeFile.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFileId(f.id);
                        setLanguage(f.language);
                        if (!openTabIds.includes(f.id)) setOpenTabIds((p) => [...p, f.id]);
                      }}
                    >
                      <div className="wb-file-left">
                        <span className="wb-file-code-tag">&lt;/&gt;</span>
                        <span className="wb-file-name">{f.name}</span>
                        {f.dirty && <span className="wb-dirty-dot" />}
                      </div>
                      <div className="wb-file-hover-actions">
                        <Edit3 size={11} />
                        <Trash2
                          size={11}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (files.length > 1) {
                              const rem = files.filter((x) => x.id !== f.id);
                              setFiles(rem);
                              if (activeFile.id === f.id) setActiveFileId(rem[0].id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* tests folder */}
                <div className="wb-folder-row">
                  <div className="wb-folder-left">
                    <Folder size={14} className="wb-folder-icon" />
                    <span>tests</span>
                  </div>
                  <span className="wb-folder-count">{testFiles.length}</span>
                </div>
                <div className="wb-file-list">
                  {testFiles.map((f) => (
                    <div
                      key={f.id}
                      className={`wb-file-row ${f.id === activeFile.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFileId(f.id);
                        if (!openTabIds.includes(f.id)) setOpenTabIds((p) => [...p, f.id]);
                      }}
                    >
                      <div className="wb-file-left">
                        <span className="wb-file-code-tag">&lt;/&gt;</span>
                        <span className="wb-file-name">{f.name}</span>
                        {f.dirty && <span className="wb-dirty-dot" />}
                      </div>
                      <div className="wb-file-hover-actions">
                        <Edit3 size={11} />
                        <Trash2 size={11} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* docs folder */}
                <div className="wb-folder-row">
                  <div className="wb-folder-left">
                    <Folder size={14} className="wb-folder-icon" />
                    <span>docs</span>
                  </div>
                  <span className="wb-folder-count">{docFiles.length}</span>
                </div>
              </div>

              <div className="wb-breakpoints-footer">
                <div className="wb-bp-header">
                  <span>BREAKPOINTS ({breakpoints.length})</span>
                  <span style={{ fontWeight: 400 }}>Click gutter to toggle</span>
                </div>
                <div className="wb-bp-list">
                  {breakpoints.map((ln) => (
                    <span
                      key={ln}
                      className="wb-bp-pill"
                      onClick={() =>
                        setBreakpoints((prev) =>
                          prev.length > 1 ? prev.filter((b) => b !== ln) : prev
                        )
                      }
                    >
                      ⊙ Ln {ln}
                    </span>
                  ))}
                </div>
              </div>
            </aside>

            {/* Column 3: Center Editor & Bottom Tracer Dock */}
            <main className="wb-center-stage">
              <div className="wb-editor-topbar">
                <div className="wb-tabs-group">
                  {openTabIds.map((tid) => {
                    const tabFile = files.find((f) => f.id === tid);
                    if (!tabFile) return null;
                    return (
                      <div
                        key={tabFile.id}
                        className={`wb-tab-item ${tabFile.id === activeFile.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveFileId(tabFile.id);
                          setLanguage(tabFile.language);
                        }}
                      >
                        <span className="wb-file-code-tag">&lt;/&gt;</span>
                        <span>{tabFile.name}</span>
                        {tabFile.dirty && <span className="wb-dirty-dot" />}
                        <X
                          size={12}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openTabIds.length > 1) {
                              const rem = openTabIds.filter((id) => id !== tabFile.id);
                              setOpenTabIds(rem);
                              if (activeFile.id === tabFile.id) setActiveFileId(rem[0]);
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="wb-toolbar-actions">
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                  >
                    <option value="cpp">C++ 20</option>
                    <option value="python">Python 3.13</option>
                    <option value="typescript">TypeScript 5.6</option>
                    <option value="javascript">JavaScript</option>
                    <option value="rust">Rust 1.82</option>
                    <option value="go">Go 1.23</option>
                    <option value="java">Java 21</option>
                  </select>

                  <button
                    className="wb-tool-btn"
                    onClick={() => handleAskCopilot('generate', 'Optimize and clean up this code')}
                  >
                    <Sparkles size={13} /> Inline AI
                  </button>
                  <button className="wb-tool-btn" onClick={handleFormat}>
                    <Wand2 size={13} /> Format
                  </button>
                  <button className="wb-tool-btn" onClick={handleGenerateSpec}>
                    <FlaskConical size={13} /> Spec
                  </button>
                  <button className="wb-tool-btn" onClick={() => setSplitView((s) => !s)}>
                    <Columns size={13} /> Split
                  </button>
                  <button className="wb-tool-btn run-btn" onClick={handleRunCode}>
                    <Play size={13} /> Run
                  </button>
                </div>
              </div>

              <div className="wb-breadcrumbs">
                <span>
                  workspace &gt; {activeFile.folder} &gt;{' '}
                  <strong style={{ color: '#e2e8f0' }}>{activeFile.name}</strong>
                </span>
                <span>
                  Ln {currentFrame?.line || 1}, Col 1{' '}
                  <span className="wb-trace-ptr">• Trace Ptr: Ln {currentFrame?.line || 1}</span>
                </span>
              </div>

              <div className="wb-editor-canvas">
                <div style={{ flex: 1, height: '100%' }}>
                  <Editor
                    height="100%"
                    language={LANGUAGE_META[activeFile.language]?.monacoLang || 'cpp'}
                    theme="vs-dark"
                    value={activeFile.content}
                    onChange={(val) => updateActiveCode(val || '')}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      minimap: { enabled: false },
                      glyphMargin: true,
                      lineNumbersMinChars: 3,
                      scrollBeyondLastLine: false,
                      padding: { top: 10 },
                    }}
                  />
                </div>
                {splitView && (
                  <div
                    style={{
                      flex: 1,
                      height: '100%',
                      borderLeft: '1px solid var(--border-hairline)',
                    }}
                  >
                    <Editor
                      height="100%"
                      language={LANGUAGE_META[activeFile.language]?.monacoLang || 'cpp'}
                      theme="vs-dark"
                      value={formatCodeBuffer(activeFile.content)}
                      options={{
                        readOnly: true,
                        fontSize: 12.5,
                        fontFamily: "'JetBrains Mono', monospace",
                        minimap: { enabled: false },
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Bottom Visual Memory & Tracer Dock */}
              <div className="wb-bottom-dock">
                <div className="wb-dock-header">
                  <div className="wb-dock-tabs">
                    <button
                      className={`wb-dock-tab ${dockTab === 'tracer' ? 'active' : ''}`}
                      onClick={() => setDockTab('tracer')}
                    >
                      VISUAL MEMORY & TRACER ({traceFrames.length} STEPS)
                    </button>
                    <button
                      className={`wb-dock-tab ${dockTab === 'terminal' ? 'active' : ''}`}
                      onClick={() => setDockTab('terminal')}
                    >
                      TERMINAL & SANDBOX
                    </button>
                    <button
                      className={`wb-dock-tab ${dockTab === 'tests' ? 'active' : ''}`}
                      onClick={() => setDockTab('tests')}
                    >
                      UNIT TESTS ({testFiles.length} SUITES)
                    </button>
                    <button
                      className={`wb-dock-tab ${dockTab === 'diagnostics' ? 'active' : ''}`}
                      onClick={() => setDockTab('diagnostics')}
                    >
                      DIAGNOSTICS (0)
                    </button>
                    <button
                      className={`wb-dock-tab ${dockTab === 'diff' ? 'active' : ''}`}
                      onClick={() => setDockTab('diff')}
                    >
                      GIT DIFF (26)
                    </button>
                  </div>

                  <div className="wb-tracer-controls">
                    <button className="wb-step-btn" onClick={() => setCurrentStepIdx(0)}>
                      <RotateCcw size={12} /> Reset
                    </button>
                    <button
                      className="wb-step-btn"
                      onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft size={12} /> Prev
                    </button>
                    <button
                      className="wb-step-btn autoplay"
                      onClick={() => setAutoPlay((a) => !a)}
                    >
                      <Play size={12} /> {autoPlay ? 'Pause' : 'Auto-Play'}
                    </button>
                    <span className="wb-step-counter">
                      Step {currentStepIdx + 1} / {traceFrames.length}
                    </span>
                    <button
                      className="wb-step-btn"
                      onClick={() =>
                        setCurrentStepIdx((i) => Math.min(traceFrames.length - 1, i + 1))
                      }
                    >
                      <ChevronRight size={12} /> Step
                    </button>
                    <button className="wb-step-btn" onClick={handleStepToBreakpoint}>
                      To Breakpoint
                    </button>
                  </div>
                </div>

                <div className="wb-dock-body">
                  {dockTab === 'tracer' && (
                    <>
                      <div className="wb-step-pills-row">
                        {traceFrames.map((frame, idx) => (
                          <button
                            key={frame.step}
                            className={`wb-step-num-pill ${idx === currentStepIdx ? 'active' : ''}`}
                            onClick={() => setCurrentStepIdx(idx)}
                          >
                            {frame.step}
                          </button>
                        ))}
                      </div>

                      <div className="wb-trace-cards-row">
                        <div className="wb-trace-explain-card">
                          <div className="wb-trace-line-title">
                            ► Line {currentFrame?.line || 1} (Step {currentFrame?.step || 1})
                          </div>
                          <div className="wb-trace-explain-text">
                            {currentFrame?.explanation}
                          </div>
                        </div>

                        {Object.entries(currentFrame?.variables || { status: 'Ready' }).map(
                          ([k, v]) => (
                            <div key={k} className="wb-trace-var-card">
                              <div className="wb-var-top">
                                <span style={{ color: '#94a3b8' }}>{k}</span>
                                <span className="wb-var-val">{String(v)}</span>
                              </div>
                              <div className="wb-var-bar">
                                <div className="wb-var-bar-fill" style={{ width: '100%' }} />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  )}

                  {dockTab === 'terminal' && (
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      {terminalLogs.map((log, i) => (
                        <div key={i} style={{ marginBottom: 4, color: '#cbd5e1' }}>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {dockTab === 'tests' && (
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      {testFiles.map((tf) => (
                        <div key={tf.id} style={{ color: '#4ade80', marginBottom: 4 }}>
                          ✓ PASS {tf.name} (0.2ms)
                        </div>
                      ))}
                    </div>
                  )}

                  {dockTab === 'diagnostics' && (
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      Complexity: {complexity.timeComplexity} Time | {complexity.spaceComplexity}{' '}
                      Space • Maintainability Score: {complexity.maintainabilityScore}/100 (0
                      Errors)
                    </div>
                  )}

                  {dockTab === 'diff' && (
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: '#38bdf8',
                      }}
                    >
                      Modified buffer src/{activeFile.name} ({activeFile.content.split('\n').length}{' '}
                      lines tracked)
                    </div>
                  )}
                </div>
              </div>
            </main>

            {/* Column 4: Right Gemini Copilot Mentor Sidebar */}
            <aside className="wb-copilot-panel">
              <div className="wb-copilot-header">
                <div className="wb-copilot-title">
                  <Bot size={15} color="#22d3ee" />
                  <span>GEMINI 3.8 COPILOT</span>
                </div>
                <div className="wb-copilot-toggle">
                  <button
                    className={`wb-toggle-pill ${copilotMode === 'chat' ? 'active' : ''}`}
                    onClick={() => setCopilotMode('chat')}
                  >
                    Chat
                  </button>
                  <button
                    className={`wb-toggle-pill ${copilotMode === 'composer' ? 'active' : ''}`}
                    onClick={() => setCopilotMode('composer')}
                  >
                    Composer
                  </button>
                </div>
              </div>

              <div className="wb-copilot-quick-row">
                <button
                  className="wb-quick-pill"
                  onClick={() => handleAskCopilot('generate', 'Optimize my current code')}
                >
                  Optimize
                </button>
                <button
                  className="wb-quick-pill"
                  onClick={() => handleAskCopilot('debug', 'Find any bugs in my code')}
                >
                  Find Bugs
                </button>
                <button
                  className="wb-quick-pill"
                  onClick={() => handleAskCopilot('explain', 'Explain how this code works simply')}
                >
                  Explain
                </button>
              </div>

              <div className="wb-copilot-feed">
                {messages.map((m) => (
                  <div key={m.id} className="wb-mentor-card">
                    <div className="wb-mentor-label">{m.title}</div>
                    <div className="wb-mentor-text">{m.text}</div>
                    {m.code && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => navigator.clipboard.writeText(m.code!)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          <Copy size={12} /> Copy
                        </button>
                        <button
                          onClick={() => updateActiveCode(m.code!)}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          <ArrowDownToLine size={12} /> Insert
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="wb-mentor-card">
                    <div className="wb-mentor-label">ANALYZING AST...</div>
                    <div className="wb-mentor-text">Preparing human-friendly explanation...</div>
                  </div>
                )}
              </div>

              <div className="wb-copilot-input-row">
                <input
                  className="wb-copilot-input"
                  placeholder="Ask Copilot or request refactor..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAskCopilot('explain');
                  }}
                />
                <button
                  className="wb-send-btn"
                  onClick={() => handleAskCopilot('explain')}
                  title="Send to Copilot"
                >
                  <Zap size={14} />
                </button>
              </div>
            </aside>
          </div>

          <footer className="wb-status-bar">
            <div className="wb-status-group">
              <span style={{ color: '#22d3ee' }}>⑂ main* (5 modified)</span>
              <span>
                {activeFile.folder}/{activeFile.name}
              </span>
              <span>• {breakpoints.length} Breakpoints</span>
              <span>
                Score: {complexity.maintainabilityScore}/100 ({complexity.timeComplexity})
              </span>
            </div>
            <div className="wb-status-group">
              <span>Ln {currentFrame?.line || 1}, Col 1</span>
              <span>⌨ Ctrl+/ Keybindings</span>
              <span>{LANGUAGE_META[activeFile.language]?.badge || 'C++ 20'}</span>
              <span style={{ color: '#4ade80' }}>• v10.5 Ultra Pro</span>
            </div>
          </footer>
        </div>
      )}

      {/* =========================================================
          SLIDE 2: COMMAND CENTER (GOOD MORNING, RAGHAV)
         ========================================================= */}
      {activeView === 'command' && (
        <div className="cc-container">
          <div className="cc-hero-card">
            <div>
              <div className="cc-badge">✨ GCC 14.2 & PE64 C/C++ Toolchain Active</div>
              <h1 className="cc-hero-title">Good Morning, Raghav.</h1>
              <p className="cc-hero-sub">
                Code. Learn. Build. Create the impossible. Your active C workspace is compiled into
                inspectable <code>.exe</code> binaries with zero friction.
              </p>
              <div className="cc-quick-Tiles">
                <button className="cc-tile-btn" onClick={() => setActiveView('workbench')}>
                  <Code2 size={16} color="#22d3ee" />
                  <div>
                    <div className="cc-tile-title">IDE Workbench</div>
                    <div className="cc-tile-sub">Open Editor</div>
                  </div>
                </button>
                <button className="cc-tile-btn" onClick={() => setActiveView('dojo')}>
                  <Award size={16} color="#a855f7" />
                  <div>
                    <div className="cc-tile-title">Coding Dojo</div>
                    <div className="cc-tile-sub">6 Challenges</div>
                  </div>
                </button>
                <button className="cc-tile-btn" onClick={() => setActiveView('vault')}>
                  <FolderKanban size={16} color="#38bdf8" />
                  <div>
                    <div className="cc-tile-title">Project Vault</div>
                    <div className="cc-tile-sub">{projects.length} Saved</div>
                  </div>
                </button>
                <button className="cc-tile-btn" onClick={() => setActiveView('extensions')}>
                  <Puzzle size={16} color="#4ade80" />
                  <div>
                    <div className="cc-tile-title">Extensions</div>
                    <div className="cc-tile-sub">{extensions.length} Active</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="cc-progress-box">
              <div className="cc-progress-circle">60%</div>
              <div className="cc-progress-caption">
                Complete 5 problems (Dojo) • 3/5 explored
              </div>
            </div>
          </div>

          <div className="cc-grid-cards">
            <div className="cc-card">
              <div className="cc-card-tag">Coding Dojo</div>
              <h3>Arrays & Hashing</h3>
              <p>Next Challenge: Two Sum</p>
              <button onClick={() => setActiveView('dojo')}>Continue Challenge</button>
            </div>
            <div className="cc-card">
              <div className="cc-card-tag">Project Vault</div>
              <h3>C Workspace & .exe</h3>
              <p>Updated recently • {projects.length} snapshots</p>
              <button onClick={() => setActiveView('vault')}>Manage Vault</button>
            </div>
            <div className="cc-card">
              <div className="cc-card-tag">Extensions</div>
              <h3>GCC Toolchain & AST</h3>
              <p>PE64 Linker enabled</p>
              <button onClick={() => setActiveView('extensions')}>View Plugins</button>
            </div>
            <div className="cc-card">
              <div className="cc-card-tag">Live System</div>
              <h3>GCC 14.2 Sandbox</h3>
              <p>Files Edited: {files.length} • 0 Warnings</p>
              <button onClick={() => setActiveView('workbench')}>Inspect AST</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SLIDE 3: CODING DOJO
         ========================================================= */}
      {activeView === 'dojo' && (
        <div className="cc-container">
          <div className="cc-card">
            <div className="cc-card-tag">Interactive Coding Dojo</div>
            <h2>{activeExercise.title}</h2>
            <p style={{ margin: '8px 0 14px' }}>{activeExercise.description}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  const results = runExerciseTestSuite(activeFile.content, language, activeExercise);
                  setDojoResults(results);
                  if (!solvedIds.includes(activeExercise.id)) {
                    const next = [...solvedIds, activeExercise.id];
                    setSolvedIds(next);
                    saveSolvedExercises(next);
                  }
                }}
              >
                <CheckCircle2 size={14} color="#4ade80" /> Run Dojo Test Suite
              </button>
              <button onClick={() => setActiveView('workbench')}>Open in IDE Workbench</button>
            </div>
            {dojoResults.length > 0 && (
              <div style={{ marginTop: 14, color: '#4ade80', fontFamily: 'monospace' }}>
                ✓ All test cases passed ({dojoResults.length}/{dojoResults.length})!
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SLIDE 4: PROJECT VAULT
         ========================================================= */}
      {activeView === 'vault' && (
        <div className="cc-container">
          <div className="cc-grid-cards">
            {projects.map((proj) => (
              <div key={proj.id} className="cc-card">
                <div className="cc-card-tag">{proj.language.toUpperCase()}</div>
                <h3>{proj.title}</h3>
                <p>{proj.notes}</p>
                <button
                  onClick={() => {
                    updateActiveCode(proj.code);
                    setActiveView('workbench');
                  }}
                >
                  Load into Editor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          SLIDE 5: EXTENSIONS
         ========================================================= */}
      {activeView === 'extensions' && (
        <div className="cc-container">
          <div className="cc-grid-cards">
            {extensions.map((ext) => (
              <div key={ext.id} className="cc-card">
                <div className="cc-card-tag">
                  {ext.category} • v{ext.version}
                </div>
                <h3>{ext.name}</h3>
                <p>{ext.description}</p>
                <button
                  onClick={() =>
                    setExtensions((prev) =>
                      prev.map((x) => (x.id === ext.id ? { ...x, enabled: !x.enabled } : x))
                    )
                  }
                >
                  <Cpu size={13} /> {ext.enabled ? 'Enabled (Active)' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          SLIDE 6: AI & SETTINGS
         ========================================================= */}
      {activeView === 'settings' && (
        <div className="cc-container">
          <div className="cc-card" style={{ maxWidth: 560 }}>
            <div className="cc-card-tag">AI & Theme Configuration</div>
            <h3>Gemini Cloud API Key & Appearance</h3>
            <p style={{ margin: '8px 0 12px' }}>
              Enter your Gemini API key for live cloud mentoring, or leave blank to use the built-in
              Human-Friendly Local AST Mentor.
            </p>
            <input
              type="password"
              placeholder="Paste Gemini API Key (AIzaSy...)"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                saveStoredApiKey(e.target.value);
              }}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTheme('tokyo-night')}>Tokyo Night</button>
              <button onClick={() => setTheme('obsidian')}>Obsidian</button>
              <button onClick={() => setTheme('vercel')}>Vercel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;