import React, { useState, useEffect, useRef } from 'react';
import {
  Code2,
  Sparkles,
  Bug,
  Activity,
  GraduationCap,
  FolderKanban,
  Play,
  Save,
  RotateCcw,
  Copy,
  Check,
  Terminal as TerminalIcon,
  FileCode2,
  Send,
  Loader2,
  CheckCircle2,
  ArrowRight,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type {
  AppState,
  PromptPreset,
  SavedProject,
  SupportedLanguage,
} from '../types';
import { LANGUAGE_META, LANGUAGE_STARTERS } from '../services/storage';
import { generateOrExplainCode, debugCodeWithGemini } from '../services/gemini';

interface UnifiedIDEProps {
  appState: AppState;
  activeProject: SavedProject | null;
  language: SupportedLanguage;
  code: string;
  activePreset: PromptPreset;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onCodeChange: (newCode: string) => void;
  onSaveProject: (title: string, description: string, asNew: boolean) => void;
  onClearActiveProject: () => void;
  onLogActivity: (msg: string) => void;
  onNavigateSection: (section: string) => void;
}

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  text: string;
}

interface TraceStep {
  stepNumber: number;
  line: number;
  variables: Record<string, string>;
  note: string;
}

function transpileSimpleTypeScript(tsCode: string): string {
  return tsCode
    .replace(/interface\s+\w+\s*\{[\s\S]*?\}/g, '')
    .replace(/^\s*type\s+\w+\s*=.*;$/gm, '')
    .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]\|\s]+(\s*\{)/g, ')$1')
    .replace(/(\w+)\s*\??:\s*(?:number|string|boolean|any|void|unknown|Record<[^>]+>|Map<[^>]+>|Set<[^>]+>|[A-Za-z0-9_]+)(?:\[\])*/g, '$1')
    .replace(/new\s+(Map|Set|Array)<[^>]+>\(/g, 'new $1(')
    .replace(/\s+as\s+[A-Za-z0-9_<>\[\]]+/g, '');
}

