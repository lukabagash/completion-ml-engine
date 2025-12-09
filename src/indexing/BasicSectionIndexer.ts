/**
 * Basic Section Indexer Implementation
 * Uses MiniSearch for BM25+ scoring and provides anchor detection
 * Phase 4: Indexing & Search
 */

import MiniSearch from 'minisearch';
import {
  ISectionIndexer,
  SearchResult,
  Anchor,
  AnchorType,
  PropertyLocation,
} from './ISectionIndexer';
import { Section, SectionInventory } from '../types';

/**
 * Document structure for MiniSearch indexing
 */
interface IndexDocument {
  id: string;
  title: string;
  content: string;
  sectionKind?: string;
}

export class BasicSectionIndexer implements ISectionIndexer {
  private miniSearch: MiniSearch<IndexDocument>;
  private sections: Map<string, Section>;
  private inventory: Map<string, SectionInventory>;

  constructor() {
    // Initialize MiniSearch with BM25+ scoring
    this.miniSearch = new MiniSearch<IndexDocument>({
      fields: ['title', 'content'],  // Fields to index
      storeFields: ['title', 'sectionKind'], // Fields to store
      searchOptions: {
        boost: { title: 2 },         // Boost title matches
        fuzzy: 0.2,                  // Allow fuzzy matching
        prefix: true,                // Enable prefix search
      },
    });

    this.sections = new Map();
    this.inventory = new Map();
  }

  async indexSections(sections: Section[]): Promise<void> {
    // Store sections for retrieval
    this.sections.clear();
    sections.forEach(section => {
      this.sections.set(section.id, section);
    });

    // Build index documents
    const documents: IndexDocument[] = sections.map(section => ({
      id: section.id,
      title: section.title,
      content: section.content,
      sectionKind: section.kind,
    }));

    // Index with MiniSearch
    this.miniSearch.removeAll();
    this.miniSearch.addAll(documents);
  }

  /**
   * Store property inventory for fast property lookup
   */
  setInventory(inventory: Map<string, SectionInventory>): void {
    this.inventory = inventory;
  }

