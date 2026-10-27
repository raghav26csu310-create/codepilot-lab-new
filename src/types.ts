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

export type IdeTheme = 'obsidian' | 'vercel' | 'tokyo-night';

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
}

export interface CodeProject {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  notes: string;
  tags?: string[];
  updatedAt: string;
}

export interface ExerciseTestCase {
  input: string;
  expected: string;
  explanation?: string;
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
  elements: (string | number)[];
  pointers: Record<number, string[]>;
  rangeStart?: number;
  rangeEnd?: number;
  targetValue?: string | number;
}

export interface AiComposerStep {
  id: string;
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'done';
}

export interface FileCheckpoint {
  id: string;
  fileId: string;
  label: string;
  timestamp: string;
  content: string;
}

export interface BenchmarkRunSample {
  iterations: number;
  totalMs: number;
  opsPerSec: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  logs: string[];
  returnValue?: string;
  error?: string;
  errorLine?: number;
  durationMs: number;
  mode: 'native-js' | 'polyglot-emulated';
}

export interface DiffLine {
  type: 'same' | 'add' | 'remove';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface CodeDiagnostic {
  id: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  quickFixLabel?: string;
  replacementLine?: string;
}

export interface ComplexityReport {
  timeComplexity: string;
  spaceComplexity: string;
  cyclomaticComplexity: number;
  maintainabilityScore: number;
  maxLoopDepth: number;
  lineCount: number;
  functionCount: number;
  diagnostics: CodeDiagnostic[];
}

export interface WorkspaceAssertionResult {
  label: string;
  passed: boolean;
  detail: string;
}

export interface WorkspaceTestFileResult {
  fileId: string;
  filePath: string;
  passed: boolean;
  durationMs: number;
  assertions: WorkspaceAssertionResult[];
  error?: string;
}

export interface IdeExtensionPlugin {
  id: string;
  name: string;
  publisher: string;
  version: string;
  category: 'Language' | 'Linter' | 'AI' | 'Visualizer';
  description: string;
  enabled: boolean;
  capabilities: string[];
}

export interface ToastNotification {
  id: string;
  title: string;
  detail?: string;
  tone: 'success' | 'info' | 'warning';
}