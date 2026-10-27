import React, { useState, useRef } from 'react';
import {
  FolderKanban,
  Plus,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  FileCode2,
} from 'lucide-react';
import type { SavedProject, SupportedLanguage } from '../types';
import { LANGUAGE_META } from '../services/storage';

interface ProjectsManagerProps {
  projects: SavedProject[];
  activeProjectId: string | null;
  onLoadProject: (project: SavedProject) => void;
  onCreateProject: (title: string, description: string, language: SupportedLanguage) => void;
  onDuplicateProject: (project: SavedProject) => void;
  onDeleteProject: (projectId: string) => void;
  onImportProjects?: (imported: SavedProject[]) => void;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({
  projects,
  activeProjectId,
  onLoadProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onImportProjects,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('typescript');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateProject(title.trim(), description.trim() || 'Custom workspace module.', language);
    setTitle('');
    setDescription('');
  };

  // Stage 6 Feature: Export all projects as a JSON backup
  const handleExportVault = () => {
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codepilot-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stage 6 Feature: Download single source code file (.ts, .py, .cpp, .js)
  const handleDownloadSourceFile = (proj: SavedProject) => {
    const ext = LANGUAGE_META[proj.language].extension;
    const safeName = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'snippet';
    const blob = new Blob([proj.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stage 6 Feature: Import JSON backup file
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        if (Array.isArray(parsed) && onImportProjects) {
          onImportProjects(parsed);
        } else {
          alert('Invalid backup file format. Expected an array of projects.');
        }
      } catch {
        alert('Failed to parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="content-container">
      <div className="dashboard-columns" style={{ gridTemplateColumns: '1fr 1.8fr' }}>
        {/* Left: Create New Project & Vault Backup Controls */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Plus size={18} color="#06b6d4" />
              <span>Create New Workspace Project</span>
            </div>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label className="field-label">Project Title</label>
              <input
                type="text"
                className="cyber-input"
                style={{ width: '100%' }}
                placeholder="e.g., Dijkstra Shortest Path"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="field-label">Target Language</label>
              <select
                className="cyber-select"
                style={{ width: '100%' }}
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              >
                <option value="typescript">TypeScript (.ts)</option>
                <option value="javascript">JavaScript (.js)</option>
                <option value="python">Python 3 (.py)</option>
                <option value="cpp">C++ 20 (.cpp)</option>
              </select>
            </div>

            <div>
              <label className="field-label">Architecture / Notes</label>
              <textarea
                className="cyber-input"
                style={{ width: '100%', minHeight: '75px', resize: 'vertical' }}
                placeholder="Brief description of algorithm or prompt goal..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button type="submit" className="cyber-btn">
              <Plus size={15} />
              <span>Initialize & Open in IDE</span>
            </button>
          </form>

          <hr style={{ borderColor: 'var(--border-subtle)', margin: '0.5rem 0' }} />

          <div className="field-label">Stage 6: Vault Portability & Backup</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="cyber-btn secondary" style={{ flex: 1 }} onClick={handleExportVault}>
              <Download size={14} />
              <span>Export Vault (.json)</span>
            </button>
            {onImportProjects && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                />
                <button
                  type="button"
                  className="cyber-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  <span>Import (.json)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Saved Projects List */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <FolderKanban size={18} color="#10b981" />
              <span>Saved Projects Vault ({filteredProjects.length})</span>
            </div>
            <input
              type="text"
              className="cyber-input"
              placeholder="Search by title or language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '220px' }}
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="console-empty">No matching projects found in Vault.</div>
          ) : (
            <div className="preset-list">
              {filteredProjects.map((proj) => {
                const isCurrent = proj.id === activeProjectId;
                const meta = LANGUAGE_META[proj.language];
                return (
                  <div key={proj.id} className={`preset-item ${isCurrent ? 'selected' : ''}`}>
                    <div className="preset-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileCode2 size={16} color="#06b6d4" />
                        <span className="preset-name">{proj.title}</span>
                        <span className="stage-pill live">{meta.label}</span>
                        {isCurrent && <span className="stage-pill">ACTIVE IN IDE</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="cyber-btn"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}
                          onClick={() => onLoadProject(proj)}
                        >
                          <ExternalLink size={12} />
                          <span>Open</span>
                        </button>
                        <button
                          className="cyber-btn secondary"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem' }}
                          title="Download Source File"
                          onClick={() => handleDownloadSourceFile(proj)}
                        >
                          <Download size={12} />
                        </button>
                        <button
                          className="cyber-btn secondary"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem' }}
                          title="Duplicate Project"
                          onClick={() => onDuplicateProject(proj)}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          className="cyber-btn secondary"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem', color: '#f87171' }}
                          title="Delete Project"
                          onClick={() => onDeleteProject(proj.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="preset-desc" style={{ marginBottom: '0.5rem' }}>
                      {proj.description}
                    </div>
                    <pre className="project-code-preview" style={{ maxHeight: '110px' }}>
                      {proj.code.slice(0, 320)}
                      {proj.code.length > 320 ? '\n...' : ''}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
