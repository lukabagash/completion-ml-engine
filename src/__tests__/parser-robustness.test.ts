/**
 * Robustness tests to verify BasicPDFParser works with various document structures
 * Tests the parser against different numbering schemes and document layouts
 * NOT specific to the mock_legal_agreement.pdf
 */

import { BasicPDFParser } from '../parsers/BasicPDFParser';
import pdfParse from 'pdf-parse';

jest.mock('pdf-parse');

describe('BasicPDFParser - Robustness Tests', () => {
  const parser = new BasicPDFParser();

  describe('Decimal Numbering Detection', () => {
    it('should detect simple decimal numbered sections (1, 2, 3)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Introduction
This is the introduction section.

2 Methodology
This describes the methodology.

3 Results
These are the results.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections.length).toBeGreaterThan(0);
      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('Introduction'))).toBe(true);
      expect(titles.some(t => t.includes('Methodology'))).toBe(true);
      expect(titles.some(t => t.includes('Results'))).toBe(true);
    });

    it('should detect nested decimal sections (1.1, 1.2, 2.1)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Main Section
Content here.

1.1 Subsection A
More content.

1.2 Subsection B
Even more content.

2 Second Main Section
Another section.

2.1 Subsection of 2
Details here.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('1.1'))).toBe(true);
      expect(titles.some(t => t.includes('1.2'))).toBe(true);
      expect(titles.some(t => t.includes('2.1'))).toBe(true);
    });

    it('should handle deep nesting (1.1.1, 1.1.2)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Main
Content.

1.1 Sub
Content.

1.1.1 Deep Nested
Content here.

1.1.2 Another Deep
More content.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('1.1.1'))).toBe(true);
      expect(titles.some(t => t.includes('1.1.2'))).toBe(true);
    });
  });

  describe('Roman Numeral Detection', () => {
    it('should detect Roman numeral sections (I, II, III)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `I. Introduction
Introduction text.

II. Body
Body text.

III. Conclusion
Conclusion text.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.match(/^I\./i))).toBe(true);
      expect(titles.some(t => t.match(/^II\./i))).toBe(true);
      expect(titles.some(t => t.match(/^III\./i))).toBe(true);
    });

    it('should detect larger Roman numerals (IV, V, VI)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `IV. Fourth Section
Content.

V. Fifth Section
More content.

VI. Sixth Section
Even more.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('IV'))).toBe(true);
      expect(titles.some(t => t.includes('V'))).toBe(true);
      expect(titles.some(t => t.includes('VI'))).toBe(true);
    });
  });

  describe('Letter Numbering Detection', () => {
    it('should detect letter-numbered sections (A, B, C)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `A. First Option
Details about option A.

B. Second Option
Details about option B.

C. Third Option
Details about option C.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.match(/^A\./i))).toBe(true);
      expect(titles.some(t => t.match(/^B\./i))).toBe(true);
      expect(titles.some(t => t.match(/^C\./i))).toBe(true);
    });

    it('should detect lowercase letter sections (a, b, c)', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `a. First item
Item a content.

b. Second item
Item b content.

c. Third item
Item c content.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      // At least one should match letter pattern
      expect(
        titles.some(t => t.match(/^[a-z]\./i))
      ).toBe(true);
    });
  });

  describe('ALL CAPS Sections Detection', () => {
    it('should detect ALL CAPS section headers', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `INTRODUCTION
This is the introduction.

METHODOLOGY
This is the methodology.

FINDINGS
These are the findings.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('INTRODUCTION'))).toBe(true);
      expect(titles.some(t => t.includes('METHODOLOGY'))).toBe(true);
      expect(titles.some(t => t.includes('FINDINGS'))).toBe(true);
    });

    it('should not detect short all-caps strings as sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Introduction
This is content. USA is mentioned. OK, so the content continues.

2 Section Two
More content here.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      // Should not treat "USA" or "OK" as section headers
      const shortCapsSections = result.sections.filter(s => s.title.match(/^(USA|OK)$/));
      expect(shortCapsSections.length).toBe(0);
    });
  });

  describe('Section: X: Pattern Detection', () => {
    it('should detect "Section X:" headers', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `Section 1: Definitions
These are definitions.

Section 2: Parties
These are parties.

Section 3: Obligations
These are obligations.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const titles = result.sections.map(s => s.title);
      expect(titles.some(t => t.includes('Definitions'))).toBe(true);
      expect(titles.some(t => t.includes('Parties'))).toBe(true);
      expect(titles.some(t => t.includes('Obligations'))).toBe(true);
    });

    it('should handle "Section X:" with capital S or lowercase', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `section 1: first part
Content.

Section 2: Second Part
More content.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Mixed Numbering Schemes', () => {
    it('should handle documents with mixed numbering schemes', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `Section 1: Overview
Overview content.

1.1 Background
Background details.

1.2 Objectives
Objective details.

I. Main Requirements
Requirements here.

II. Secondary Requirements
More requirements.

A. Appendix A
Appendix content.

B. Appendix B
More appendix.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      // Should detect sections from all numbering schemes
      const titles = result.sections.map(s => s.title);
      expect(titles.length).toBeGreaterThan(4);
      expect(titles.some(t => t.includes('Overview'))).toBe(true);
      expect(titles.some(t => t.match(/^1\.1/))).toBe(true);
      expect(titles.some(t => t.match(/^I\./i))).toBe(true);
      expect(titles.some(t => t.match(/^A\./i))).toBe(true);
    });
  });

  describe('Signature Section Detection', () => {
    it('should detect signature sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Agreement
Agreement text.

2 Terms
Terms text.

SIGNATURES
In Witness Whereof:

By: John Doe
Title: CEO`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const signatureSections = result.sections.filter(s =>
        s.title.toLowerCase().includes('signature') ||
        s.kind === 'Signatures'
      );
      expect(signatureSections.length).toBeGreaterThan(0);
    });

    it('should detect "Executed as of" signature markers', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `Main Agreement Content

Executed as of January 1, 2025

By: Alpha Inc.
By: Beta Inc.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Section Classification', () => {
    it('should classify Definitions sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Definitions
"Agreement" means this document.
"Party" means either signatory.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const definitionSection = result.sections.find(s =>
        s.kind === 'Definitions' || s.title.toLowerCase().includes('definition')
      );
      expect(definitionSection).toBeDefined();
    });

    it('should classify Fees and Payment sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `3 Fees and Payment
The annual fee is $25,000.
Payment is due within 45 days.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const feeSection = result.sections.find(s =>
        s.kind === 'Fees and Payment' || s.title.toLowerCase().includes('fee')
      );
      expect(feeSection).toBeDefined();
    });

    it('should classify Officers sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Officers and Responsible Parties
The CEO is responsible for operations.
The CFO is responsible for finances.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const officerSection = result.sections.find(s =>
        s.kind === 'Officers' || s.title.toLowerCase().includes('officer')
      );
      expect(officerSection).toBeDefined();
    });

    it('should classify Services and Data sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `2 Services and Data Responsibilities
The Provider will maintain data security.
The Client will provide necessary data.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const serviceSection = result.sections.find(s =>
        s.kind === 'Services and Data'
      );
      expect(serviceSection).toBeDefined();
    });
  });

  describe('Content Extraction', () => {
    it('should extract section content correctly', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Introduction
This is the introduction content that spans multiple lines.
It contains important information about the document.
More details here.

2 Body
This is the body section.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      const introSection = result.sections.find(s => s.title.includes('Introduction'));
      expect(introSection).toBeDefined();
      expect(introSection?.content).toContain('introduction content');
      expect(introSection?.content).toContain('multiple lines');
    });

    it('should maintain proper section boundaries', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 First Section
First section content line 1
First section content line 2

2 Second Section
Second section content line 1
Second section content line 2`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections.length).toBeGreaterThan(0);
      result.sections.forEach(section => {
        expect(section.startOffset).toBeDefined();
        expect(section.endOffset).toBeDefined();
        expect(section.endOffset).toBeGreaterThanOrEqual(section.startOffset);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty documents', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: '',
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
    });

    it('should handle documents with no clear sections', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `This is just a blob of text with no clear section headers.
It goes on and on without any structure.
No numbers, no roman numerals, nothing.
Just plain text content.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      // Should still return sections (at least one for the whole document)
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('should ignore false positive headers', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Real Section
Content with numbers like 1.5 in the middle of text.
And references to item 2.3 are here but should not create sections.

2 Another Real Section
More content here.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      // Should not create sections for inline numbers
      const realSections = result.sections.filter(s => s.title.match(/^[12] /));
      expect(realSections.length).toBeLessThanOrEqual(2);
    });

    it('should handle very long section titles', async () => {
      const longTitle = 'A'.repeat(200);
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 ${longTitle}
Content here.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      // Should still parse (though very long lines might be ignored)
      expect(result.sections).toBeDefined();
    });

    it('should handle documents with many sections', async () => {
      let text = '';
      for (let i = 1; i <= 50; i++) {
        text += `${i} Section ${i}\nContent ${i}.\n\n`;
      }

      const mockPdfData = {
        numpages: 1,
        info: {},
        text,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await parser.parse(Buffer.from('dummy'));

      expect(result.sections.length).toBeGreaterThan(20);
    });
  });

  describe('Consistency Tests', () => {
    it('should consistently parse the same document structure', async () => {
      const mockPdfData = {
        numpages: 1,
        info: {},
        text: `1 Introduction
Introduction content.

2 Methods
Methods content.

3 Results
Results content.`,
      };

      (pdfParse as jest.Mock).mockResolvedValue(mockPdfData);

      const result1 = await parser.parse(Buffer.from('dummy1'));
      const result2 = await parser.parse(Buffer.from('dummy2'));

      expect(result1.sections.map(s => s.title)).toEqual(
        result2.sections.map(s => s.title)
      );
    });
  });
});
