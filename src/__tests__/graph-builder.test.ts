/**
 * Graph Builder Tests
 * Tests similarity metrics, policy bonuses, evidence tracking, and graph construction
 * Phase 5: Graph Construction
 */

import { BasicGraphBuilder } from '../graph/BasicGraphBuilder';
import {
  Section,
  SectionInventory,
  NameAndRole,
  DateProperty,
  TermProperty,
} from '../types';

describe('BasicGraphBuilder', () => {
  let builder: BasicGraphBuilder;

  beforeEach(() => {
    builder = new BasicGraphBuilder();
  });

  describe('Name&Role Similarity', () => {
    it('should detect exact matches between sections', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 31,
          content: 'CTO: John Doe, CFO: Mark Miller',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Responsible Officers',
          startOffset: 100,
          endOffset: 131,
          content: 'CTO: John Doe, CFO: Mark Miller',
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
              { role: 'CFO', person: 'Mark Miller', span: { start: 111, end: 125 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.prop).toBe('Name&Role');
      expect(edge.evidence.matched).toHaveLength(2);
      expect(edge.evidence.missing).toHaveLength(0);
      expect(edge.weight).toBeGreaterThan(0.9); // High similarity + policy bonus
    });

    it('should detect missing officers (answer key scenario)', async () => {
      // Section 1.1: CTO John Doe, CFO Mark Miller, Associate Brian Brown
      // Section 3.2: CTO John Doe, CFO Mark Miller (missing Associate Brian Brown)
      const sections: Section[] = [
        {
          id: 'sec1.1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 56,
          content: 'CTO: John Doe, CFO: Mark Miller, Associate: Brian Brown',
          kind: 'Officers',
        },
        {
          id: 'sec3.2',
          title: 'Responsible Officers for Implementation',
          startOffset: 200,
          endOffset: 231,
          content: 'CTO: John Doe, CFO: Mark Miller',
          kind: 'Officers',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1.1',
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
          'sec3.2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 200, end: 210 }, conf: 0.95 },
              { role: 'CFO', person: 'Mark Miller', span: { start: 211, end: 225 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      
      // Should have 2 matches (CTO John Doe, CFO Mark Miller)
      expect(edge.evidence.matched).toHaveLength(2);
      expect(edge.evidence.matched[0].value).toContain('John Doe');
      expect(edge.evidence.matched[1].value).toContain('Mark Miller');
      
      // Should have 1 missing (Associate Brian Brown in section 3.2)
      expect(edge.evidence.missing).toHaveLength(1);
      expect(edge.evidence.missing[0].value).toContain('Brian Brown');
      expect(edge.evidence.missing[0].inSection).toBe('sec3.2');
      
      // Weight should reflect partial match (2/3 = 0.67 base + policy bonus)
      expect(edge.weight).toBeGreaterThan(0.5);
      expect(edge.weight).toBeLessThan(1.0);
    });

    it('should normalize role abbreviations', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Officers',
          startOffset: 0,
          endOffset: 34,
          content: 'Chief Technology Officer: John Doe',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Officers',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: John Doe',
          kind: 'Officers',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'Chief Technology Officer', person: 'John Doe', span: { start: 0, end: 30 }, conf: 0.95 },
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

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.evidence.matched).toHaveLength(1);
      expect(edge.evidence.missing).toHaveLength(0);
    });

    it('should be case-insensitive for names', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Officers',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: JOHN DOE',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Officers',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: john doe',
          kind: 'Officers',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'JOHN DOE', span: { start: 0, end: 10 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'john doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.evidence.matched).toHaveLength(1);
    });
  });

  describe('Date Similarity', () => {
    it('should match identical dates', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Effective Date',
          startOffset: 0,
          endOffset: 15,
          content: 'January 1, 2024',
        },
        {
          id: 'sec2',
          title: 'Start Date',
          startOffset: 100,
          endOffset: 115,
          content: 'January 1, 2024',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [],
            Date: [
              { iso: '2024-01-01', span: { start: 0, end: 15 }, surface: 'January 1, 2024', conf: 0.98 },
            ],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [
              { iso: '2024-01-01', span: { start: 100, end: 115 }, surface: 'January 1, 2024', conf: 0.98 },
            ],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.prop).toBe('Date');
      expect(edge.evidence.matched).toHaveLength(1);
      expect(edge.evidence.matched[0].value).toBe('2024-01-01');
      expect(edge.evidence.missing).toHaveLength(0);
    });

    it('should detect date mismatches', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Effective Date',
          startOffset: 0,
          endOffset: 15,
          content: 'January 1, 2024',
        },
        {
          id: 'sec2',
          title: 'Start Date',
          startOffset: 100,
          endOffset: 116,
          content: 'February 1, 2024',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [],
            Date: [
              { iso: '2024-01-01', span: { start: 0, end: 15 }, surface: 'January 1, 2024', conf: 0.98 },
            ],
            Terms: [],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [
              { iso: '2024-02-01', span: { start: 100, end: 116 }, surface: 'February 1, 2024', conf: 0.98 },
            ],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.evidence.matched).toHaveLength(0);
      expect(edge.evidence.missing).toHaveLength(2); // Both dates are missing in the other section
    });
  });

  describe('Terms Similarity', () => {
    it('should match identical terms', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Term',
          startOffset: 0,
          endOffset: 19,
          content: 'Duration: 24 months',
        },
        {
          id: 'sec2',
          title: 'Term Length',
          startOffset: 100,
          endOffset: 119,
          content: 'Duration: 24 months',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [],
            Date: [],
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 0, end: 19 }, conf: 0.92 },
            ],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [],
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 100, end: 119 }, conf: 0.92 },
            ],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.prop).toBe('Terms');
      expect(edge.evidence.matched).toHaveLength(1);
      expect(edge.evidence.matched[0].value).toContain('24 months');
      expect(edge.evidence.missing).toHaveLength(0);
    });

    it('should detect term mismatches', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Term',
          startOffset: 0,
          endOffset: 19,
          content: 'Duration: 24 months',
        },
        {
          id: 'sec2',
          title: 'Term Length',
          startOffset: 100,
          endOffset: 119,
          content: 'Duration: 12 months',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [],
            Date: [],
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 0, end: 19 }, conf: 0.92 },
            ],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [],
            Date: [],
            Terms: [
              { name: 'Duration', value: 12, unit: 'months', span: { start: 100, end: 119 }, conf: 0.92 },
            ],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      expect(edge.evidence.matched).toHaveLength(0);
      expect(edge.evidence.missing).toHaveLength(2);
    });
  });

  describe('Policy Bonuses', () => {
    it('should apply high bonus for officer sections', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: John Doe',
          kind: 'Officers',
        },
        {
          id: 'sec2',
          title: 'Responsible Officers',
          startOffset: 100,
          endOffset: 113,
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

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      
      // Weight should be very high due to exact match + officer section bonus
      expect(edge.weight).toBeGreaterThan(0.9);
    });

    it('should apply lower bonus for non-officer sections', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Introduction',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec2',
          title: 'Background',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: John Doe',
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
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.edges).toHaveLength(1);
      const edge = graph.edges[0];
      
      // Weight should be lower than officer sections (still high due to exact match)
      expect(edge.weight).toBeGreaterThan(0.7);
      expect(edge.weight).toBeLessThan(0.95);
    });
  });

  describe('Edge Construction', () => {
    it('should create edges for all property types', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Agreement Details',
          startOffset: 0,
          endOffset: 58,
          content: 'CTO: John Doe, Date: January 1, 2024, Duration: 24 months',
        },
        {
          id: 'sec2',
          title: 'Terms',
          startOffset: 100,
          endOffset: 158,
          content: 'CTO: John Doe, Date: January 1, 2024, Duration: 24 months',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 0, end: 10 }, conf: 0.95 },
            ],
            Date: [
              { iso: '2024-01-01', span: { start: 11, end: 26 }, surface: 'January 1, 2024', conf: 0.98 },
            ],
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 27, end: 42 }, conf: 0.92 },
            ],
          },
        ],
        [
          'sec2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [
              { iso: '2024-01-01', span: { start: 111, end: 126 }, surface: 'January 1, 2024', conf: 0.98 },
            ],
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 127, end: 142 }, conf: 0.92 },
            ],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      // Should have 3 edges: Name&Role, Date, Terms
      expect(graph.edges).toHaveLength(3);
      
      const propTypes = graph.edges.map(e => e.prop).sort();
      expect(propTypes).toEqual(['Date', 'Name&Role', 'Terms']);
    });

    it('should only create edges when properties exist', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Officers',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec2',
          title: 'Terms',
          startOffset: 100,
          endOffset: 119,
          content: 'Duration: 24 months',
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
            Terms: [
              { name: 'Duration', value: 24, unit: 'months', span: { start: 100, end: 119 }, conf: 0.92 },
            ],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      // Should have 1 edge for Name&Role (even though sec2 has no Name&Role, we still create edge to track missing)
      // and 1 edge for Terms
      expect(graph.edges).toHaveLength(2);
    });
  });

  describe('Graph Structure', () => {
    it('should include all sections as nodes', async () => {
      const sections: Section[] = [
        { id: 'sec1', title: 'Section 1', startOffset: 0, endOffset: 0, content: '' },
        { id: 'sec2', title: 'Section 2', startOffset: 100, endOffset: 100, content: '' },
        { id: 'sec3', title: 'Section 3', startOffset: 200, endOffset: 200, content: '' },
      ];

      const inventory = new Map<string, SectionInventory>([
        ['sec1', { 'Name&Role': [], Date: [], Terms: [] }],
        ['sec2', { 'Name&Role': [], Date: [], Terms: [] }],
        ['sec3', { 'Name&Role': [], Date: [], Terms: [] }],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.nodes.map(n => n.id)).toEqual(['sec1', 'sec2', 'sec3']);
    });

    it('should create bidirectional comparisons', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Section 1',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec2',
          title: 'Section 2',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec3',
          title: 'Section 3',
          startOffset: 200,
          endOffset: 213,
          content: 'CTO: John Doe',
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
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
        [
          'sec3',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 200, end: 210 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);

      // Should have 3 edges: sec1-sec2, sec1-sec3, sec2-sec3
      expect(graph.edges).toHaveLength(3);
    });
  });

  describe('Helper Methods', () => {
    it('should find edges for a specific section', async () => {
      const sections: Section[] = [
        {
          id: 'sec1',
          title: 'Section 1',
          startOffset: 0,
          endOffset: 13,
          content: 'CTO: John Doe',
        },
        {
          id: 'sec2',
          title: 'Section 2',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: John Doe',
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
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);
      const edges = builder.getEdgesForSection(graph, 'sec1');

      expect(edges).toHaveLength(1);
      expect(edges[0].from).toBe('sec1');
    });

    it('should find authoritative section for Name&Role', async () => {
      const sections: Section[] = [
        {
          id: 'sec1.1',
          title: 'Designated Officers',
          startOffset: 0,
          endOffset: 56,
          content: 'CTO: John Doe, CFO: Mark Miller, Associate: Brian Brown',
          kind: 'Officers',
        },
        {
          id: 'sec3.2',
          title: 'Responsible Officers',
          startOffset: 100,
          endOffset: 113,
          content: 'CTO: John Doe',
        },
      ];

      const inventory = new Map<string, SectionInventory>([
        [
          'sec1.1',
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
          'sec3.2',
          {
            'Name&Role': [
              { role: 'CTO', person: 'John Doe', span: { start: 100, end: 110 }, conf: 0.95 },
            ],
            Date: [],
            Terms: [],
          },
        ],
      ]);

      const graph = await builder.buildGraph(sections, inventory);
      const authoritative = builder.findAuthoritativeSection(graph, inventory, 'Name&Role');

      // Section 1.1 should be authoritative (more properties + higher policy score)
      expect(authoritative).toBe('sec1.1');
    });
  });
});
