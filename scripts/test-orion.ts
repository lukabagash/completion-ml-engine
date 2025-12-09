/**
 * Orion Agreement Test
 * Validates engine output against the answer key
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function testOrionAgreement() {
  console.log('='.repeat(80));
  console.log('ORION AGREEMENT - ENGINE VALIDATION TEST');
  console.log('='.repeat(80));
  console.log();

  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/orion_agreement.pdf');

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
  console.log('\n📋 Validation 1: Authoritative Section Selection');
  const authSection = suggestions.authoritative;
  const isAuthoritativeValidSection = 
    authSection.section.includes('section-1') || 
    authSection.section.includes('section-2') ||
    authSection.section.includes('section-3') ||
    authSection.section.toLowerCase().includes('parties') ||
    authSection.section.toLowerCase().includes('contact') ||
    authSection.section.toLowerCase().includes('officer');
    
  if (isAuthoritativeValidSection) {
    console.log(`   ✅ PASS: Authoritative section identified correctly`);
    console.log(`      Section ID: ${authSection.section}`);
    console.log(`      Rationale: ${authSection.rationale}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Expected Section 1-3 or Parties/Contacts/Officer section, got ${authSection.section}`);
    validationsFailed++;
  }

  // Validation 2: Check for "Head of Security Daniel Kim" suggestion in Section 3.2
  console.log('\n📋 Validation 2: Daniel Kim Missing from Section 3.2');
  const section32Suggestions = suggestions.suggestedUpdates.filter(
    (s) => s.section.includes('section-13') || s.section.includes('3.2') || s.section.toLowerCase().includes('incident')
  );
  const danielKimSuggestion = section32Suggestions.find(
    (s) =>
      s.prop === 'Name&Role' &&
      s.values.some((v: any) => {
        const text = typeof v === 'string' ? v : (v.person || '');
        return text.toLowerCase().includes('daniel') && text.toLowerCase().includes('kim');
      })
  );

  if (danielKimSuggestion) {
    console.log(`   ✅ PASS: Found suggestion to add Daniel Kim to Section 3.2`);
    console.log(`      Target: ${danielKimSuggestion.section}`);
    console.log(`      Confidence: ${danielKimSuggestion.confidence.toFixed(2)}`);
    console.log(`      Anchor: "${danielKimSuggestion.anchor}"`);
    console.log(`      Strategy: ${danielKimSuggestion.anchorStrategy}`);
    validationsPassed++;
  } else {
    console.log(`   ❌ FAIL: Missing suggestion for Daniel Kim in Section 3.2`);
    console.log(`      Found ${section32Suggestions.length} Name&Role suggestions for section-13`);
    validationsFailed++;
  }

  // Validation 3: Check inventory parsing
  console.log('\n📋 Validation 3: Property Inventory Parsing');
  let inventoryChecks = { passed: 0, failed: 0 };

  // Find section with most Name&Role properties (should be section-1 with 3)
  let maxNameRoleSection = '';
  let maxNameRoleCount = 0;
  Object.entries(result.inventory).forEach(([key, value]) => {
    if (value['Name&Role'] && value['Name&Role'].length > maxNameRoleCount) {
      maxNameRoleCount = value['Name&Role'].length;
      maxNameRoleSection = key;
    }
  });

  if (maxNameRoleSection) {
    const inv = result.inventory[maxNameRoleSection];
    const nameRoleProps = inv['Name&Role'] || [];
    const actualSection = sections.find((s) => s.id === maxNameRoleSection);
    console.log(`\n   Officers/Contacts (${actualSection?.title}) - Name&Role:`);
    console.log(`      Expected: 3 (CTO/Security/Support Manager or similar)`);
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
    console.log(`\n   ❌ No officers/contacts section found in inventory`);
    inventoryChecks.failed++;
  }

  // Find Term sections and check counts
  const termSections: Array<{ key: string; count: number }> = [];
  Object.entries(result.inventory).forEach(([key, value]) => {
    if (value['Terms'] && value['Terms'].length > 0) {
      termSections.push({ key, count: value['Terms'].length });
    }
  });

  if (termSections.length > 0) {
    console.log(`\n   Terms Sections: Found ${termSections.length} sections with terms`);
    let totalTerms = 0;
    termSections.forEach((ts) => {
      const section = sections.find((s) => s.id === ts.key);
      console.log(`      ${ts.key}: ${ts.count} terms - ${section?.title.substring(0, 40)}`);
      totalTerms += ts.count;
    });

    console.log(`      Total Terms: ${totalTerms}`);
    if (totalTerms >= 8) {
      console.log(`      ✅ Found sufficient term properties across sections`);
      inventoryChecks.passed++;
    } else {
      console.log(`      ⚠️  Found ${totalTerms} terms (expected at least 8)`);
      inventoryChecks.failed++;
    }
  } else {
    console.log(`\n   ❌ No terms found in inventory`);
    inventoryChecks.failed++;
  }

  // Check for fee/payment terms specifically
  const feeTermsKey = Object.keys(result.inventory).find((key) => {
    const section = sections.find((s) => s.id === key);
    return (
      section &&
      (section.title.toLowerCase().includes('fee') || 
       section.title.toLowerCase().includes('uptime') ||
       section.title.toLowerCase().includes('payment'))
    );
  });

  if (feeTermsKey) {
    const inv = result.inventory[feeTermsKey];
    const termProps = inv['Terms'] || [];
    const actualSection = sections.find((s) => s.id === feeTermsKey);
    console.log(`\n   Fees/SLA (${actualSection?.title}) - Terms:`);
    console.log(`      Expected: ~4+ (Fee, Payment, Uptime, Credit, Suspension)`);
    console.log(`      Found: ${termProps.length}`);
    termProps.slice(0, 5).forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.name}: ${p.value} ${p.unit || ''}`);
    });

    if (termProps.length >= 2) {
      console.log(`      ✅ Found term properties`);
      inventoryChecks.passed++;
    } else {
      console.log(`      ⚠️  Expected terms, found ${termProps.length}`);
      inventoryChecks.failed++;
    }
  } else {
    console.log(`\n   ⚠️  Fee/SLA section not found`);
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
  const outputPath = path.join(__dirname, '../output/orion_suggestions.json');
  const outputData = {
    metadata: {
      timestamp: new Date().toISOString(),
      document: 'orion_agreement.pdf',
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

testOrionAgreement().catch((error) => {
  console.error('Error running orion test:', error);
  process.exit(1);
});
