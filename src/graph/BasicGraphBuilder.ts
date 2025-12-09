/**
 * Basic Graph Builder Implementation
 * Constructs section-property graph with similarity metrics and policy bonuses
 * Phase 5: Graph Construction
 * 
 * Following the answer key logic:
 * - Compare sections pairwise for each property type
 * - Detect matches and missing properties
 * - Apply policy bonuses based on section types
 * - Build edges with weights and evidence
 */

import { IGraphBuilder } from './IGraphBuilder';
import {
  Section,
  SectionInventory,
  SectionGraph,
  GraphEdge,
  EdgeEvidence,
  NameAndRole,
  DateProperty,
  TermProperty,
} from '../types';

export class BasicGraphBuilder implements IGraphBuilder {
  
  async buildGraph(
    sections: Section[],
    inventory: Map<string, SectionInventory>
  ): Promise<SectionGraph> {
    const edges: GraphEdge[] = [];

    // Build edges for each property type
    // Compare each pair of sections that have the same property type
    
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const sectionA = sections[i];
        const sectionB = sections[j];
        const inventoryA = inventory.get(sectionA.id);
        const inventoryB = inventory.get(sectionB.id);

        if (!inventoryA || !inventoryB) continue;

        // Build Name&Role edges
        if (inventoryA['Name&Role'].length > 0 || inventoryB['Name&Role'].length > 0) {
          const nameRoleEdge = this.buildNameRoleEdge(sectionA, sectionB, inventoryA, inventoryB);
          if (nameRoleEdge) {
            edges.push(nameRoleEdge);
          }
        }

        // Build Date edges
        if (inventoryA.Date.length > 0 || inventoryB.Date.length > 0) {
          const dateEdge = this.buildDateEdge(sectionA, sectionB, inventoryA, inventoryB);
          if (dateEdge) {
            edges.push(dateEdge);
          }
        }

        // Build Terms edges
        if (inventoryA.Terms.length > 0 || inventoryB.Terms.length > 0) {
          const termsEdge = this.buildTermsEdge(sectionA, sectionB, inventoryA, inventoryB);
          if (termsEdge) {
            edges.push(termsEdge);
          }
        }
      }
    }

    return {
      nodes: sections,
      edges,
    };
  }

  /**
   * Build Name&Role edge between two sections
   * Implements canonical matching with role-strict comparison
   */
  private buildNameRoleEdge(
    sectionA: Section,
    sectionB: Section,
    inventoryA: SectionInventory,
    inventoryB: SectionInventory
  ): GraphEdge | null {
    const rolesA = inventoryA['Name&Role'];
    const rolesB = inventoryB['Name&Role'];

    // Calculate similarity and evidence
    const { matched, missingInB, missingInA } = this.compareNameRoles(rolesA, rolesB);
    
    // Calculate base similarity score
    const totalProperties = Math.max(rolesA.length, rolesB.length);
    if (totalProperties === 0) return null;
    
    const baseSimilarity = matched.length / totalProperties;
    
    // Apply policy bonus based on section types
    const policyBonus = this.calculatePolicyBonus(sectionA, sectionB, 'Name&Role');
    
    // Final weight combines similarity and policy
    const weight = baseSimilarity * 0.7 + policyBonus * 0.3;
    
    // Build evidence
    const evidence: EdgeEvidence = {
      matched: matched.map(m => ({
        property: 'Name&Role',
        value: `${m.role}: ${m.person}`,
        spans: [m.spanA, m.spanB],
      })),
      missing: [
        ...missingInB.map(m => ({
          property: 'Name&Role',
          value: `${m.role}: ${m.person}`,
          inSection: sectionB.id,
        })),
        ...missingInA.map(m => ({
          property: 'Name&Role',
          value: `${m.role}: ${m.person}`,
          inSection: sectionA.id,
        })),
      ],
    };

    return {
      from: sectionA.id,
      to: sectionB.id,
      prop: 'Name&Role',
      weight,
      evidence,
    };
  }

  /**
   * Compare Name&Role properties between two sections
   * Returns matched and missing properties
   */
  private compareNameRoles(
    rolesA: NameAndRole[],
    rolesB: NameAndRole[]
  ): {
    matched: Array<{ role: string; person: string; spanA: any; spanB: any }>;
    missingInB: NameAndRole[];
    missingInA: NameAndRole[];
  } {
    const matched: Array<{ role: string; person: string; spanA: any; spanB: any }> = [];
    const missingInB: NameAndRole[] = [];
    const missingInA: NameAndRole[] = [];

    const usedB = new Set<number>();

    // Find matches for each role in A
    for (const roleA of rolesA) {
      let foundMatch = false;
      
      for (let i = 0; i < rolesB.length; i++) {
        if (usedB.has(i)) continue;
        
        const roleB = rolesB[i];
        
        // Exact match: same role and person (case-insensitive, normalized)
        if (
          this.normalizeRole(roleA.role) === this.normalizeRole(roleB.role) &&
          this.normalizeName(roleA.person) === this.normalizeName(roleB.person)
        ) {
          matched.push({
            role: roleA.role,
            person: roleA.person,
            spanA: roleA.span,
            spanB: roleB.span,
          });
          usedB.add(i);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        missingInB.push(roleA);
      }
    }

    // Find roles in B that weren't matched
    for (let i = 0; i < rolesB.length; i++) {
      if (!usedB.has(i)) {
        missingInA.push(rolesB[i]);
      }
    }

    return { matched, missingInB, missingInA };
  }

  /**
   * Build Date edge between two sections
   */
  private buildDateEdge(
    sectionA: Section,
    sectionB: Section,
    inventoryA: SectionInventory,
    inventoryB: SectionInventory
  ): GraphEdge | null {
    const datesA = inventoryA.Date;
    const datesB = inventoryB.Date;

    const { matched, missingInB, missingInA } = this.compareDates(datesA, datesB);
    
    const totalProperties = Math.max(datesA.length, datesB.length);
    if (totalProperties === 0) return null;
    
    const baseSimilarity = matched.length / totalProperties;
    const policyBonus = this.calculatePolicyBonus(sectionA, sectionB, 'Date');
    const weight = baseSimilarity * 0.8 + policyBonus * 0.2;
    
    const evidence: EdgeEvidence = {
      matched: matched.map(m => ({
        property: 'Date',
        value: m.iso,
        spans: [m.spanA, m.spanB],
      })),
      missing: [
        ...missingInB.map(m => ({
          property: 'Date',
          value: m.iso,
          inSection: sectionB.id,
        })),
        ...missingInA.map(m => ({
          property: 'Date',
          value: m.iso,
          inSection: sectionA.id,
        })),
      ],
    };

    return {
      from: sectionA.id,
      to: sectionB.id,
      prop: 'Date',
      weight,
      evidence,
    };
  }

  /**
   * Compare Date properties
   */
  private compareDates(
    datesA: DateProperty[],
    datesB: DateProperty[]
  ): {
    matched: Array<{ iso: string; spanA: any; spanB: any }>;
    missingInB: DateProperty[];
    missingInA: DateProperty[];
  } {
    const matched: Array<{ iso: string; spanA: any; spanB: any }> = [];
    const missingInB: DateProperty[] = [];
    const missingInA: DateProperty[] = [];

    const usedB = new Set<number>();

    for (const dateA of datesA) {
      let foundMatch = false;
      
      for (let i = 0; i < datesB.length; i++) {
        if (usedB.has(i)) continue;
        
        const dateB = datesB[i];
        
        // Exact ISO date match
        if (dateA.iso === dateB.iso) {
          matched.push({
            iso: dateA.iso,
            spanA: dateA.span,
            spanB: dateB.span,
          });
          usedB.add(i);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        missingInB.push(dateA);
      }
    }

    for (let i = 0; i < datesB.length; i++) {
      if (!usedB.has(i)) {
        missingInA.push(datesB[i]);
      }
    }

    return { matched, missingInB, missingInA };
  }

  /**
   * Build Terms edge between two sections
   */
  private buildTermsEdge(
    sectionA: Section,
    sectionB: Section,
    inventoryA: SectionInventory,
    inventoryB: SectionInventory
  ): GraphEdge | null {
    const termsA = inventoryA.Terms;
    const termsB = inventoryB.Terms;

    const { matched, missingInB, missingInA } = this.compareTerms(termsA, termsB);
    
    const totalProperties = Math.max(termsA.length, termsB.length);
    if (totalProperties === 0) return null;
    
    const baseSimilarity = matched.length / totalProperties;
    const policyBonus = this.calculatePolicyBonus(sectionA, sectionB, 'Terms');
    const weight = baseSimilarity * 0.8 + policyBonus * 0.2;
    
    const evidence: EdgeEvidence = {
      matched: matched.map(m => ({
        property: 'Terms',
        value: `${m.name}: ${m.value}${m.unit ? ' ' + m.unit : ''}`,
        spans: [m.spanA, m.spanB],
      })),
      missing: [
        ...missingInB.map(m => ({
          property: 'Terms',
          value: `${m.name}: ${m.value}${m.unit ? ' ' + m.unit : ''}`,
          inSection: sectionB.id,
        })),
        ...missingInA.map(m => ({
          property: 'Terms',
          value: `${m.name}: ${m.value}${m.unit ? ' ' + m.unit : ''}`,
          inSection: sectionA.id,
        })),
      ],
    };

    return {
      from: sectionA.id,
      to: sectionB.id,
      prop: 'Terms',
      weight,
      evidence,
    };
  }

  /**
   * Compare Terms properties with unit normalization
   */
  private compareTerms(
    termsA: TermProperty[],
    termsB: TermProperty[]
  ): {
    matched: Array<{ name: string; value: any; unit?: string; spanA: any; spanB: any }>;
    missingInB: TermProperty[];
    missingInA: TermProperty[];
  } {
    const matched: Array<{ name: string; value: any; unit?: string; spanA: any; spanB: any }> = [];
    const missingInB: TermProperty[] = [];
    const missingInA: TermProperty[] = [];

    const usedB = new Set<number>();

    for (const termA of termsA) {
      let foundMatch = false;
      
      for (let i = 0; i < termsB.length; i++) {
        if (usedB.has(i)) continue;
        
        const termB = termsB[i];
        
        // Match if same name, value, and unit (with normalization)
        if (
          termA.name === termB.name &&
          termA.value === termB.value &&
          (termA.unit || '') === (termB.unit || '')
        ) {
          matched.push({
            name: termA.name,
            value: termA.value,
            unit: termA.unit,
            spanA: termA.span,
            spanB: termB.span,
          });
          usedB.add(i);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        missingInB.push(termA);
      }
    }

    for (let i = 0; i < termsB.length; i++) {
      if (!usedB.has(i)) {
        missingInA.push(termsB[i]);
      }
    }

    return { matched, missingInB, missingInA };
  }

  /**
   * Calculate policy bonus based on section types
   * Implements the answer key logic: Section 1.1 is authoritative for Name&Role
   */
  private calculatePolicyBonus(
    sectionA: Section,
    sectionB: Section,
    propType: 'Name&Role' | 'Date' | 'Terms'
  ): number {
    // Policy bonuses mainly apply to Name&Role (officer rosters)
    if (propType === 'Name&Role') {
      const titleA = sectionA.title.toLowerCase();
      const titleB = sectionB.title.toLowerCase();
      const kindA = (sectionA.kind || '').toLowerCase();
      const kindB = (sectionB.kind || '').toLowerCase();
      
      // Bonus for comparing officer-related sections
      const isOfficerSectionA = 
        titleA.includes('officer') || 
        titleA.includes('designated') ||
        kindA.includes('officer');
      
      const isOfficerSectionB = 
        titleB.includes('officer') || 
        titleB.includes('designated') ||
        kindB.includes('officer');
      
      if (isOfficerSectionA && isOfficerSectionB) {
        // High bonus if both are officer sections
        return 0.9;
      } else if (isOfficerSectionA || isOfficerSectionB) {
        // Medium bonus if one is an officer section
        return 0.6;
      }
      
      return 0.3;
    }
    
    // Dates get moderate bonus for term/signature sections
    if (propType === 'Date') {
      const titleA = sectionA.title.toLowerCase();
      const titleB = sectionB.title.toLowerCase();
      
      const isDateSectionA = titleA.includes('term') || titleA.includes('signature') || titleA.includes('effective');
      const isDateSectionB = titleB.includes('term') || titleB.includes('signature') || titleB.includes('effective');
      
      if (isDateSectionA && isDateSectionB) {
        return 0.7;
      } else if (isDateSectionA || isDateSectionB) {
        return 0.4;
      }
      
      return 0.2;
    }
    
    // Terms get moderate bonus for term/fee sections
    if (propType === 'Terms') {
      const titleA = sectionA.title.toLowerCase();
      const titleB = sectionB.title.toLowerCase();
      
      const isTermSectionA = titleA.includes('term') || titleA.includes('fee') || titleA.includes('payment');
      const isTermSectionB = titleB.includes('term') || titleB.includes('fee') || titleB.includes('payment');
      
      if (isTermSectionA && isTermSectionB) {
        return 0.7;
      } else if (isTermSectionA || isTermSectionB) {
        return 0.4;
      }
      
      return 0.2;
    }
    
    return 0.1;
  }

  /**
   * Normalize role for comparison (handle abbreviations, case)
   */
  private normalizeRole(role: string): string {
    const normalized = role.trim().toLowerCase();
    
    // Common mappings
    const roleMap: Record<string, string> = {
      'cto': 'chief technology officer',
      'cfo': 'chief financial officer',
      'ceo': 'chief executive officer',
      'coo': 'chief operating officer',
      'vp': 'vice president',
      'svp': 'senior vice president',
    };
    
    return roleMap[normalized] || normalized;
  }

  /**
   * Normalize name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:-]/g, '');
  }

  /**
   * Get edges involving a specific section
   */
  getEdgesForSection(graph: SectionGraph, sectionId: string): GraphEdge[] {
    return graph.edges.filter(
      edge => edge.from === sectionId || edge.to === sectionId
    );
  }

  /**
   * Find authoritative section for a property type
   * Based on highest number of properties and policy priority
   */
  findAuthoritativeSection(
    graph: SectionGraph,
    inventory: Map<string, SectionInventory>,
    propType: 'Name&Role' | 'Date' | 'Terms'
  ): string | null {
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

    return bestSection;
  }

  /**
   * Get policy score for a section based on its type
   */
  private getSectionPolicyScore(section: Section, propType: 'Name&Role' | 'Date' | 'Terms'): number {
    if (propType === 'Name&Role') {
      const title = section.title.toLowerCase();
      if (title.includes('designated') && title.includes('officer')) {
        return 10; // Section 1.1 - authoritative
      }
      if (title.includes('officer')) {
        return 8;
      }
      if (title.includes('signature')) {
        return 6;
      }
      return 3;
    }
    
    return 5; // Default moderate score
  }
}
