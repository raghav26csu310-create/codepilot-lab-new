import { useState, useEffect } from 'react';
import {
  Code2,
  FolderKanban,
  Award,
  Shield,
  Sliders,
  Trash2,
  ExternalLink,
  LayoutDashboard,
  Puzzle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Database,
  Search,
  Terminal as TerminalIcon,
  Play,
  FileCode,
  Activity,
  Globe,
  Plus,
} from 'lucide-react';
import type { IdeTheme, SupportedLanguage, PromptPreset, IdeExtensionPlugin } from './types';
import {
  getStoredPresets,
  getActivePresetId,
  getStoredApiKey,
  saveStoredApiKey,
  getStoredTheme,
  saveStoredTheme,
  getStoredExtensions,
  saveStoredExtensions,
  logActivity,
  LANGUAGE_META,
} from './services/storage';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ImmersiveWorkspace } from './components/ImmersiveWorkspace';
import { ExercisesView } from './components/ExercisesView';

type IdeMode = 'overview' | 'workbench' | 'dojo' | 'vault' | 'extensions' | 'settings';

function SingularityMasterShell() {
  const {
    files,
    activeFile,
    updateFileContent,
    setLanguage,
    projects,
    loadProjectIntoWorkspace,
    deleteProject,
    openFile,
  } = useWorkspace();

  const [mode, setMode] = useState<IdeMode>('overview');
  const [theme, setThemeState] = useState<IdeTheme>(getStoredTheme);
  const [presets] = useState<PromptPreset[]>(getStoredPresets);
  const [activePresetId] = useState<string>(getActivePresetId);
  const [apiKey, setApiKeyState] = useState<string>(getStoredApiKey);
  const [keyInput, setKeyInput] = useState<string>(getStoredApiKey);
  const [extensions, setExtensions] = useState<IdeExtensionPlugin[]>(getStoredExtensions);

  const activePreset =
    presets.find((p) => p.id === activePresetId) || presets[0];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveStoredTheme(theme);
  }, [theme]);

  const handleApiKeySave = () => {
    saveStoredApiKey(keyInput);
    setApiKeyState(keyInput.trim());
    logActivity('Updated Gemini API key');
  };

  const toggleExtension = (extId: string) => {
    const updated = extensions.map((e) =>
      e.id === extId ? { ...e, enabled: !e.enabled } : e
    );
    setExtensions(updated);
    saveStoredExtensions(updated);
    logActivity(`Toggled extension plugin: ${extId}`);
  };

  const modifiedCount = files.filter((f) => f.isModified).length;

  return (
    <div className="ide-root">
      {/* CINEMATIC TOP COMMAND BAR */}
      <header className="ide-header">
        <div className="ide-brand" onClick={() => setMode('overview')} style={{ cursor: 'pointer' }}>
          <div className="ide-logo">CP</div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', color: '#fff' }}>
            CodePilot Lab <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: 11, marginLeft: 6 }}>GCC 14.2 PE64 IDE</span>
          </span>
        </div>

        {/* SEARCH OMNIBAR */}
        <div className="omnibar-search" onClick={() => setMode('workbench')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color="var(--accent-cyan)" />
            <span>Search files, .c, .exe targets...</span>
          </div>
          <span className="kbd-badge">Ctrl+K</span>
        </div>

        {/* MODE NAV */}
        <nav className="ide-mode-nav">
          {[
            { id: 'overview' as IdeMode, label: 'Command Center', icon: <LayoutDashboard size={13} /> },
            { id: 'workbench' as IdeMode, label: 'IDE Workbench', icon: <Code2 size={13} /> },
            { id: 'dojo' as IdeMode, label: 'Coding Dojo', icon: <Award size={13} /> },
            { id: 'vault' as IdeMode, label: `Vault (${projects.length})`, icon: <FolderKanban size={13} /> },
            { id: 'extensions' as IdeMode, label: 'Extensions', icon: <Puzzle size={13} /> },
            { id: 'settings' as IdeMode, label: 'Settings', icon: <Sliders size={13} /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`ide-mode-btn ${mode === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* RIGHT TELEMETRY & PROFILE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="status-pill" style={{ borderColor: 'var(--accent-violet)', color: 'var(--accent-violet)', background: 'rgba(168, 85, 247, 0.12)' }}>
            <span className="pulse-dot" />
            <span>Gemini 2.5 Pro • Connected</span>
          </div>

          <select
            className="cyber-select"
            style={{ width: 130, padding: '4px 8px', fontSize: 11.5 }}
            value={theme}
            onChange={(e) => setThemeState(e.target.value as IdeTheme)}
          >
            <option value="obsidian">Obsidian Cyber</option>
            <option value="vercel">Vercel Mono</option>
            <option value="tokyo-night">Tokyo Cyber</option>
          </select>
        </div>
      </header>

      {/* WORKBENCH BODY SHELL WITH LEFT NAVIGATION RAIL */}
      <div className="singularity-body">
        {/* LEFT FUTRURISTIC RAIL (MATCHING REFERENCE ART) */}
        <aside className="singularity-left-rail">
          <div className="rail-nav-list">
            {[
              { id: 'overview' as IdeMode, title: 'Home', subtitle: 'Command Center', icon: <LayoutDashboard size={16} /> },
              { id: 'workbench' as IdeMode, title: 'IDE Workbench', subtitle: 'Code. Build. Debug.', icon: <Code2 size={16} /> },
              { id: 'dojo' as IdeMode, title: 'Coding Dojo', subtitle: 'Practice & Compete', icon: <Award size={16} /> },
              { id: 'vault' as IdeMode, title: 'Project Vault', subtitle: 'Save & Restore', icon: <FolderKanban size={16} /> },
              { id: 'extensions' as IdeMode, title: 'Extensions', subtitle: 'Supercharge', icon: <Puzzle size={16} /> },
              { id: 'settings' as IdeMode, title: 'Settings', subtitle: 'Configure AI', icon: <Sliders size={16} /> },
            ].map((r) => {
              const active = mode === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setMode(r.id)}
                  className={`rail-nav-btn ${active ? 'active' : ''}`}
                >
                  <div className="rail-nav-icon">{r.icon}</div>
                  <div className="rail-nav-text">
                    <span className="rail-nav-title">{r.title}</span>
                    <span className="rail-nav-sub">{r.subtitle}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* LIVE SYSTEM TELEMETRY WIDGET AT BOTTOM OF LEFT RAIL */}
          <div className="rail-system-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Cpu size={12} color="var(--accent-cyan)" /> Live System
              </span>
              <span className="pulse-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>CPU Load</span>
                <span style={{ color: 'var(--accent-cyan)' }}>12%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>RAM Cache</span>
                <span style={{ color: 'var(--accent-violet)' }}>42%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>WASM SSD</span>
                <span style={{ color: 'var(--accent-emerald)' }}>68%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER CONTENT CONTAINER */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* MODE 0: COMMAND CENTER DASHBOARD (MATCHING REFERENCE ART) */}
          {mode === 'overview' && (
            <div className="singularity-dashboard view-transition">
              {/* HERO BANNER & CIRCULAR GOAL WIDGET */}
              <div className="hero-cockpit-grid">
                <div className="hero-banner">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
                    <span className="stage-pill" style={{ width: 'fit-content' }}>
                      ✨ GCC 14.2 & PE64 C/C++ Toolchain Active
                    </span>
                    <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff' }}>
                      Good Morning, Raghav.
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 540 }}>
                      Code. Learn. Build. Create the impossible. Your active C workspace is compiled into inspectable <code>.exe</code> binaries with zero friction.
                    </p>
                  </div>

                  {/* QUICK ACTION TILES */}
                  <div className="hero-quick-actions">
                    <button className="quick-action-tile" onClick={() => setMode('workbench')}>
                      <div className="quick-action-icon"><Code2 size={16} /></div>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700 }}>IDE Workbench</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Open Editor</div>
                      </div>
                    </button>
                    <button className="quick-action-tile" onClick={() => setMode('dojo')}>
                      <div className="quick-action-icon"><Award size={16} /></div>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700 }}>Coding Dojo</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>6 Challenges</div>
                      </div>
                    </button>
                    <button className="quick-action-tile" onClick={() => setMode('vault')}>
                      <div className="quick-action-icon"><FolderKanban size={16} /></div>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700 }}>Project Vault</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{projects.length} Saved</div>
                      </div>
                    </button>
                    <button className="quick-action-tile" onClick={() => setMode('extensions')}>
                      <div className="quick-action-icon"><Puzzle size={16} /></div>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700 }}>Extensions</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>4 Active</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* WEEKLY GOAL CIRCULAR RING WIDGET */}
                <div className="hologram-panel" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span className="field-label">Today's Progress</span>
                    <span style={{ fontSize: 10.5, color: 'var(--accent-emerald)', fontWeight: 800 }}>Weekly Goal</span>
                  </div>
                  <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="90" height="90" viewBox="0 0 90 90">
                      <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                      <circle
                        cx="45"
                        cy="45"
                        r="38"
                        fill="none"
                        stroke="url(#gradientRing)"
                        strokeWidth="7"
                        strokeDasharray="238"
                        strokeDashoffset="95"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradientRing" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div style={{ position: 'absolute', fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                      60%
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Complete 5 problems (Dojo) • 3/5 explored
                  </div>
                </div>
              </div>

              {/* BOTTOM TELEMETRY DOCK (MATCHING REFERENCE ART) */}
              <div className="telemetry-dock-grid">
                {/* 1. CODING DOJO CARD */}
                <div className="hologram-panel" onClick={() => setMode('dojo')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label">Coding Dojo</span>
                    <span className="stage-pill" style={{ fontSize: 10 }}>Level 3</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Arrays & Hashing</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Next Challenge: Two Sum</div>
                  <button className="cyber-btn" style={{ marginTop: 'auto', fontSize: 11, padding: '5px 10px' }}>
                    Continue Challenge
                  </button>
                </div>

                {/* 2. PROJECT VAULT CARD */}
                <div className="hologram-panel" onClick={() => setMode('vault')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label">Project Vault</span>
                    <span className="stage-pill" style={{ fontSize: 10 }}>3 Snapshots</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>C Workspace & .exe</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Updated 2h ago</div>
                  <button className="cyber-btn secondary" style={{ marginTop: 'auto', fontSize: 11, padding: '5px 10px' }}>
                    Manage Vault
                  </button>
                </div>

                {/* 3. EXTENSIONS CARD */}
                <div className="hologram-panel" onClick={() => setMode('extensions')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label">Extensions</span>
                    <span className="status-pill" style={{ fontSize: 10 }}>4 Active</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>GCC Toolchain & AST</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>PE64 Linker enabled</div>
                  <button className="cyber-btn secondary" style={{ marginTop: 'auto', fontSize: 11, padding: '5px 10px' }}>
                    View Plugins
                  </button>
                </div>

                {/* 4. GIT STATUS CARD */}
                <div className="hologram-panel" onClick={() => setMode('workbench')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label">Git Status</span>
                    <span className="stage-pill" style={{ fontSize: 10, color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}>main • Clean</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Last Commit</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>feat: init C workspace</div>
                  <button className="cyber-btn secondary" style={{ marginTop: 'auto', fontSize: 11, padding: '5px 10px' }}>
                    View Diffs
                  </button>
                </div>

                {/* 5. LIVE SYSTEM ANALYTICS CARD */}
                <div className="hologram-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="field-label">Live Analytics</span>
                    <span className="pulse-dot" />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div>Files Edited: <strong style={{ color: '#fff' }}>12</strong></div>
                    <div>Tests Run: <strong style={{ color: '#fff' }}>8</strong></div>
                    <div>Runtime: <strong style={{ color: '#fff' }}>42s</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 1: IDE WORKBENCH */}
          {mode === 'workbench' && (
            <ImmersiveWorkspace
              language={activeFile.language}
              code={activeFile.content}
              activePreset={activePreset}
              onCodeChange={(val) => updateFileContent(activeFile.id, val)}
              onLogActivity={logActivity}
            />
          )}

          {/* MODE 2: CODING DOJO */}
          {mode === 'dojo' && (
            <ExercisesView
              language={activeFile.language}
              activePreset={activePreset}
              onLogActivity={logActivity}
            />
          )}

          {/* MODE 3: PROJECT VAULT */}
          {mode === 'vault' && (
            <div className="singularity-dashboard view-transition">
              <div className="hologram-panel">
                <h2 style={{ fontSize: 15, fontWeight: 800 }}>Project Vault Snapshots ({projects.length})</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Click any saved snapshot to load it into your active C/C++ workspace.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginTop: 8 }}>
                  {projects.map((p) => (
                    <div key={p.id} className="hologram-panel" style={{ background: 'var(--bg-surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13 }}>{p.title}</strong>
                        <span className="stage-pill">{p.language.toUpperCase()}</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{p.notes}</p>
                      <pre style={{ background: 'var(--bg-canvas)', padding: 10, borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', maxHeight: 110, overflow: 'auto', border: '1px solid var(--border-hairline)' }}>
                        {p.code}
                      </pre>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <button className="cyber-btn secondary" onClick={() => deleteProject(p.id)}>
                          <Trash2 size={12} /> Delete
                        </button>
                        <button className="cyber-btn" onClick={() => { loadProjectIntoWorkspace(p); setMode('workbench'); }}>
                          <ExternalLink size={12} /> Open in Workbench
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 4: EXTENSIONS */}
          {mode === 'extensions' && (
            <div className="singularity-dashboard view-transition" style={{ maxWidth: 880 }}>
              <div className="hologram-panel">
                <h2 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Puzzle size={17} color="var(--accent-cyan)" /> Extension Marketplace
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {extensions.map((ext) => (
                    <div
                      key={ext.id}
                      style={{
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 10,
                        padding: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 540 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 13.5, color: '#fff' }}>{ext.name}</strong>
                          <span className="stage-pill" style={{ fontSize: 10 }}>v{ext.version}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ext.description}</p>
                      </div>
                      <button
                        className={`cyber-btn ${ext.enabled ? 'secondary' : 'emerald'}`}
                        onClick={() => toggleExtension(ext.id)}
                      >
                        {ext.enabled ? <CheckCircle2 size={13} color="var(--accent-emerald)" /> : null}
                        {ext.enabled ? 'Enabled' : 'Enable Plugin'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 5: SETTINGS */}
          {mode === 'settings' && (
            <div className="singularity-dashboard view-transition" style={{ maxWidth: 820 }}>
              <div className="hologram-panel">
                <h3 style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={16} color="var(--accent-cyan)" /> Gemini 2.5 Pro API Key
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Stored securely in browser `localStorage`. Without a key, CodePilot Lab seamlessly falls back to the Local AST Copilot Engine.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="password"
                    className="cyber-input"
                    placeholder="AIzaSy..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                  />
                  <button className="cyber-btn" onClick={handleApiKeySave}>Save Key</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <SingularityMasterShell />
    </WorkspaceProvider>
  );
}