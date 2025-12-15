/**
 * Basic PDF Parser implementation using pdf-parse
 * Includes advanced section detection with heading hierarchy, numbering schemes, etc.
 */

import pdfParse from 'pdf-parse';
import { IPDFParser, PDFParserResult } from './IPDFParser';
import { Section } from '../types';

interface SectionMatch {
  title: string;
  level: number;
  type: 'decimal' | 'roman' | 'letter' | 'caps' | 'other' | 'emphasized';
  offset: number;
}

export class BasicPDFParser implements IPDFParser {
  private sectionPatterns = {
    // Decimal numbering: 1, 1.1, 1.1.1, etc.
    decimal: /^(\d+(?:\.\d+)*)\s+(.+)$/,
    // Section X: pattern (common in legal docs)
    sectionHeading: /^Section\s+(\d+):\s+(.+)$/i,
    // Roman numerals: I, II, III, etc.
    roman: /^([IVXLCDM]+)\.\s+(.+)$/,
    // Letter numbering: A, B, C or a, b, c
    letter: /^([A-Za-z])\.\s+(.+)$/,
    // ALL CAPS sections
    caps: /^([A-Z\s&]+)$/,
    // Mixed case with emphasis markers (typical legal docs)
    emphasized: /^(#{1,6})\s+(.+)$/,
  };

  private roleKeywords = [
    'officer',
    'director',
    'chief',
    'executive',
    'president',
    'vice',
    'secretary',
    'treasurer',
    'responsible',
    'authorized',
  ];

  async parse(pdfBuffer: Buffer): Promise<PDFParserResult> {
    const data = await pdfParse(pdfBuffer);

    // Extract sections with advanced detection
    const sections = this.extractSections(data.text);

    return {
      text: data.text,
      sections,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  }

  /**
   * Advanced section extraction with multiple detection strategies
   */
  private extractSections(text: string): Section[] {
    const lines = text.split('\n');
    const sectionMatches: SectionMatch[] = [];

    // Find all potential section headers
    let charOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const match = this.detectSectionHeader(trimmed);
      if (match) {
        sectionMatches.push({
          ...match,
          offset: charOffset,
        });
      }

      charOffset += line.length + 1; // +1 for newline
    }

    // Convert section matches to Section objects with content
    return this.buildSectionsFromMatches(text, sectionMatches);
  }

  /**
   * Detect if a line is a section header using multiple patterns
   */
  private detectSectionHeader(line: string): SectionMatch | null {
    if (!line || line.length === 0 || line.length > 300) return null;

    // Try "Section X:" pattern first
    const sectionHeadingMatch = line.match(this.sectionPatterns.sectionHeading);
    if (sectionHeadingMatch) {
      return {
        title: line,
        level: 0,
        type: 'decimal',
        offset: 0,
      };
    }

    // Try decimal numbering (1, 1.1, 1.1.1, etc.)
    const decimalMatch = line.match(this.sectionPatterns.decimal);
    if (decimalMatch && this.isValidDecimalHeader(decimalMatch[1])) {
      return {
        title: line,
        level: this.getDecimalLevel(decimalMatch[1]),
        type: 'decimal',
        offset: 0,
      };
    }

    // Try roman numerals
    const romanMatch = line.match(this.sectionPatterns.roman);
    if (romanMatch && this.isValidRoman(romanMatch[1])) {
      return {
        title: line,
        level: this.getRomanLevel(romanMatch[1]),
        type: 'roman',
        offset: 0,
      };
    }

    // Try letter numbering
    const letterMatch = line.match(this.sectionPatterns.letter);
    if (letterMatch && decimalMatch === null && romanMatch === null) {
      return {
        title: line,
        level: 1,
        type: 'letter',
        offset: 0,
      };
    }

    // Try ALL CAPS headers (common in legal documents)
    const capsMatch = line.match(this.sectionPatterns.caps);
    if (capsMatch && line.length > 5 && !line.includes('THE')) {
      return {
        title: line,
        level: 0,
        type: 'caps',
        offset: 0,
      };
    }

    // Check for signature section markers
    if (this.isSignatureMarker(line)) {
      return {
        title: 'Signatures',
        level: 0,
        type: 'other',
        offset: 0,
      };
    }

    // Check for emphasized headers (like subsections)
    if (this.isLikelySubsectionHeader(line)) {
      return {
        title: line,
        level: 2,
        type: 'emphasized',
        offset: 0,
      };
    }

    return null;
  }

  /**
   * Check if decimal numbering is valid (1, 1.1, 1.1.1 are valid; 1.1.1.1.1 might not be)
   */
  private isValidDecimalHeader(numPart: string): boolean {
    const parts = numPart.split('.');
    // Allow up to 4 levels deep (1.1.1.1)
    if (parts.length > 4) return false;
    // All parts must be numbers
    return parts.every(p => /^\d+$/.test(p));
  }

  /**
   * Get hierarchy level from decimal numbering
   */
  private getDecimalLevel(numPart: string): number {
    return numPart.split('.').length;
  }

  /**
   * Check if string is valid Roman numeral
   */
  private isValidRoman(roman: string): boolean {
    const romanPattern = /^[IVXLCDM]+$/;
    return romanPattern.test(roman);
  }

  /**
   * Get hierarchy level from Roman numeral
   */
  private getRomanLevel(roman: string): number {
    // Rough estimate based on length
    if (roman.length <= 3) return 1;
    if (roman.length <= 6) return 2;
    return 3;
  }

  /**
   * Detect likely subsection headers
   */
  private isLikelySubsectionHeader(line: string): boolean {
    const indicators = [
      /^(Effective Date|Signature|Executed|Dated)/i,
      /^(Contact|Address|Notice|Email)/i,
      /^(By|Signed|For|Authorized)/i,
      /^(\([\da-z]\))\s+/,
    ];

    return indicators.some(pattern => pattern.test(line));
  }

  /**
   * Detect signature section markers
   */
  private isSignatureMarker(line: string): boolean {
    const trimmed = line.trim();
    // Common signature section indicators
    const signaturePatterns = [
      /^signatures?$/i,
      /^in\s+witness\s+whereof/i,
      /^executed\s+as\s+of/i,
      /^signed\s+and\s+delivered/i,
      /^by\s+and\s+between/i,
    ];

    return signaturePatterns.some(pattern => pattern.test(trimmed)) && trimmed.length < 100;
  }

  /**
   * Build Section objects from detected headers
   */
  private buildSectionsFromMatches(text: string, matches: SectionMatch[]): Section[] {
    if (matches.length === 0) {
      // No sections detected, return entire document as one section
      return [
        {
          id: 'section-0',
          title: 'Document',
          startOffset: 0,
          endOffset: text.length,
          content: text,
          kind: 'document',
        },
      ];
    }

    const sections: Section[] = [];
    const lines = text.split('\n');
    let lineOffset = 0;
    const lineOffsets: number[] = [0];

    // Build line offset map for quick lookup
    for (const line of lines) {
      lineOffset += line.length + 1;
      lineOffsets.push(lineOffset);
    }

    // Create sections between matches
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];

      const startLine = this.findLineByOffset(lines, current.offset);
      const endLine = next ? this.findLineByOffset(lines, next.offset) : lines.length;

      const contentLines = lines.slice(startLine + 1, endLine);
      const content = contentLines.join('\n');

      // Determine section kind
      const kind = this.classifySectionType(current.title);

      sections.push({
        id: `section-${sections.length}`,
        title: current.title,
        startOffset: current.offset,
        endOffset: endLine < lines.length ? lineOffsets[endLine] : text.length,
        content,
        kind,
      });
    }

