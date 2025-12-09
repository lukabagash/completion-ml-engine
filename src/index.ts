/**
 * Main entry point for the Legal Document ML Engine
 */

export { LegalDocEngine } from './engine';

// Types
export * from './types';

// Interfaces
export { IPDFParser, PDFParserResult } from './parsers/IPDFParser';
export { IPropertyExtractor } from './extractors/IPropertyExtractor';
export { IGraphBuilder } from './graph/IGraphBuilder';
export { ISuggestionEngine } from './suggestions/ISuggestionEngine';

// Basic implementations
export { BasicPDFParser } from './parsers/BasicPDFParser';
export { BasicPropertyExtractor } from './extractors/BasicPropertyExtractor';
export { BasicGraphBuilder } from './graph/BasicGraphBuilder';
export { BasicSuggestionEngine } from './suggestions/BasicSuggestionEngine';

// Utility function to create engine with basic implementations
import { LegalDocEngine } from './engine';
import { BasicPDFParser } from './parsers/BasicPDFParser';
import { BasicPropertyExtractor } from './extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from './graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from './suggestions/BasicSuggestionEngine';
import { EngineConfig } from './types';

/**
 * Create a Legal Document Engine with basic implementations
 * @param config - Optional configuration
 * @returns Configured LegalDocEngine instance
 */
export function createEngine(config?: EngineConfig): LegalDocEngine {
  const pdfParser = new BasicPDFParser();
  const propertyExtractor = new BasicPropertyExtractor(config?.confidenceThreshold);
  const graphBuilder = new BasicGraphBuilder();
  const suggestionEngine = new BasicSuggestionEngine();

  return new LegalDocEngine(
    pdfParser,
    propertyExtractor,
    graphBuilder,
    suggestionEngine,
    config
  );
}
