/**
 * Debug script to check cluster deltas
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function debugDeltas() {
  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/orion_agreement.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);

  const engine = new LegalDocEngine(
    new BasicPDFParser(),
    new BasicPropertyExtractor(),
    new BasicGraphBuilder(),
    new BasicSuggestionEngine()
  );

  const result = await engine.process(pdfBuffer);
  const sections = result.sections;
  const inventoryMap = new Map(Object.entries(result.inventory));
  const graph = result.graph;

  console.log('='.repeat(80));
  console.log('DELTA DEBUGGING');
  console.log('='.repeat(80));

  // Show what Name&Role properties exist in each section
  console.log('\n📋 Name&Role INVENTORY:');
  for (const [sectionId, inv] of inventoryMap) {
    if (inv['Name&Role'].length > 0) {
      const section = sections.find(s => s.id === sectionId);
      console.log(`\n${sectionId}: ${section?.title}`);
      inv['Name&Role'].forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.person} - ${p.role}`);
      });
    }
  }

  // Check suggestions generated
  console.log('\n\n📊 SUGGESTIONS GENERATED:');
  const suggestions = result.suggestions.suggestedUpdates;
  console.log(`Total suggestions: ${suggestions.length}`);
  
  const nameRoleSuggestions = suggestions.filter((s: any) => s.prop === 'Name&Role');
  console.log(`Name&Role suggestions: ${nameRoleSuggestions.length}`);
  
  console.log('\nName&Role Suggestions:');
  nameRoleSuggestions.forEach((s: any, i: number) => {
    console.log(`\n  Suggestion ${i + 1}:`);
    console.log(`    Target: ${s.section}`);
    console.log(`    From: ${s.evidenceFrom.section}`);
    console.log(`    Values: ${s.values.map((v: any) => v.person + ' - ' + v.role).join(', ')}`);
    console.log(`    Confidence: ${s.confidence.toFixed(2)}`);
  });
}

debugDeltas().catch(console.error);
