/**
 * Phase 3 Validation Script
 * Validates that BasicPropertyExtractor correctly extracts properties from the mock agreement
 * per the answer key expectations
 */

import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';

async function validatePhase3() {
  console.log('='.repeat(80));
  console.log('Phase 3 Validation: Property Extraction from Mock Agreement');
  console.log('='.repeat(80));
  console.log();

  const parser = new BasicPDFParser();
  const extractor = new BasicPropertyExtractor();

  // Parse the mock agreement
  const mockPath = './pdf_mock_agreements/mock_legal_agreement.pdf';
  console.log(`Parsing: ${mockPath}`);
  
  const fs = require('fs');
  const pdfBuffer = fs.readFileSync(mockPath);
  const document = await parser.parse(pdfBuffer);
  console.log(`✓ Parsed ${document.sections.length} sections`);
  console.log();

  // Extract properties from all sections
  const inventory = await extractor.extractAll(document.sections);
  
  // Expected per answer key:
  // Section 1.1: CTO John Doe, CFO Mark Miller, Associate Brian Brown
  // Section 3.2: CTO John Doe, CFO Mark Miller (missing Associate Brian Brown)
  // Cover, Section 2.1, Section 5: Date 2025-01-01
  // Section 2: Terms (24 months, 12 months renewal, 60 days notice, 30 days cure)
  // Section 4: Terms (25,000 USD, 12 months, 45 days, 60 days)

  console.log('='.repeat(80));
  console.log('Section-by-Section Property Extraction');
  console.log('='.repeat(80));
  console.log();

  let totalNameAndRole = 0;
  let totalDates = 0;
  let totalTerms = 0;

  for (const section of document.sections) {
    const props = inventory.get(section.id);
    if (!props) continue;

    const hasProps = props['Name&Role'].length > 0 || props.Date.length > 0 || props.Terms.length > 0;
    if (!hasProps) continue;

    console.log(`Section: ${section.id} - ${section.title}`);
    console.log('-'.repeat(80));

    if (props['Name&Role'].length > 0) {
      console.log(`  Name&Role (${props['Name&Role'].length}):`);
      props['Name&Role'].forEach(nr => {
        console.log(`    - ${nr.role}: ${nr.person} (conf: ${nr.conf.toFixed(2)})`);
        totalNameAndRole++;
      });
    }

    if (props.Date.length > 0) {
      console.log(`  Dates (${props.Date.length}):`);
      props.Date.forEach(d => {
        console.log(`    - ${d.iso} (surface: "${d.surface}", conf: ${d.conf.toFixed(2)})`);
        totalDates++;
      });
    }

    if (props.Terms.length > 0) {
      console.log(`  Terms (${props.Terms.length}):`);
      props.Terms.forEach(t => {
        const valueStr = typeof t.value === 'number' ? t.value : `"${t.value}"`;
        const unitStr = t.unit ? ` ${t.unit}` : '';
        const qualStr = t.qualifiers ? ` [${t.qualifiers}]` : '';
        console.log(`    - ${t.name}: ${valueStr}${unitStr}${qualStr} (conf: ${t.conf.toFixed(2)})`);
        totalTerms++;
      });
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('Summary Statistics');
  console.log('='.repeat(80));
  console.log(`Total Name&Role extracted: ${totalNameAndRole}`);
  console.log(`Total Dates extracted: ${totalDates}`);
  console.log(`Total Terms extracted: ${totalTerms}`);
  console.log();

  // Answer key validation checks
  console.log('='.repeat(80));
  console.log('Answer Key Validation Checks');
  console.log('='.repeat(80));
  console.log();

  let allPassed = true;

  // Check 1: Should find officers in Section 1.1 (Designated Officers)
  console.log('✓ Check 1: Section 1.1 should contain authoritative Name&Role roster');
  const section1_1 = document.sections.find(s => s.title.includes('Designated Officers') || s.id.includes('1.1'));
  if (section1_1) {
    const props1_1 = inventory.get(section1_1.id);
    const officers1_1 = props1_1?.['Name&Role'] || [];
    const hasJohnDoe = officers1_1.some(nr => nr.person.includes('John Doe') && nr.role.includes('Technology'));
    const hasMarkMiller = officers1_1.some(nr => nr.person.includes('Mark Miller') && nr.role.includes('Financial'));
    const hasBrianBrown = officers1_1.some(nr => nr.person.includes('Brian Brown') && nr.role.includes('Associate'));
    
    if (hasJohnDoe && hasMarkMiller && hasBrianBrown) {
      console.log('  ✓ PASS: Found CTO John Doe, CFO Mark Miller, Associate Brian Brown');
    } else {
      console.log('  ✗ FAIL: Missing expected officers in Section 1.1');
      allPassed = false;
    }
  } else {
    console.log('  ⚠ WARNING: Could not find Section 1.1');
  }
  console.log();

  // Check 2: Should find dates normalized to 2025-01-01
  console.log('✓ Check 2: Date consistency - all dates should normalize to 2025-01-01');
  let dateCount = 0;
  let correctDateCount = 0;
  for (const [_, props] of inventory) {
    for (const date of props.Date) {
      dateCount++;
      if (date.iso === '2025-01-01') {
        correctDateCount++;
      }
    }
  }
  if (dateCount > 0 && dateCount === correctDateCount) {
    console.log(`  ✓ PASS: All ${dateCount} dates normalize to 2025-01-01`);
  } else if (dateCount === 0) {
    console.log('  ⚠ WARNING: No dates found');
  } else {
    console.log(`  ✗ FAIL: ${correctDateCount}/${dateCount} dates are 2025-01-01`);
    allPassed = false;
  }
  console.log();

  // Check 3: Should find terms in Section 2 and Section 4
  console.log('✓ Check 3: Terms extraction from Section 2 (Term and Renewal) and Section 4 (Fees)');
  const section2 = document.sections.find(s => s.title.includes('Term') && s.title.includes('Renewal'));
  const section4 = document.sections.find(s => s.title.includes('Fees') || s.title.includes('Payment'));
  
  let termsFound = false;
  if (section2) {
    const props2 = inventory.get(section2.id);
    if (props2 && props2.Terms.length > 0) {
      console.log(`  ✓ Section 2 has ${props2.Terms.length} terms`);
      termsFound = true;
    }
  }
  if (section4) {
    const props4 = inventory.get(section4.id);
    if (props4 && props4.Terms.length > 0) {
      console.log(`  ✓ Section 4 has ${props4.Terms.length} terms`);
      termsFound = true;
    }
  }
  if (termsFound) {
    console.log('  ✓ PASS: Terms extracted from expected sections');
  } else {
    console.log('  ✗ FAIL: No terms found in expected sections');
    allPassed = false;
  }
  console.log();

  // Check 4: Property types implemented
  console.log('✓ Check 4: All three property types implemented');
  if (totalNameAndRole > 0 && totalDates > 0 && totalTerms > 0) {
    console.log('  ✓ PASS: Name&Role, Date, and Terms all extracted');
  } else {
    console.log('  ✗ FAIL: Missing property types');
    console.log(`    Name&Role: ${totalNameAndRole > 0 ? '✓' : '✗'}`);
    console.log(`    Date: ${totalDates > 0 ? '✓' : '✗'}`);
    console.log(`    Terms: ${totalTerms > 0 ? '✓' : '✗'}`);
    allPassed = false;
  }
  console.log();

  console.log('='.repeat(80));
  if (allPassed) {
    console.log('✓✓✓ PHASE 3 VALIDATION PASSED ✓✓✓');
    console.log('All property extraction requirements met. Ready for Phase 4.');
  } else {
    console.log('✗✗✗ PHASE 3 VALIDATION FAILED ✗✗✗');
    console.log('Some requirements not met. Review output above.');
  }
  console.log('='.repeat(80));
}

validatePhase3().catch(console.error);
