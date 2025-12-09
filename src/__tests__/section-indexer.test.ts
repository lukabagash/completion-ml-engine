/**
 * Tests for BasicSectionIndexer
 * Phase 4: Indexing & Search validation
 */

import { BasicSectionIndexer } from '../indexing/BasicSectionIndexer';
import { AnchorType } from '../indexing/ISectionIndexer';
import { Section, SectionInventory } from '../types';

describe('BasicSectionIndexer', () => {
  let indexer: BasicSectionIndexer;
  let sections: Section[];
  let inventory: Map<string, SectionInventory>;

  beforeEach(() => {
    indexer = new BasicSectionIndexer();

    // Create test sections
    sections = [
      {
        id: 'sec-1',
        title: 'Officers and Responsibilities',
        content: 'The designated officers are CTO John Doe and CFO Mark Miller. They are responsible for technical and financial decisions.',
        startOffset: 0,
        endOffset: 140,
        kind: 'Officers',
      },
      {
        id: 'sec-2',
        title: 'Term and Renewal',
        content: 'The initial term is twenty four (24) months beginning on January 1, 2025. The agreement may be renewed for additional twelve (12) month periods.',
        startOffset: 140,
        endOffset: 280,
        kind: 'Terms and Termination',
      },
      {
        id: 'sec-3',
        title: 'Payment Terms',
        content: 'The subscription fee is $25,000 per year. Payment is due within 30 days of invoice date.',
        startOffset: 280,
        endOffset: 370,
        kind: 'Fees and Payment',
      },
      {
        id: 'sec-4',
        title: 'Signatures',
        content: 'By: John Doe\nTitle: CTO\nDate: 01/01/2025\n\nBy: Mark Miller\nTitle: CFO\nDate: 01/01/2025',
        startOffset: 370,
        endOffset: 460,
        kind: 'Signatures',
      },
    ];

    // Create test inventory
    inventory = new Map();
    
    inventory.set('sec-1', {
      'Name&Role': [
        {
          role: 'Chief Technology Officer',
          person: 'John Doe',
          span: { start: 28, end: 40 },
          conf: 0.92,
        },
        {
          role: 'Chief Financial Officer',
          person: 'Mark Miller',
          span: { start: 45, end: 60 },
          conf: 0.92,
        },
      ],
      Date: [],
      Terms: [],
    });

    inventory.set('sec-2', {
      'Name&Role': [],
      Date: [
        {
          iso: '2025-01-01',
          surface: 'January 1, 2025',
          span: { start: 58, end: 73 },
          conf: 0.96,
        },
      ],
      Terms: [
        {
          name: 'duration',
          value: 24,
          unit: 'month',
          qualifiers: 'word_form: twenty four',
          span: { start: 19, end: 48 },
          conf: 0.96,
        },
        {
          name: 'duration',
          value: 12,
          unit: 'month',
          qualifiers: 'word_form: twelve',
          span: { start: 117, end: 141 },
          conf: 0.96,
        },
      ],
    });

    inventory.set('sec-3', {
      'Name&Role': [],
      Date: [],
      Terms: [
        {
          name: 'fee',
          value: 25000,
          unit: 'USD',
          span: { start: 24, end: 31 },
          conf: 0.94,
        },
        {
          name: 'duration',
          value: 30,
          unit: 'day',
          span: { start: 66, end: 73 },
          conf: 0.90,
        },
      ],
    });

    inventory.set('sec-4', {
      'Name&Role': [
        {
          role: 'Chief Technology Officer',
          person: 'John Doe',
          span: { start: 4, end: 12 },
          conf: 0.85,
        },
        {
          role: 'Chief Financial Officer',
          person: 'Mark Miller',
          span: { start: 40, end: 51 },
          conf: 0.85,
        },
      ],
      Date: [
        {
          iso: '2025-01-01',
          surface: '01/01/2025',
          span: { start: 24, end: 34 },
          conf: 0.95,
        },
        {
          iso: '2025-01-01',
          surface: '01/01/2025',
          span: { start: 66, end: 76 },
          conf: 0.95,
        },
      ],
      Terms: [],
    });
  });

  describe('Index Management', () => {
    test('should index sections successfully', async () => {
      await indexer.indexSections(sections);
      
      const stats = indexer.getStats();
      expect(stats.sectionCount).toBe(4);
      expect(stats.documentCount).toBe(4);
    });

    test('should store and retrieve sections by ID', async () => {
      await indexer.indexSections(sections);
      
      const section = indexer.getSection('sec-1');
      expect(section).toBeDefined();
      expect(section?.title).toBe('Officers and Responsibilities');
    });

    test('should return undefined for non-existent section', async () => {
      await indexer.indexSections(sections);
      
      const section = indexer.getSection('non-existent');
      expect(section).toBeUndefined();
    });

    test('should get all section IDs', async () => {
      await indexer.indexSections(sections);
      
      const ids = indexer.getSectionIds();
      expect(ids).toHaveLength(4);
      expect(ids).toContain('sec-1');
      expect(ids).toContain('sec-2');
    });

    test('should store property inventory', async () => {
      await indexer.indexSections(sections);
      indexer.setInventory(inventory);
      
      const stats = indexer.getStats();
      expect(stats.hasInventory).toBe(true);
    });
  });

  describe('BM25 Search', () => {
    beforeEach(async () => {
      await indexer.indexSections(sections);
      indexer.setInventory(inventory);
    });

    test('should search by content and return ranked results', async () => {
      const results = await indexer.search('officers technical financial');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sectionId).toBe('sec-1');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].section.title).toBe('Officers and Responsibilities');
    });

    test('should boost title matches', async () => {
      const results = await indexer.search('Payment');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sectionId).toBe('sec-3');
      expect(results[0].section.title).toContain('Payment');
    });

    test('should support fuzzy matching', async () => {
      const results = await indexer.search('oficers'); // Misspelled
      
      // Should still find "Officers" due to fuzzy matching
      expect(results.length).toBeGreaterThan(0);
    });

    test('should limit results', async () => {
      const results = await indexer.search('term', { limit: 2 });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should filter by minimum score', async () => {
      const results = await indexer.search('agreement', { minScore: 5.0 });
      
      // High min score should filter out low-relevance results
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(5.0);
      });
    });

    test('should filter by section type', async () => {
      const results = await indexer.search('term', {
        sectionTypes: ['Terms and Termination'],
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.section.kind).toBe('Terms and Termination');
      });
    });

    test('should return empty array for no matches', async () => {
      const results = await indexer.search('xyznonexistent');
      
      expect(results).toHaveLength(0);
    });

    test('should search in title field', async () => {
      const results = await indexer.search('Signatures');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sectionId).toBe('sec-4');
    });
  });

  describe('Anchor Detection', () => {
    beforeEach(async () => {
      await indexer.indexSections(sections);
      indexer.setInventory(inventory);
    });

    test('should detect heading anchor', async () => {
      const anchors = await indexer.detectAnchors('sec-1', {
        anchorTypes: [AnchorType.HEADING],
      });
      
      expect(anchors.length).toBeGreaterThan(0);
      const headingAnchor = anchors.find(a => a.type === AnchorType.HEADING);
      expect(headingAnchor).toBeDefined();
      expect(headingAnchor?.text).toBe('Officers and Responsibilities');
      expect(headingAnchor?.offset).toBe(0);
      expect(headingAnchor?.confidence).toBeGreaterThan(0.9);
    });

    test('should detect property-based anchors for Name&Role', async () => {
      const anchors = await indexer.detectAnchors('sec-1', {
        anchorTypes: [AnchorType.PROPERTY_SPAN],
      });
      
      const nameRoleAnchors = anchors.filter(
        a => a.metadata?.propertyType === 'Name&Role'
      );
      expect(nameRoleAnchors.length).toBe(2);
      
      const ctoAnchor = nameRoleAnchors.find(a => a.text.includes('John Doe'));
      expect(ctoAnchor).toBeDefined();
      expect(ctoAnchor?.metadata?.role).toBe('Chief Technology Officer');
    });

    test('should detect property-based anchors for Date', async () => {
      const anchors = await indexer.detectAnchors('sec-2', {
        anchorTypes: [AnchorType.PROPERTY_SPAN],
      });
      
      const dateAnchors = anchors.filter(
        a => a.metadata?.propertyType === 'Date'
      );
      expect(dateAnchors.length).toBe(1);
      expect(dateAnchors[0].metadata?.iso).toBe('2025-01-01');
    });

    test('should detect property-based anchors for Terms', async () => {
      const anchors = await indexer.detectAnchors('sec-3', {
        anchorTypes: [AnchorType.PROPERTY_SPAN],
      });
      
      const termAnchors = anchors.filter(
        a => a.metadata?.propertyType === 'Terms'
      );
      expect(termAnchors.length).toBe(2);
      
      const feeAnchor = termAnchors.find(a => a.metadata?.termName === 'fee');
      expect(feeAnchor).toBeDefined();
    });

    test('should detect paragraph anchors', async () => {
      const anchors = await indexer.detectAnchors('sec-1', {
        anchorTypes: [AnchorType.PARAGRAPH],
      });
      
      const paraAnchors = anchors.filter(a => a.type === AnchorType.PARAGRAPH);
      expect(paraAnchors.length).toBeGreaterThan(0);
    });

    test('should limit anchor results', async () => {
      const anchors = await indexer.detectAnchors('sec-1', {
        limit: 3,
      });
      
      expect(anchors.length).toBeLessThanOrEqual(3);
    });

    test('should sort anchors by confidence', async () => {
      const anchors = await indexer.detectAnchors('sec-1');
      
      // Check that anchors are sorted by confidence descending
      for (let i = 1; i < anchors.length; i++) {
        expect(anchors[i].confidence).toBeLessThanOrEqual(anchors[i - 1].confidence);
      }
    });

    test('should filter anchors by afterText', async () => {
      const anchors = await indexer.detectAnchors('sec-1', {
        afterText: 'CFO Mark Miller',
      });
      
      // All anchors should be after "CFO Mark Miller" in the content
      const section = indexer.getSection('sec-1')!;
      const afterIndex = section.content.indexOf('CFO Mark Miller');
      
      anchors.forEach(anchor => {
        expect(anchor.offset).toBeGreaterThanOrEqual(afterIndex);
      });
    });

    test('should return empty array for non-existent section', async () => {
      const anchors = await indexer.detectAnchors('non-existent');
      
      expect(anchors).toHaveLength(0);
    });

    test('should detect list item anchors', async () => {
      const listSection: Section = {
        id: 'sec-list',
        title: 'Responsibilities',
        content: '- Monitor system performance\n- Review security reports\n- Update documentation',
        startOffset: 0,
        endOffset: 80,
      };
      
      await indexer.indexSections([...sections, listSection]);
      
      const anchors = await indexer.detectAnchors('sec-list', {
        anchorTypes: [AnchorType.LIST_ITEM],
      });
      
      expect(anchors.length).toBe(3);
      expect(anchors[0].type).toBe(AnchorType.LIST_ITEM);
    });
  });

  describe('Property Lookup', () => {
    beforeEach(async () => {
      await indexer.indexSections(sections);
      indexer.setInventory(inventory);
    });

    test('should find all Name&Role properties', async () => {
      const locations = await indexer.findProperties('Name&Role');
      
      expect(locations.length).toBe(4); // 2 in sec-1, 2 in sec-4
      locations.forEach(loc => {
        expect(loc.propertyType).toBe('Name&Role');
        expect(loc.value).toHaveProperty('role');
        expect(loc.value).toHaveProperty('person');
      });
    });

    test('should find all Date properties', async () => {
      const locations = await indexer.findProperties('Date');
      
      expect(locations.length).toBe(3); // 1 in sec-2, 2 in sec-4
      locations.forEach(loc => {
        expect(loc.propertyType).toBe('Date');
        expect(loc.value).toHaveProperty('iso');
      });
    });

    test('should find all Terms properties', async () => {
      const locations = await indexer.findProperties('Terms');
      
      expect(locations.length).toBe(4); // 2 in sec-2, 2 in sec-3
      locations.forEach(loc => {
        expect(loc.propertyType).toBe('Terms');
        expect(loc.value).toHaveProperty('name');
        expect(loc.value).toHaveProperty('value');
      });
    });

    test('should filter Name&Role by role', async () => {
      const locations = await indexer.findProperties(
        'Name&Role',
        (prop: any) => prop.role.includes('Technology')
      );
      
      expect(locations.length).toBe(2); // CTO in sec-1 and sec-4
      locations.forEach(loc => {
        expect(loc.value.role).toContain('Technology');
      });
    });

    test('should filter Date by ISO value', async () => {
      const locations = await indexer.findProperties(
        'Date',
        (prop: any) => prop.iso === '2025-01-01'
      );
      
      expect(locations.length).toBe(3);
      locations.forEach(loc => {
        expect(loc.value.iso).toBe('2025-01-01');
      });
    });

    test('should filter Terms by value', async () => {
      const locations = await indexer.findProperties(
        'Terms',
        (prop: any) => typeof prop.value === 'number' && prop.value >= 24
      );
      
      expect(locations.length).toBeGreaterThan(0);
      locations.forEach(loc => {
        expect(typeof loc.value.value).toBe('number');
        expect(loc.value.value).toBeGreaterThanOrEqual(24);
      });
    });

    test('should return empty array when no properties match filter', async () => {
      const locations = await indexer.findProperties(
        'Name&Role',
        (prop: any) => prop.person === 'NonExistent Person'
      );
      
      expect(locations).toHaveLength(0);
    });

    test('should include span information', async () => {
      const locations = await indexer.findProperties('Name&Role');
      
      locations.forEach(loc => {
        expect(loc.span).toHaveProperty('start');
        expect(loc.span).toHaveProperty('end');
        expect(loc.span.start).toBeGreaterThanOrEqual(0);
        expect(loc.span.end).toBeGreaterThan(loc.span.start);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should support full workflow: index, search, find properties, detect anchors', async () => {
      // 1. Index sections
      await indexer.indexSections(sections);
      indexer.setInventory(inventory);
      
      // 2. Search for relevant section
      const searchResults = await indexer.search('officers');
      expect(searchResults.length).toBeGreaterThan(0);
      const targetSectionId = searchResults[0].sectionId;
      
      // 3. Find properties in that section
      const nameRoles = await indexer.findProperties(
        'Name&Role',
        (prop: any) => {
          const locations = searchResults.map(r => r.sectionId);
          return true; // Will be filtered by section in real usage
        }
      );
      expect(nameRoles.length).toBeGreaterThan(0);
      
      // 4. Detect anchors for insertion
      const anchors = await indexer.detectAnchors(targetSectionId);
      expect(anchors.length).toBeGreaterThan(0);
      expect(anchors[0].confidence).toBeGreaterThan(0);
    });

    test('should handle sections with no properties', async () => {
      const emptySection: Section = {
        id: 'sec-empty',
        title: 'Empty Section',
        content: 'This section has no special properties.',
        startOffset: 500,
        endOffset: 540,
      };
      
      await indexer.indexSections([...sections, emptySection]);
      inventory.set('sec-empty', {
        'Name&Role': [],
        Date: [],
        Terms: [],
      });
      indexer.setInventory(inventory);
      
      const anchors = await indexer.detectAnchors('sec-empty');
      expect(anchors.length).toBeGreaterThan(0); // Should still have heading/paragraph anchors
      
      const properties = await indexer.findProperties('Name&Role');
      const emptyProps = properties.filter(p => p.sectionId === 'sec-empty');
      expect(emptyProps).toHaveLength(0);
    });
  });
});
