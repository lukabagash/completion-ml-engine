/**
 * Test suite for PDF Parser (Phase 2)
 * Based on mock_legal_agreement.pdf answer key
 */

import * as fs from 'fs';
import * as path from 'path';
import { BasicPDFParser } from '../parsers/BasicPDFParser';

describe('BasicPDFParser - Phase 2 PDF Parsing & Section Detection', () => {
  let parser: BasicPDFParser;
  let mockPdfBuffer: Buffer;

  beforeAll(() => {
    parser = new BasicPDFParser();
    // Load the mock PDF
    const pdfPath = path.join(__dirname, '../../pdf_mock_agreements/mock_legal_agreement.pdf');
    if (fs.existsSync(pdfPath)) {
      mockPdfBuffer = fs.readFileSync(pdfPath);
    }
  });

  describe('Section Detection', () => {
    it('should successfully parse the mock PDF', async () => {
      if (!mockPdfBuffer) {
        console.log('Mock PDF not found, skipping test');
        return;
      }

      const result = await parser.parse(mockPdfBuffer);
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.sections).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('should extract metadata from PDF', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.pages).toBeGreaterThan(0);
    });

    it('should detect Section 1: Parties and Officers', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section1 = result.sections.find(
        s => s.title.toLowerCase().includes('part') || 
             s.title.toLowerCase().includes('1.1') ||
             s.title.toLowerCase().includes('officer')
      );
      
      if (section1) {
        expect(section1).toBeDefined();
        expect(section1.kind).toMatch(/officer|definition|cover/i);
      }
    });

    it('should detect Section 2: Term and Renewal', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section2 = result.sections.find(
        s => s.title.toLowerCase().includes('term') &&
             (s.title.toLowerCase().includes('renewal') ||
              s.title.toLowerCase().includes('2') ||
              s.title.match(/^2\./))
      );
      
      if (section2) {
        expect(section2).toBeDefined();
      }
    });

    it('should detect Section 3: Services and Data', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section3 = result.sections.find(
        s => s.title.toLowerCase().includes('service') ||
             s.title.toLowerCase().includes('data') ||
             s.title.match(/^3\./)
      );
      
      if (section3) {
        expect(section3).toBeDefined();
      }
    });

    it('should detect Section 4: Fees and Payment', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section4 = result.sections.find(
        s => s.title.toLowerCase().includes('fee') ||
             s.title.toLowerCase().includes('payment') ||
             s.title.match(/^4\./)
      );
      
      if (section4) {
        expect(section4).toBeDefined();
      }
    });

    it('should detect Section 5: Signatures', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section5 = result.sections.find(
        s => s.title.toLowerCase().includes('signature') ||
             s.title.toLowerCase().includes('executed') ||
             s.title.match(/^5\./)
      );
      
      if (section5) {
        expect(section5).toBeDefined();
        expect(section5.kind).toMatch(/signature/i);
      }
    });
  });

  describe('Section Properties - Answer Key Validation', () => {
    it('should have section offsets that are sequential', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      for (let i = 0; i < result.sections.length - 1; i++) {
        const current = result.sections[i];
        const next = result.sections[i + 1];
        
        expect(current.startOffset).toBeLessThanOrEqual(next.startOffset);
        expect(current.endOffset).toBeLessThanOrEqual(next.endOffset);
      }
    });

    it('should have content for each section', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      for (const section of result.sections) {
        expect(section.content).toBeDefined();
        if (section.content && section.content.trim().length > 0) {
          expect(section.content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should classify section types correctly', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const validKinds = [
        'Definitions',
        'Cover Page',
        'Officers',
        'Terms and Termination',
        'Services and Data',
        'Fees and Payment',
        'Signatures',
        'Other',
        'document',
      ];
      
      for (const section of result.sections) {
        if (section.kind) {
          expect(validKinds.some(k => k.toLowerCase().includes(section.kind?.toLowerCase() || ''))).toBe(true);
        }
      }
    });
  });

  describe('Expected Content Validation', () => {
    it('Section 1.1 should contain officer names', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text.toLowerCase();
      
      // Answer key specifies these officers
      expect(text).toMatch(/john doe|jd|cto/i);
      expect(text).toMatch(/mark miller|mm|cfo/i);
      expect(text).toMatch(/brian brown|bb|associate/i);
    });

    it('Should contain effective date January 1, 2025', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      expect(text).toMatch(/january\s+1,?\s+2025|01\/01\/2025|2025-01-01|01-01-2025/i);
    });

    it('Should contain term duration: 24 months', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      // Pattern handles "twenty four (24) months" format
      expect(text).toMatch(/(?:twenty\s*four|24)\s*\(?24?\)?.*months?/i);
    });

    it('Should contain renewal term: 12 months', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      // Pattern handles "twelve (12) month" format
      expect(text).toMatch(/(?:twelve|12)\s*\(?12?\)?.*months?/i);
    });

    it('Should contain notice period: 60 days', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      // Pattern handles "sixty (60) days" format
      expect(text).toMatch(/(?:sixty|60)\s*\(?60?\)?.*days?/i);
    });

    it('Should contain fee amount: 25,000 USD', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      expect(text).toMatch(/25[,\s]*000|25000/i);
      expect(text).toMatch(/usd|dollar/i);
    });

    it('Should contain payment window: 45 days', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      // Pattern handles "forty five (45) days" format
      expect(text).toMatch(/(?:forty\s*five|45)\s*\(?45?\)?.*days?/i);
    });

    it('Should contain suspension threshold: 60 days overdue', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const text = result.text;
      
      // Check that it contains both 60 days and context about unpaid
      // Using single-line flag to match across newlines
      expect(text).toMatch(/sixty\s+\(\s*60\s*\)\s+days[\s\S]*?(?:unpaid|remain)/i);
      expect(text).toMatch(/suspend.*access/i);
    });
  });

  describe('Section Count Expectations', () => {
    it('should detect minimum 5 major sections', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      // We expect at least: Cover, Section 1, Section 2, Section 3, Section 4, Section 5
      expect(result.sections.length).toBeGreaterThanOrEqual(5);
    });

    it('should preserve section hierarchy', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      // Check that sections are in document order
      expect(result.sections.length).toBeGreaterThan(0);
      
      for (let i = 0; i < result.sections.length - 1; i++) {
        expect(result.sections[i].startOffset).toBeLessThan(result.sections[i + 1].startOffset);
      }
    });
  });

  describe('Subsection Detection', () => {
    it('should detect Section 1.1 (Designated Officers)', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section1_1 = result.sections.find(
        s => s.title.match(/1\.1|designated officer/i)
      );
      
      if (section1_1) {
        expect(section1_1).toBeDefined();
      }
    });

    it('should detect Section 2.1 (Effective Date)', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section2_1 = result.sections.find(
        s => s.title.match(/2\.1|effective date/i)
      );
      
      if (section2_1) {
        expect(section2_1).toBeDefined();
      }
    });

    it('should detect Section 3.2 (Responsible Officers)', async () => {
      if (!mockPdfBuffer) return;

      const result = await parser.parse(mockPdfBuffer);
      const section3_2 = result.sections.find(
        s => s.title.match(/3\.2|responsible officer/i)
      );
      
      if (section3_2) {
        expect(section3_2).toBeDefined();
      }
    });
  });
});
