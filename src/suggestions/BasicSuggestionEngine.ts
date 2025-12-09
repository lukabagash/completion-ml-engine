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
  Span,
} from '../types';

export class BasicSuggestionEngine implements ISuggestionEngine {
  
  async generateSuggestions(
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Promise<SuggestionsReport> {
    
    // Step 1: Find authoritative sections for each property type
    const authoritativeSections = this.findAuthoritativeSections(graph, inventory);
    
    // Step 2: Compute deltas (missing properties) from edges
    const deltas = this.computeDeltas(graph, authoritativeSections);
    
    // Step 3: Generate suggestions for missing properties
    const suggestedUpdates = this.generateUpdateSuggestions(deltas, graph, inventory);
    
    // Step 4: Identify unchanged properties (high-confidence matches)
    const unchanged = this.identifyUnchangedProperties(graph);
    
    // Step 5: Create final report
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
   * Find authoritative sections for each property type
   * Based on property count and section type (policy bonuses)
   */
  private findAuthoritativeSections(
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (!inventory) return result;
    
    // Find authoritative section for each property type
    const propertyTypes: Array<'Name&Role' | 'Date' | 'Terms'> = ['Name&Role', 'Date', 'Terms'];
    
    for (const propType of propertyTypes) {
      let bestSection: string | null = null;
      let bestScore = -1;
      
      for (const [sectionId, inv] of inventory) {
        const props = inv[propType];
        if (props.length === 0) continue;
        
        const section = graph.nodes.find(n => n.id === sectionId);
        if (!section) continue;
        
        // Score = property count + policy bonus
        const propertyCount = props.length;
        const policyScore = this.getSectionPolicyScore(section, propType);
        const score = propertyCount * 0.6 + policyScore * 0.4;
        
        if (score > bestScore) {
          bestScore = score;
          bestSection = sectionId;
        }
      }
      
      if (bestSection) {
        result[propType] = bestSection;
      }
    }
    
    return result;
  }

  /**
   * Get policy score for a section based on its type
   */
  private getSectionPolicyScore(
    section: { title: string; kind?: string },
    propType: 'Name&Role' | 'Date' | 'Terms'
  ): number {
    const title = section.title.toLowerCase();
    const kind = (section.kind || '').toLowerCase();
    
    if (propType === 'Name&Role') {
      if ((title.includes('designated') && title.includes('officer')) || 
          kind.includes('officer')) {
        return 10; // Highest priority for officer sections
      }
      if (title.includes('officer') || title.includes('parties')) {
        return 8;
      }
      if (title.includes('signature')) {
        return 6;
      }
      return 3;
    }
    
    if (propType === 'Date') {
      if (title.includes('effective') || title.includes('term') || kind.includes('term')) {
        return 8;
      }
      return 5;
    }
    
    if (propType === 'Terms') {
      if (title.includes('term') || title.includes('fee') || title.includes('payment')) {
        return 8;
      }
      return 5;
    }
    
    return 3;
  }

  /**
   * Compute deltas (missing properties) from graph edges
   */
  private computeDeltas(
    graph: SectionGraph,
    authoritativeSections: Record<string, string>
  ): Array<{
    targetSection: string;
    propType: 'Name&Role' | 'Date' | 'Terms';
    missingValues: any[];
    sourceSection: string;
    confidence: number;
  }> {
    const deltas: Array<{
      targetSection: string;
      propType: 'Name&Role' | 'Date' | 'Terms';
      missingValues: any[];
      sourceSection: string;
      confidence: number;
    }> = [];
    
    // For each authoritative section, find edges showing missing properties
    for (const [propType, authSectionId] of Object.entries(authoritativeSections)) {
      const propTyped = propType as 'Name&Role' | 'Date' | 'Terms';
      
      // Find edges from authoritative section
      const relevantEdges = graph.edges.filter(
        e => e.prop === propTyped && 
             (e.from === authSectionId || e.to === authSectionId)
      );
      
      for (const edge of relevantEdges) {
        // Find missing properties (properties in auth section but not in other section)
        const missingInTarget = edge.evidence.missing.filter(m => {
          const targetSectionId = edge.from === authSectionId ? edge.to : edge.from;
          return m.inSection === targetSectionId;
        });
        
        if (missingInTarget.length > 0) {
          const targetSectionId = edge.from === authSectionId ? edge.to : edge.from;
          
          deltas.push({
            targetSection: targetSectionId,
            propType: propTyped,
            missingValues: missingInTarget,
            sourceSection: authSectionId,
            confidence: edge.weight,
          });
        }
      }
    }
    
    return deltas;
  }

  /**
   * Generate update suggestions from deltas
   */
  private generateUpdateSuggestions(
    deltas: Array<{
      targetSection: string;
      propType: 'Name&Role' | 'Date' | 'Terms';
      missingValues: any[];
      sourceSection: string;
      confidence: number;
    }>,
    graph: SectionGraph,
    inventory?: Map<string, SectionInventory>
  ): SuggestedUpdate[] {
    const suggestions: SuggestedUpdate[] = [];
    
    for (const delta of deltas) {
      const targetSection = graph.nodes.find(n => n.id === delta.targetSection);
      const sourceSection = graph.nodes.find(n => n.id === delta.sourceSection);
      
      if (!targetSection || !sourceSection) continue;
      
      // Find anchor point in target section
      const anchor = this.findAnchor(targetSection, delta.propType, inventory);
      
      // Get source properties from inventory
      const sourceInv = inventory?.get(delta.sourceSection);
      const sourceProps = sourceInv?.[delta.propType] || [];
      
      // Filter to only missing properties
      const missingProps = sourceProps.filter(prop => {
        const propValue = this.getPropertyValue(prop, delta.propType);
        return delta.missingValues.some(m => m.value.includes(propValue));
      });
      
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
    propType: 'Name&Role' | 'Date' | 'Terms',
    inventory?: Map<string, SectionInventory>
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
      missingValues: any[];
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
