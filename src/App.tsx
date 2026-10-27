import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Lightbulb,
} from 'lucide-react';
import type { SupportedLanguage, TraceFrame, IdeTheme, CodeProject } from './types';
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
  const [language, setLanguage] = useState<SupportedLanguage>('c');
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveStoredTheme(theme);
  }, [theme]);

  const [files, setFiles] = useState<VfsFile[]>([
    {
      id: 'f-main',
      name: 'main.c',
      folder: 'src',
      language: 'c',
      content: LANGUAGE_META.c.defaultCode,
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
      id: 't-1',
      name: 'algorithm.spec.ts',
      folder: 'tests',
      language: 'typescript',
      content: '// Unit test suite\nconsole.log("PASS");',
    },
  ]);

  const [activeFileId, setActiveFileId] = useState<string>('f-main');
  const [openTabIds, setOpenTabIds] = useState<string[]>(['f-main', 'f-py']);
  const [breakpoints, setBreakpoints] = useState<number[]>([7]);

  const [splitView, setSplitView] = useState<boolean>(false);
  const [splitRightMode, setSplitRightMode] = useState<'disassembly' | 'secondary' | 'formatted'>(
    'disassembly'
  );
  const [secondaryFileId, setSecondaryFileId] = useState<string>('f-py');

  const [inlineAiOpen, setInlineAiOpen] = useState<boolean>(false);
  const [inlineAiPrompt, setInlineAiPrompt] = useState<string>('');
  const [inlineAiPreview, setInlineAiPreview] = useState<{
    explanation: string;
    code: string;
  } | null>(null);
  const [inlineAiBusy, setInlineAiBusy] = useState<boolean>(false);

  const [dockTab, setDockTab] = useState<'tracer' | 'terminal' | 'tests' | 'diagnostics' | 'diff'>(
    'tracer'
  );
  const [traceFrames, setTraceFrames] = useState<TraceFrame[]>(() =>
    generateDynamicTrace(LANGUAGE_META.c.defaultCode, 'c')
  );
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[GCC 14.2 PE64] Ready on workspace/src/main.c',
  ]);

  const [copilotMode, setCopilotMode] = useState<'chat' | 'composer'>('chat');
  const [chatInput, setChatInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; title: string; text: string; code?: string }>
  >([
    {
      id: 'welcome',
      title: 'INTERACTIVE SYSTEMS MENTOR',
      text: 'Ready on src/main.c. Click Copy or Insert on any AI code snippet.',
    },
  ]);

  const [solvedIds, setSolvedIds] = useState<string[]>(() => getSolvedExercises());
  const [dojoCategory, setDojoCategory] = useState<string>('All');
  const [activeExercise, setActiveExercise] = useState(CODING_EXERCISES[0]);
  const [dojoCode, setDojoCode] = useState<string>(CODING_EXERCISES[0].starterCode);
  const [dojoHintLevel, setDojoHintLevel] = useState<number>(0);
  const [dojoResults, setDojoResults] = useState<any[]>([]);

  const [projects, setProjects] = useState<CodeProject[]>(() => getStoredProjects());
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [vaultLangFilter, setVaultLangFilter] = useState<string>('ALL');
  const [newVaultTitle, setNewVaultTitle] = useState<string>('');

  const [extensions, setExtensions] = useState(() => getStoredExtensions());

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const secondaryFile = files.find((f) => f.id === secondaryFileId) || files[1] || files[0];
  const currentFrame = traceFrames[currentStepIdx] || traceFrames[0];
  const prevFrame = currentStepIdx > 0 ? traceFrames[currentStepIdx - 1] : undefined;
  const complexity = analyzeCodeQuality(activeFile.content);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const newFrames = generateDynamicTrace(activeFile.content, activeFile.language);
    setTraceFrames(newFrames);
    setCurrentStepIdx((prev) => (prev < newFrames.length ? prev : 0));
  }, [activeFile.id, activeFile.content, activeFile.language]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !currentFrame) return;
    const line = Math.max(1, currentFrame.line || 1);
    try {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
        {
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'monaco-active-trace-line',
            glyphMarginClassName: 'monaco-trace-glyph',
          },
        },
      ]);
    } catch {}
  }, [currentFrame, activeFile.id]);

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

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const meta = LANGUAGE_META[newLang];
    const targetName = newLang === 'c' ? 'main.c' : `main.${meta.extension}`;
    const existing = files.find(
      (f) => f.name === targetName || (f.folder === 'src' && f.language === newLang)
    );

    if (existing) {
      setActiveFileId(existing.id);
      if (!openTabIds.includes(existing.id)) setOpenTabIds((prev) => [...prev, existing.id]);
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

  const handleRunCode = () => {
    const res = executeCodeInSandbox(activeFile.content, activeFile.language);
    const frames = generateDynamicTrace(activeFile.content, activeFile.language);
    setTraceFrames(frames);
    setCurrentStepIdx(0);

    setTerminalLogs([
      `$ gcc -O2 -std=c23 src/${activeFile.name} -o build/main.exe`,
      ...res.logs,
      res.error ? `[ERROR] ${res.error}` : `[EXIT 0] Executed in ${res.durationMs}ms`,
    ]);
  };

  const handleRunInlineAi = async (customInstruction?: string) => {
    const instruction =
      customInstruction || inlineAiPrompt.trim() || 'Explain and optimize this code.';
    setInlineAiBusy(true);
    try {
      const resp = await generateOrExplainCode({
        mode: 'generate',
        language: activeFile.language,
        userPrompt: instruction,
        currentCode: activeFile.content,
      });
      setInlineAiPreview({ explanation: resp.explanation, code: resp.code || activeFile.content });
    } finally {
      setInlineAiBusy(false);
    }
  };

  const handleFormat = () => updateActiveCode(formatCodeBuffer(activeFile.content));

  const handleGenerateSpec = () => {
    const spec = synthesizeUnitTestFile(activeFile.name, activeFile.content);
    setFiles((prev) => [
      ...prev,
      {
        id: `spec-${Date.now()}`,
        name: spec.testFileName,
        folder: 'tests',
        language: 'typescript',
        content: spec.testContent,
        dirty: true,
      },
    ]);
    setDockTab('tests');
  };

  const handleAskCopilot = async (mode: 'explain' | 'generate' | 'debug', customPrompt?: string) => {
    const promptText = customPrompt || chatInput.trim() || 'Explain code simply.';
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
    if (foundIdx !== -1) setCurrentStepIdx(foundIdx);
    else if (traceFrames.length > 0) setCurrentStepIdx(traceFrames.length - 1);
  };

  const handleSaveToVault = (customTitle?: string) => {
    const titleToUse = customTitle?.trim() || newVaultTitle.trim() || `${activeFile.name} Snapshot`;
    const newProj: CodeProject = {
      id: `proj-${Date.now()}`,
      title: titleToUse,
      language: activeFile.language,
      code: activeFile.content,
      notes: `Saved from IDE Workbench`,
      tags: [LANGUAGE_META[activeFile.language].badge, activeFile.name],
      updatedAt: 'Just now',
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
    setNewVaultTitle('');
  };

  const srcFiles = files.filter((f) => f.folder === 'src');
  const testFiles = files.filter((f) => f.folder === 'tests');
  const docFiles = files.filter((f) => f.folder === 'docs');

  const getSplitRightContent = () => {
    if (splitRightMode === 'secondary') return secondaryFile.content;
    if (splitRightMode === 'formatted') return formatCodeBuffer(activeFile.content);
    return `// GCC 14.2 PE64 & AST Execution Disassembly\n// File: ${activeFile.name}\n// Steps Traced: ${traceFrames.length}`;
  };

  return (
    <div className="ide-root" data-theme={theme}>
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
          >
            <option value="tokyo-night">Tokyo Night Cyb</option>
            <option value="obsidian">Obsidian Pro</option>
            <option value="vercel">Vercel Pitch</option>
          </select>
          <button className="gemini-status-pill" onClick={() => setActiveView('settings')}>
            <Key size={12} /> Gemini Key Active
          </button>
          <select
            className="header-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
          >
            <option value="c">C (ISO C11)</option>
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

      {activeView === 'workbench' && (
        <div className="wb-shell">
          <div className="wb-main-grid">
            <aside className="wb-activity-rail">
              <div className="wb-rail-group">
                <button className="wb-rail-btn active" title="Workspace Files">
                  <Folder size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Inline AI"
                  onClick={() => setInlineAiOpen((o) => !o)}
                >
                  <Search size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Git Diff"
                  onClick={() => setDockTab('diff')}
                >
                  <GitBranch size={15} />
                  <span className="wb-rail-badge">5</span>
                </button>
                <button
                  className="wb-rail-btn"
                  title="Diagnostics"
                  onClick={() => setDockTab('diagnostics')}
                >
                  <Gauge size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Tracer"
                  onClick={() => setDockTab('tracer')}
                >
                  <Network size={15} />
                </button>
                <button className="wb-rail-btn" title="Run Code" onClick={handleRunCode}>
                  <Zap size={15} />
                </button>
              </div>

              {/* RESTORED ORIGINAL RAIL ACTIONS */}
              <div className="wb-rail-group">
                <button
                  className="wb-rail-btn"
                  title="Command Center Tour"
                  onClick={() => setActiveView('command')}
                >
                  <Compass size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Keyboard Shortcuts"
                  onClick={() => alert('Shortcuts:\nCtrl+Enter: Run\nCtrl+S: Save')}
                >
                  <Keyboard size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Import Workspace JSON"
                  onClick={() => {
                    const json = prompt('Paste exported Vault JSON:');
                    if (json) {
                      try {
                        const parsed = JSON.parse(json);
                        if (Array.isArray(parsed)) {
                          setProjects(parsed);
                          saveStoredProjects(parsed);
                          alert('Imported successfully!');
                        }
                      } catch {
                        alert('Invalid JSON');
                      }
                    }
                  }}
                >
                  <Upload size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Export Snapshot"
                  onClick={() => handleSaveToVault('Export Snapshot')}
                >
                  <Download size={15} />
                </button>
                <button
                  className="wb-rail-btn"
                  title="Settings"
                  onClick={() => setActiveView('settings')}
                >
                  <Command size={15} />
                </button>
              </div>
            </aside>

            <aside className="wb-explorer-panel">
              <div className="wb-explorer-header">
                <span className="wb-explorer-title">WORKSPACE FILES ({files.length})</span>
                <div className="wb-explorer-actions">
                  <button
                    className="wb-icon-mini-btn"
                    onClick={() => {
                      const ext = LANGUAGE_META[language].extension;
                      const nf: VfsFile = {
                        id: `f-${Date.now()}`,
                        name: `mod.${ext}`,
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
                  <button className="wb-icon-mini-btn" onClick={handleGenerateSpec}>
                    <FolderPlus size={13} />
                  </button>
                </div>
              </div>

              <div className="wb-tree-scroll">
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <main className="wb-center-stage">
              <div className="wb-editor-topbar">
                <div className="wb-tabs-group">
                  {openTabIds.map((tid) => {
                    const tf = files.find((f) => f.id === tid);
                    if (!tf) return null;
                    return (
                      <div
                        key={tf.id}
                        className={`wb-tab-item ${tf.id === activeFile.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveFileId(tf.id);
                          setLanguage(tf.language);
                        }}
                      >
                        <span>{tf.name}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="wb-toolbar-actions">
                  <button
                    className={`wb-tool-btn ${inlineAiOpen ? 'active-tool' : ''}`}
                    onClick={() => setInlineAiOpen((o) => !o)}
                  >
                    <Sparkles size={13} /> Inline AI
                  </button>
                  <button className="wb-tool-btn" onClick={handleFormat}>
                    <Wand2 size={13} /> Format
                  </button>
                  <button className="wb-tool-btn" onClick={handleGenerateSpec}>
                    <FlaskConical size={13} /> Spec
                  </button>
                  <button
                    className={`wb-tool-btn ${splitView ? 'active-tool' : ''}`}
                    onClick={() => setSplitView((s) => !s)}
                  >
                    <Columns size={13} /> Split
                  </button>
                  <button className="wb-tool-btn run-btn" onClick={handleRunCode}>
                    <Play size={13} /> Run
                  </button>
                </div>
              </div>

              {inlineAiOpen && (
                <div className="wb-inline-ai-bar">
                  <div className="wb-inline-ai-top">
                    <Sparkles size={14} color="#22d3ee" />
                    <input
                      className="wb-inline-ai-input"
                      placeholder="Ask Inline AI..."
                      value={inlineAiPrompt}
                      onChange={(e) => setInlineAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunInlineAi()}
                    />
                    <button
                      className="wb-tool-btn run-btn"
                      onClick={() => handleRunInlineAi()}
                      disabled={inlineAiBusy}
                    >
                      {inlineAiBusy ? '...' : 'Go'}
                    </button>
                    <button onClick={() => setInlineAiOpen(false)}>
                      <X size={13} />
                    </button>
                  </div>
                  {inlineAiPreview && (
                    <div className="wb-inline-ai-preview">
                      <div className="wb-inline-ai-exp">{inlineAiPreview.explanation}</div>
                      <button
                        onClick={() => {
                          updateActiveCode(inlineAiPreview.code);
                          setInlineAiPreview(null);
                          setInlineAiOpen(false);
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="wb-editor-canvas">
                <div className="wb-editor-pane">
                  <Editor
                    height="100%"
                    language={LANGUAGE_META[activeFile.language]?.monacoLang || 'c'}
                    theme="vs-dark"
                    value={activeFile.content}
                    onChange={(val) => updateActiveCode(val || '')}
                    onMount={(ed, mon) => {
                      editorRef.current = ed;
                      monacoRef.current = mon;
                    }}
                    options={{ fontSize: 13, minimap: { enabled: false } }}
                  />
                </div>
                {splitView && (
                  <div className="wb-editor-pane wb-split-right-pane">
                    <Editor
                      height="100%"
                      language="cpp"
                      theme="vs-dark"
                      value={getSplitRightContent()}
                      options={{ readOnly: true, fontSize: 12, minimap: { enabled: false } }}
                    />
                  </div>
                )}
              </div>

              <div className="wb-bottom-dock">
                <div className="wb-dock-header">
                  <div className="wb-dock-tabs">
                    <button
                      className={`wb-dock-tab ${dockTab === 'tracer' ? 'active' : ''}`}
                      onClick={() => setDockTab('tracer')}
                    >
                      TRACER ({traceFrames.length})
                    </button>
                    <button
                      className={`wb-dock-tab ${dockTab === 'terminal' ? 'active' : ''}`}
                      onClick={() => setDockTab('terminal')}
                    >
                      TERMINAL
                    </button>
                  </div>
                </div>
                <div className="wb-dock-body">
                  {dockTab === 'tracer' && (
                    <div className="wb-trace-cards-row">
                      <div className="wb-trace-explain-card">
                        <div className="wb-trace-line-title">Line {currentFrame?.line}</div>
                        <div className="wb-trace-explain-text">{currentFrame?.explanation}</div>
                      </div>
                    </div>
                  )}
                  {dockTab === 'terminal' && (
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {terminalLogs.map((l, i) => (
                        <div key={i}>{l}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </main>

            <aside className="wb-copilot-panel">
              <div className="wb-copilot-header">
                <div className="wb-copilot-title">
                  <Bot size={15} /> GEMINI COPILOT
                </div>
              </div>
              <div className="wb-copilot-feed">
                {messages.map((m) => (
                  <div key={m.id} className="wb-mentor-card">
                    <div className="wb-mentor-label">{m.title}</div>
                    <div className="wb-mentor-text">{m.text}</div>
                  </div>
                ))}
              </div>
              <div className="wb-copilot-input-row">
                <input
                  className="wb-copilot-input"
                  placeholder="Ask Copilot..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot('explain')}
                />
              </div>
            </aside>
          </div>
        </div>
      )}

      {activeView === 'command' && (
        <div className="cc-container">
          <div className="cc-hero-card">
            <div>
              <h1 className="cc-hero-title">Good Morning, Raghav.</h1>
              <p className="cc-hero-sub">GCC 14.2 C toolchain and PE64 binary output ready.</p>
            </div>
          </div>
        </div>
      )}

      {activeView === 'dojo' && (
        <div className="dojo-shell">
          <aside className="dojo-sidebar">
            <h3>Coding Dojo</h3>
            {CODING_EXERCISES.map((ex) => (
              <div
                key={ex.id}
                className="dojo-exercise-item"
                onClick={() => setActiveExercise(ex)}
              >
                <strong>{ex.title}</strong>
              </div>
            ))}
          </aside>
          <main className="dojo-problem-pane">
            <h2>{activeExercise.title}</h2>
            <p>{activeExercise.description}</p>
          </main>
        </div>
      )}

      {activeView === 'vault' && (
        <div className="cc-container">
          <h2>Project Vault ({projects.length})</h2>
          <div className="vault-grid">
            {projects.map((p) => (
              <div key={p.id} className="vault-project-card">
                <h3>{p.title}</h3>
                <p>{p.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'extensions' && (
        <div className="cc-container">
          <h2>Extensions</h2>
          {extensions.map((e) => (
            <div key={e.id} className="cc-card">
              <h3>{e.name}</h3>
            </div>
          ))}
        </div>
      )}

      {activeView === 'settings' && (
        <div className="cc-container">
          <h2>AI & Settings</h2>
          <input
            type="password"
            placeholder="Gemini API Key"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              saveStoredApiKey(e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;