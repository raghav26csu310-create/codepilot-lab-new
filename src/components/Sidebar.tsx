import React from 'react';
import {
  LayoutDashboard,
  Code2,
  Sparkles,
  Bug,
  Activity,
  GraduationCap,
  FolderKanban,
  Terminal,
} from 'lucide-react';
import type { NavSection } from '../types';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  projectCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  projectCount,
}) => {
  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Command Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'editor', label: 'Multi-Lang Editor', icon: <Code2 size={18} /> },
    { id: 'projects', label: `Saved Projects (${projectCount})`, icon: <FolderKanban size={18} /> },
    { id: 'ai-assistant', label: 'AI Code & Explain', icon: <Sparkles size={18} /> },
    { id: 'debugger', label: 'AI Debug Assistant', icon: <Bug size={18} /> },
    { id: 'tracer', label: 'Loop & Var Tracer', icon: <Activity size={18} /> },
    { id: 'exercises', label: 'Coding Exercises', icon: <GraduationCap size={18} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-box">
        <div className="brand-logo">
          <Terminal size={20} />
        </div>
        <div>
          <div className="brand-title">CodePilot Lab</div>
          <div className="brand-subtitle">Prompt & Code OS</div>
        </div>
      </div>

      <div className="nav-group-label">Platform Modules</div>
      <nav className="nav-list">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-btn ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSelectSection(item.id)}
          >
            <span className="nav-btn-left">
              {item.icon}
              <span>{item.label}</span>
            </span>
            <span className="stage-pill live">LIVE</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Architecture: All 7 Modules Live</div>
        <div>AI Engine: Gemini 2.5 Flash</div>
        <div>Env: Windows 11 • Vite + TS</div>
      </div>
    </aside>
  );
};
