/**
 * Section Indexer Interface
 * Provides BM25-based full-text search and anchor detection for sections
 * Phase 4: Indexing & Search
 */

import { Section } from '../types';

/**
 * Anchor types for insertion points
 */
export enum AnchorType {
  HEADING = 'heading',           // Section heading
  PROPERTY_SPAN = 'property',    // After a specific property (Name&Role, Date, Term)
  TABLE_ROW = 'table_row',       // Within a table structure
  PARAGRAPH = 'paragraph',       // Paragraph boundary
  LIST_ITEM = 'list_item',       // Bullet/numbered list item
}

/**
 * Anchor for insertion/replacement operations
 */
export interface Anchor {
  type: AnchorType;
  sectionId: string;
  offset: number;              // Character offset in section
  text: string;                // Anchor text/context
  confidence: number;          // Confidence that this is a good anchor (0-1)
  metadata?: Record<string, any>; // Additional context
}

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  sectionId: string;
  score: number;               // BM25 relevance score
  matches: string[];           // Matched terms
  section: Section;
}

/**
 * Property lookup result
 */
export interface PropertyLocation {
  sectionId: string;
  propertyType: 'Name&Role' | 'Date' | 'Terms';
  propertyIndex: number;       // Index in the property array
  span: { start: number; end: number };
  value: any;                  // The property value
}

/**
 * Section Indexer interface
 */
export interface ISectionIndexer {
  /**
   * Index a set of sections for search
   * @param sections Sections to index
   */
  indexSections(sections: Section[]): Promise<void>;

  /**
   * Search sections using BM25 scoring
   * @param query Search query
   * @param options Search options
   * @returns Ranked search results
   */
  search(query: string, options?: {
    limit?: number;
    sectionTypes?: string[];
    minScore?: number;
  }): Promise<SearchResult[]>;

  /**
   * Detect anchors in a section for insertion/replacement
   * @param sectionId Section to analyze
   * @param options Anchor detection options
   * @returns Ranked anchors
   */
  detectAnchors(sectionId: string, options?: {
    anchorTypes?: AnchorType[];
    afterText?: string;
    limit?: number;
  }): Promise<Anchor[]>;

  /**
   * Find property locations across sections
   * @param propertyType Type of property to find
   * @param filter Optional filter function
   * @returns Property locations
   */
  findProperties(
    propertyType: 'Name&Role' | 'Date' | 'Terms',
    filter?: (value: any) => boolean
  ): Promise<PropertyLocation[]>;

  /**
   * Get section by ID
   * @param sectionId Section identifier
   * @returns Section or undefined
   */
  getSection(sectionId: string): Section | undefined;
}
