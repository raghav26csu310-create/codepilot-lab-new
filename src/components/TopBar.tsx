import React from 'react';
import { Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { NavSection, PromptPreset } from '../types';

interface TopBarProps {
  activeSection: NavSection;
  activePreset: PromptPreset;
  apiKeyConfigured: boolean;
}

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Mission Control & Prompt Telemetry',
  editor: 'Multi-Language Code Editor',
  'ai-assistant': 'AI Code Generation & Explanation Studio',
  debugger: 'Automated Root-Cause Debugging Lab',
  tracer: 'Interactive Loop & Variable Execution Tracer',
  exercises: 'Coding Exercises & Mastery Progression',
  projects: 'Local Saved Projects Repository',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  activePreset,
  apiKeyConfigured,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-title-group">
        <span className="topbar-title">{SECTION_TITLES[activeSection]}</span>
      </div>

      <div className="topbar-status-group">
        <div className="status-badge" title="Active System Prompt Persona">
          <Cpu size={14} color="#06b6d4" />
          <span>Persona: {activePreset.name}</span>
        </div>

        <div className="status-badge">
          <span className={`status-dot ${apiKeyConfigured ? 'online' : 'warn'}`} />
          {apiKeyConfigured ? (
            <>
              <ShieldCheck size={14} color="#10b981" />
              <span>Gemini Key Stored Locally</span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} color="#f59e0b" />
              <span>Gemini Key Not Set</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
