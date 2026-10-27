import React, { useState } from 'react';
import { Bug, Play, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import type { PromptPreset, SupportedLanguage } from '../types';
import { LANGUAGE_META } from '../services/storage';
import { debugCodeWithGemini, type AIDebugResult } from '../services/gemini';

interface DebuggerViewProps {
  language: SupportedLanguage;
  currentCode: string;
  activePreset: PromptPreset;
  onApplyFixToEditor: (fixedCode: string) => void;
  onLogActivity: (msg: string) => void;
}

export const DebuggerView: React.FC<DebuggerViewProps> = ({
  language,
  currentCode,
  activePreset,
  onApplyFixToEditor,
  onLogActivity,
}) => {
  const [buggyCode, setBuggyCode] = useState(currentCode);
  const [symptom, setSymptom] = useState('Off-by-one loop condition or unexpected output.');
  const [localCheckResult, setLocalCheckResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugReport, setDebugReport] = useState<AIDebugResult | null>(null);

  const runLocalSyntaxAndRuntimeProbe = () => {
    if (language !== 'javascript' && language !== 'typescript') {
      setLocalCheckResult(`Local runtime probe supports JS/TS. Use Gemini Analysis for ${LANGUAGE_META[language].label}.`);
      return;
    }
    try {
      const stripped = buggyCode
        .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]\|\s]+(\s*\{)/g, ')$1')
        .replace(/(\w+)\s*\??:\s*(?:number|string|boolean|any|void|unknown)(?:\[\])*/g, '$1');
      const fn = new Function('console', `"use strict";\n${stripped}`);
      fn({ log: () => {}, warn: () => {}, error: () => {} });
      setLocalCheckResult('✓ No syntax or immediate runtime exceptions thrown.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setSymptom(msg);
      setLocalCheckResult(`✖ Caught Exception: ${msg}`);
    }
  };

  const handleRunAIDebug = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await debugCodeWithGemini({
        language,
        buggyCode,
        errorOrSymptom: symptom,
        preset: activePreset,
      });
      setDebugReport(res);
      onLogActivity(`Ran AI Root-Cause Debugger on ${LANGUAGE_META[language].label} snippet.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-container">
      <div className="dashboard-columns">
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Bug size={18} color="#f59e0b" />
              <span>Code Under Investigation ({LANGUAGE_META[language].label})</span>
            </div>
            <button type="button" className="cyber-btn secondary" onClick={runLocalSyntaxAndRuntimeProbe}>
              <Play size={14} />
              <span>Probe JS/TS Runtime</span>
            </button>
          </div>

          {localCheckResult && (
            <div className="preset-prompt-preview" style={{ color: 'var(--accent-cyan)' }}>
              {localCheckResult}
            </div>
          )}

          <textarea
            className="cyber-input"
            style={{ width: '100%', minHeight: '280px', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}
            value={buggyCode}
            onChange={(e) => setBuggyCode(e.target.value)}
          />

          <form onSubmit={handleRunAIDebug} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="field-label">Observed Error Message or Logical Symptom</label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="cyber-btn" disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              <span>{loading ? 'Isolating Root Cause...' : 'Run Gemini Root-Cause Analysis'}</span>
            </button>
          </form>

          {error && (
            <div className="console-notice" style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">Diagnostic Report & Verified Fix</div>
            {debugReport && (
              <button
                className="cyber-btn"
                onClick={() => onApplyFixToEditor(debugReport.fixedCode)}
              >
                <span>Apply Fix to Editor</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {!debugReport ? (
            <div className="console-empty">
              Click <strong>"Run Gemini Root-Cause Analysis"</strong> to isolate logical bugs and apply fixes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div className="field-label">Faulty Line / Condition</div>
                <div className="preset-prompt-preview" style={{ borderColor: '#f59e0b', color: '#fde68a' }}>
                  {debugReport.buggyLineHint}
                </div>
              </div>
              <div>
                <div className="field-label">Root Cause Analysis</div>
                <p style={{ fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                  {debugReport.rootCause}
                </p>
              </div>
              <div>
                <div className="field-label">Corrected Code</div>
                <pre className="project-code-preview" style={{ maxHeight: '220px' }}>
                  {debugReport.fixedCode}
                </pre>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', gap: '0.4rem' }}>
                <CheckCircle2 size={15} />
                <span>{debugReport.verificationNotes}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
