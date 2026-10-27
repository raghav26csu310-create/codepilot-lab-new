export type SupportedLanguage =
  | 'c'
  | 'cpp'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'csharp'
  | 'swift'
  | 'kotlin'
  | 'php'
  | 'ruby';

export type IdeTheme = 'tokyo-night' | 'obsidian' | 'vercel';

export interface CodeProject {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  notes: string;
  tags: string[];
  updatedAt: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
}

export interface IdeExtensionPlugin {
  id: string;
  name: string;
  publisher: string;
  version: string;
  category: 'Language' | 'Visualizer' | 'Linter' | 'AI';
  description: string;
  enabled: boolean;
  capabilities: string[];
}

export interface SandboxExecutionResult {
  success: boolean;
  logs: string[];
  returnValue?: string;
  error?: string;
  durationMs: number;
  mode: string;
}

export interface TraceFrame {
  step: number;
  line: number;
  variables: Record<string, string | number>;
  explanation: string;
}

export interface VariableHistoryPoint {
  step: number;
  line: number;
  value: string | number;
  changed: boolean;
  normalizedHeight: number;
}

export interface VariableHistorySeries {
  name: string;
  currentValue: string | number;
  previousValue?: string | number;
  changedAtCurrentStep: boolean;
  points: VariableHistoryPoint[];
}

export interface VisualArrayInspection {
  arrayName: string;
  elements: number[];
  highlights: number[];
  pointers: Record<string, number>;
}

export interface BenchmarkRunSample {
  iterations: number;
  totalMs: number;
  opsPerSec: number;
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumberOriginal?: number;
  lineNumberModified?: number;
}

export interface ExerciseTestCase {
  input: string;
  expected: string;
}

export interface ExerciseItem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  description: string;
  functionName: string;
  starterCode: string;
  starterCodeByLang?: Partial<Record<SupportedLanguage, string>>;
  solutionCode: string;
  testCases: ExerciseTestCase[];
}

export interface ComplexityReport {
  timeComplexity: string;
  spaceComplexity: string;
  cyclomaticComplexity: number;
  maintainabilityScore: number;
  maxLoopDepth: number;
  lineCount: number;
  functionCount: number;
  diagnostics: Array<{ line: number; message: string; severity: 'info' | 'warn' | 'error' }>;
}