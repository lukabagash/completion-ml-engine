#!/usr/bin/env ts-node
/**
 * Phase 6 Validation Script - End-to-End Test
 * Processes the mock PDF agreement and generates JSON suggestions
 * This is the final integration test showing all phases working together
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function validatePhase6() {
  console.log('=== Phase 6 Validation: End-to-End Suggestion Generation ===\n');

  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/mock_legal_agreement.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Mock agreement not found:', pdfPath);
    process.exit(1);
  }

  // Initialize engine with all components
  console.log('Initializing Legal Document Engine...');
  const engine = new LegalDocEngine(
    new BasicPDFParser(),
    new BasicPropertyExtractor(),
    new BasicGraphBuilder(),
    new BasicSuggestionEngine()
  );
  console.log('✅ Engine initialized\n');

  // Process the PDF
  console.log('Processing PDF through complete pipeline...');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const result = await engine.process(pdfBuffer);
  
  console.log('✅ PDF processed successfully\n');
  
  // Display statistics
  console.log('=== Processing Statistics ===');
  console.log(`Sections parsed: ${result.sections.length}`);
  console.log(`Properties extracted: ${Object.keys(result.inventory).length} sections with properties`);
  console.log(`Graph edges: ${result.graph.edges.length}`);
  console.log(`Suggested updates: ${result.suggestions.suggestedUpdates.length}`);
  console.log(`Unchanged properties: ${result.suggestions.unchanged.length}\n`);

  // Display authoritative section
  console.log('=== Authoritative Section ===');
  const authSection = result.sections.find(s => s.id === result.suggestions.authoritative.section);
  console.log(`Section: ${authSection?.title || result.suggestions.authoritative.section}`);
  console.log(`Rationale: ${result.suggestions.authoritative.rationale}\n`);

  // Display suggested updates
  console.log('=== Suggested Updates ===');
  if (result.suggestions.suggestedUpdates.length === 0) {
    console.log('No updates suggested (all sections consistent)');
  } else {
    result.suggestions.suggestedUpdates.forEach((update, index) => {
      const targetSection = result.sections.find(s => s.id === update.section);
      const sourceSection = result.sections.find(s => s.id === update.evidenceFrom.section);
      
      console.log(`\nUpdate #${index + 1}:`);
      console.log(`  Target Section: ${targetSection?.title || update.section}`);
      console.log(`  Type: ${update.type}`);
      console.log(`  Property: ${update.prop}`);
      console.log(`  Values to insert: ${update.values.length}`);
      
      update.values.forEach((val: any, i) => {
        if (update.prop === 'Name&Role') {
          console.log(`    ${i + 1}. ${val.role}: ${val.person}`);
        } else if (update.prop === 'Date') {
          console.log(`    ${i + 1}. ${val.iso} (${val.surface})`);
        } else if (update.prop === 'Terms') {
          console.log(`    ${i + 1}. ${val.name}: ${val.value}${val.unit ? ' ' + val.unit : ''}`);
        }
      });
      
      console.log(`  Confidence: ${(update.confidence * 100).toFixed(1)}%`);
      console.log(`  Anchor: "${update.anchor?.substring(0, 50)}..."`);
      console.log(`  Anchor Strategy: ${update.anchorStrategy}`);
      console.log(`  Evidence from: ${sourceSection?.title || update.evidenceFrom.section}`);
      console.log(`  Rationale: ${update.rationale}`);
    });
  }

  // Display unchanged properties
  console.log('\n=== Unchanged Properties (Consistent Across Sections) ===');
  if (result.suggestions.unchanged.length === 0) {
    console.log('No high-confidence matches found');
  } else {
    result.suggestions.unchanged.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.prop}: ${item.value?.substring(0, 50) || 'N/A'}`);
      console.log(`   Found in: ${item.sections.join(', ')}`);
    });
    if (result.suggestions.unchanged.length > 5) {
      console.log(`   ... and ${result.suggestions.unchanged.length - 5} more`);
    }
  }

  // Generate JSON output
  console.log('\n=== JSON Output ===');
  
  const jsonOutput = {
    metadata: {
      timestamp: new Date().toISOString(),
      document: path.basename(pdfPath),
      sections_analyzed: result.sections.length,
      total_edges: result.graph.edges.length,
    },
    authoritative: {
      section_id: result.suggestions.authoritative.section,
      section_title: authSection?.title || 'Unknown',
      rationale: result.suggestions.authoritative.rationale,
    },
    suggested_updates: result.suggestions.suggestedUpdates.map(update => {
      const targetSection = result.sections.find(s => s.id === update.section);
      const sourceSection = result.sections.find(s => s.id === update.evidenceFrom.section);
      
      return {
        target_section: {
          id: update.section,
          title: targetSection?.title || 'Unknown',
        },
        operation: update.type,
        property_type: update.prop,
        values: update.values.map((val: any) => {
          if (update.prop === 'Name&Role') {
            return { role: val.role, person: val.person };
          } else if (update.prop === 'Date') {
            return { iso: val.iso, surface: val.surface };
          } else if (update.prop === 'Terms') {
            return { name: val.name, value: val.value, unit: val.unit };
          }
          return val;
        }),
        confidence: Math.round(update.confidence * 100) / 100,
        anchor: {
          text: update.anchor?.substring(0, 100),
          strategy: update.anchorStrategy,
        },
        evidence_from: {
          section_id: update.evidenceFrom.section,
          section_title: sourceSection?.title || 'Unknown',
        },
        rationale: update.rationale,
      };
    }),
    unchanged: result.suggestions.unchanged.slice(0, 10).map(item => ({
      property_type: item.prop,
      value: item.value,
      sections: item.sections,
    })),
  };

  console.log(JSON.stringify(jsonOutput, null, 2));

  // Save JSON to file
  const outputPath = path.join(__dirname, '../output/suggestions.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n✅ JSON output saved to: ${outputPath}`);

  // Validation checks
  console.log('\n=== Validation Checks ===');
  
  const checks = [
    {
      name: 'Authoritative section identified',
      pass: result.suggestions.authoritative.section !== 'unknown',
    },
    {
      name: 'Suggestions generated',
      pass: result.suggestions.suggestedUpdates.length > 0,
    },
    {
      name: 'All suggestions have confidence scores',
      pass: result.suggestions.suggestedUpdates.every(u => u.confidence > 0),
    },
    {
      name: 'All suggestions have anchors',
      pass: result.suggestions.suggestedUpdates.every(u => u.anchor && u.anchorStrategy),
    },
    {
      name: 'All suggestions have evidence source',
      pass: result.suggestions.suggestedUpdates.every(u => u.evidenceFrom.section),
    },
    {
      name: 'All suggestions have rationale',
      pass: result.suggestions.suggestedUpdates.every(u => u.rationale),
    },
  ];

  let allPassed = true;
  checks.forEach(check => {
    const status = check.pass ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    if (!check.pass) allPassed = false;
  });

  console.log('\n=== Phase 6 Validation Summary ===');
  if (allPassed) {
    console.log('✅ All validation checks passed!');
    console.log('✅ End-to-end pipeline working correctly:');
    console.log('   1. PDF Parsing ✓');
    console.log('   2. Property Extraction ✓');
    console.log('   3. Graph Construction ✓');
    console.log('   4. Suggestion Generation ✓');
    console.log('✅ JSON output successfully generated');
    console.log('✅ Phase 6: Suggestion Engine COMPLETE');
  } else {
    console.log('❌ Some validation checks failed');
    process.exit(1);
  }
}

validatePhase6().catch(error => {
  console.error('❌ Error during validation:', error);
  process.exit(1);
});
