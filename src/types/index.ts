/**
 * Type definitions for the Legal Document ML Engine
 */

/**
 * Represents a span (character offset range) in a document
 */
export interface Span {
  start: number;
  end: number;
}

/**
 * Represents a Name & Role property extracted from a section
 */
export interface NameAndRole {
  role: string;
  person: string;
  span: Span;
  conf: number;
}

/**
 * Represents a Date property extracted from a section
 */
export interface DateProperty {
  iso: string;
  surface: string;
  span: Span;
  conf: number;
}

/**
 * Represents a Term property extracted from a section
 */
export interface TermProperty {
  name: string;
  value: number | string;
  unit?: string;
  qualifiers?: string;
  span: Span;
  conf: number;
}

/**
 * Inventory of properties extracted from a single section
 */
export interface SectionInventory {
  'Name&Role': NameAndRole[];
  Date: DateProperty[];
  Terms: TermProperty[];
}

/**
 * Represents a document section
 */
export interface Section {
  id: string;
  title: string;
  startOffset: number;
  endOffset: number;
  content: string;
  kind?: string;
}

/**
 * Complete inventory of all sections and their properties
 */
export interface DocumentInventory {
  [sectionId: string]: SectionInventory;
}

/**
 * Represents evidence for a graph edge
 */
export interface EdgeEvidence {
  matched: Array<{
    property: string;
    value: string;
    spans: Span[];
  }>;
  missing: Array<{
    property: string;
    value: string;
    inSection: string;
  }>;
}

/**
 * Represents an edge in the section-property graph
 */
export interface GraphEdge {
  from: string;
  to: string;
  prop: 'Name&Role' | 'Date' | 'Terms';
  weight: number;
  evidence: EdgeEvidence;
}

/**
 * Section-property graph
 */
export interface SectionGraph {
  nodes: Section[];
  edges: GraphEdge[];
}

/**
 * Represents a suggested update to a section
 */
export interface SuggestedUpdate {
  section: string;
  type: 'insert' | 'replace';
  prop: 'Name&Role' | 'Date' | 'Terms';
  anchor?: string;
  anchorStrategy?: string;
  values: Array<NameAndRole | DateProperty | TermProperty | string>;
  confidence: number;
  evidenceFrom: {
    section: string;
    spans: Span[];
  };
  rationale?: string;
}

/**
 * Complete suggestions report
 */
export interface SuggestionsReport {
  authoritative: {
    section: string;
    evidenceSpan: Span;
    rationale: string;
  };
  suggestedUpdates: SuggestedUpdate[];
  unchanged: Array<{
    prop: string;
    sections: string[];
    value?: string;
  }>;
}

/**
 * Final engine output combining all analysis results
 */
export interface EngineOutput {
  sections: Section[];
  inventory: DocumentInventory;
  graph: SectionGraph;
  suggestions: SuggestionsReport;
}

/**
 * Configuration options for the engine
 */
export interface EngineConfig {
  confidenceThreshold?: number;
  enableNER?: boolean;
  enableLLMAssist?: boolean;
  policyRules?: {
    authoritativeSections?: string[];
    requiredProperties?: {
      [sectionKind: string]: Array<'Name&Role' | 'Date' | 'Terms'>;
    };
  };
}
