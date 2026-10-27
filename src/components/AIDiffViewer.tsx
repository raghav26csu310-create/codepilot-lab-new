import React from 'react';
import { Check, X, GitCommit } from 'lucide-react';

interface AIDiffViewerProps {
  originalCode: string;
  proposedCode: string;
  explanation: string;
  onAccept: () => void;
  onReject: () => void;
}

export const AIDiffViewer: React.FC<AIDiffViewerProps> = ({
  originalCode,
  proposedCode,
  explanation,
  onAccept,
  onReject,
}) => {
  const originalLines = originalCode.split('\n');
  const proposedLines = proposedCode.split('\n');

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glow)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
          <GitCommit size={18} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>AI Proposed Code Modification (Diff Review)</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="cyber-btn secondary" onClick={onReject} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
            <X size={14} />
            <span>Reject</span>
          </button>
          <button className="cyber-btn" onClick={onAccept} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
            <Check size={14} />
            <span>Accept Changes</span>
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        <strong>AI Rationale:</strong> {explanation}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Original */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span className="field-label" style={{ color: '#f87171' }}>Original Buffer</span>
          <pre
            className="project-code-preview"
            style={{ maxHeight: '220px', background: 'rgba(248, 113, 113, 0.04)', borderColor: 'rgba(248, 113, 113, 0.2)' }}
          >
            {originalLines.map((line, idx) => (
              <div key={idx} style={{ color: '#fca5a5' }}>
                - {line}
              </div>
            ))}
          </pre>
        </div>

        {/* Proposed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span className="field-label" style={{ color: '#34d399' }}>Proposed Refactor</span>
          <pre
            className="project-code-preview"
            style={{ maxHeight: '220px', background: 'rgba(52, 211, 153, 0.04)', borderColor: 'rgba(52, 211, 153, 0.2)' }}
          >
            {proposedLines.map((line, idx) => (
              <div key={idx} style={{ color: '#6ee7b7' }}>
                + {line}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
};