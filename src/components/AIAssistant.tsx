import React, { useState } from 'react';
import { Sparkles, Send, ArrowRight, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import type { PromptPreset, SupportedLanguage } from '../types';
import { LANGUAGE_META } from '../services/storage';
import { generateOrExplainCode, type AIStudioResult } from '../services/gemini';

interface AIAssistantProps {
  language: SupportedLanguage;
  currentCode: string;
  activePreset: PromptPreset;
  onApplyCodeToEditor: (code: string) => void;
  onLogActivity: (msg: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  language,
  currentCode,
  activePreset,
  onApplyCodeToEditor,
  onLogActivity,
}) => {
  const [mode, setMode] = useState<'generate' | 'explain'>('explain');
  const [promptInput, setPromptInput] = useState(
    'Explain how the loop invariants and pointers work in my current editor code.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIStudioResult | null>(null);

  const handleRunAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await generateOrExplainCode({
        mode,
        language,
        userPrompt: promptInput,
        currentCode,
        preset: activePreset,
      });
      setResult(res);
      onLogActivity(`Gemini AI (${activePreset.name}) completed ${mode} task for ${LANGUAGE_META[language].label}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-container">
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Sparkles size={18} color="#06b6d4" />
            <span>AI Code Generation & Explanation Studio</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`cyber-btn ${mode === 'explain' ? '' : 'secondary'}`}
              onClick={() => {
                setMode('explain');
                setPromptInput('Explain how my current editor code works and analyze Big-O complexity.');
              }}
            >
              Explain Code
            </button>
            <button
              type="button"
              className={`cyber-btn ${mode === 'generate' ? '' : 'secondary'}`}
              onClick={() => {
                setMode('generate');
                setPromptInput('Write an iterative Merge Sort algorithm with logging.');
              }}
            >
              Generate Code
            </button>
          </div>
        </div>

        <div className="preset-prompt-preview" style={{ marginBottom: '0.4rem' }}>
          <Cpu size={13} style={{ display: 'inline', marginRight: '6px' }} />
          <strong>Active Persona ({activePreset.name}, temp={activePreset.temperature}):</strong> "{activePreset.systemPrompt}"
        </div>

        <form onSubmit={handleRunAI} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label className="field-label">
              {mode === 'generate'
                ? `Prompt Request (Target: ${LANGUAGE_META[language].label})`
                : `Question About Current ${LANGUAGE_META[language].label} Buffer`}
            </label>
            <textarea
              className="cyber-input"
              style={{ width: '100%', minHeight: '85px', resize: 'vertical' }}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Powered by Gemini 3.8 Flash with structured JSON output.
            </span>
            <button type="submit" className="cyber-btn" disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              <span>{loading ? 'Querying Gemini...' : mode === 'generate' ? 'Generate Code' : 'Explain Code'}</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="console-notice" style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && (
        <div className="dashboard-columns">
          <div className="panel-card">
            <div className="panel-header">
              <div className="panel-title">Generated / Annotated Code</div>
              <button
                className="cyber-btn"
                onClick={() => onApplyCodeToEditor(result.code)}
              >
                <span>Load into Editor</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <pre className="project-code-preview" style={{ maxHeight: '420px', fontSize: '0.8rem' }}>
              {result.code}
            </pre>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card">
              <div className="panel-header">
                <div className="panel-title">Conceptual Explanation</div>
              </div>
              <p style={{ fontSize: '0.86rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {result.explanation}
              </p>
            </div>

            <div className="panel-card">
              <div className="panel-header">
                <div className="panel-title">Time & Space Complexity</div>
              </div>
              <div className="preset-prompt-preview" style={{ color: 'var(--accent-emerald)' }}>
                {result.complexity}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                <strong>Persona Effect:</strong> {result.promptBreakdown}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
