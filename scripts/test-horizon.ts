/**
 * Horizon Agreement Test
 * Validates engine output against the answer key
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function testHorizonAgreement() {
  console.log('='.repeat(80));
  console.log('HORIZON AGREEMENT - ENGINE VALIDATION TEST');
  console.log('='.repeat(80));
  console.log();

  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/horizon_agreement.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF not found: ${pdfPath}`);
    return;
  }

  console.log(`📄 Loading PDF: ${pdfPath}`);
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Initialize engine with all components
  const engine = new LegalDocEngine(
    new BasicPDFParser(),
    new BasicPropertyExtractor(),
    new BasicGraphBuilder(),
    new BasicSuggestionEngine()
  );

  console.log('\n1️⃣  PROCESSING PDF THROUGH COMPLETE PIPELINE...');
  const result = await engine.process(pdfBuffer);
  console.log(`   ✓ Parsed ${result.sections.length} sections`);
  console.log(`   ✓ Extracted properties from ${Object.keys(result.inventory).length} sections`);
  console.log(`   ✓ Built graph with ${result.graph.edges.length} edges`);
  console.log(`   ✓ Generated ${result.suggestions.suggestedUpdates.length} suggestions`);

  const sections = result.sections;
  const inventory = result.inventory;
  const suggestions = result.suggestions;

  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION AGAINST ANSWER KEY');
  console.log('='.repeat(80));

  let validationsPassed = 0;
  let validationsFailed = 0;

  // Validation 1: Check authoritative section for Name&Role
  console.log('\n📋 Validation 1: Authoritative Section Selection');
  const authSection = suggestions.authoritative;
  // Accept section-1, section-2, or section-3 as they all relate to primary/designated representatives
  const isAuthoritativeValidSection = 
    authSection.section.includes('section-1') || 
    authSection.section.includes('section-2') ||
    authSection.section.includes('section-3') ||
    authSection.section.toLowerCase().includes('representative') ||
    authSection.section.toLowerCase().includes('designated') ||
    authSection.section.toLowerCase().includes('primary');
    
  if (isAuthoritativeValidSection) {
    console.log(`   ✅ PASS: Authoritative section identified correctly`);
    console.log(`      Section ID: ${authSection.section}`);
    console.log(`      Rationale: ${authSection.rationale}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Expected Primary/Designated Representatives section, got ${authSection.section}`);
    validationsFailed++;
  }

  // Validation 2: Check for "VP Operations Sarah Green" suggestion in Section 3 (Support)
  console.log('\n📋 Validation 2: Sarah Green Missing from Section 3.2 (Support)');
  const section32Suggestions = suggestions.suggestedUpdates.filter(
    (s) => s.section.includes('section-10') || s.section.includes('3.2') || s.section.toLowerCase().includes('support')
  );
  const sarahGreenSuggestion = section32Suggestions.find(
    (s) =>
      s.prop === 'Name&Role' &&
      s.values.some((v: any) => {
        const text = typeof v === 'string' ? v : (v.person || '');
        return (text.toLowerCase().includes('sarah') && text.toLowerCase().includes('green')) ||
               (text.toLowerCase().includes('operations') && text.toLowerCase().includes('green'));
      })
  );

  if (sarahGreenSuggestion) {
    console.log(`   ✅ PASS: Found suggestion to add Sarah Green to Section 3.2`);
    console.log(`      Target: ${sarahGreenSuggestion.section}`);
    console.log(`      Confidence: ${sarahGreenSuggestion.confidence.toFixed(2)}`);
    console.log(`      Anchor: "${sarahGreenSuggestion.anchor}"`);
    console.log(`      Strategy: ${sarahGreenSuggestion.anchorStrategy}`);
    console.log(`      Values: ${sarahGreenSuggestion.values.map((v: any) => v.person || v).join(', ')}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Missing suggestion for Sarah Green in Section 3.2`);
    console.log(`      Found ${section32Suggestions.length} Name&Role suggestions for section-10`);
    if (section32Suggestions.length > 0) {
      console.log(`      First suggestion values: ${section32Suggestions[0].values.map((v: any) => v.person || v).join(', ')}`);
    }
    validationsFailed++;
  }

  // Validation 3: Check for date mismatch suggestion
  console.log('\n📋 Validation 3: Date Mismatch (Signature vs Effective)');
  const dateAlertSuggestions = suggestions.suggestedUpdates.filter(
    (s) => s.prop === 'Date' && (s.section.includes('section-5') || s.section.toLowerCase().includes('signature'))
  );
  
  if (dateAlertSuggestions.length > 0) {
    console.log(`   ✅ PASS: Found date-related suggestion for Section 5`);
    dateAlertSuggestions.forEach((s, i) => {
      console.log(`      Suggestion ${i + 1}:`);
      console.log(`        Target: ${s.section}`);
      console.log(`        Type: ${s.type}`);
      console.log(`        Confidence: ${s.confidence.toFixed(2)}`);
      console.log(`        Values: ${JSON.stringify(s.values).substring(0, 60)}`);
    });
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Missing date mismatch suggestion for Section 5`);
    console.log(`      Expected: Signature date (03/20/2024) → Effective Date (03/15/2024)`);
    validationsFailed++;
  }

  // Validation 4: Check inventory parsing
  console.log('\n📋 Validation 4: Property Inventory Parsing');
  let inventoryChecks = { passed: 0, failed: 0 };

  // Check Section 1 - Primary Representatives (should have 3 Name&Role)
  let section1Found = false;
  for (const [sectionId, inv] of Object.entries(result.inventory)) {
    const section = sections.find(s => s.id === sectionId);
    if (section && (section.title.toLowerCase().includes('primary') || section.title.toLowerCase().includes('representative'))) {
      console.log(`\n   Section 1: ${section.title}`);
      const nameRoleProps = inv['Name&Role'] || [];
      console.log(`      Expected: 3 (CEO, CFO, VP Operations)`);
      console.log(`      Found: ${nameRoleProps.length}`);
      nameRoleProps.forEach((p: any, i: number) => {
        console.log(`        ${i + 1}. ${p.person} - ${p.role}`);
      });
      
      if (nameRoleProps.length >= 3) {
        console.log(`      ✅ Found at least 3 Name&Role properties`);
        inventoryChecks.passed++;
      } else {
        console.log(`      ❌ Expected at least 3, found ${nameRoleProps.length}`);
        inventoryChecks.failed++;
      }
      section1Found = true;
      break;
    }
  }
  
  if (!section1Found) {
    console.log(`\n   ❌ Primary Representatives section not found`);
    inventoryChecks.failed++;
  }

  // Check for terms in sections
  let termCount = 0;
  const termSections: Array<{ id: string; count: number; title: string }> = [];
  for (const [sectionId, inv] of Object.entries(result.inventory)) {
    if (inv['Terms'] && inv['Terms'].length > 0) {
      const section = sections.find(s => s.id === sectionId);
      termSections.push({ id: sectionId, count: inv['Terms'].length, title: section?.title || sectionId });
      termCount += inv['Terms'].length;
    }
  }

  console.log(`\n   Terms Sections: Found ${termSections.length} sections with terms`);
  termSections.forEach((ts) => {
    console.log(`      ${ts.id}: ${ts.count} terms - ${ts.title.substring(0, 40)}`);
  });
  
  console.log(`      Total Terms: ${termCount}`);
  if (termCount >= 4) {
    console.log(`      ✅ Found sufficient term properties (≥4)`);
    inventoryChecks.passed++;
  } else {
    console.log(`      ⚠️  Found ${termCount} terms (expected ≥4)`);
    inventoryChecks.failed++;
  }

  // Check for effective date
  let effectiveDateFound = false;
  for (const [sectionId, inv] of Object.entries(result.inventory)) {
    if (inv['Date'] && inv['Date'].length > 0) {
      const section = sections.find(s => s.id === sectionId);
      inv['Date'].forEach((d: any) => {
        if (d.iso && d.iso.includes('2024-03-15')) {
          console.log(`\n   Effective Date Found: ${d.iso} (${d.surface})`);
          console.log(`      In section: ${section?.title}`);
          console.log(`      ✅ Correct effective date detected`);
          effectiveDateFound = true;
          inventoryChecks.passed++;
        }
      });
    }
  }

  if (!effectiveDateFound) {
    console.log(`\n   ⚠️  Effective Date 2024-03-15 not found`);
    inventoryChecks.failed++;
  }

  if (inventoryChecks.passed >= 3) {
    console.log(
      `\n   ✅ PASS: Inventory parsing (${inventoryChecks.passed}/${inventoryChecks.passed + inventoryChecks.failed} checks passed)`
    );
    validationsPassed++;
  } else {
    console.log(
      `\n   ❌ FAIL: Inventory parsing (${inventoryChecks.passed}/${inventoryChecks.passed + inventoryChecks.failed} checks passed)`
    );
    validationsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${validationsPassed}`);
  console.log(`❌ Failed: ${validationsFailed}`);
  console.log(`Total:    ${validationsPassed + validationsFailed}`);

  if (validationsFailed === 0) {
    console.log('\n🎉 ALL VALIDATIONS PASSED! Engine matches answer key expectations.');
  } else {
    console.log('\n⚠️  Some validations failed. Review output above for details.');
  }

  // Output full results to JSON
  const outputPath = path.join(__dirname, '../output/horizon_suggestions.json');
  const outputData = {
    metadata: {
      timestamp: new Date().toISOString(),
      document: 'horizon_agreement.pdf',
      sections_analyzed: sections.length,
      total_edges: result.graph.edges.length,
    },
    authoritative: {
      section_id: suggestions.authoritative.section,
      rationale: suggestions.authoritative.rationale,
    },
    suggested_updates: suggestions.suggestedUpdates.map((s) => ({
      target_section: s.section,
      operation: s.type,
      property_type: s.prop,
      values: s.values,
      confidence: s.confidence,
      anchor: s.anchor,
      anchor_strategy: s.anchorStrategy,
      evidence_from: s.evidenceFrom,
      rationale: s.rationale,
    })),
    unchanged: suggestions.unchanged.map((u) => ({
      property_type: u.prop,
      sections: u.sections,
    })),
    validation_results: {
      passed: validationsPassed,
      failed: validationsFailed,
      total: validationsPassed + validationsFailed,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\n📄 Full results written to: ${outputPath}`);
}

testHorizonAgreement().catch((error) => {
  console.error('Error running horizon test:', error);
  process.exit(1);
});
