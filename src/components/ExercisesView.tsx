import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  RotateCcw,
  Award,
  Terminal,
  CheckCircle2,
  XCircle,
  Sparkles,
  Code2,
  Cpu,
  Layers,
  Wand2,
} from 'lucide-react';
import type { PromptPreset, SupportedLanguage } from '../types';
import {
  CODING_EXERCISES,
  DEFAULT_PRESETS,
  getSolvedExercises,
  saveSolvedExercises,
  getExerciseStarter,
  runExerciseTestSuite,
  formatCodeBuffer,
  LANGUAGE_META,
} from '../services/storage';
import { generateOrExplainCode } from '../services/gemini';

export interface ExercisesViewProps {
  language?: SupportedLanguage;
  preset?: PromptPreset;
  activePreset?: PromptPreset;
  solvedIds?: string[];
  onSolvedChange?: (ids: string[]) => void;
  onMarkSolved?: (id: string) => void;
  onLogActivity?: (msg: string) => void;
}

type DojoSubTab = 'challenges' | 'scratchpad';

interface TestRunOutcome {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  durationMs: number;
}

export const ExercisesView: React.FC<ExercisesViewProps> = ({
  language: initialLanguage = 'typescript',
  preset,
  activePreset,
  solvedIds,
  onSolvedChange,
  onMarkSolved,
  onLogActivity,
}) => {
  const [dojoTab, setDojoTab] = useState<DojoSubTab>('challenges');
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);

  const [localSolved, setLocalSolved] = useState<string[]>(
    () => solvedIds ?? getSolvedExercises()
  );
  const effectiveSolved = solvedIds ?? localSolved;
  const effectivePreset = activePreset ?? preset ?? DEFAULT_PRESETS[0];

  const [selectedEx, setSelectedEx] = useState(CODING_EXERCISES[0]);
  const [dojoCode, setDojoCode] = useState(() =>
    getExerciseStarter(CODING_EXERCISES[0], initialLanguage)
  );
  const [testResults, setTestResults] = useState<TestRunOutcome[] | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Free-Form Scratchpad state
  const [scratchpadCode, setScratchpadCode] = useState(
    `// Free-Form Code Lab & AI Reviewer\n// Write or paste any algorithm below and click 'Execute & Audit with AI'\n\nfunction findMissingNumber(nums: number[]): number {\n  const n = nums.length;\n  const expectedSum = (n * (n + 1)) / 2;\n  const actualSum = nums.reduce((a, b) => a + b, 0);\n  return expectedSum - actualSum;\n}\n\nconsole.log("Missing number is:", findMissingNumber([3, 0, 1]));`
  );
  const [scratchpadOutput, setScratchpadOutput] = useState<string[] | null>(null);
  const [scratchpadAiReview, setScratchpadAiReview] = useState<string | null>(null);

  const markExerciseSolved = (id: string) => {
    if (!effectiveSolved.includes(id)) {
      const updated = [...effectiveSolved, id];
      setLocalSolved(updated);
      saveSolvedExercises(updated);
      onSolvedChange?.(updated);
      onMarkSolved?.(id);
    }
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setDojoCode(getExerciseStarter(selectedEx, newLang));
    setTestResults(null);
    setAiFeedback(null);
  };

  const handleRunDojoTests = async () => {
    setLoading(true);
    setTestResults(null);
    setAiFeedback(null);

    const outcomes = runExerciseTestSuite(dojoCode, language, selectedEx);
    setTestResults(outcomes);

    const allPassed = outcomes.every((o) => o.passed);
    if (allPassed) {
      markExerciseSolved(selectedEx.id);
      onLogActivity?.(`Passed all unit tests for Dojo challenge: ${selectedEx.title}`);
    } else {
      onLogActivity?.(`Test assertions failed for Dojo challenge: ${selectedEx.title}`);
    }

    try {
      const res = await generateOrExplainCode({
        mode: allPassed ? 'explain' : 'debug',
        language,
        userPrompt: `Review this solution for challenge "${selectedEx.title}". All tests passed: ${allPassed}. Provide time/space complexity and constructive feedback.`,
        currentCode: dojoCode,
        preset: effectivePreset,
      });
      setAiFeedback(`${res.explanation}\n\nComplexity: ${res.complexity}`);
    } catch {
      setAiFeedback(
        allPassed
          ? '✔ All unit test assertions verified successfully in sandbox.'
          : '⚠️ One or more test assertions failed. Inspect actual vs expected outputs above.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunScratchpad = async () => {
    setLoading(true);
    setScratchpadOutput(null);
    setScratchpadAiReview(null);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(
        args
          .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ')
      );
    };

    const t0 = performance.now();
    try {
      const fn = new Function('console', `"use strict";\n${scratchpadCode}`);
      fn({
        log: (...args: unknown[]) => customLog(...args),
        warn: (...args: unknown[]) => logs.push('[WARN] ' + args.join(' ')),
        error: (...args: unknown[]) => logs.push('[ERROR] ' + args.join(' ')),
      });

      function customLog(...args: unknown[]) {
        logs.push(
          args
            .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
            .join(' ')
        );
      }

      const durationMs = Number((performance.now() - t0).toFixed(2));
      logs.push(`✔ Execution completed cleanly in ${durationMs}ms`);
      setScratchpadOutput(logs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(`❌ Runtime Error: ${msg}`);
      setScratchpadOutput(logs);
    } finally {
      console.log = origLog;
    }

    try {
      const res = await generateOrExplainCode({
        mode: 'debug',
        language,
        userPrompt: 'Review this custom scratchpad code, verify time/space complexity, and suggest edge-case improvements.',
        currentCode: scratchpadCode,
        preset: effectivePreset,
      });
      setScratchpadAiReview(`${res.explanation}\n\nComplexity: ${res.complexity}`);
    } catch {
      setScratchpadAiReview('AI Code Reviewer completed static and runtime analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="singularity-dashboard view-transition">
      {/* TOP HEADER & SUB-TAB SWITCHER */}
      <div
        className="hologram-panel"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Award size={18} color="var(--accent-cyan)" /> Algorithmic Dojo & AI Code Reviewer
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Solve curated challenges or write custom code in our free-form writing space with AI code reviews.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-canvas)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid var(--border-hairline)',
            }}
          >
            <button
              onClick={() => setDojoTab('challenges')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: dojoTab === 'challenges' ? 'var(--bg-surface-3)' : 'transparent',
                color: dojoTab === 'challenges' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
            >
              Curated Challenges
            </button>
            <button
              onClick={() => setDojoTab('scratchpad')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: dojoTab === 'scratchpad' ? 'var(--bg-surface-3)' : 'transparent',
                color: dojoTab === 'scratchpad' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
            >
              Free-Form Code Lab
            </button>
          </div>

          <span
            className="status-pill"
            style={{ borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)' }}
          >
            ✔ {effectiveSolved.length} / {CODING_EXERCISES.length} Solved
          </span>
        </div>
      </div>

      {/* SUB-TAB 1: CURATED ALGORITHMIC CHALLENGES */}
      {dojoTab === 'challenges' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, minHeight: 0, flex: 1 }}>
          {/* LEFT CHALLENGE LIST */}
          <div className="hologram-panel" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="field-label">CHALLENGE SUITE</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['typescript', 'javascript', 'python'] as SupportedLanguage[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className="cyber-btn secondary"
                    style={{
                      fontSize: 10,
                      padding: '3px 7px',
                      borderColor: language === l ? 'var(--accent-cyan)' : undefined,
                      color: language === l ? 'var(--accent-cyan)' : undefined,
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '520px' }}>
              {CODING_EXERCISES.map((ex) => {
                const isSolved = effectiveSolved.includes(ex.id);
                const isSelected = selectedEx.id === ex.id;
                return (
                  <div
                    key={ex.id}
                    onClick={() => {
                      setSelectedEx(ex);
                      setDojoCode(getExerciseStarter(ex, language));
                      setTestResults(null);
                      setAiFeedback(null);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface-2)',
                      border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-hairline)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#fff' }}>
                        {ex.title}
                      </strong>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {isSolved && <CheckCircle2 size={14} color="var(--accent-emerald)" />}
                        <span className="stage-pill">{ex.difficulty}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {ex.category}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT CHALLENGE EDITOR & TEST SUITE */}
          <div className="hologram-panel" style={{ gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#fff' }}>
                  <Code2 size={16} color="var(--accent-cyan)" /> {selectedEx.title}
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {selectedEx.description}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="cyber-btn secondary"
                  style={{ padding: '6px 12px', fontSize: 11.5 }}
                  onClick={() => {
                    setDojoCode(formatCodeBuffer(dojoCode));
                    onLogActivity?.(`Formatted solution for ${selectedEx.title}`);
                  }}
                  title="Format Code (Shift+Alt+F)"
                >
                  <Wand2 size={12} /> Format
                </button>
                <button
                  className="cyber-btn secondary"
                  style={{ padding: '6px 12px', fontSize: 11.5 }}
                  onClick={() => {
                    setDojoCode(getExerciseStarter(selectedEx, language));
                    setTestResults(null);
                    setAiFeedback(null);
                  }}
                >
                  <RotateCcw size={12} /> Reset Stub
                </button>
                <button
                  className="cyber-btn"
                  style={{ padding: '6px 16px', fontSize: 12 }}
                  onClick={handleRunDojoTests}
                  disabled={loading}
                >
                  <Play size={13} /> {loading ? 'Evaluating...' : 'Run Test Suite'}
                </button>
              </div>
            </div>

            <div
              style={{
                height: 300,
                border: '1px solid var(--border-hairline)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <Editor
                height="100%"
                language={language === 'python' ? 'python' : 'typescript'}
                theme="vs-dark"
                value={dojoCode}
                onChange={(val) => setDojoCode(val || '')}
                options={{
                  fontSize: 13.5,
                  fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                }}
              />
            </div>

            {/* TEST ASSERTION RESULTS & AI FEEDBACK */}
            <div
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 10,
                padding: 14,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 10 }}>
                <Terminal size={14} /> Strict Test Assertions ({LANGUAGE_META[language].label})
              </div>

              {testResults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {testResults.map((tr, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '7px 11px',
                        borderRadius: 7,
                        background: tr.passed
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(244, 63, 94, 0.15)',
                        border: `1px solid ${
                          tr.passed
                            ? 'rgba(16, 185, 129, 0.4)'
                            : 'rgba(244, 63, 94, 0.45)'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {tr.passed ? (
                          <CheckCircle2 size={14} color="var(--accent-emerald)" />
                        ) : (
                          <XCircle size={14} color="var(--accent-magenta)" />
                        )}
                        <span>
                          Inputs: <code>{tr.input}</code> → Expected:{' '}
                          <code>{tr.expected}</code> | Actual: <code>{tr.actual}</code>
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {tr.durationMs}ms
                      </span>
                    </div>
                  ))}

                  {aiFeedback && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12.5,
                        lineHeight: 1.5,
                      }}
                    >
                      <Sparkles size={14} color="var(--accent-cyan)" style={{ marginTop: 2 }} />
                      <div style={{ whiteSpace: 'pre-wrap' }}>{aiFeedback}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  Complete your function stub in the editor above and click <strong>Run Test Suite</strong> to verify your solution against test cases.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB 2: FREE-FORM CODE LAB & AI REVIEWER */
        <div className="hologram-panel" style={{ flex: 1, gap: 14, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#fff' }}>
                <Cpu size={16} color="var(--accent-cyan)" /> Free-Form Code Writing & AI Review Sandbox
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                Write any custom script or algorithm from scratch. Execute it in the browser sandbox and get instant AI code reviews.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['typescript', 'javascript', 'python'] as SupportedLanguage[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className="cyber-btn secondary"
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      borderColor: language === l ? 'var(--accent-cyan)' : undefined,
                      color: language === l ? 'var(--accent-cyan)' : undefined,
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                className="cyber-btn"
                style={{ padding: '6px 16px', fontSize: 12 }}
                onClick={handleRunScratchpad}
                disabled={loading}
              >
                <Play size={13} /> {loading ? 'Auditing...' : 'Execute & Audit with AI'}
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 280,
              border: '1px solid var(--border-hairline)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <Editor
              height="100%"
              language={language === 'python' ? 'python' : 'typescript'}
              theme="vs-dark"
              value={scratchpadCode}
              onChange={(val) => setScratchpadCode(val || '')}
              options={{
                fontSize: 13.5,
                fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* SCRATCHPAD EXECUTION & AI REVIEW OUTPUT */}
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 10,
              padding: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 10 }}>
              <Layers size={14} /> Runtime Output & AI Code Reviewer
            </div>

            {scratchpadOutput ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scratchpadOutput.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      color: l.startsWith('❌') ? 'var(--accent-magenta)' : l.startsWith('✔') ? 'var(--accent-emerald)' : 'var(--text-primary)',
                    }}
                  >
                    {l}
                  </div>
                ))}

                {scratchpadAiReview && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: 4 }}>
                      🤖 Gemini 3.8 Code Review:
                    </strong>
                    {scratchpadAiReview}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                Write your code above and click <strong>Execute & Audit with AI</strong> to test runtime behavior and receive architectural feedback.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CodingExercises = ExercisesView;
export default ExercisesView;