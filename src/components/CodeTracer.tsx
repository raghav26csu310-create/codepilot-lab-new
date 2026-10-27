import React, { useState } from 'react';
import { Activity, Play, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

interface TraceStep {
  stepNumber: number;
  line: number;
  variables: Record<string, string>;
  note: string;
}

const TRACE_PRESETS: Record<string, { name: string; code: string; vars: string[] }> = {
  binarySearch: {
    name: 'Binary Search Trace',
    vars: ['left', 'right', 'mid', 'target'],
    code: `const arr = [4, 12, 19, 26, 38, 45, 72];
let target = 38;
let left = 0;
let right = arr.length - 1;
let mid = 0;

while (left <= right) {
  mid = Math.floor((left + right) / 2);
  if (arr[mid] === target) {
    break;
  }
  if (arr[mid] < target) {
    left = mid + 1;
  } else {
    right = mid - 1;
  }
}`,
  },
  prefixSum: {
    name: 'Prefix Sum Accumulator',
    vars: ['i', 'currentVal', 'runningSum'],
    code: `const nums = [3, 7, 2, 9, 4];
let runningSum = 0;
let currentVal = 0;

for (let i = 0; i < nums.length; i++) {
  currentVal = nums[i];
  runningSum = runningSum + currentVal;
}`,
  },
};

export const CodeTracer: React.FC<{ onLogActivity: (msg: string) => void }> = ({ onLogActivity }) => {
  const [traceCode, setTraceCode] = useState(TRACE_PRESETS.binarySearch.code);
  const [watchedVarsInput, setWatchedVarsInput] = useState(TRACE_PRESETS.binarySearch.vars.join(', '));
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [traceError, setTraceError] = useState<string | null>(null);

  const runInstrumentedTrace = () => {
    setTraceError(null);
    const varNames = watchedVarsInput.split(',').map((v) => v.trim()).filter(Boolean);
    const lines = traceCode.split('\n');
    const instrumentedLines: string[] = [];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      instrumentedLines.push(line);

      if (trimmed && !trimmed.startsWith('//') && trimmed !== '}' && !trimmed.startsWith('break')) {
        // Safely evaluate variables even if they are in the Temporal Dead Zone (TDZ)
        const snapshotEntries = varNames
          .map(
            (v) =>
              `"${v}": (() => { try { return JSON.stringify(${v}); } catch(e) { return "uninitialized"; } })()`
          )
          .join(', ');
        instrumentedLines.push(`__record(${lineNum}, { ${snapshotEntries} }, ${JSON.stringify(trimmed)});`);
      }
    });

    const recorded: TraceStep[] = [];
    const __record = (line: number, variables: Record<string, string>, note: string) => {
      if (recorded.length < 150) {
        recorded.push({ stepNumber: recorded.length + 1, line, variables, note });
      }
    };

    try {
      const runner = new Function('__record', `"use strict";\n${instrumentedLines.join('\n')}`);
      runner(__record);
      setSteps(recorded);
      setCurrentIdx(0);
      onLogActivity(`Generated ${recorded.length} interactive trace frames.`);
    } catch (err: unknown) {
      setTraceError(err instanceof Error ? err.message : String(err));
    }
  };

  const activeStep = steps[currentIdx] || null;
  const codeLines = traceCode.split('\n');

  return (
    <div className="content-container">
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Activity size={18} color="#06b6d4" />
            <span>Interactive Loop & Variable Execution Tracer</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(TRACE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                className="cyber-btn secondary"
                onClick={() => {
                  setTraceCode(preset.code);
                  setWatchedVarsInput(preset.vars.join(', '));
                  setSteps([]);
                }}
              >
                {preset.name}
              </button>
            ))}
            <button className="cyber-btn" onClick={runInstrumentedTrace}>
              <Play size={14} />
              <span>Compile & Trace</span>
            </button>
          </div>
        </div>

        <div className="input-row">
          <div style={{ flex: 1 }}>
            <label className="field-label">Watched Variables (comma-separated)</label>
            <input
              type="text"
              className="cyber-input"
              style={{ width: '100%' }}
              value={watchedVarsInput}
              onChange={(e) => setWatchedVarsInput(e.target.value)}
            />
          </div>
        </div>

        {traceError && (
          <div className="console-notice" style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
            <span>Trace Error: {traceError}</span>
          </div>
        )}
      </div>

      <div className="dashboard-columns">
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">Source Code & Pointer</div>
            {activeStep && <span className="stage-pill live">Line {activeStep.line}</span>}
          </div>

          <div className="code-surface" style={{ minHeight: '340px', borderRadius: '8px' }}>
            <div className="line-gutter">
              {codeLines.map((_, i) => (
                <div key={i} className={`gutter-line ${activeStep?.line === i + 1 ? 'active-line' : ''}`}>
                  {activeStep?.line === i + 1 ? '▶' : i + 1}
                </div>
              ))}
            </div>
            <textarea
              className="code-textarea"
              value={traceCode}
              onChange={(e) => setTraceCode(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              Variable State {steps.length > 0 && `(Step ${currentIdx + 1} of ${steps.length})`}
            </div>
            {steps.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="cyber-btn secondary" onClick={() => setCurrentIdx(0)} disabled={currentIdx === 0}>
                  <RotateCcw size={13} />
                </button>
                <button className="cyber-btn secondary" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                  <SkipBack size={13} />
                  <span>Prev</span>
                </button>
                <button className="cyber-btn" onClick={() => setCurrentIdx((i) => Math.min(steps.length - 1, i + 1))} disabled={currentIdx === steps.length - 1}>
                  <span>Next</span>
                  <SkipForward size={13} />
                </button>
              </div>
            )}
          </div>

          {!activeStep ? (
            <div className="console-empty">
              Click <strong>"Compile & Trace"</strong> to step through variable mutations.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="range"
                min={0}
                max={steps.length - 1}
                value={currentIdx}
                onChange={(e) => setCurrentIdx(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />

              <div className="preset-prompt-preview">
                <strong>Executed:</strong> <code>{activeStep.note}</code>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {Object.entries(activeStep.variables).map(([varName, val]) => (
                  <div key={varName} className="metric-card" style={{ padding: '0.85rem' }}>
                    <div className="field-label">{varName}</div>
                    <div className="metric-value" style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};