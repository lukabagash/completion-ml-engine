/**
 * Tests for BasicPropertyExtractor
 * Phase 3: Property Extraction validation
 */

import { BasicPropertyExtractor } from '../extractors/BasicPropertyExtractor';
import { Section } from '../types';

describe('BasicPropertyExtractor', () => {
  let extractor: BasicPropertyExtractor;

  beforeEach(() => {
    extractor = new BasicPropertyExtractor();
  });

  describe('Name & Role Extraction', () => {
    test('should extract "Role Name" format (e.g., CTO John Doe)', async () => {
      const section: Section = {
        id: 'test-1',
        title: 'Officers',
        startOffset: 0,
        endOffset: 100,
        content: 'The officers are CTO John Doe and CFO Mark Miller.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role']).toHaveLength(2);
      
      const cto = result['Name&Role'].find(r => r.role.includes('Technology'));
      expect(cto).toBeDefined();
      expect(cto?.person).toBe('John Doe');
      expect(cto?.conf).toBeGreaterThan(0.8);
      
      const cfo = result['Name&Role'].find(r => r.role.includes('Financial'));
      expect(cfo).toBeDefined();
      expect(cfo?.person).toBe('Mark Miller');
    });

    test('should extract "Name, Role" format', async () => {
      const section: Section = {
        id: 'test-2',
        title: 'Parties',
        startOffset: 0,
        endOffset: 100,
        content: 'Signed by John Doe, CTO and Mary Smith, CEO.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(2);
      
      const cto = result['Name&Role'].find(r => r.person === 'John Doe');
      expect(cto).toBeDefined();
      expect(cto?.role).toContain('Technology');
    });

    test('should extract Associate role', async () => {
      const section: Section = {
        id: 'test-3',
        title: 'Staff',
        startOffset: 0,
        endOffset: 100,
        content: 'Reporting to Associate Brian Brown.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(1);
      
      const associate = result['Name&Role'].find(r => r.role === 'Associate');
      expect(associate).toBeDefined();
      expect(associate?.person).toBe('Brian Brown');
    });

    test('should handle "By: Name" with nearby role', async () => {
      const section: Section = {
        id: 'test-4',
        title: 'Signatures',
        startOffset: 0,
        endOffset: 200,
        content: 'By: John Doe\nTitle: Chief Technology Officer\n\nBy: Mark Miller\nTitle: CFO',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(2);
    });

    test('should normalize role abbreviations', async () => {
      const section: Section = {
        id: 'test-5',
        title: 'Officers',
        startOffset: 0,
        endOffset: 100,
        content: 'VP Alice Johnson and SVP Bob Smith.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(2);
      
      const vp = result['Name&Role'].find(r => r.person === 'Alice Johnson');
      expect(vp?.role).toContain('Vice President');
    });

    test('should deduplicate same person-role pairs', async () => {
      const section: Section = {
        id: 'test-6',
        title: 'Officers',
        startOffset: 0,
        endOffset: 200,
        content: 'CTO John Doe signed the agreement. The CTO John Doe also approved the terms.',
      };

      const result = await extractor.extract(section);
      const ctoCount = result['Name&Role'].filter(r => 
        r.person === 'John Doe' && r.role.includes('Technology')
      ).length;
      
      expect(ctoCount).toBe(1);
    });

    test('should handle names with middle initials', async () => {
      const section: Section = {
        id: 'test-7',
        title: 'Officers',
        startOffset: 0,
        endOffset: 100,
        content: 'CEO John Q. Public leads the company.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(1);
      
      const ceo = result['Name&Role'].find(r => r.role.includes('Executive'));
      expect(ceo?.person).toMatch(/John.*Public/);
    });
  });

  describe('Date Extraction', () => {
    test('should extract MM/DD/YYYY format', async () => {
      const section: Section = {
        id: 'test-8',
        title: 'Effective Date',
        startOffset: 0,
        endOffset: 100,
        content: 'This agreement is effective as of 01/01/2025.',
      };

      const result = await extractor.extract(section);
      expect(result.Date).toHaveLength(1);
      expect(result.Date[0].iso).toBe('2025-01-01');
      expect(result.Date[0].surface).toBe('01/01/2025');
      expect(result.Date[0].conf).toBeGreaterThan(0.9);
    });

    test('should extract "Month Day, Year" format', async () => {
      const section: Section = {
        id: 'test-9',
        title: 'Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'Executed on January 1, 2025 by both parties.',
      };

      const result = await extractor.extract(section);
      expect(result.Date).toHaveLength(1);
      expect(result.Date[0].iso).toBe('2025-01-01');
      expect(result.Date[0].surface).toBe('January 1, 2025');
    });

    test('should extract abbreviated month names', async () => {
      const section: Section = {
        id: 'test-10',
        title: 'Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'Signed on Jan 15, 2025 and effective Feb 1, 2025.',
      };

      const result = await extractor.extract(section);
      expect(result.Date.length).toBeGreaterThanOrEqual(2);
      
      const jan = result.Date.find(d => d.iso === '2025-01-15');
      const feb = result.Date.find(d => d.iso === '2025-02-01');
      
      expect(jan).toBeDefined();
      expect(feb).toBeDefined();
    });

    test('should extract ISO format dates', async () => {
      const section: Section = {
        id: 'test-11',
        title: 'Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'The deadline is 2025-12-31.',
      };

      const result = await extractor.extract(section);
      expect(result.Date).toHaveLength(1);
      expect(result.Date[0].iso).toBe('2025-12-31');
    });

    test('should validate date ranges', async () => {
      const section: Section = {
        id: 'test-12',
        title: 'Invalid Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'Invalid dates: 13/32/2025 and 02/30/2025.',
      };

      const result = await extractor.extract(section);
      expect(result.Date).toHaveLength(0);
    });

    test('should handle leap years correctly', async () => {
      const section: Section = {
        id: 'test-13',
        title: 'Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'Leap year date: February 29, 2024 is valid.',
      };

      const result = await extractor.extract(section);
      expect(result.Date).toHaveLength(1);
      expect(result.Date[0].iso).toBe('2024-02-29');
    });

    test('should deduplicate same dates in different formats', async () => {
      const section: Section = {
        id: 'test-14',
        title: 'Dates',
        startOffset: 0,
        endOffset: 100,
        content: 'The date 01/01/2025 is also written as January 1, 2025.',
      };

      const result = await extractor.extract(section);
      // Should deduplicate to 1 date since both represent 2025-01-01
      expect(result.Date.length).toBe(1);
      expect(result.Date[0].iso).toBe('2025-01-01');
    });
  });

  describe('Terms Extraction', () => {
    test('should extract duration with word numbers', async () => {
      const section: Section = {
        id: 'test-15',
        title: 'Term',
        startOffset: 0,
        endOffset: 200,
        content: 'The initial term shall be twenty four (24) months.',
      };

      const result = await extractor.extract(section);
      const duration = result.Terms.find(t => t.value === 24);
      
      expect(duration).toBeDefined();
      expect(duration?.unit).toBe('month');
      expect(duration?.qualifiers).toContain('twenty four');
      expect(duration?.conf).toBeGreaterThan(0.9);
    });

    test('should extract simple durations', async () => {
      const section: Section = {
        id: 'test-16',
        title: 'Terms',
        startOffset: 0,
        endOffset: 200,
        content: 'Renewal period is 12 months. Notice must be given 60 days in advance.',
      };

      const result = await extractor.extract(section);
      expect(result.Terms.length).toBeGreaterThanOrEqual(2);
      
      const renewal = result.Terms.find(t => t.value === 12);
      const notice = result.Terms.find(t => t.value === 60);
      
      expect(renewal?.unit).toBe('month');
      expect(notice?.unit).toBe('day');
    });

    test('should extract monetary amounts with currency', async () => {
      const section: Section = {
        id: 'test-17',
        title: 'Fees',
        startOffset: 0,
        endOffset: 200,
        content: 'The annual fee is $25,000 USD payable within 45 days.',
      };

      const result = await extractor.extract(section);
      
      const fee = result.Terms.find(t => t.value === 25000);
      expect(fee).toBeDefined();
      expect(fee?.unit).toBe('USD');
      expect(fee?.name).toContain('fee');
      
      const payment = result.Terms.find(t => t.value === 45);
      expect(payment?.unit).toBe('day');
    });

    test('should extract labeled terms', async () => {
      const section: Section = {
        id: 'test-18',
        title: 'Terms',
        startOffset: 0,
        endOffset: 200,
        content: 'Initial Term: 24 months. Renewal Term: 12 months.',
      };

      const result = await extractor.extract(section);
      
      const initial = result.Terms.find(t => t.name === 'initial_term');
      const renewal = result.Terms.find(t => t.name === 'renewal_term');
      
      expect(initial?.value).toBe(24);
      expect(renewal?.value).toBe(12);
    });

    test('should extract percentages', async () => {
      const section: Section = {
        id: 'test-19',
        title: 'Rates',
        startOffset: 0,
        endOffset: 200,
        content: 'Interest rate is 5% per annum. Tax rate is 8.5 percent.',
      };

      const result = await extractor.extract(section);
      
      const interest = result.Terms.find(t => t.value === 5);
      const tax = result.Terms.find(t => t.value === 8.5);
      
      expect(interest?.unit).toBe('%');
      expect(tax?.unit).toBe('%');
    });

    test('should extract contextual durations with qualifiers', async () => {
      const section: Section = {
        id: 'test-20',
        title: 'Conditions',
        startOffset: 0,
        endOffset: 200,
        content: 'Payment must be made within 30 days. Notice of at least 60 days is required.',
      };

      const result = await extractor.extract(section);
      
      const within = result.Terms.find(t => t.qualifiers?.includes('within'));
      const atLeast = result.Terms.find(t => t.qualifiers?.includes('at least'));
      
      expect(within?.value).toBe(30);
      expect(atLeast?.value).toBe(60);
    });

    test('should normalize time units', async () => {
      const section: Section = {
        id: 'test-21',
        title: 'Terms',
        startOffset: 0,
        endOffset: 200,
        content: '1 month, 2 months, 1 year, 3 years, 1 day, 5 days.',
      };

      const result = await extractor.extract(section);
      
      // All should be normalized to singular
      result.Terms.forEach(term => {
        expect(['month', 'year', 'day']).toContain(term.unit);
      });
    });

    test('should handle multiple currencies', async () => {
      const section: Section = {
        id: 'test-22',
        title: 'Payments',
        startOffset: 0,
        endOffset: 200,
        content: 'Fee is $1,000 USD or 900 EUR or 750 GBP.',
      };

      const result = await extractor.extract(section);
      
      const usd = result.Terms.find(t => t.unit === 'USD');
      const eur = result.Terms.find(t => t.unit === 'EUR');
      const gbp = result.Terms.find(t => t.unit === 'GBP');
      
      expect(usd?.value).toBe(1000);
      expect(eur?.value).toBe(900);
      expect(gbp?.value).toBe(750);
    });
  });

  describe('Integration with Mock Agreement', () => {
    test('should extract all expected properties from mock agreement section 1', async () => {
      const section: Section = {
        id: 'section-1',
        title: 'Section 1: The Parties',
        startOffset: 0,
        endOffset: 500,
        content: `
          Section 1: The Parties
          
          This Agreement is entered into on January 1, 2025, by and between:
          
          Alpha Analytics, Inc., represented by CTO John Doe, CFO Mark Miller, and Associate Brian Brown.
          
          Beta Manufacturing, LLC.
        `,
      };

      const result = await extractor.extract(section);
      
      // Should extract 3 officers
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(3);
      
      const officers = result['Name&Role'].map(r => r.person);
      expect(officers).toContain('John Doe');
      expect(officers).toContain('Mark Miller');
      expect(officers).toContain('Brian Brown');
      
      // Should extract date
      expect(result.Date.length).toBeGreaterThanOrEqual(1);
      expect(result.Date[0].iso).toBe('2025-01-01');
    });

    test('should extract terms from mock agreement section 2', async () => {
      const section: Section = {
        id: 'section-2',
        title: 'Section 2: Term and Renewal',
        startOffset: 500,
        endOffset: 1000,
        content: `
          Section 2: Term and Renewal
          
          The initial term of this Agreement shall be twenty four (24) months.
          The Agreement may be renewed for successive periods of twelve (12) months.
          Either party may terminate by providing sixty (60) days written notice.
        `,
      };

      const result = await extractor.extract(section);
      
      // Should extract 24 months, 12 months, and 60 days
      const values = result.Terms.map(t => t.value);
      expect(values).toContain(24);
      expect(values).toContain(12);
      expect(values).toContain(60);
    });

    test('should extract fees from mock agreement section 4', async () => {
      const section: Section = {
        id: 'section-4',
        title: 'Section 4: Fees and Payment',
        startOffset: 2000,
        endOffset: 2500,
        content: `
          Section 4: Fees and Payment
          
          The annual fee shall be $25,000 USD.
          Payment is due within forty five (45) days of invoice date.
          Failure to pay within sixty (60) days may result in suspension.
        `,
      };

      const result = await extractor.extract(section);
      
      // Should extract fee amount
      const fee = result.Terms.find(t => t.value === 25000);
      expect(fee).toBeDefined();
      expect(fee?.unit).toBe('USD');
      
      // Should extract payment terms
      const payment = result.Terms.find(t => t.value === 45);
      const suspension = result.Terms.find(t => t.value === 60);
      
      expect(payment).toBeDefined();
      expect(suspension).toBeDefined();
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle empty content gracefully', async () => {
      const section: Section = {
        id: 'empty',
        title: 'Empty',
        startOffset: 0,
        endOffset: 0,
        content: '',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role']).toHaveLength(0);
      expect(result.Date).toHaveLength(0);
      expect(result.Terms).toHaveLength(0);
    });

    test('should handle content with no extractable properties', async () => {
      const section: Section = {
        id: 'no-props',
        title: 'Generic',
        startOffset: 0,
        endOffset: 100,
        content: 'This is a generic paragraph with no specific properties.',
      };

      const result = await extractor.extract(section);
      expect(result['Name&Role']).toHaveLength(0);
      expect(result.Date).toHaveLength(0);
      expect(result.Terms).toHaveLength(0);
    });

    test('should not extract false positives from acronyms', async () => {
      const section: Section = {
        id: 'acronyms',
        title: 'About',
        startOffset: 0,
        endOffset: 100,
        content: 'The USA and NATO organizations work together.',
      };

      const result = await extractor.extract(section);
      // Should not extract "USA" or "NATO" as roles
      expect(result['Name&Role']).toHaveLength(0);
    });

    test('should handle Unicode and special characters in names', async () => {
      const section: Section = {
        id: 'unicode',
        title: 'Officers',
        startOffset: 0,
        endOffset: 100,
        content: 'CEO José García and CFO François Müller.',
      };

      const result = await extractor.extract(section);
      // Should still extract despite special characters
      expect(result['Name&Role'].length).toBeGreaterThanOrEqual(2);
    });

    test('should extract from multiple sections', async () => {
      const sections: Section[] = [
        {
          id: 's1',
          title: 'Section 1',
          startOffset: 0,
          endOffset: 100,
          content: 'CTO John Doe signed on 01/01/2025.',
        },
        {
          id: 's2',
          title: 'Section 2',
          startOffset: 100,
          endOffset: 200,
          content: 'Term is 24 months with a fee of $25,000.',
        },
      ];

      const result = await extractor.extractAll(sections);
      
      expect(result.size).toBe(2);
      expect(result.get('s1')?.['Name&Role'].length).toBeGreaterThanOrEqual(1);
      expect(result.get('s1')?.Date.length).toBeGreaterThanOrEqual(1);
      expect(result.get('s2')?.Terms.length).toBeGreaterThanOrEqual(2);
    });
  });
});
