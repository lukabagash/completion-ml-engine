/**
 * Suggestion Engine Interface
 * Responsible for detecting inconsistencies and generating update suggestions
 */

import { SectionGraph, SuggestionsReport, SectionInventory } from '../types';

export interface ISuggestionEngine {
  /**
   * Analyze the graph and generate suggestions for inconsistencies
   * @param graph - The section-property graph
   * @param inventory - Optional inventory map for property details
   * @returns Suggestions report with updates and rationales
   */
  generateSuggestions(
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Promise<SuggestionsReport>;
}
