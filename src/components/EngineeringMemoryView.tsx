import React, { useState } from 'react';
import { Brain, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export interface MemoryRule {
  id: string;
  category: 'Convention' | 'Architecture' | 'Preference';
  content: string;
  enabled: boolean;
}

interface EngineeringMemoryProps {
  memories: MemoryRule[];
  onAddMemory: (rule: MemoryRule) => void;
  onToggleMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
}

export const EngineeringMemoryView: React.FC<EngineeringMemoryProps> = ({
  memories,
  onAddMemory,
  onToggleMemory,
  onDeleteMemory,
}) => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'Convention' | 'Architecture' | 'Preference'>('Convention');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAddMemory({
      id: `mem-${Date.now()}`,
      category,
      content: content.trim(),
      enabled: true,
    });
    setContent('');
  };

  return (
    <div className="content-container">
      <div className="dashboard-columns">
        {/* Left: Add Memory Rule */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Brain size={18} color="#a371f7" />
              <span>Personal Engineering Memory</span>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Preserve user-approved project conventions, architecture decisions, and coding style preferences. Active rules are automatically injected into Gemini AI prompt contexts.
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            <div>
              <label className="field-label">Category</label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="Convention">Coding Convention</option>
                <option value="Architecture">Architecture Rule</option>
                <option value="Preference">Personal Preference</option>
              </select>
            </div>

            <div>
              <label className="field-label">Rule / Preference Instruction</label>
              <textarea
                className="cyber-input"
                style={{ width: '100%', minHeight: '90px', resize: 'vertical' }}
                placeholder="e.g., Always use strict TypeScript types, early returns, and functional patterns..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="cyber-btn">
              <Plus size={15} />
              <span>Save to Memory</span>
            </button>
          </form>
        </div>

        {/* Right: Active Memory Rules List */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <span>Saved Rules & Context Injection ({memories.filter((m) => m.enabled).length} Active)</span>
            </div>
          </div>

          {memories.length === 0 ? (
            <div className="console-empty">No engineering memory rules defined yet. Add one on the left.</div>
          ) : (
            <div className="preset-list">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className={`preset-item ${mem.enabled ? 'selected' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="stage-pill live">{mem.category}</span>
                      <span style={{ fontSize: '0.74rem', color: mem.enabled ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {mem.enabled ? 'Active in AI Prompt' : 'Disabled'}
                      </span>
                    </div>
                    <div className="preset-desc" style={{ color: 'var(--text-primary)' }}>
                      {mem.content}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '1rem' }}>
                    <button
                      className="cyber-btn secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}
                      onClick={() => onToggleMemory(mem.id)}
                    >
                      {mem.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="cyber-btn secondary"
                      style={{ padding: '0.3rem 0.55rem', color: '#f87171' }}
                      onClick={() => onDeleteMemory(mem.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};