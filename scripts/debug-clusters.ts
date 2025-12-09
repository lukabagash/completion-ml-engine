/**
 * Debug script to understand cluster formation
 */

import * as fs from 'fs';
import * as path from 'path';
import { LegalDocEngine } from '../src/engine';
import { BasicPDFParser } from '../src/parsers/BasicPDFParser';
import { BasicPropertyExtractor } from '../src/extractors/BasicPropertyExtractor';
import { BasicGraphBuilder } from '../src/graph/BasicGraphBuilder';
import { BasicSuggestionEngine } from '../src/suggestions/BasicSuggestionEngine';

async function debugClusters() {
  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/orion_agreement.pdf');
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
  console.log('CLUSTER DEBUGGING');
  console.log('='.repeat(80));

  // Check Name&Role properties across sections
  console.log('\n📋 Name&Role PROPERTIES BY SECTION:');
  let totalNameRole = 0;
  for (const [sectionId, inv] of inventoryMap) {
    if (inv['Name&Role'].length > 0) {
      const section = sections.find(s => s.id === sectionId);
      console.log(`\n${sectionId}: ${section?.title}`);
      console.log(`  Count: ${inv['Name&Role'].length}`);
      inv['Name&Role'].forEach((p: any) => {
        console.log(`    - ${p.person} (${p.role})`);
      });
      totalNameRole += inv['Name&Role'].length;
    }
  }
  console.log(`\nTotal Name&Role properties: ${totalNameRole}`);

  // Check edges for Name&Role
  console.log('\n\n📊 EDGES WITH Name&Role:');
  const nameRoleEdges = graph.edges.filter((e: any) => e.prop === 'Name&Role');
  console.log(`Total Name&Role edges: ${nameRoleEdges.length}`);

  nameRoleEdges.slice(0, 20).forEach((e: any, i: number) => {
    const fromSection = sections.find(s => s.id === e.from);
    const toSection = sections.find(s => s.id === e.to);
    console.log(`\nEdge ${i + 1}: ${e.from} → ${e.to}`);
    console.log(`  From: ${fromSection?.title}`);
    console.log(`  To: ${toSection?.title}`);
    console.log(`  Weight: ${e.weight}`);
    console.log(`  Matched: ${e.evidence.matched.length}`);
    console.log(`  Missing in ${e.to}: ${e.evidence.missing.filter((m: any) => m.inSection === e.to).length}`);
    console.log(`  Missing in ${e.from}: ${e.evidence.missing.filter((m: any) => m.inSection === e.from).length}`);
  });

  if (nameRoleEdges.length > 20) {
    console.log(`\n... and ${nameRoleEdges.length - 20} more edges`);
  }

  // Find clusters manually
  console.log('\n\n🔗 MANUAL CLUSTER ANALYSIS:');
  console.log('Looking for connected components in Name&Role graph...');
  
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
}

debugClusters().catch(console.error);
