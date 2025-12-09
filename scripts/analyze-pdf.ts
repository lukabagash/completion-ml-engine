/**
 * Test utility to analyze and print PDF parsing results
 * Useful for debugging section detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';

async function analyzePDF() {
  const parser = new BasicPDFParser();
  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/mock_legal_agreement.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found at:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Parsing PDF...\n');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const result = await parser.parse(pdfBuffer);

  console.log('='.repeat(80));
  console.log('PDF PARSING RESULTS');
  console.log('='.repeat(80));

  console.log(`\n📊 METADATA:`);
  console.log(`  Pages: ${result.metadata?.pages}`);
  console.log(`  Title: ${result.metadata?.title || 'N/A'}`);
  console.log(`  Author: ${result.metadata?.author || 'N/A'}`);
  console.log(`  Total text length: ${result.text.length} characters`);

  console.log(`\n📑 SECTIONS DETECTED: ${result.sections.length}\n`);

  result.sections.forEach((section, idx) => {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`Section ${idx}: ${section.id}`);
    console.log(`${'-'.repeat(80)}`);
    console.log(`  Title:  ${section.title}`);
    console.log(`  Kind:   ${section.kind || 'N/A'}`);
    console.log(`  Range:  ${section.startOffset} - ${section.endOffset}`);
    console.log(`  Length: ${section.endOffset - section.startOffset} chars`);
    console.log(`  Content preview: ${section.content?.substring(0, 100).replace(/\n/g, ' ')}...`);
  });

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('VALIDATION AGAINST ANSWER KEY');
  console.log(`${'='.repeat(80)}\n`);

  // Expected content checks
  const checks = [
    {
      name: 'Officers: CTO John Doe',
      pattern: /john doe|jd|cto/i,
    },
    {
      name: 'Officers: CFO Mark Miller',
      pattern: /mark miller|mm|cfo/i,
    },
    {
      name: 'Officers: Associate Brian Brown',
      pattern: /brian brown|bb|associate/i,
    },
    {
      name: 'Date: January 1, 2025 (in any format)',
      pattern: /january\s+1,?\s+2025|01\/01\/2025|2025-01-01|01-01-2025/i,
    },
    {
      name: 'Term: 24 months (twenty four format)',
      pattern: /(?:twenty\s*four|24)\s*\(?24?\)?.*months?/i,
    },
    {
      name: 'Renewal: 12 months (twelve format)',
      pattern: /(?:twelve|12)\s*\(?12?\)?.*months?/i,
    },
    {
      name: 'Notice: 60 days (sixty format)',
      pattern: /(?:sixty|60)\s*\(?60?\)?.*days?/i,
    },
    {
      name: 'Fee: 25,000 USD',
      pattern: /25[,\s]*000|25000/i,
    },
    {
      name: 'Payment: 45 days (forty five format)',
      pattern: /(?:forty\s*five|45)\s*\(?45?\)?.*days?/i,
    },
  ];

  const text = result.text;

  checks.forEach(check => {
    const found = check.pattern.test(text);
    console.log(`  ${found ? '✓' : '✗'} ${check.name}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('SECTION HIERARCHY CHECK');
  console.log('='.repeat(80) + '\n');

  const hierarchyChecks = [
    { name: 'Section 1 (Parties/Officers)', patterns: [/^1(?:\.|:|\s)/, /parties?|officer/i] },
    { name: 'Section 2 (Term/Renewal)', patterns: [/^2(?:\.|:|\s)/, /term|renewal/i] },
    { name: 'Section 3 (Services/Data)', patterns: [/^3(?:\.|:|\s)/, /service|data|responsibility/i] },
    { name: 'Section 4 (Fees/Payment)', patterns: [/^4(?:\.|:|\s)/, /fee|payment/i] },
    { name: 'Section 5 (Signatures)', patterns: [/^5(?:\.|:|\s)/, /signature|executed|dated/i] },
  ];

  hierarchyChecks.forEach(check => {
    const found = result.sections.some(s =>
      check.patterns.some(p => p.test(s.title))
    );
    console.log(`  ${found ? '✓' : '✗'} ${check.name}`);
  });

  console.log('\n' + '='.repeat(80));
}

analyzePDF().catch(console.error);