export const UnifiedIDE: React.FC<UnifiedIDEProps> = ({
  activeProject,
  language,
  code,
  activePreset,
  onLanguageChange,
  onCodeChange,
  onSaveProject,
  onLogActivity,
  onNavigateSection,
}) => {
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'debug' | 'tracer'>('ai');
const [projectTitle] = useState(activeProject ? activeProject.title : 'Workspace Buffer');
  const [projectDesc] = useState(activeProject ? activeProject.description : 'Integrated IDE session.');
  
  // Console state
  const [consoleOutput, setConsoleOutput] = useState<ConsoleEntry[]>([]);
  const [execTimeMs, setExecTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // AI Panel state
  const [aiPrompt, setAiPrompt] = useState('Explain the time complexity and logic of this code buffer.');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ code: string; explanation: string; complexity: string } | null>(null);

  // Debug Panel state
  const [debugSymptom, setDebugSymptom] = useState('Unexpected output or loop boundary issue.');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugReport, setDebugReport] = useState<{ rootCause: string; buggyLineHint: string; fixedCode: string } | null>(null);

  // Tracer state
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [traceIdx, setTraceIdx] = useState(0);
  const [traceError, setTraceError] = useState<string | null>(null);

  const langMeta = LANGUAGE_META[language];
  const lines = code.split('\n');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleRunCode = () => {
    if (!langMeta.runnableInBrowser) {
      setConsoleOutput([
        { level: 'info', text: `[${langMeta.label}] Static buffer ready. Browser execution supports JavaScript & TypeScript.` },
      ]);
      return;
    }

    const logs: ConsoleEntry[] = [];
    const customConsole = {
      log: (...args: unknown[]) => logs.push({ level: 'log', text: args.map(String).join(' ') }),
      warn: (...args: unknown[]) => logs.push({ level: 'warn', text: args.map(String).join(' ') }),
      error: (...args: unknown[]) => logs.push({ level: 'error', text: args.map(String).join(' ') }),
      info: (...args: unknown[]) => logs.push({ level: 'info', text: args.map(String).join(' ') }),
    };

    const executableSource = language === 'typescript' ? transpileSimpleTypeScript(code) : code;
    const start = performance.now();
    try {
      const runner = new Function('console', `"use strict";\n${executableSource}`);
      runner(customConsole);
      const elapsed = Number((performance.now() - start).toFixed(2));
      setExecTimeMs(elapsed);
      if (logs.length === 0) logs.push({ level: 'info', text: 'Execution completed with no console output.' });
      setConsoleOutput(logs);
      onLogActivity(`Executed ${langMeta.label} buffer in sandbox (${elapsed}ms).`);
    } catch (err: unknown) {
      const elapsed = Number((performance.now() - start).toFixed(2));
      setExecTimeMs(elapsed);
      logs.push({ level: 'error', text: err instanceof Error ? err.message : String(err) });
      setConsoleOutput(logs);
      onLogActivity(`Sandbox execution caught exception.`);
    }
  };

  // Keyboard Shortcuts: Ctrl+S to Save, Ctrl+Enter to Run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSaveProject(projectTitle, projectDesc, !activeProject);
        setSaveFeedback('Saved (Ctrl+S)');
        setTimeout(() => setSaveFeedback(''), 2000);
        onLogActivity(`Saved project "${projectTitle}" via shortcut.`);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectTitle, projectDesc, activeProject, code, language]);

  const handleAiExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);
    try {
      const res = await generateOrExplainCode({
        mode: 'explain',
        language,
        userPrompt: aiPrompt,
        currentCode: code,
        preset: activePreset,
      });
      setAiResult(res);
      onLogActivity(`AI Studio analyzed buffer using persona "${activePreset.name}".`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleDebugExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setDebugLoading(true);
    try {
      const res = await debugCodeWithGemini({
        language,
        buggyCode: code,
        errorOrSymptom: debugSymptom,
        preset: activePreset,
      });
      setDebugReport(res);
      onLogActivity('Root-cause debugger generated diagnostic report.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDebugLoading(false);
    }
  };

  const handleRunTracer = () => {
    setTraceError(null);
    if (language !== 'javascript' && language !== 'typescript') {
      setTraceError('Code tracing is supported for JavaScript & TypeScript buffers.');
      return;
    }

    const fileLines = code.split('\n');
    const instrumented: string[] = [];
    fileLines.forEach((l, idx) => {
      const lineNum = idx + 1;
      const trimmed = l.trim();
      instrumented.push(l);
      if (trimmed && !trimmed.startsWith('//') && trimmed !== '}' && !trimmed.startsWith('break')) {
        instrumented.push(`__record(${lineNum}, { codeLine: ${JSON.stringify(trimmed)} });`);
      }
    });

    const recorded: TraceStep[] = [];
    const __record = (line: number, payload: { codeLine: string }) => {
      if (recorded.length < 80) {
        recorded.push({
          stepNumber: recorded.length + 1,
          line,
          variables: { statement: payload.codeLine },
          note: payload.codeLine,
        });
      }
    };

    try {
      const executable = transpileSimpleTypeScript(instrumented.join('\n'));
      const runner = new Function('__record', `"use strict";\n${executable}`);
      runner(__record);
      setTraceSteps(recorded);
      setTraceIdx(0);
      onLogActivity(`Generated ${recorded.length} execution trace steps.`);
    } catch (err: unknown) {
      setTraceError(err instanceof Error ? err.message : String(err));
    }
  };

  const activeTraceStep = traceSteps[traceIdx] || null;

  return (
    <div className="unified-ide-layout">
      {/* VS Code Style Activity Bar */}
      <div className="ide-activity-bar">
        <button className="ide-act-btn active" title="Multi-Lang Editor" onClick={() => onNavigateSection('editor')}>
          <Code2 size={20} />
        </button>
        <button className="ide-act-btn" title="Saved Projects Vault" onClick={() => onNavigateSection('projects')}>
          <FolderKanban size={20} />
        </button>
        <button className="ide-act-btn" title="Coding Exercises" onClick={() => onNavigateSection('exercises')}>
          <GraduationCap size={20} />
        </button>
      </div>

      {/* Main Workspace */}
      <div className="ide-main-workspace">
        {/* Top File Tab Bar */}
        <div className="ide-tab-bar">
          <div className="ide-file-tab active">
            <FileCode2 size={14} color="#06b6d4" />
            <span>{projectTitle}.${langMeta.extension}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <span className="stage-pill live">Persona: {activePreset.name}</span>
            <button
              className="cyber-btn secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
              onClick={() => {
                onSaveProject(projectTitle, projectDesc, !activeProject);
                setSaveFeedback('Saved!');
                setTimeout(() => setSaveFeedback(''), 2000);
              }}
            >
              <Save size={12} />
              <span>{saveFeedback || 'Save (Ctrl+S)'}</span>
            </button>
          </div>
        </div>

        {/* Center Split: Editor & Contextual Right Panel */}
        <div className="ide-center-split">
          {/* Left: Code Editor + Bottom Console */}
          <div className="ide-editor-column">
            <div className="editor-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <select
                  className="cyber-select"
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
                >
                  <option value="typescript">TypeScript (.ts)</option>
                  <option value="javascript">JavaScript (.js)</option>
                  <option value="python">Python 3 (.py)</option>
                  <option value="cpp">C++ 20 (.cpp)</option>
                </select>
                <button
                  className="cyber-btn secondary"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.74rem' }}
                  onClick={() => onCodeChange(LANGUAGE_STARTERS[language])}
                >
                  <RotateCcw size={12} />
                  <span>Reset Template</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="cyber-btn secondary"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.74rem' }}
                  onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}
                >
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  className="cyber-btn"
                  style={{ padding: '0.38rem 0.85rem', fontSize: '0.78rem' }}
                  onClick={handleRunCode}
                >
                  <Play size={13} />
                  <span>Run Sandbox (Ctrl+Enter)</span>
                </button>
              </div>
            </div>

            {/* Code Surface */}
            <div className="code-surface" style={{ flex: 1 }}>
              <div className="line-gutter">
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={`gutter-line ${
                      activeTraceStep?.line === i + 1 || cursorPos.line === i + 1 ? 'active-line' : ''
                    }`}
                  >
                    {activeTraceStep?.line === i + 1 ? '▶' : i + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="code-textarea"
                value={code}
                onChange={(e) => {
                  onCodeChange(e.target.value);
                  const sel = e.target.selectionStart || 0;
                  const lns = e.target.value.slice(0, sel).split('\n');
                  setCursorPos({ line: lns.length, col: lns[lns.length - 1].length + 1 });
                }}
                spellCheck={false}
              />
            </div>

            {/* Bottom Integrated Console */}
            <div className="ide-bottom-console">
              <div className="console-header-bar">
                <TerminalIcon size={14} color="#10b981" />
                <span>Console Output</span>
                {execTimeMs !== null && <span className="stage-pill live">{execTimeMs} ms</span>}
                <button
                  className="cyber-btn secondary"
                  style={{ marginLeft: 'auto', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={() => setConsoleOutput([])}
                >
                  Clear
                </button>
              </div>
              <div className="console-body" style={{ maxHeight: '130px' }}>
                {consoleOutput.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Run JavaScript/TypeScript to view sandbox console output.
                  </div>
                ) : (
                  consoleOutput.map((item, idx) => (
                    <div key={idx} className={`console-line ${item.level}`}>
                      <span className="console-prefix">›</span>
                      <span>{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Integrated AI, Debug & Tracer Side Panel */}
          <div className="ide-right-sidebar">
            <div className="ide-right-tabs">
              <button
                className={`ide-right-tab ${rightPanelTab === 'ai' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('ai')}
              >
                <Sparkles size={13} />
                <span>AI</span>
              </button>
              <button
                className={`ide-right-tab ${rightPanelTab === 'debug' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('debug')}
              >
                <Bug size={13} />
                <span>Debug</span>
              </button>
              <button
                className={`ide-right-tab ${rightPanelTab === 'tracer' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('tracer')}
              >
                <Activity size={13} />
                <span>Trace</span>
              </button>
            </div>

            <div className="ide-right-content">
              {rightPanelTab === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Contextual AI studio using active persona: <strong>{activePreset.name}</strong>
                  </div>
                  <form onSubmit={handleAiExecute} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <textarea
                      className="cyber-input"
                      style={{ width: '100%', minHeight: '80px', fontSize: '0.78rem' }}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      required
                    />
                    <button type="submit" className="cyber-btn" disabled={aiLoading} style={{ fontSize: '0.78rem' }}>
                      {aiLoading ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                      <span>{aiLoading ? 'Analyzing...' : 'Ask AI Studio'}</span>
                    </button>
                  </form>

                  {aiResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                      <div className="field-label">Explanation</div>
                      <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                        {aiResult.explanation}
                      </p>
                      <div className="field-label">Complexity</div>
                      <div className="preset-prompt-preview" style={{ color: 'var(--accent-emerald)', fontSize: '0.74rem' }}>
                        {aiResult.complexity}
                      </div>
                      <button
                        className="cyber-btn secondary"
                        style={{ fontSize: '0.74rem' }}
                        onClick={() => {
                          onCodeChange(aiResult.code);
                          onLogActivity('Inserted AI generated code into editor buffer.');
                        }}
                      >
                        <span>Insert AI Code into Buffer</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {rightPanelTab === 'debug' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Root-cause isolation for active code buffer.
                  </div>
                  <form onSubmit={handleDebugExecute} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <label className="field-label">Observed Bug / Symptom</label>
                    <input
                      type="text"
                      className="cyber-input"
                      style={{ width: '100%', fontSize: '0.78rem' }}
                      value={debugSymptom}
                      onChange={(e) => setDebugSymptom(e.target.value)}
                      required
                    />
                    <button type="submit" className="cyber-btn" disabled={debugLoading} style={{ fontSize: '0.78rem' }}>
                      {debugLoading ? <Loader2 size={13} className="spin" /> : <Bug size={13} />}
                      <span>{debugLoading ? 'Diagnosing...' : 'Run Root-Cause AI'}</span>
                    </button>
                  </form>

                  {debugReport && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                      <div className="field-label">Faulty Line</div>
                      <div className="preset-prompt-preview" style={{ borderColor: '#f59e0b', color: '#fde68a', fontSize: '0.74rem' }}>
                        {debugReport.buggyLineHint}
                      </div>
                      <div className="field-label">Root Cause</div>
                      <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                        {debugReport.rootCause}
                      </p>
                      <button
                        className="cyber-btn"
                        style={{ fontSize: '0.74rem' }}
                        onClick={() => {
                          onCodeChange(debugReport.fixedCode);
                          onLogActivity('Applied verified bug fix to editor buffer.');
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Apply Verified Fix</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {rightPanelTab === 'tracer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Step through active editor code execution frame-by-frame.
                  </div>
                  <button className="cyber-btn" onClick={handleRunTracer} style={{ fontSize: '0.78rem' }}>
                    <Play size={13} />
                    <span>Generate Execution Trace</span>
                  </button>

                  {traceError && (
                    <div className="console-notice" style={{ fontSize: '0.74rem' }}>
                      {traceError}
                    </div>
                  )}

                  {traceSteps.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>Step {traceIdx + 1} of {traceSteps.length}</span>
                        <span>Line {activeTraceStep?.line}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="cyber-btn secondary"
                          style={{ flex: 1, fontSize: '0.74rem' }}
                          onClick={() => setTraceIdx((i) => Math.max(0, i - 1))}
                          disabled={traceIdx === 0}
                        >
                          <SkipBack size={12} />
                          <span>Prev</span>
                        </button>
                        <button
                          className="cyber-btn"
                          style={{ flex: 1, fontSize: '0.74rem' }}
                          onClick={() => setTraceIdx((i) => Math.min(traceSteps.length - 1, i + 1))}
                          disabled={traceIdx === traceSteps.length - 1}
                        >
                          <span>Next</span>
                          <SkipForward size={12} />
                        </button>
                      </div>
                      <div className="preset-prompt-preview" style={{ fontSize: '0.74rem' }}>
                        <code>{activeTraceStep?.note}</code>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};