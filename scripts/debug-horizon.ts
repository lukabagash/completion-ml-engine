/**
 * Debug Horizon inventory
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function debugHorizon() {
  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/horizon_agreement.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);

  const engine = new LegalDocEngine(
    new BasicPDFParser(),
    new BasicPropertyExtractor(),
    new BasicGraphBuilder(),
    new BasicSuggestionEngine()
  );

  const result = await engine.process(pdfBuffer);
  const sections = result.sections;
  const inventory = result.inventory;

  console.log('='.repeat(80));
  console.log('HORIZON INVENTORY DEBUG');
  console.log('='.repeat(80));

  // Show all sections and their Name&Role
  console.log('\nAll sections with Name&Role:');
  for (const [sectionId, inv] of Object.entries(result.inventory)) {
    if (inv['Name&Role'].length > 0) {
      const section = sections.find(s => s.id === sectionId);
      console.log(`\n${sectionId}: ${section?.title}`);
      console.log(`  Count: ${inv['Name&Role'].length}`);
      inv['Name&Role'].forEach((p: any) => {
        console.log(`    - ${p.person} (${p.role})`);
      });
    }
  }

  console.log('\n\nAuthoritative section selected:');
  console.log(`  ${result.suggestions.authoritative.section}`);
  console.log(`  Rationale: ${result.suggestions.authoritative.rationale}`);

  console.log('\n\nAll Name&Role suggestions:');
  const rolesuggestions = result.suggestions.suggestedUpdates.filter((s: any) => s.prop === 'Name&Role');
  rolesuggestions.forEach((s: any, i: number) => {
    console.log(`\n  ${i + 1}. Target: ${s.section}`);
    console.log(`     From: ${s.evidenceFrom.section}`);
    console.log(`     Values: ${s.values.map((v: any) => v.person).join(', ')}`);
  });
}

debugHorizon().catch(console.error);
