/**
 * Quick test script to debug property extraction
 */

import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { Section } from '../src/types';

async function test() {
  const extractor = new BasicPropertyExtractor();

  // Test 1: Role Name format
  console.log('='.repeat(80));
  console.log('Test 1: Role Name format');
  const section1: Section = {
    id: 'test-1',
    title: 'Officers',
    startOffset: 0,
    endOffset: 100,
    content: 'The officers are CTO John Doe and CFO Mark Miller.',
  };

  const result1 = await extractor.extract(section1);
  console.log('Name&Role:', JSON.stringify(result1['Name&Role'], null, 2));

  // Test 2: Name, Role format
  console.log('\n' + '='.repeat(80));
  console.log('Test 2: Name, Role format');
  const section2: Section = {
    id: 'test-2',
    title: 'Parties',
    startOffset: 0,
    endOffset: 100,
    content: 'Signed by John Doe, CTO and Mary Smith, CEO.',
  };

  const result2 = await extractor.extract(section2);
  console.log('Name&Role:', JSON.stringify(result2['Name&Role'], null, 2));

  // Test 3: Percentages
  console.log('\n' + '='.repeat(80));
  console.log('Test 3: Percentages');
  const section3: Section = {
    id: 'test-3',
    title: 'Rates',
    startOffset: 0,
    endOffset: 200,
    content: 'Interest rate is 5% per annum. Tax rate is 8.5 percent.',
  };

  const result3 = await extractor.extract(section3);
  console.log('Terms:', JSON.stringify(result3.Terms, null, 2));

  // Test 4: VP abbreviation
  console.log('\n' + '='.repeat(80));
  console.log('Test 4: VP/SVP abbreviations');
  const section4: Section = {
    id: 'test-4',
    title: 'Officers',
    startOffset: 0,
    endOffset: 100,
    content: 'VP Alice Johnson and SVP Bob Smith.',
  };

  const result4 = await extractor.extract(section4);
  console.log('Name&Role:', JSON.stringify(result4['Name&Role'], null, 2));
}

test().catch(console.error);
