/**
 * Basic Suggestion Engine Implementation
 * Analyzes the graph to detect inconsistencies and generate update suggestions
 * Phase 6: Suggestion Engine
 * 
 * Key responsibilities:
 * 1. Delta computation: Identify missing properties using graph edges
 * 2. Authority selection: Determine authoritative section for each property type
 * 3. Edit synthesis: Generate insertion suggestions with anchors
 * 4. Confidence scoring: Combine extraction confidence with edge weights
 */

import { ISuggestionEngine } from './ISuggestionEngine';
import {
  SectionGraph,
  SuggestionsReport,
  SuggestedUpdate,
  SectionInventory,
  NameAndRole,
  DateProperty,
  TermProperty,
} from '../types';

export class BasicSuggestionEngine implements ISuggestionEngine {
  
  async generateSuggestions(
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Promise<SuggestionsReport> {
    
    // Step 1: Find authority clusters (connected sections with matching properties)
    const clusters = this.findAuthorityClusters(graph, inventory);
    
    // Step 2: For each property type, select primary authority from cluster
    const authoritativeSections = this.selectPrimaryAuthoritiesFromClusters(clusters, graph, inventory);
    
    // Step 3: Compute deltas using cluster information (not just single authority)
    const deltas = this.computeDeltasFromClusters(clusters, graph, inventory);
    
    // Step 4: Generate suggestions for missing properties
    const suggestedUpdates = this.generateUpdateSuggestions(deltas, graph);
    
    // Step 5: Identify unchanged properties (high-confidence matches)
    const unchanged = this.identifyUnchangedProperties(graph);
    
    // Step 6: Create final report
    const primaryAuthoritative = authoritativeSections['Name&Role'] || 
                                 authoritativeSections['Date'] || 
                                 authoritativeSections['Terms'];
    
    const authSection = graph.nodes.find(n => n.id === primaryAuthoritative);
    
    return {
      authoritative: {
        section: primaryAuthoritative || graph.nodes[0]?.id || 'unknown',
        evidenceSpan: authSection ? {
          start: authSection.startOffset,
          end: authSection.endOffset,
        } : { start: 0, end: 0 },
        rationale: this.generateAuthRationale(primaryAuthoritative, graph, inventory),
      },
      suggestedUpdates,
      unchanged,
    };
  }

  /**
   * Find clusters of sections connected by matching properties
   * Returns mapping of property type to list of clusters
   */
  private findAuthorityClusters(
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Record<string, string[][]> {
    const clusters: Record<string, string[][]> = {
      'Name&Role': [],
      'Date': [],
      'Terms': [],
    };
    
    if (!inventory) return clusters;
    
    const propertyTypes: Array<'Name&Role' | 'Date' | 'Terms'> = ['Name&Role', 'Date', 'Terms'];
    
    for (const propType of propertyTypes) {
      const visited = new Set<string>();
      
      // For each section with this property type
      for (const [sectionId, inv] of inventory) {
        if (visited.has(sectionId) || inv[propType].length === 0) continue;
        
        // BFS to find all connected sections
        const cluster = this.buildClusterBFS(sectionId, propType, graph, inventory, visited);
        if (cluster.length > 0) {
          clusters[propType].push(cluster);
        }
      }
    }
    
    return clusters;
  }

  /**
   * Build a cluster of connected sections using BFS
   */
  private buildClusterBFS(
    startSectionId: string,
    propType: 'Name&Role' | 'Date' | 'Terms',
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>,
    visited?: Set<string>
  ): string[] {
    const cluster: string[] = [];
    const queue: string[] = [startSectionId];
    const localVisited = visited || new Set<string>();
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (localVisited.has(current)) continue;
      
      localVisited.add(current);
      
      const inv = inventory?.get(current);
      if (!inv || inv[propType].length === 0) continue;
      
      cluster.push(current);
      
      // Find connected edges
      const connectedEdges = graph.edges.filter(
        e => e.prop === propType && (e.from === current || e.to === current)
      );
      
      for (const edge of connectedEdges) {
        const neighbor = edge.from === current ? edge.to : edge.from;
        if (!localVisited.has(neighbor) && inventory?.has(neighbor)) {
          const neighborInv = inventory.get(neighbor)!;
          if (neighborInv[propType].length > 0) {
            queue.push(neighbor);
          }
        }
      }
    }
    
    return cluster;
  }

  /**
   * Select primary authority for each property type from clusters
   * Chooses section with most properties from each cluster
   */
  private selectPrimaryAuthoritiesFromClusters(
    clusters: Record<string, string[][]>,
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (!inventory) return result;
    
    for (const [propType, clusterList] of Object.entries(clusters)) {
      const propTyped = propType as 'Name&Role' | 'Date' | 'Terms';
      let bestSection: string | null = null;
      let bestScore = -1;
      
      // Find best section across all clusters
      for (const cluster of clusterList) {
        for (const sectionId of cluster) {
          const inv = inventory.get(sectionId);
          if (!inv) continue;
          
          const section = graph.nodes.find(n => n.id === sectionId);
          if (!section) continue;
          
          // Score = property count (70%) + policy bonus (30%)
          const propertyCount = inv[propTyped].length;
          const policyScore = this.getSectionPolicyScore(section, propTyped);
          const score = propertyCount * 0.7 + policyScore * 0.3;
          
          if (score > bestScore) {
            bestScore = score;
            bestSection = sectionId;
          }
        }
      }
      
      if (bestSection) {
        result[propType] = bestSection;
      }
    }
    
    return result;
  }

  /**
   * Compute deltas from clusters
   * For each cluster, generate suggestions to add missing properties to all sections
   * Also handle edges between sections even if one section has no properties yet
   */
  private computeDeltasFromClusters(
    clusters: Record<string, string[][]>,
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Array<{
    targetSection: string;
    propType: 'Name&Role' | 'Date' | 'Terms';
    missingValues: (NameAndRole | DateProperty | TermProperty)[];
    sourceSection: string;
    confidence: number;
  }> {
    const deltas: Array<{
      targetSection: string;
      propType: 'Name&Role' | 'Date' | 'Terms';
      missingValues: (NameAndRole | DateProperty | TermProperty)[];
      sourceSection: string;
      confidence: number;
    }> = [];
    
    if (!inventory) return deltas;
    
    // For each property type cluster
    for (const [propTypeStr, clusterList] of Object.entries(clusters)) {
      const propType = propTypeStr as 'Name&Role' | 'Date' | 'Terms';
      
      for (const cluster of clusterList) {
        // Find the most complete section in cluster (reference)
        let refSection: string | null = null;
        let maxProps = 0;
        
        for (const sectionId of cluster) {
          const inv = inventory.get(sectionId);
          if (!inv) continue;
          
          const propCount = inv[propType].length;
          if (propCount > maxProps) {
            maxProps = propCount;
            refSection = sectionId;
          }
        }
        
        if (!refSection) continue;
        
        const refInv = inventory.get(refSection)!;
        const refProps = refInv[propType];
        
        // For each section in cluster, check what's missing
        for (const sectionId of cluster) {
          if (sectionId === refSection) continue; // Skip reference section
          
          const inv = inventory.get(sectionId);
          if (!inv) continue;
          
          const currentProps = inv[propType];
          
          // Find properties in reference that are missing in current
          const missingProps: (NameAndRole | DateProperty | TermProperty)[] = [];
          
          for (const refProp of refProps) {
            const refValue = this.getPropertyValue(refProp, propType);
            const exists = currentProps.some(p => this.getPropertyValue(p, propType) === refValue);
            
            if (!exists) {
              missingProps.push(refProp);
            }
          }
          
          // Find edge weight for confidence
          const edge = graph.edges.find(
            e => e.prop === propType && 
                 ((e.from === refSection && e.to === sectionId) || 
                  (e.from === sectionId && e.to === refSection))
          );
          
          const confidence = edge?.weight || 0.75;
          
          if (missingProps.length > 0) {
            deltas.push({
              targetSection: sectionId,
              propType,
              missingValues: missingProps,
              sourceSection: refSection,
              confidence,
            });
          }
        }
      }
    }
    
    // FALLBACK: For edges not covered by clusters (e.g., section with no properties)
    // Find all edges and check if they create suggestions
    const processedPairs = new Set<string>();
    
    for (const edge of graph.edges) {
      const pairKey = `${edge.from}-${edge.to}-${edge.prop}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      
      const fromInv = inventory.get(edge.from);
      const toInv = inventory.get(edge.to);
      
      if (!fromInv || !toInv) continue;
      
      // If from has properties and to doesn't, suggest adding
      if (fromInv[edge.prop].length > 0 && toInv[edge.prop].length === 0) {
        const missingProps = fromInv[edge.prop];
        deltas.push({
          targetSection: edge.to,
          propType: edge.prop,
          missingValues: missingProps,
          sourceSection: edge.from,
          confidence: edge.weight,
        });
      }
      // If to has properties and from doesn't, suggest adding to from
      else if (toInv[edge.prop].length > 0 && fromInv[edge.prop].length === 0) {
        const missingProps = toInv[edge.prop];
        deltas.push({
          targetSection: edge.from,
          propType: edge.prop,
          missingValues: missingProps,
          sourceSection: edge.to,
          confidence: edge.weight,
        });
      }
    }
    
    return deltas;
  }

  /**
   * Get policy score for a section based on its type
   * Note: Scores are kept moderate (max 5) to ensure property count dominates with 70/30 weighting
   */
  private getSectionPolicyScore(
    section: { title: string; kind?: string },
    propType: 'Name&Role' | 'Date' | 'Terms'
  ): number {
    const title = section.title.toLowerCase();
    const kind = (section.kind || '').toLowerCase();
    
    if (propType === 'Name&Role') {
      // Any title that explicitly lists/designates officers is a good source
      if (title.includes('designated') || (title.includes('designation') && title.includes('officer'))) {
        return 4; // Designated officer lists are authoritative
      }
      if ((title.includes('designated') && title.includes('officer')) || 
          kind.includes('officer')) {
        return 5; // Explicit officer section
      }
      if (title.includes('officer') || title.includes('parties')) {
        return 4;
      }
      if (title.includes('signature')) {
        return 3;
      }
      return 2;
    }
    
    if (propType === 'Date') {
      if (title.includes('effective') || title.includes('term') || kind.includes('term')) {
        return 4;
      }
      return 2;
    }
    
    if (propType === 'Terms') {
      if (title.includes('term') || title.includes('fee') || title.includes('payment')) {
        return 4;
      }
      return 2;
    }
    
    return 2;
  }



  /**
   * Generate update suggestions from deltas
   */
  private generateUpdateSuggestions(
    deltas: Array<{
      targetSection: string;
      propType: 'Name&Role' | 'Date' | 'Terms';
      missingValues: (NameAndRole | DateProperty | TermProperty)[];
      sourceSection: string;
      confidence: number;
    }>,
    graph: SectionGraph
  ): SuggestedUpdate[] {
    const suggestions: SuggestedUpdate[] = [];
    
    for (const delta of deltas) {
      const targetSection = graph.nodes.find(n => n.id === delta.targetSection);
      const sourceSection = graph.nodes.find(n => n.id === delta.sourceSection);
      
      if (!targetSection || !sourceSection) continue;
      
      // Find anchor point in target section
      const anchor = this.findAnchor(targetSection, delta.propType);
      
      // The missingValues from delta are already the actual property objects
      // from the cluster computation, so we can use them directly
      const missingProps = delta.missingValues;
      
      if (missingProps.length === 0) continue;
      
      // Calculate confidence (combine edge weight with property confidence)
      const avgPropConfidence = missingProps.reduce((sum, p: any) => sum + (p.conf || 0.8), 0) / missingProps.length;
      const confidence = delta.confidence * 0.6 + avgPropConfidence * 0.4;
      
      suggestions.push({
        section: delta.targetSection,
        type: 'insert',
        prop: delta.propType,
        anchor: anchor.text,
        anchorStrategy: anchor.strategy,
        values: missingProps,
        confidence,
        evidenceFrom: {
          section: delta.sourceSection,
          spans: missingProps.map((p: any) => p.span),
        },
        rationale: this.generateRationale(delta, targetSection, sourceSection),
      });
    }
    
    return suggestions;
  }

  /**
   * Find anchor point for insertion in target section
   */
  private findAnchor(
    section: { title: string; content: string },
    propType: 'Name&Role' | 'Date' | 'Terms'
  ): { text: string; strategy: string } {
    const content = section.content;
    
    // Strategy 1: Find existing properties of same type (insert after last one)
    if (propType === 'Name&Role') {
      const rolePatterns = [
        /•\s+\w+/,
        /\d+\.\s+\w+/,
        /-\s+\w+/,
      ];
      
      for (const pattern of rolePatterns) {
        const matches = content.match(new RegExp(pattern, 'g'));
        if (matches && matches.length > 0) {
          return {
            text: matches[matches.length - 1],
            strategy: 'after_last_list_item',
          };
        }
      }
    }
    
    // Strategy 2: Find heading/title
    const lines = content.split('\n');
    if (lines.length > 0 && lines[0].trim().length > 0) {
      return {
        text: lines[0].trim(),
        strategy: 'after_heading',
      };
    }
    
    // Strategy 3: Default to beginning of content
    const firstSentence = content.split(/[.!?]/)[0];
    return {
      text: firstSentence || content.substring(0, 50),
      strategy: 'beginning_of_section',
    };
  }

  /**
   * Get property value as string for comparison
   */
  private getPropertyValue(prop: any, propType: string): string {
    if (propType === 'Name&Role') {
      return `${prop.role}: ${prop.person}`;
    } else if (propType === 'Date') {
      return prop.iso;
    } else if (propType === 'Terms') {
      return `${prop.name}: ${prop.value}${prop.unit ? ' ' + prop.unit : ''}`;
    }
    return '';
  }

  /**
   * Identify unchanged properties (high-confidence matches)
   */
  private identifyUnchangedProperties(
    graph: SectionGraph
  ): Array<{ prop: string; sections: string[]; value?: string }> {
    const unchanged: Array<{ prop: string; sections: string[]; value?: string }> = [];
    const seen = new Set<string>();
    
    // Find edges with high weight and full matches
    const highConfidenceEdges = graph.edges.filter(e => 
      e.weight > 0.85 && 
      e.evidence.matched.length > 0 &&
      e.evidence.missing.length === 0
    );
    
    for (const edge of highConfidenceEdges) {
      for (const match of edge.evidence.matched) {
        const key = `${edge.prop}:${match.value}`;
        if (!seen.has(key)) {
          unchanged.push({
            prop: edge.prop,
            sections: [edge.from, edge.to],
            value: match.value,
          });
          seen.add(key);
        }
      }
    }
    
    return unchanged;
  }

  /**
   * Generate rationale for authoritative section selection
   */
  private generateAuthRationale(
    sectionId: string,
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): string {
    const section = graph.nodes.find(n => n.id === sectionId);
    if (!section) return 'Selected as authoritative section';
    
    const inv = inventory?.get(sectionId);
    if (!inv) return `Section "${section.title}" selected as authoritative`;
    
    const nameRoleCount = inv['Name&Role'].length;
    const dateCount = inv.Date.length;
    const termsCount = inv.Terms.length;
    
    const counts = [
      nameRoleCount > 0 ? `${nameRoleCount} Name&Role` : null,
      dateCount > 0 ? `${dateCount} Dates` : null,
      termsCount > 0 ? `${termsCount} Terms` : null,
    ].filter(Boolean).join(', ');
    
    const title = section.title.toLowerCase();
    let typeReason = '';
    
    if (title.includes('designated') && title.includes('officer')) {
      typeReason = ' (designated officer section)';
    } else if (title.includes('officer')) {
      typeReason = ' (officer section)';
    }
    
    return `Section "${section.title}" has highest property count (${counts})${typeReason}`;
  }

  /**
   * Generate rationale for a specific suggestion
   */
  private generateRationale(
    delta: {
      targetSection: string;
      propType: string;
      missingValues: (NameAndRole | DateProperty | TermProperty)[];
      sourceSection: string;
    },
    targetSection: { title: string },
    sourceSection: { title: string }
  ): string {
    const count = delta.missingValues.length;
    const propType = delta.propType;
    
    return `Missing ${count} ${propType} propert${count === 1 ? 'y' : 'ies'} found in authoritative section "${sourceSection.title}"`;
  }
}
