/**
 * Example: Basic usage of the Legal Document ML Engine
 */

import { createEngine } from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Create engine with default configuration
  const engine = createEngine({
    confidenceThreshold: 0.85,
    enableNER: true,
  });

  // Load a PDF file (you'll need to provide your own PDF)
  const pdfPath = path.join(__dirname, 'sample-document.pdf');
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    console.log('Sample PDF not found. Please place a PDF file at:', pdfPath);
    console.log('\nCreating a mock result instead...\n');
    
    // Show what the output would look like
    const mockResult = {
      sections: [
        {
          id: 'section-0',
          title: 'DEFINITIONS',
          startOffset: 0,
          endOffset: 1500,
          content: 'Sample content with CTO John Doe and date 10/08/2021...',
        },
      ],
      inventory: {
        'section-0': {
          'Name&Role': [
            {
              role: 'CTO',
              person: 'John Doe',
              span: { start: 20, end: 32 },
              conf: 0.96,
            },
          ],
          Date: [
            {
              iso: '2021-10-08',
              surface: '10/08/2021',
              span: { start: 42, end: 52 },
              conf: 0.99,
            },
          ],
          Terms: [],
        },
      },
      graph: {
        nodes: [],
        edges: [],
      },
      suggestions: {
        authoritative: {
          section: 'section-0',
          evidenceSpan: { start: 0, end: 1500 },
          rationale: 'Definitions section takes precedence',
        },
        suggestedUpdates: [],
        unchanged: [],
      },
    };
    
    console.log('Mock Result:');
    console.log(JSON.stringify(mockResult, null, 2));
    return;
  }

  const pdfBuffer = fs.readFileSync(pdfPath);

  console.log('Processing document...\n');

  // Process the document
  const result = await engine.process(pdfBuffer);

  // Display results
  console.log('=== SECTIONS ===');
  console.log(`Found ${result.sections.length} sections:\n`);
  result.sections.forEach((section, idx) => {
    console.log(`${idx + 1}. ${section.title}`);
    console.log(`   ID: ${section.id}`);
    console.log(`   Offset: ${section.startOffset}-${section.endOffset}`);
    console.log('');
  });

  console.log('\n=== PROPERTY INVENTORY ===');
  Object.entries(result.inventory).forEach(([sectionId, inventory]) => {
    console.log(`\nSection: ${sectionId}`);
    console.log(`  Name&Role: ${inventory['Name&Role'].length} found`);
    inventory['Name&Role'].forEach(nr => {
      console.log(`    - ${nr.role} ${nr.person} (confidence: ${nr.conf})`);
    });
    
    console.log(`  Dates: ${inventory.Date.length} found`);
    inventory.Date.forEach(d => {
      console.log(`    - ${d.surface} (${d.iso}) (confidence: ${d.conf})`);
    });
    
    console.log(`  Terms: ${inventory.Terms.length} found`);
    inventory.Terms.forEach(t => {
      console.log(`    - ${t.name}: ${t.value}${t.unit ? ' ' + t.unit : ''}`);
    });
  });

  console.log('\n=== GRAPH ===');
  console.log(`Edges: ${result.graph.edges.length}`);
  result.graph.edges.forEach(edge => {
    console.log(`  ${edge.from} <--> ${edge.to}`);
    console.log(`    Property: ${edge.prop}, Weight: ${edge.weight.toFixed(2)}`);
  });

  console.log('\n=== SUGGESTIONS ===');
  console.log(`Authoritative Section: ${result.suggestions.authoritative.section}`);
  console.log(`Suggested Updates: ${result.suggestions.suggestedUpdates.length}`);
  console.log(`Unchanged Properties: ${result.suggestions.unchanged.length}`);

  // Save results to file
  const outputPath = path.join(__dirname, 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nFull results saved to: ${outputPath}`);
}

main().catch(console.error);
