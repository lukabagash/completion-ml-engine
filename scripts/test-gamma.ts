/**
 * Gamma Insights Agreement Test
 * Validates engine output against the answer key
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function testGammaAgreement() {
  console.log('='.repeat(80));
  console.log('GAMMA INSIGHTS AGREEMENT - ENGINE VALIDATION TEST');
  console.log('='.repeat(80));
  console.log();

  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/gamma_insight_agreement.pdf');

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
  const graph = result.graph;
  const suggestions = result.suggestions;

  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION AGAINST ANSWER KEY');
  console.log('='.repeat(80));

  let validationsPassed = 0;
  let validationsFailed = 0;

  // Validation 1: Check authoritative section for Name&Role
  console.log('\n📋 Validation 1: Authoritative Section for Name&Role');
  const authSection = suggestions.authoritative;
  if (authSection.section.includes('section-1') || authSection.section.toLowerCase().includes('section 1')) {
    console.log(`   ✅ PASS: Authoritative section is Section 1`);
    console.log(`      Section ID: ${authSection.section}`);
    console.log(`      Rationale: ${authSection.rationale}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Expected Section 1, got ${authSection.section}`);
    validationsFailed++;
  }

  // Validation 2: Check for "Counsel Priya Patel" suggestion in Section 3
  console.log('\n📋 Validation 2: Missing "Counsel Priya Patel" in Section 3');
  const section3Suggestions = suggestions.suggestedUpdates.filter(
    (s) => s.section.includes('section-3') || s.section.toLowerCase().includes('section 3')
  );
  const priyaPatelSuggestion = section3Suggestions.find(
    (s) =>
      s.prop === 'Name&Role' &&
      s.values.some((v: any) => {
        const text = typeof v === 'string' ? v : v.person || '';
        return text.toLowerCase().includes('priya') || text.toLowerCase().includes('patel');
      })
  );

  if (priyaPatelSuggestion) {
    console.log(`   ✅ PASS: Found suggestion to add Priya Patel to Section 3`);
    console.log(`      Target: ${priyaPatelSuggestion.section}`);
    console.log(`      Confidence: ${priyaPatelSuggestion.confidence.toFixed(2)}`);
    console.log(`      Values: ${JSON.stringify(priyaPatelSuggestion.values, null, 2)}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Missing suggestion for Priya Patel in Section 3`);
    console.log(`      Found ${section3Suggestions.length} suggestions for Section 3`);
    if (section3Suggestions.length > 0) {
      console.log(`      Suggestions:`, JSON.stringify(section3Suggestions, null, 2));
    }
    validationsFailed++;
  }

  // Validation 3: Check inventory parsing
  console.log('\n📋 Validation 3: Property Inventory Parsing');
  let inventoryChecks = { passed: 0, failed: 0 };

  // Find Section 1
  const section1Key = Object.keys(inventory).find((key) => {
    const section = sections.find((s) => s.id === key);
    return section && (section.id.includes('section-1') || section.title.toLowerCase().includes('section 1'));
  });

  if (section1Key) {
    const section1 = inventory[section1Key];
    const nameRoleProps = section1['Name&Role'] || [];
    console.log(`\n   Section 1 - Name&Role:`);
    console.log(`      Expected: 3 (Alice Smith, David Lee, Priya Patel)`);
    console.log(`      Found: ${nameRoleProps.length}`);
    nameRoleProps.forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.person} - ${p.role}`);
    });

    if (nameRoleProps.length >= 3) {
      console.log(`      ✅ Found at least 3 Name&Role properties`);
      inventoryChecks.passed++;
    } else {
      console.log(`      ❌ Expected at least 3, found ${nameRoleProps.length}`);
      inventoryChecks.failed++;
    }
  } else {
    console.log(`\n   ❌ Section 1 not found in inventory`);
    inventoryChecks.failed++;
  }

  // Find Section 2
  const section2Key = Object.keys(inventory).find((key) => {
    const section = sections.find((s) => s.id === key);
    return section && (section.id.includes('section-2') || section.title.toLowerCase().includes('section 2'));
  });

  if (section2Key) {
    const section2 = inventory[section2Key];
    const termProps = section2['Terms'] || [];
    console.log(`\n   Section 2 - Terms:`);
    console.log(`      Expected: 4 terms (Initial Term, Renewal, Notice, Cure Period)`);
    console.log(`      Found: ${termProps.length}`);
    termProps.forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.name}: ${p.value} ${p.unit || ''}`);
    });

    if (termProps.length >= 3) {
      console.log(`      ✅ Found at least 3 Term properties`);
      inventoryChecks.passed++;
    } else {
      console.log(`      ❌ Expected at least 3, found ${termProps.length}`);
      inventoryChecks.failed++;
    }
  } else {
    console.log(`\n   ❌ Section 2 not found in inventory`);
    inventoryChecks.failed++;
  }

  // Find Section 4
  const section4Key = Object.keys(inventory).find((key) => {
    const section = sections.find((s) => s.id === key);
    return section && (section.id.includes('section-4') || section.title.toLowerCase().includes('section 4'));
  });

  if (section4Key) {
    const section4 = inventory[section4Key];
    const termProps = section4['Terms'] || [];
    console.log(`\n   Section 4 - Terms (Fees/SLA):`);
    console.log(`      Expected: ~5 terms (Annual Fee, Payment, Uptime, Credit, Suspension)`);
    console.log(`      Found: ${termProps.length}`);
    termProps.forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.name}: ${p.value} ${p.unit || ''}`);
    });

    if (termProps.length >= 3) {
      console.log(`      ✅ Found at least 3 Term properties`);
      inventoryChecks.passed++;
    } else {
      console.log(`      ❌ Expected at least 3, found ${termProps.length}`);
      inventoryChecks.failed++;
    }
  } else {
    console.log(`\n   ❌ Section 4 not found in inventory`);
    inventoryChecks.failed++;
  }

  if (inventoryChecks.passed >= 2) {
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
  const outputPath = path.join(__dirname, '../output/gamma_suggestions.json');
  const outputData = {
    metadata: {
      timestamp: new Date().toISOString(),
      document: 'gamma_insight_agreement.pdf',
      sections_analyzed: sections.length,
      total_edges: graph.edges.length,
    },
    authoritative: {
      section_id: authSection.section,
      rationale: authSection.rationale,
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

testGammaAgreement().catch((error) => {
  console.error('Error running gamma test:', error);
  process.exit(1);
});
