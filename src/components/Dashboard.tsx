import React, { useState } from 'react';
import {
  Cpu,
  KeyRound,
  Activity,
  FolderKanban,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  PlusCircle,
  Code2,
} from 'lucide-react';
import type { ActivityEvent, AppState, NavSection, PromptPreset } from '../types';
import { DEFAULT_PROMPT_PRESETS, getStoredApiKey } from '../services/storage';

interface DashboardProps {
  appState: AppState;
  customPresets?: PromptPreset[];
  onNavigate: (section: NavSection) => void;
  onSelectPreset: (presetId: string) => void;
  onSaveApiKey: (rawKey: string) => void;
  onCreateCustomPreset?: (preset: PromptPreset) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  appState,
  customPresets = [],
  onNavigate,
  onSelectPreset,
  onSaveApiKey,
  onCreateCustomPreset,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey());
  const [keySavedBanner, setKeySavedBanner] = useState(false);

  // Stage 7: Custom Persona Builder State
  const [showBuilder, setShowBuilder] = useState(false);
  const [personaName, setPersonaName] = useState('');
  const [personaDesc, setPersonaDesc] = useState('');
  const [personaPrompt, setPersonaPrompt] = useState('');
  const [personaTemp, setPersonaTemp] = useState(0.3);

  const allPresets: PromptPreset[] = [...DEFAULT_PROMPT_PRESETS, ...customPresets];
  const activePreset =
    allPresets.find((p) => p.id === appState.activePromptPresetId) || allPresets[0];

  const activityItems: ActivityEvent[] =
    appState.recentActivity || appState.activityLog || [];

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(apiKeyInput);
    setKeySavedBanner(true);
    setTimeout(() => setKeySavedBanner(false), 2500);
  };

  const handleAddPersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim() || !personaPrompt.trim() || !onCreateCustomPreset) return;
    const newPreset: PromptPreset = {
      id: `custom-${Date.now()}`,
      name: personaName.trim(),
      role: personaDesc.trim() || 'User-defined custom prompt engineering persona.',
      description: personaDesc.trim() || 'User-defined custom prompt engineering persona.',
      systemPrompt: personaPrompt.trim(),
      temperature: Number(personaTemp),
    };
    onCreateCustomPreset(newPreset);
    setPersonaName('');
    setPersonaDesc('');
    setPersonaPrompt('');
    setShowBuilder(false);
  };

  return (
    <div className="content-container">
      {/* Top Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            <span>SAVED PROJECTS</span>
            <FolderKanban size={16} color="#06b6d4" />
          </div>
          <div className="metric-value">{appState.projects.length}</div>
          <div className="metric-sub">Multi-language buffers in Vault</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>ACTIVE AI PERSONA</span>
            <Cpu size={16} color="#10b981" />
          </div>
          <div className="metric-value" style={{ fontSize: '1.15rem' }}>
            {activePreset.name}
          </div>
          <div className="metric-sub">Temperature: {activePreset.temperature}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>EXERCISE MASTERY</span>
            <GraduationCap size={16} color="#f59e0b" />
          </div>
          <div className="metric-value">{appState.completedExerciseIds.length} / 6</div>
          <div className="metric-sub">Automated test suites passed</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>GEMINI 3.8 FLASH ENGINE</span>
            <Sparkles size={16} color="#06b6d4" />
          </div>
          <div
            className="metric-value"
            style={{
              fontSize: '1.15rem',
              color: appState.geminiApiKeyConfigured ? '#10b981' : '#f59e0b',
            }}
          >
            {appState.geminiApiKeyConfigured ? 'Connected' : 'Key Required'}
          </div>
          <div className="metric-sub">Structured JSON Schema Active</div>
        </div>
      </div>

      {/* Main Two Columns */}
      <div className="dashboard-columns">
        {/* Left: Prompt Engineering Persona Studio (Stage 7 Enhanced) */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Cpu size={18} color="#06b6d4" />
              <span>Prompt Engineering Personas</span>
            </div>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {onCreateCustomPreset && (
                <button
                  type="button"
                  className="cyber-btn secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => setShowBuilder(!showBuilder)}
                >
                  <PlusCircle size={13} />
                  <span>{showBuilder ? 'Cancel' : 'New Persona'}</span>
                </button>
              )}
              <button
                type="button"
                className="cyber-btn"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => onNavigate('editor')}
              >
                <Code2 size={13} />
                <span>Launch Unified IDE</span>
              </button>
            </div>
          </div>

          {showBuilder && (
            <form
              onSubmit={handleAddPersona}
              className="preset-prompt-preview"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
            >
              <div className="field-label" style={{ color: 'var(--accent-cyan)' }}>
                Stage 7: Create Custom Prompt Persona
              </div>
              <input
                type="text"
                className="cyber-input"
                placeholder="Persona Name (e.g., Competitive Programming Coach)"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                required
              />
              <input
                type="text"
                className="cyber-input"
                placeholder="Short description..."
                value={personaDesc}
                onChange={(e) => setPersonaDesc(e.target.value)}
              />
              <textarea
                className="cyber-input"
                style={{ minHeight: '65px' }}
                placeholder="System Prompt Instruction (e.g., Focus on O(N log N) time complexity and C++/TS bit manipulation...)"
                value={personaPrompt}
                onChange={(e) => setPersonaPrompt(e.target.value)}
                required
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ margin: 0 }}>
                  Temperature: {personaTemp}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={personaTemp}
                  onChange={(e) => setPersonaTemp(parseFloat(e.target.value))}
                  style={{ width: '160px', accentColor: 'var(--accent-cyan)' }}
                />
                <button type="submit" className="cyber-btn" style={{ padding: '0.35rem 0.75rem' }}>
                  Save Persona
                </button>
              </div>
            </form>
          )}

          <div className="preset-list">
            {allPresets.map((preset) => {
              const isSelected = preset.id === activePreset.id;
              return (
                <div
                  key={preset.id}
                  className={`preset-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectPreset(preset.id)}
                >
                  <div className="preset-header">
                    <span className="preset-name">{preset.name}</span>
                    <span className={`stage-pill ${isSelected ? 'live' : ''}`}>
                      temp={preset.temperature} {isSelected ? '• ACTIVE' : ''}
                    </span>
                  </div>
                  <div className="preset-desc">
                    {preset.description || preset.role || 'Specialized AI system prompt configuration.'}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="field-label">Active System Instruction Payload</div>
            <div className="preset-prompt-preview">"{activePreset.systemPrompt}"</div>
          </div>
        </div>

        {/* Right Column: API Key Configuration + Live Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel-card">
            <div className="panel-header">
              <div className="panel-title">
                <KeyRound size={18} color="#10b981" />
                <span>Google AI Studio API Key (Local Storage)</span>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="input-row">
              <input
                type="password"
                className="cyber-input"
                style={{ flex: 1 }}
                placeholder="Paste AIzaSy... key from Google AI Studio"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <button type="submit" className="cyber-btn">
                Save Key
              </button>
            </form>

            {keySavedBanner && (
              <div style={{ color: '#10b981', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} />
                <span>API Key updated in browser localStorage!</span>
              </div>
            )}
          </div>

          <div className="panel-card" style={{ flex: 1 }}>
            <div className="panel-header">
              <div className="panel-title">
                <Activity size={18} color="#06b6d4" />
                <span>Workspace Activity Telemetry</span>
              </div>
            </div>

            {activityItems.length === 0 ? (
              <div className="console-empty">No telemetry events recorded yet.</div>
            ) : (
              <div className="activity-list">
                {activityItems.slice(0, 8).map((item: ActivityEvent) => (
                  <div key={item.id} className="activity-item">
                    <span>{item.message}</span>
                    <span className="stage-pill">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
