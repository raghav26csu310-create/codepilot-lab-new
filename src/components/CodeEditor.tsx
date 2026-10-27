import React, { useState, useRef } from 'react';
import {
  Play,
  Save,
  RotateCcw,
  Download,
  Copy,
  Check,
  Terminal,
  FileCode2,
  FolderPlus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { SavedProject, SupportedLanguage } from '../types';
import { LANGUAGE_META, LANGUAGE_STARTERS } from '../services/storage';

interface CodeEditorProps {
  activeProject: SavedProject | null;
  language: SupportedLanguage;
  code: string;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onCodeChange: (newCode: string) => void;
  onSaveProject: (title: string, description: string, asNew: boolean) => void;
  onClearActiveProject: () => void;
}

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  text: string;
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

export const CodeEditor: React.FC<CodeEditorProps> = ({
  activeProject,
  language,
  code,
  onLanguageChange,
  onCodeChange,
  onSaveProject,
  onClearActiveProject,
}) => {
  const [projectTitle, setProjectTitle] = useState<string>(
    activeProject ? activeProject.title : 'Untitled Algorithm'
  );
  const [projectDesc, setProjectDesc] = useState<string>(
    activeProject ? activeProject.description : 'Custom workspace implementation.'
  );
  const [consoleOutput, setConsoleOutput] = useState<ConsoleEntry[]>([]);
  const [execTimeMs, setExecTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string>('');
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({
    line: 1,
    col: 1,
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (activeProject) {
      setProjectTitle(activeProject.title);
      setProjectDesc(activeProject.description);
    }
  }, [activeProject]);

  const lines = code.split('\n');
  const langMeta = LANGUAGE_META[language];

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const updateCursorMetrics = (target: HTMLTextAreaElement) => {
    const selectionStart = target.selectionStart || 0;
    const textUpToCursor = target.value.slice(0, selectionStart);
    const currentLines = textUpToCursor.split('\n');
    setCursorPos({
      line: currentLines.length,
      col: currentLines[currentLines.length - 1].length + 1,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + '  ' + code.substring(end);
      onCodeChange(updated);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          updateCursorMetrics(textareaRef.current);
        }
      });
    }
  };

  const handleRunCode = () => {
    if (!langMeta.runnableInBrowser) {
      setExecTimeMs(null);
      setConsoleOutput([
        {
          level: 'info',
          text: `[${langMeta.label} Mode] Browser execution supports JavaScript & TypeScript.`,
        },
        {
          level: 'info',
          text: `Your ${langMeta.label} code is ready for saving or analysis in the AI Studio.`,
        },
      ]);
      return;
    }

    const logs: ConsoleEntry[] = [];
    const formatArg = (arg: unknown): string => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    };

    const customConsole = {
      log: (...args: unknown[]) => logs.push({ level: 'log', text: args.map(formatArg).join(' ') }),
      warn: (...args: unknown[]) => logs.push({ level: 'warn', text: args.map(formatArg).join(' ') }),
      error: (...args: unknown[]) => logs.push({ level: 'error', text: args.map(formatArg).join(' ') }),
      info: (...args: unknown[]) => logs.push({ level: 'info', text: args.map(formatArg).join(' ') }),
    };

    const executableSource =
      language === 'typescript' ? transpileSimpleTypeScript(code) : code;

    const startTime = performance.now();
    try {
      const runner = new Function('console', `"use strict";\n${executableSource}`);
      const returnValue = runner(customConsole);
      const elapsed = Number((performance.now() - startTime).toFixed(2));
      setExecTimeMs(elapsed);

      if (returnValue !== undefined) {
        logs.push({ level: 'info', text: `Return Value: ${formatArg(returnValue)}` });
      }
      if (logs.length === 0) {
        logs.push({ level: 'info', text: 'Execution completed with no console.log output.' });
      }
      setConsoleOutput(logs);
    } catch (err: unknown) {
      const elapsed = Number((performance.now() - startTime).toFixed(2));
      setExecTimeMs(elapsed);
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      logs.push({ level: 'error', text: `Runtime Exception -> ${message}` });
      setConsoleOutput(logs);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName =
      projectTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'codepilot-snippet';
    a.href = url;
    a.download = `${safeName}.${langMeta.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerSave = (asNew: boolean) => {
    const cleanTitle = projectTitle.trim() || 'Untitled Project';
    onSaveProject(cleanTitle, projectDesc.trim(), asNew);
    setSaveFeedback(asNew ? `Saved as new project "${cleanTitle}"` : `Updated "${cleanTitle}"`);
    setTimeout(() => setSaveFeedback(''), 3000);
  };

  return (
    <div className="content-container">
      <div className="panel-card" style={{ padding: '1.1rem 1.4rem' }}>
        <div className="editor-project-bar">
          <div className="editor-meta-inputs">
            <div style={{ flex: 1, minWidth: '210px' }}>
              <label className="field-label">Project Title</label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </div>
            <div style={{ flex: 2, minWidth: '260px' }}>
              <label className="field-label">Brief Description</label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="editor-save-actions">
            {activeProject ? (
              <>
                <button className="cyber-btn" onClick={() => triggerSave(false)}>
                  <Save size={15} />
                  <span>Update Project</span>
                </button>
                <button className="cyber-btn secondary" onClick={() => triggerSave(true)}>
                  <FolderPlus size={15} />
                  <span>Save as Copy</span>
                </button>
                <button
                  className="cyber-btn secondary"
                  onClick={() => {
                    onClearActiveProject();
                    setProjectTitle('Untitled Algorithm');
                    setProjectDesc('Fresh workspace buffer.');
                  }}
                >
                  New Buffer
                </button>
              </>
            ) : (
              <button className="cyber-btn" onClick={() => triggerSave(true)}>
                <Save size={15} />
                <span>Save to Projects</span>
              </button>
            )}
          </div>
        </div>

        {saveFeedback && (
          <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
            ✓ {saveFeedback}
          </div>
        )}
      </div>

      <div className="editor-workspace-grid">
        <div className="editor-pane">
          <div className="editor-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <FileCode2 size={17} color="#06b6d4" />
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
                style={{ padding: '0.4rem 0.7rem', fontSize: '0.76rem' }}
                onClick={() => onCodeChange(LANGUAGE_STARTERS[language])}
              >
                <RotateCcw size={13} />
                <span>Load Starter Template</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                className="cyber-btn secondary"
                style={{ padding: '0.4rem 0.7rem', fontSize: '0.76rem' }}
                onClick={handleCopyCode}
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                className="cyber-btn secondary"
                style={{ padding: '0.4rem 0.7rem', fontSize: '0.76rem' }}
                onClick={handleDownload}
              >
                <Download size={13} />
                <span>.{langMeta.extension}</span>
              </button>

              <button
                className="cyber-btn"
                style={{ padding: '0.42rem 0.9rem', fontSize: '0.8rem' }}
                onClick={handleRunCode}
              >
                <Play size={14} />
                <span>{langMeta.runnableInBrowser ? 'Run JS/TS' : 'Check Mode'}</span>
              </button>
            </div>
          </div>

          <div className="code-surface">
            <div className="line-gutter" ref={gutterRef}>
              {lines.map((_, idx) => (
                <div
                  key={idx}
                  className={`gutter-line ${cursorPos.line === idx + 1 ? 'active-line' : ''}`}
                >
                  {idx + 1}
                </div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              className="code-textarea"
              value={code}
              onChange={(e) => {
                onCodeChange(e.target.value);
                updateCursorMetrics(e.target);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => updateCursorMetrics(e.currentTarget)}
              onKeyUp={(e) => updateCursorMetrics(e.currentTarget)}
              onScroll={handleScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>

          <div className="editor-statusbar">
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            <span>{lines.length} Lines • {code.length} Chars</span>
            <span>{langMeta.runnableInBrowser ? 'Browser Sandbox: Active' : 'Static Buffer'}</span>
          </div>
        </div>

        <div className="console-pane">
          <div className="editor-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={16} color="#10b981" />
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Local Sandbox Console</span>
              {execTimeMs !== null && <span className="stage-pill live">{execTimeMs} ms</span>}
            </div>

            <button
              className="cyber-btn secondary"
              style={{ padding: '0.32rem 0.6rem', fontSize: '0.74rem' }}
              onClick={() => {
                setConsoleOutput([]);
                setExecTimeMs(null);
              }}
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>

          <div className="console-body">
            {!langMeta.runnableInBrowser && (
              <div className="console-notice">
                <AlertCircle size={15} color="#f59e0b" />
                <span>
                  <strong>{langMeta.label}</strong> files are ready for editing, saving, and AI analysis.
                </span>
              </div>
            )}

            {consoleOutput.length === 0 ? (
              <div className="console-empty">
                Click <strong>"Run JS/TS"</strong> to execute code in the browser sandbox.
              </div>
            ) : (
              consoleOutput.map((entry, index) => (
                <div key={index} className={`console-line ${entry.level}`}>
                  <span className="console-prefix">
                    {entry.level === 'error' ? '✖' : entry.level === 'warn' ? '⚠' : entry.level === 'info' ? 'ℹ' : '›'}
                  </span>
                  <span>{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