  async search(
    query: string,
    options?: {
      limit?: number;
      sectionTypes?: string[];
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const minScore = options?.minScore || 0;

    // Perform search
    const rawResults = this.miniSearch.search(query, {
      boost: { title: 2 },
      fuzzy: 0.2,
      prefix: true,
    });

    // Filter and transform results
    const results: SearchResult[] = rawResults
      .filter(result => result.score >= minScore)
      .filter(result => {
        if (!options?.sectionTypes || options.sectionTypes.length === 0) {
          return true;
        }
        const section = this.sections.get(result.id);
        return section && options.sectionTypes.includes(section.kind || '');
      })
      .slice(0, limit)
      .map(result => {
        const section = this.sections.get(result.id)!;
        return {
          sectionId: result.id,
          score: result.score,
          matches: result.terms || [],
          section,
        };
      });

    return results;
  }

  async detectAnchors(
    sectionId: string,
    options?: {
      anchorTypes?: AnchorType[];
      afterText?: string;
      limit?: number;
    }
  ): Promise<Anchor[]> {
    const section = this.sections.get(sectionId);
    if (!section) {
      return [];
    }

    const limit = options?.limit || 10;
    const anchorTypes = options?.anchorTypes || Object.values(AnchorType);
    const anchors: Anchor[] = [];

    // 1. Heading anchor (start of section)
    if (anchorTypes.includes(AnchorType.HEADING)) {
      anchors.push({
        type: AnchorType.HEADING,
        sectionId,
        offset: 0,
        text: section.title,
        confidence: 0.95,
        metadata: { position: 'start' },
      });
    }

    // 2. Property-based anchors
    if (anchorTypes.includes(AnchorType.PROPERTY_SPAN)) {
      const props = this.inventory.get(sectionId);
      if (props) {
        // Name&Role anchors
        props['Name&Role'].forEach((nr, index) => {
          anchors.push({
            type: AnchorType.PROPERTY_SPAN,
            sectionId,
            offset: nr.span.end,
            text: `${nr.role}: ${nr.person}`,
            confidence: 0.90,
            metadata: {
              propertyType: 'Name&Role',
              propertyIndex: index,
              role: nr.role,
              person: nr.person,
            },
          });
        });

        // Date anchors
        props.Date.forEach((date, index) => {
          anchors.push({
            type: AnchorType.PROPERTY_SPAN,
            sectionId,
            offset: date.span.end,
            text: date.surface,
            confidence: 0.88,
            metadata: {
              propertyType: 'Date',
              propertyIndex: index,
              iso: date.iso,
            },
          });
        });

        // Term anchors
        props.Terms.forEach((term, index) => {
          const valueStr = typeof term.value === 'number' 
            ? `${term.value}${term.unit ? ' ' + term.unit : ''}`
            : String(term.value);
          
          anchors.push({
            type: AnchorType.PROPERTY_SPAN,
            sectionId,
            offset: term.span.end,
            text: `${term.name}: ${valueStr}`,
            confidence: 0.85,
            metadata: {
              propertyType: 'Terms',
              propertyIndex: index,
              termName: term.name,
            },
          });
        });
      }
    }

    // 3. List item anchors (bullet points)
    if (anchorTypes.includes(AnchorType.LIST_ITEM)) {
      const listItemPattern = /^[\s]*[-•\*]\s+(.+)$/gm;
      let match;
      while ((match = listItemPattern.exec(section.content)) !== null) {
        anchors.push({
          type: AnchorType.LIST_ITEM,
          sectionId,
          offset: match.index + match[0].length,
          text: match[1].substring(0, 50), // First 50 chars
          confidence: 0.80,
          metadata: { fullText: match[1] },
        });
      }
    }

    // 4. Paragraph anchors
    if (anchorTypes.includes(AnchorType.PARAGRAPH)) {
      const paragraphs = section.content.split(/\n\s*\n/);
      let offset = 0;
      paragraphs.forEach((para, index) => {
        if (para.trim().length > 0) {
          anchors.push({
            type: AnchorType.PARAGRAPH,
            sectionId,
            offset: offset + para.length,
            text: para.substring(0, 60).trim(),
            confidence: 0.75,
            metadata: { paragraphIndex: index },
          });
        }
        offset += para.length + 2; // +2 for \n\n
      });
    }

    // 5. Table row anchors (simple detection)
    if (anchorTypes.includes(AnchorType.TABLE_ROW)) {
      // Detect table-like structures (lines with multiple tabs or pipes)
      const tableRowPattern = /^.+[\t|].+[\t|].+$/gm;
      let match;
      while ((match = tableRowPattern.exec(section.content)) !== null) {
        anchors.push({
          type: AnchorType.TABLE_ROW,
          sectionId,
          offset: match.index + match[0].length,
          text: match[0].substring(0, 60),
          confidence: 0.70,
          metadata: { row: match[0] },
        });
      }
    }

    // Filter by afterText if provided
    let filteredAnchors = anchors;
    if (options?.afterText) {
      const afterIndex = section.content.indexOf(options.afterText);
      if (afterIndex !== -1) {
        filteredAnchors = anchors.filter(a => a.offset >= afterIndex);
      }
    }

    // Sort by confidence (descending) and limit
    filteredAnchors.sort((a, b) => b.confidence - a.confidence);
    return filteredAnchors.slice(0, limit);
  }

  async findProperties(
    propertyType: 'Name&Role' | 'Date' | 'Terms',
    filter?: (value: any) => boolean
  ): Promise<PropertyLocation[]> {
    const locations: PropertyLocation[] = [];

    for (const [sectionId, props] of this.inventory) {
      const properties = props[propertyType];
      
      properties.forEach((prop, index) => {
        // Apply filter if provided
        if (filter && !filter(prop)) {
          return;
        }

        locations.push({
          sectionId,
          propertyType,
          propertyIndex: index,
          span: prop.span,
          value: prop,
        });
      });
    }

    return locations;
  }

  getSection(sectionId: string): Section | undefined {
    return this.sections.get(sectionId);
  }

  /**
   * Get all indexed section IDs
   */
  getSectionIds(): string[] {
    return Array.from(this.sections.keys());
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    sectionCount: number;
    documentCount: number;
    hasInventory: boolean;
  } {
    return {
      sectionCount: this.sections.size,
      documentCount: this.miniSearch.documentCount,
      hasInventory: this.inventory.size > 0,
    };
  }
}
