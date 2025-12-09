/**
 * Main Engine class - orchestrates the entire processing pipeline
 */

import { Buffer } from 'buffer';
import { IPDFParser } from './parsers/IPDFParser';
import { IPropertyExtractor } from './extractors/IPropertyExtractor';
import { IGraphBuilder } from './graph/IGraphBuilder';
import { ISuggestionEngine } from './suggestions/ISuggestionEngine';
import { EngineOutput, EngineConfig, DocumentInventory } from './types';

export class LegalDocEngine {
  private pdfParser: IPDFParser;
  private propertyExtractor: IPropertyExtractor;
  private graphBuilder: IGraphBuilder;
  private suggestionEngine: ISuggestionEngine;
  private config: EngineConfig;

  constructor(
    pdfParser: IPDFParser,
    propertyExtractor: IPropertyExtractor,
    graphBuilder: IGraphBuilder,
    suggestionEngine: ISuggestionEngine,
    config: EngineConfig = {}
  ) {
    this.pdfParser = pdfParser;
    this.propertyExtractor = propertyExtractor;
    this.graphBuilder = graphBuilder;
    this.suggestionEngine = suggestionEngine;
    this.config = {
      confidenceThreshold: 0.85,
      enableNER: true,
      enableLLMAssist: false,
      ...config,
    };
  }

  /**
   * Process a PDF file and return complete analysis
   * @param pdfBuffer - Buffer containing the PDF file
   * @returns Complete engine output with sections, inventory, graph, and suggestions
   */
  async process(pdfBuffer: Buffer): Promise<EngineOutput> {
    // Step 1: Parse PDF and extract sections
    const parseResult = await this.pdfParser.parse(pdfBuffer);
    const sections = parseResult.sections;

    // Step 2: Extract properties from all sections
    const inventoryMap = await this.propertyExtractor.extractAll(sections);

    // Convert Map to plain object for output
    const inventory: DocumentInventory = {};
    inventoryMap.forEach((value, key) => {
      inventory[key] = value;
    });

    // Step 3: Build section-property graph
    const graph = await this.graphBuilder.buildGraph(sections, inventoryMap);

    // Step 4: Generate suggestions based on graph analysis
    const suggestions = await this.suggestionEngine.generateSuggestions(graph, inventoryMap);

    return {
      sections,
      inventory,
      graph,
      suggestions,
    };
  }

  /**
   * Get the current engine configuration
   */
  getConfig(): EngineConfig {
    return { ...this.config };
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
