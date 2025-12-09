/**
 * Property Extractor Interface
 * Responsible for extracting Name&Role, Date, and Terms properties from sections
 */

import { SectionInventory, Section } from '../types';

export interface IPropertyExtractor {
  /**
   * Extract properties from a single section
   * @param section - The section to analyze
   * @returns Inventory of extracted properties
   */
  extract(section: Section): Promise<SectionInventory>;

  /**
   * Extract properties from multiple sections
   * @param sections - Array of sections to analyze
   * @returns Map of section IDs to their inventories
   */
  extractAll(sections: Section[]): Promise<Map<string, SectionInventory>>;
}
