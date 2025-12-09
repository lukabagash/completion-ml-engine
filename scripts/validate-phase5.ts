#!/usr/bin/env ts-node
/**
 * Phase 5 Validation Script
 * Tests the graph builder on the mock agreement
 * Expected: Detect Section 1.1 vs 3.2 Name&Role comparison
 * Should show: 2 matched officers (CTO, CFO), 1 missing (Associate Brian Brown in 3.2)
 */

import * as fs from 'fs';
import * as path from 'path';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';

async function validatePhase5() {
  console.log('=== Phase 5 Validation: Graph Construction ===\n');

  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/mock_legal_agreement.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Mock agreement not found:', pdfPath);
    process.exit(1);
  }

  // Step 1: Parse PDF
  console.log('Step 1: Parsing PDF...');
  const parser = new BasicPDFParser();
  const pdfBuffer = fs.readFileSync(pdfPath);
  const parseResult = await parser.parse(pdfBuffer);
  const sections = parseResult.sections;
  console.log(`✅ Parsed ${sections.length} sections\n`);

  // Step 2: Extract properties
  console.log('Step 2: Extracting properties...');
  const extractor = new BasicPropertyExtractor();
  const inventory = await extractor.extractAll(sections);
  
  let totalRoles = 0;
  let totalDates = 0;
  let totalTerms = 0;
  
  for (const inv of inventory.values()) {
    totalRoles += inv['Name&Role'].length;
    totalDates += inv.Date.length;
    totalTerms += inv.Terms.length;
  }
  
  console.log(`✅ Extracted ${totalRoles} Name&Role, ${totalDates} Dates, ${totalTerms} Terms\n`);

  // Step 3: Build graph
  console.log('Step 3: Building graph...');
  const builder = new BasicGraphBuilder();
  const graph = await builder.buildGraph(sections, inventory);
  
  console.log(`✅ Built graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges\n`);

  // Step 4: Analyze Section 1.1 vs Section 3.2 (Answer Key Scenario)
  console.log('Step 4: Analyzing Section 1.1 vs 3.2 (Answer Key Scenario)...\n');
  
  // Find section with officers for Section 1.1 area (section-3 has the actual officer list)
  const section11 = sections.find(s => 
    s.title.includes('For purposes of this Agreement') && 
    s.title.includes('officers')
  );
  // Find Section 3.2 (Responsible Officers for Implementation)
  const section32 = sections.find(s => s.title.includes('Responsible Officers for Implementation'));
  
  if (!section11 || !section32) {
    console.error('❌ Could not find Section 1.1 or 3.2');
    console.log('Available sections:', sections.map(s => `${s.id}: ${s.title}`));
    process.exit(1);
  }
  
  console.log(`Section 1.1: ${section11.title} (ID: ${section11.id})`);
  const inv11 = inventory.get(section11.id);
  console.log(`  Name&Role: ${inv11!['Name&Role'].length} officers`);
  inv11!['Name&Role'].forEach(nr => {
    console.log(`    - ${nr.role}: ${nr.person}`);
  });
  
  console.log(`\nSection 3.2: ${section32.title} (ID: ${section32.id})`);
  const inv32 = inventory.get(section32.id);
  console.log(`  Name&Role: ${inv32!['Name&Role'].length} officers`);
  inv32!['Name&Role'].forEach(nr => {
    console.log(`    - ${nr.role}: ${nr.person}`);
  });
  
  // Find edge between Section 1.1 and 3.2
  const edge = graph.edges.find(e => 
    (e.from === section11.id && e.to === section32.id) ||
    (e.from === section32.id && e.to === section11.id)
  );
  
  if (!edge) {
    console.error('\n❌ No edge found between Section 1.1 and 3.2');
    process.exit(1);
  }
  
  console.log(`\n=== Edge Analysis (${edge.from} → ${edge.to}) ===`);
  console.log(`Property Type: ${edge.prop}`);
  console.log(`Weight: ${edge.weight.toFixed(3)}`);
  console.log(`\nMatched Properties (${edge.evidence.matched.length}):`);
  edge.evidence.matched.forEach(m => {
    console.log(`  ✅ ${m.value}`);
  });
  
  console.log(`\nMissing Properties (${edge.evidence.missing.length}):`);
  edge.evidence.missing.forEach(m => {
    const missingSectionTitle = m.inSection === section32.id ? section32.title : section11.title;
    console.log(`  ⚠️  ${m.value} (missing in: ${missingSectionTitle})`);
  });
  
  // Step 5: Find authoritative section for Name&Role
  console.log('\n=== Step 5: Finding Authoritative Section ===');
  const authSection = builder.findAuthoritativeSection(graph, inventory, 'Name&Role');
  
  if (authSection) {
    const authSec = sections.find(s => s.id === authSection);
    console.log(`✅ Authoritative section for Name&Role: ${authSec?.title} (ID: ${authSection})`);
    console.log(`   Reason: Highest property count + policy bonus (Designated Officers)`);
  } else {
    console.log('⚠️  No authoritative section found');
  }
  
  // Step 6: Verify answer key expectations
  console.log('\n=== Step 6: Validating Against Answer Key ===');
  
  const expectations = [
    {
      check: 'Section 1.1 has officers including Brian Brown',
      pass: inv11!['Name&Role'].some(nr => nr.person.includes('Brian Brown')),
    },
    {
      check: 'Section 3.2 has CTO and CFO',
      pass: inv32!['Name&Role'].some(nr => nr.role.includes('CTO') || nr.role.includes('Technology')) &&
            inv32!['Name&Role'].some(nr => nr.role.includes('CFO') || nr.role.includes('Financial')),
    },
    {
      check: 'Edge detects matched officers (CTO, CFO)',
      pass: edge.evidence.matched.length > 0 &&
            edge.evidence.matched.some(m => m.value.includes('John Doe')) &&
            edge.evidence.matched.some(m => m.value.includes('Mark Miller')),
    },
    {
      check: 'Edge detects missing officer (Brian Brown in 3.2)',
      pass: edge.evidence.missing.length > 0 && 
            edge.evidence.missing.some(m => 
              m.value.includes('Brian Brown') && 
              m.inSection === section32.id
            ),
    },
    {
      check: 'Section 1.1 is authoritative',
      pass: authSection === section11.id,
    },
    {
      check: 'Edge weight reflects partial match',
      pass: edge.weight > 0.5 && edge.weight < 1.0,
    },
  ];
  
  let allPassed = true;
  expectations.forEach(exp => {
    const status = exp.pass ? '✅' : '❌';
    console.log(`${status} ${exp.check}`);
    if (!exp.pass) allPassed = false;
  });
  
  // Step 7: Summary
  console.log('\n=== Phase 5 Validation Summary ===');
  if (allPassed) {
    console.log('✅ All checks passed!');
    console.log('✅ Graph builder correctly:');
    console.log('   - Detects matched properties (CTO John Doe, CFO Mark Miller)');
    console.log('   - Identifies missing properties (Associate Brian Brown)');
    console.log('   - Applies policy bonuses (officer sections)');
    console.log('   - Determines authoritative sections (Section 1.1)');
    console.log('✅ Phase 5: Graph Construction COMPLETE');
  } else {
    console.log('❌ Some checks failed - review output above');
    process.exit(1);
  }
}

validatePhase5().catch(console.error);
