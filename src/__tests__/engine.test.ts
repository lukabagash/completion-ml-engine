/**
 * Test file for LegalDocEngine
 */

import { LegalDocEngine } from '../engine';
import { BasicPDFParser } from '../parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../suggestions/BasicSuggestionEngine';

describe('LegalDocEngine', () => {
  let engine: LegalDocEngine;

  beforeEach(() => {
    const pdfParser = new BasicPDFParser();
    const propertyExtractor = new BasicPropertyExtractor();
    const graphBuilder = new BasicGraphBuilder();
    const suggestionEngine = new BasicSuggestionEngine();

    engine = new LegalDocEngine(
      pdfParser,
      propertyExtractor,
      graphBuilder,
      suggestionEngine
    );
  });

  it('should create an engine instance', () => {
    expect(engine).toBeInstanceOf(LegalDocEngine);
  });

  it('should have default configuration', () => {
    const config = engine.getConfig();
    expect(config.confidenceThreshold).toBe(0.85);
    expect(config.enableNER).toBe(true);
    expect(config.enableLLMAssist).toBe(false);
  });

  it('should allow configuration updates', () => {
    engine.updateConfig({ confidenceThreshold: 0.9 });
    const config = engine.getConfig();
    expect(config.confidenceThreshold).toBe(0.9);
  });

  // TODO: Add more tests with mock PDF data
});
