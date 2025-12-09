/**
 * Graph Builder Interface
 * Responsible for constructing the section-property graph
 */

import { Section, SectionInventory, SectionGraph } from '../types';

export interface IGraphBuilder {
  /**
   * Build a section-property graph from sections and their inventories
   * @param sections - Array of document sections
   * @param inventory - Map of section IDs to their property inventories
   * @returns The constructed graph
   */
  buildGraph(
    sections: Section[],
    inventory: Map<string, SectionInventory>
  ): Promise<SectionGraph>;
}