    return sections;
  }

  /**
   * Find line index by character offset
   */
  private findLineByOffset(lines: string[], offset: number): number {
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount > offset) return i;
    }
    return lines.length - 1;
  }

  /**
   * Classify section type (Definitions, Signatures, etc.)
   */
  private classifySectionType(title: string): string {
    const titleLower = title.toLowerCase();

    if (
      titleLower.includes('signature') ||
      titleLower.includes('executed') ||
      titleLower.includes('signed')
    ) {
      return 'Signatures';
    }

    if (titleLower.includes('definition')) {
      return 'Definitions';
    }

    if (titleLower.includes('term') && titleLower.includes('termination')) {
      return 'Terms and Termination';
    }

    if (titleLower.includes('officer') || titleLower.includes('responsible')) {
      return 'Officers';
    }

    if (titleLower.includes('fee') || titleLower.includes('payment')) {
      return 'Fees and Payment';
    }

    if (
      titleLower.includes('service') ||
      titleLower.includes('data') ||
      titleLower.includes('responsibility')
    ) {
      return 'Services and Data';
    }

    if (
      titleLower.includes('party') ||
      titleLower.includes('parties') ||
      titleLower.includes('agreement')
    ) {
      return 'Cover Page';
    }

    return 'Other';
  }
}
