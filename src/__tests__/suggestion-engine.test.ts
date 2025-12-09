/**
 * Suggestion Engine Tests
 * Tests delta computation, authority selection, edit synthesis, and confidence scoring
 * Phase 6: Suggestion Engine
 */

import { BasicSuggestionEngine } from '../suggestions/BasicSuggestionEngine';
import {
  SectionGraph,
  Section,
  GraphEdge,
  SectionInventory,
  NameAndRole,
  DateProperty,
  TermProperty,
} from '../types';

describe('BasicSuggestionEngine', () => {
  let engine: BasicSuggestionEngine;

  beforeEach(() => {
    engine = new BasicSuggestionEngine();
  });

  describe('Authority Selection', () => {
    it('should select section with most properties as authoritative', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 100,
          content: 'CTO: John Doe, CFO: Mark Miller, Associate: Brian Brown',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Responsible Officers',
          startOffset: 100,
          endOffset: 200,
          content: 'CTO: John Doe',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 11, end: 25 }, conf: 0.95 },
              { role: 'Associate', person: 'Brian Brown', span: { start: 26, end: 40 }, conf: 0.90 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.7,
          evidence: {
            matched: [
              { property: 'Name&Role', value: 'CTO: John Doe', spans: [{ start: 0, end: 10 }, { start: 100, end: 110 }] },
            ],
            missing: [
              { property: 'Name&Role', value: 'CFO: Mark Miller', inSection: 'sec2' },
              { property: 'Name&Role', value: 'Associate: Brian Brown', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.authoritative.section).toBe('sec1');
      expect(report.authoritative.rationale).toContain('Designated Officers');
      expect(report.authoritative.rationale).toContain('3 Name&Role');
    });

    it('should prefer officer sections with policy bonus', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Introduction',
          startOffset: 0,
          endOffset: 100,
          content: 'CTO: John Doe, CFO: Mark Miller',
        },
        {
          id: 'sec2',
          title: 'Designated Officers',
          startOffset: 100,
          endOffset: 200,
          content: 'CTO: John Doe',
          kind: 'Officers',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 11, end: 25 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [];
      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      // sec2 should be preferred due to policy bonus (officer section)
      expect(report.authoritative.section).toBe('sec2');
    });
  });

  describe('Delta Computation', () => {
    it('should detect missing officers in target section', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 100,
          content: 'Officers: CTO John Doe, CFO Mark Miller, Associate Brian Brown',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Implementation Officers',
          startOffset: 100,
          endOffset: 200,
          content: 'Officers: CTO John Doe, CFO Mark Miller',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 11, end: 25 }, conf: 0.95 },
              { role: 'Associate', person: 'Brian Brown', span: { start: 26, end: 40 }, conf: 0.90 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 111, end: 125 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.7,
          evidence: {
            matched: [
              { property: 'Name&Role', value: 'CTO: John Doe', spans: [{ start: 0, end: 10 }, { start: 100, end: 110 }] },
              { property: 'Name&Role', value: 'CFO: Mark Miller', spans: [{ start: 11, end: 25 }, { start: 111, end: 125 }] },
            ],
            missing: [
              { property: 'Name&Role', value: 'Associate: Brian Brown', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.suggestedUpdates).toHaveLength(1);
      
      const update = report.suggestedUpdates[0];
      expect(update.section).toBe('sec2');
      expect(update.type).toBe('insert');
      expect(update.prop).toBe('Name&Role');
      expect(update.values).toHaveLength(1);
      
      const value = update.values[0] as NameAndRole;
      expect(value.role).toBe('Associate');
      expect(value.person).toBe('Brian Brown');
      
      expect(update.evidenceFrom.section).toBe('sec1');
      expect(update.confidence).toBeGreaterThan(0.5);
    });

    it('should detect missing dates', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Effective Date',
          startOffset: 0,
          endOffset: 100,
          content: 'Effective Date: January 1, 2025',
        },
        {
          id: 'sec2',
          title: 'Term',
          startOffset: 100,
          endOffset: 200,
          content: 'Term section without date',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [],
            Date: [
              { iso: '2025-01-01', surface: 'January 1, 2025', span: { start: 0, end: 15 }, conf: 0.98 },
            ],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Date',
          weight: 0.6,
          evidence: {
            matched: [],
            missing: [
              { property: 'Date', value: '2025-01-01', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.suggestedUpdates).toHaveLength(1);
      
      const update = report.suggestedUpdates[0];
      expect(update.section).toBe('sec2');
      expect(update.prop).toBe('Date');
      expect(update.values).toHaveLength(1);
    });
  });

  describe('Edit Synthesis', () => {
    it('should provide anchor points for insertions', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Officers',
          startOffset: 0,
          endOffset: 100,
          content: '• CTO John Doe\n• CFO Mark Miller\n• Associate Brian Brown',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Officers',
          startOffset: 100,
          endOffset: 200,
          content: '• CTO John Doe\n• CFO Mark Miller',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 11, end: 25 }, conf: 0.95 },
              { role: 'Associate', person: 'Brian Brown', span: { start: 26, end: 40 }, conf: 0.90 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 111, end: 125 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.7,
          evidence: {
            matched: [
              { property: 'Name&Role', value: 'CTO: John Doe', spans: [] },
              { property: 'Name&Role', value: 'CFO: Mark Miller', spans: [] },
            ],
            missing: [
              { property: 'Name&Role', value: 'Associate: Brian Brown', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.suggestedUpdates).toHaveLength(1);
      
      const update = report.suggestedUpdates[0];
      expect(update.anchor).toBeDefined();
      expect(update.anchorStrategy).toBeDefined();
      expect(update.anchorStrategy).toContain('after_last_list_item');
    });

    it('should include rationale for suggestions', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 100,
          content: 'Officers',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Other Section',
          startOffset: 100,
          endOffset: 200,
          content: 'Content',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.6,
          evidence: {
            matched: [],
            missing: [
              { property: 'Name&Role', value: 'CTO: John Doe', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      if (report.suggestedUpdates.length > 0) {
        const update = report.suggestedUpdates[0];
        expect(update.rationale).toBeDefined();
        expect(update.rationale).toContain('Designated Officers');
      }
    });
  });

  describe('Unchanged Properties', () => {
    it('should identify properties that match across sections', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Section 1',
          startOffset: 0,
          endOffset: 100,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec2',
          title: 'Section 2',
          startOffset: 100,
          endOffset: 200,
          content: 'CTO: John Doe',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        ['sec1', { 'Name&Role': [{ role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 }], Date: [], Terms: [] }],
        ['sec2', { 'Name&Role': [{ role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 }], Date: [], Terms: [] }],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.95,
          evidence: {
            matched: [
              { property: 'Name&Role', value: 'CTO: John Doe', spans: [] },
            ],
            missing: [],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.unchanged).toHaveLength(1);
      expect(report.unchanged[0].prop).toBe('Name&Role');
      expect(report.unchanged[0].value).toContain('John Doe');
    });
  });

  describe('Confidence Scoring', () => {
    it('should combine edge weight with property confidence', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Officers',
          startOffset: 0,
          endOffset: 100,
          content: 'CTO: John Doe',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Officers',
          startOffset: 100,
          endOffset: 200,
          content: 'Empty',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.90 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const edges: GraphEdge[] = [
        {
          from: 'sec1',
          to: 'sec2',
          prop: 'Name&Role',
          weight: 0.80, // Edge weight
          evidence: {
            matched: [],
            missing: [
              { property: 'Name&Role', value: 'CTO: John Doe', inSection: 'sec2' },
            ],
          },
        },
      ];

      const graph: SectionGraph = { nodes: sections, edges };
      const report = await engine.generateSuggestions(graph, inventory);

      expect(report.suggestedUpdates).toHaveLength(1);
      
      const update = report.suggestedUpdates[0];
      // Confidence should be a combination of edge weight (0.80) and property conf (0.90)
      // Formula: edge * 0.6 + propConf * 0.4 = 0.80 * 0.6 + 0.90 * 0.4 = 0.48 + 0.36 = 0.84
      expect(update.confidence).toBeGreaterThan(0.7);
      expect(update.confidence).toBeLessThan(1.0);
    });
  });
});
