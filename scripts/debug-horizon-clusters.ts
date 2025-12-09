/**
 * Debug Horizon clusters
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function debugClusters() {
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
  const inventoryMap = new Map(Object.entries(result.inventory));
  const graph = result.graph;

  console.log('='.repeat(80));
  console.log('HORIZON CLUSTERING DEBUG');
  console.log('='.repeat(80));

  // Find clusters manually for Name&Role
  console.log('\n🔗 NAME&ROLE CLUSTER ANALYSIS:');
  const visited = new Set<string>();
  const sectionIds = Array.from(inventoryMap.keys());
  
  for (const sectionId of sectionIds) {
    if (visited.has(sectionId)) continue;
    
    const inv = inventoryMap.get(sectionId)!;
    if (inv['Name&Role'].length === 0) continue;
    
    // BFS to find cluster
    const cluster: string[] = [];
    const queue: string[] = [sectionId];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      const curInv = inventoryMap.get(current);
      if (!curInv || curInv['Name&Role'].length === 0) continue;
      
      visited.add(current);
      cluster.push(current);
      
      // Find connected edges
      const edges = graph.edges.filter(
        (e: any) => e.prop === 'Name&Role' && (e.from === current || e.to === current)
      );
      
      for (const edge of edges) {
        const neighbor = edge.from === current ? edge.to : edge.from;
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    if (cluster.length > 0) {
      console.log(`\nCluster: ${cluster.join(', ')}`);
      cluster.forEach(sid => {
        const section = sections.find(s => s.id === sid);
        const inv = inventoryMap.get(sid)!;
        console.log(`  ${sid}: ${section?.title} (${inv['Name&Role'].length} roles)`);
      });
    }
  }

  // Check section-3 and section-10 edge
  console.log('\n\n🔗 CHECKING SECTION-3 ↔ SECTION-10 CONNECTION:');
  const edges310 = graph.edges.filter((e: any) => 
    e.prop === 'Name&Role' && 
    ((e.from === 'section-3' && e.to === 'section-10') || 
     (e.from === 'section-10' && e.to === 'section-3'))
  );
  
  if (edges310.length > 0) {
    console.log(`Found ${edges310.length} Name&Role edge(s) between section-3 and section-10:`);
    edges310.forEach((e: any) => {
      console.log(`  From: ${e.from}, To: ${e.to}`);
      console.log(`  Weight: ${e.weight}`);
      console.log(`  Matched: ${e.evidence.matched.length}`);
      console.log(`  Missing in ${e.to}: ${e.evidence.missing.filter((m: any) => m.inSection === e.to).length}`);
    });
  } else {
    console.log('❌ NO EDGE between section-3 and section-10!');
  }

  // Check all Name&Role edges
  console.log('\n\n📊 ALL NAME&ROLE EDGES (first 20):');
  const nameRoleEdges = graph.edges.filter((e: any) => e.prop === 'Name&Role');
  nameRoleEdges.slice(0, 20).forEach((e: any, i: number) => {
    const fromSec = sections.find(s => s.id === e.from);
    const toSec = sections.find(s => s.id === e.to);
    console.log(`\nEdge ${i + 1}: ${e.from} → ${e.to}`);
    console.log(`  From: ${fromSec?.title}`);
    console.log(`  To: ${toSec?.title}`);
  });
  
  console.log(`\nTotal Name&Role edges: ${nameRoleEdges.length}`);
}

debugClusters().catch(console.error);
