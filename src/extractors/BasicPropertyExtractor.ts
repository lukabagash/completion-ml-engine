/**
 * Basic Property Extractor implementation
 * Uses regex patterns and NER-like techniques for property extraction
 * Phase 3: Complete implementation with Name&Role, Date, and Terms extraction
 */

import { IPropertyExtractor } from './IPropertyExtractor';
import { Section, SectionInventory, NameAndRole, DateProperty, TermProperty } from '../types';

export class BasicPropertyExtractor implements IPropertyExtractor {
  private confidenceThreshold: number;

  // Comprehensive role lexicon
  private readonly roleLexicon: string[] = [
    // C-level executives
    'CEO', 'Chief Executive Officer',
    'CTO', 'Chief Technology Officer',
    'CFO', 'Chief Financial Officer',
    'COO', 'Chief Operating Officer',
    'CMO', 'Chief Marketing Officer',
    'CIO', 'Chief Information Officer',
    'CISO', 'Chief Information Security Officer',
    'CPO', 'Chief Product Officer',
    'CLO', 'Chief Legal Officer',
    'General Counsel',
    
    // Senior positions
    'President', 'Vice President', 'VP',
    'Senior Vice President', 'SVP',
    'Executive Vice President', 'EVP',
    'Managing Director',
    'Partner', 'Senior Partner',
    
    // Directors and Managers
    'Director', 'Senior Director',
    'Manager', 'Senior Manager',
    'Program Manager', 'Project Manager',
    'Product Manager',
    
    // Associates and Staff
    'Associate', 'Senior Associate',
    'Analyst', 'Senior Analyst',
    'Consultant', 'Senior Consultant',
    'Engineer', 'Senior Engineer',
    'Developer', 'Senior Developer',
    'Architect', 'Principal Architect',
    
    // Legal and specialized
    'Attorney', 'Counsel', 'Of Counsel',
    'Secretary', 'Treasurer',
    'Controller', 'Comptroller',
    'Officer', 'Authorized Representative',
    'Signatory', 'Agent',
  ];

  // Month name to number mapping
  private readonly monthMap: Record<string, number> = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sept': 9, 'sep': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
  };

  // Number word to digit mapping for terms
  private readonly numberWords: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
  };

  constructor(confidenceThreshold: number = 0.85) {
    this.confidenceThreshold = confidenceThreshold;
  }

  async extract(section: Section): Promise<SectionInventory> {
    const nameAndRoles = this.extractNameAndRole(section);
    const dates = this.extractDates(section);
    const terms = this.extractTerms(section);

    return {
      'Name&Role': nameAndRoles,
      Date: dates,
      Terms: terms,
    };
  }

  async extractAll(sections: Section[]): Promise<Map<string, SectionInventory>> {
    const inventory = new Map<string, SectionInventory>();

    for (const section of sections) {
      const sectionInventory = await this.extract(section);
      inventory.set(section.id, sectionInventory);
    }

    return inventory;
  }

  /**
   * Extract Name & Role properties from section
   * Implements NER-like pattern matching with role lexicon
   * Handles various name formats and role variations
   */
  private extractNameAndRole(section: Section): NameAndRole[] {
    const results: NameAndRole[] = [];
    const content = section.content;
    const seen = new Set<string>(); // Deduplicate

    // Build role pattern from lexicon
    const rolePattern = this.roleLexicon.join('|').replace(/\s+/g, '\\s+');
    const namePatternStrict = `[A-Z][\\w.À-ÿ'-]+(?:\\s+(?:[A-Z]\\.\\s*)?[A-Z][\\w.À-ÿ'-]+){0,2}`;
    const stopLookahead = `(?=\\s+(?:and|or)\\b|[,.;]|$|\\s+[a-z])`;
    
    // Pattern 1: "Role Name" format (e.g., "CTO John Doe")
    const pattern1 = new RegExp(
      `\\b(${rolePattern})\\s+(${namePatternStrict})${stopLookahead}`,
      'g'
    );
    
    // Pattern 2: "Name, Role" format (e.g., "John Doe, CTO")
    const pattern2 = new RegExp(
      `(?:^|[\\s,;.])(?!By|And|Or|The|At|In|On|For|With|From|To)\\s*(${namePatternStrict}),\\s*(${rolePattern})${stopLookahead}`,
      'g'
    );
    
    // Pattern 3: "Name - Role" or "Name – Role" format
    const pattern3 = new RegExp(
      `(?:^|[\\s,;.])(?!By|And|Or|The|At|In|On|For|With|From|To)\\s*(${namePatternStrict})\\s*[-–—]\\s*(${rolePattern})${stopLookahead}`,
      'g'
    );
    
    // Pattern 4: "Title: Role" format (e.g., "Title: Chief Technology Officer")
    const pattern4 = new RegExp(
      `Title:\\s*(${rolePattern})`,
      'g'
    );
    
    // Pattern 5: "By: Name" with nearby role context
    const pattern5 = new RegExp(`By:\\s+(${namePatternStrict})`, 'g');

    // Extract using Pattern 1: Role Name
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const role = this.normalizeRole(match[1]);
      const rawPerson = match[2];
      if (this.hasLowercaseToken(rawPerson)) continue;
      const person = this.normalizeName(rawPerson);
      const key = `${role}:${person}`;
      if (!this.isCapitalizedName(person)) continue;
      
      if (!seen.has(key)) {
        seen.add(key);
        const start = section.startOffset + match.index;
        results.push({
          role,
          person,
          span: {
            start,
            end: start + match[0].length,
          },
          conf: 0.92,
        });
      }
    }

    // Extract using Pattern 2: Name, Role
    while ((match = pattern2.exec(content)) !== null) {
      const rawPerson = match[1];
      if (this.hasLowercaseToken(rawPerson)) continue;
      const person = this.normalizeName(rawPerson);
      const role = this.normalizeRole(match[2]);
      const key = `${role}:${person}`;
      if (!this.isCapitalizedName(person)) continue;
      
      if (!seen.has(key)) {
        seen.add(key);
        const start = section.startOffset + match.index;
        results.push({
          role,
          person,
          span: {
            start,
            end: start + match[0].length,
          },
          conf: 0.90,
        });
      }
    }

    // Extract using Pattern 3: Name - Role
    while ((match = pattern3.exec(content)) !== null) {
      const rawPerson = match[1];
      if (this.hasLowercaseToken(rawPerson)) continue;
      const person = this.normalizeName(rawPerson);
      const role = this.normalizeRole(match[2]);
      const key = `${role}:${person}`;
      if (!this.isCapitalizedName(person)) continue;
      
      if (!seen.has(key)) {
        seen.add(key);
        const start = section.startOffset + match.index;
        results.push({
          role,
          person,
          span: {
            start,
            end: start + match[0].length,
          },
          conf: 0.88,
        });
      }
    }

    // Extract using Pattern 4: Title: Role (then look for nearby name)
    while ((match = pattern4.exec(content)) !== null) {
      const role = this.normalizeRole(match[1]);
      const start = section.startOffset + match.index;
      
      // Look for name in the context (within 100 chars before)
      const contextStart = Math.max(0, match.index - 100);
      const context = content.substring(contextStart, match.index);
      const nameMatch = context.match(new RegExp(`(${namePatternStrict})\\s*$`));
      
      if (nameMatch) {
        const rawPerson = nameMatch[1];
        if (this.hasLowercaseToken(rawPerson)) continue;
        const person = this.normalizeName(rawPerson);
        const key = `${role}:${person}`;
        if (!this.isCapitalizedName(person)) continue;
        
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            role,
            person,
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.85,
          });
        }
      }
    }

    // Extract using Pattern 5: By: Name (look for role in context)
    while ((match = pattern5.exec(content)) !== null) {
      const rawPerson = match[1];
      if (this.hasLowercaseToken(rawPerson)) continue;
      const person = this.normalizeName(rawPerson);
      const start = section.startOffset + match.index;
      if (!this.isCapitalizedName(person)) continue;
      
      // Look for role in context (within 150 chars after)
      const contextEnd = Math.min(content.length, match.index + match[0].length + 150);
      const context = content.substring(match.index + match[0].length, contextEnd);
      
      const roleRegex = new RegExp(`\\b(${rolePattern})\\b`, 'i');
      const roleMatch = context.match(roleRegex);
      
      if (roleMatch) {
        const role = this.normalizeRole(roleMatch[1]);
        const key = `${role}:${person}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            role,
            person,
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.80,
          });
        }
      }
    }

    return results;
  }

  /**
   * Extract Date properties from section
   * Handles multiple date formats and normalizes to ISO-8601
   */
  private extractDates(section: Section): DateProperty[] {
    const results: DateProperty[] = [];
    const content = section.content;
    const seen = new Set<string>(); // Deduplicate by ISO date

    // Pattern 1: MM/DD/YYYY or M/D/YYYY
    const pattern1 = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    
    // Pattern 2: YYYY-MM-DD (ISO format)
    const pattern2 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    
    // Pattern 3: Month Day, Year (e.g., "January 1, 2025" or "Jan 1, 2025")
    const pattern3 = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;
    
    // Pattern 4: Day Month Year (e.g., "1 January 2025")
    const pattern4 = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})\b/gi;
    
    // Pattern 5: Month Day Year (no comma, e.g., "January 1 2025")
    const pattern5 = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})\s+(\d{4})\b/gi;

    // Extract Pattern 1: MM/DD/YYYY
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      if (this.isValidDate(year, month, day)) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (!seen.has(iso)) {
          seen.add(iso);
          const start = section.startOffset + match.index;
          results.push({
            iso,
            surface: match[0],
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.95,
          });
        }
      }
    }

    // Extract Pattern 2: YYYY-MM-DD (ISO)
    while ((match = pattern2.exec(content)) !== null) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      
      if (this.isValidDate(year, month, day)) {
        const iso = match[0];
        
        if (!seen.has(iso)) {
          seen.add(iso);
          const start = section.startOffset + match.index;
          results.push({
            iso,
            surface: match[0],
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.98,
          });
        }
      }
    }

    // Extract Pattern 3: Month Day, Year
    while ((match = pattern3.exec(content)) !== null) {
      const monthName = match[1].toLowerCase();
      const month = this.monthMap[monthName];
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      if (month && this.isValidDate(year, month, day)) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (!seen.has(iso)) {
          seen.add(iso);
          const start = section.startOffset + match.index;
          results.push({
            iso,
            surface: match[0],
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.96,
          });
        }
      }
    }

    // Extract Pattern 4: Day Month Year
    while ((match = pattern4.exec(content)) !== null) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const month = this.monthMap[monthName];
      const year = parseInt(match[3], 10);
      
      if (month && this.isValidDate(year, month, day)) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (!seen.has(iso)) {
          seen.add(iso);
          const start = section.startOffset + match.index;
          results.push({
            iso,
            surface: match[0],
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.94,
          });
        }
      }
    }

    // Extract Pattern 5: Month Day Year (no comma)
    while ((match = pattern5.exec(content)) !== null) {
      const monthName = match[1].toLowerCase();
      const month = this.monthMap[monthName];
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      if (month && this.isValidDate(year, month, day)) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (!seen.has(iso)) {
          seen.add(iso);
          const start = section.startOffset + match.index;
          results.push({
            iso,
            surface: match[0],
            span: {
              start,
              end: start + match[0].length,
            },
            conf: 0.93,
          });
        }
      }
    }

    return results;
  }

  /**
   * Extract Term properties from section
   * Handles duration terms, monetary amounts, and numeric clauses
   * Includes unit normalization and number word parsing
   */
  private extractTerms(section: Section): TermProperty[] {
    const results: TermProperty[] = [];
    const content = section.content;

    // Pattern 1: Duration with word numbers (e.g., "twenty four (24) months")
    const pattern1 = /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s*(?:one|two|three|four|five|six|seven|eight|nine))?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))\s*\((\d+)\)\s*(day|days|month|months|year|years)\b/gi;
    
    // Pattern 2: Simple duration (e.g., "24 months", "60 days")
    const pattern2 = /\b(\d+)(?:\s*|-)(day|days|month|months|year|years)\b/gi;
    
    // Pattern 3: Monetary amounts (e.g., "$25,000", "25,000 USD")
    const pattern3 = /\$\s*([\d,]+(?:\.\d{2})?)|(\d[\d,]*(?:\.\d{2})?)\s*(USD|EUR|GBP|dollars?|euros?)/gi;
    
    // Pattern 4: Term with label (e.g., "Initial Term: 24 months")
    const pattern4 = /\b(Initial Term|Term|Renewal Term|Renewal Period|Notice Period|Payment Terms?|Payment Period):\s*([^.\n]{1,100})/gi;
    
    // Pattern 5: Percentage (e.g., "15%", "15 percent")
    const pattern5 = /(\d+(?:\.\d+)?)\s*(%|percent)/gi;
    
    // Pattern 6: General numeric clauses with context
    const pattern6 = /\b(?:within|after|at least|minimum|maximum|up to|no more than|no less than)\s+(\d+)\s+(day|days|month|months|year|years|business days?|calendar days?)\b/gi;

    // Extract Pattern 1: Duration with word numbers
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const wordNumber = match[1].trim();
      const digitNumber = parseInt(match[2], 10);
      const unit = this.normalizeUnit(match[3]);
      const start = section.startOffset + match.index;
      
      results.push({
        name: 'duration',
        value: digitNumber,
        unit,
        qualifiers: `word_form: ${wordNumber}`,
        span: {
          start,
          end: start + match[0].length,
        },
        conf: 0.96,
      });
    }

    // Extract Pattern 2: Simple duration
    while ((match = pattern2.exec(content)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = this.normalizeUnit(match[2]);
      const start = section.startOffset + match.index;
      
      // Look for context to determine term type
      const contextStart = Math.max(0, match.index - 50);
      const context = content.substring(contextStart, match.index).toLowerCase();
      
      let termName = 'duration';
      if (context.includes('term')) termName = 'term';
      else if (context.includes('renewal')) termName = 'renewal';
      else if (context.includes('notice')) termName = 'notice_period';
      else if (context.includes('payment')) termName = 'payment_period';
      
      results.push({
        name: termName,
        value,
        unit,
        span: {
          start,
          end: start + match[0].length,
        },
        conf: 0.90,
      });
    }

    // Extract Pattern 3: Monetary amounts
    while ((match = pattern3.exec(content)) !== null) {
      const amountStr = match[1] || match[2];
      const currency = match[3] ? this.normalizeCurrency(match[3]) : 'USD';
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      const start = section.startOffset + match.index;
      
      // Look for context
      const contextStart = Math.max(0, match.index - 60);
      const context = content.substring(contextStart, match.index).toLowerCase();
      
      let termName = 'amount';
      if (context.includes('fee')) termName = 'fee';
      else if (context.includes('payment')) termName = 'payment';
      else if (context.includes('price')) termName = 'price';
      else if (context.includes('cost')) termName = 'cost';
      else if (context.includes('penalty')) termName = 'penalty';
      
      results.push({
        name: termName,
        value: amount,
        unit: currency,
        span: {
          start,
          end: start + match[0].length,
        },
        conf: 0.94,
      });
    }

    // Extract Pattern 4: Labeled terms
    while ((match = pattern4.exec(content)) !== null) {
      const label = match[1];
      const valueText = match[2].trim();
      const start = section.startOffset + match.index;
      
      // Try to extract structured value from the text
      const durationMatch = valueText.match(/(\d+)\s*(day|days|month|months|year|years)/i);
      
      if (durationMatch) {
        const value = parseInt(durationMatch[1], 10);
        const unit = this.normalizeUnit(durationMatch[2]);
        
        results.push({
          name: label.toLowerCase().replace(/\s+/g, '_'),
          value,
          unit,
          qualifiers: valueText,
          span: {
            start,
            end: start + match[0].length,
          },
          conf: 0.92,
        });
      } else {
        // Store as string value if no structured extraction
        results.push({
          name: label.toLowerCase().replace(/\s+/g, '_'),
          value: valueText,
          span: {
            start,
            end: start + match[0].length,
          },
          conf: 0.85,
        });
      }
    }

    // Extract Pattern 5: Percentages
    while ((match = pattern5.exec(content)) !== null) {
      const value = parseFloat(match[1]);
      const start = section.startOffset + match.index;
      
      // Look for context
      const contextStart = Math.max(0, match.index - 50);
      const context = content.substring(contextStart, match.index).toLowerCase();
      
      let termName = 'percentage';
      if (context.includes('interest')) termName = 'interest_rate';
      else if (context.includes('discount')) termName = 'discount';
      else if (context.includes('tax')) termName = 'tax_rate';
      else if (context.includes('fee')) termName = 'fee_percentage';
      
      results.push({
        name: termName,
        value,
        unit: '%',
        span: {
          start,
          end: start + match[0].length,
        },
        conf: 0.93,
      });
    }

    // Extract Pattern 6: Contextual numeric clauses
    while ((match = pattern6.exec(content)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = this.normalizeUnit(match[2]);
      const start = section.startOffset + match.index;
      
      // Get the qualifier (within, after, etc.)
      const fullMatch = match[0];
      const qualifierMatch = fullMatch.match(/^(within|after|at least|minimum|maximum|up to|no more than|no less than)/i);
      const qualifier = qualifierMatch ? qualifierMatch[1].toLowerCase() : '';
      
      results.push({
        name: 'conditional_duration',
        value,
        unit,
        qualifiers: qualifier,
        span: {
          start,
          end: start + match[0].length,
        },
        conf: 0.88,
      });
    }

    return results;
  }

  /**
   * Helper Methods
   */

  /**
   * Normalize role to canonical form
   */
  private normalizeRole(role: string): string {
    const normalized = role.trim();
    
    // Map common abbreviations to full forms
    const roleMap: Record<string, string> = {
      'CTO': 'Chief Technology Officer',
      'CFO': 'Chief Financial Officer',
      'CEO': 'Chief Executive Officer',
      'COO': 'Chief Operating Officer',
      'CMO': 'Chief Marketing Officer',
      'CIO': 'Chief Information Officer',
      'VP': 'Vice President',
      'SVP': 'Senior Vice President',
      'EVP': 'Executive Vice President',
    };
    
    return roleMap[normalized.toUpperCase()] || normalized;
  }

  /**
   * Normalize person name (capitalize properly, remove extra spaces)
   */
  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/[.,;:]+$/, '')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(part => {
        // Handle initials (e.g., "J.")
        if (part.length <= 2 && part.includes('.')) {
          return part.toUpperCase();
        }
        // Capitalize first letter, lowercase rest
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Ensure every token in the name starts with an uppercase letter
   */
  private isCapitalizedName(name: string): boolean {
    const tokens = name.trim().split(/\s+/);
    return tokens.every(tok => /^[A-ZÀ-Ý]/.test(tok[0] || ''));
  }

  /**
   * Check if any token starts with lowercase (used to drop trailing verbs)
   */
  private hasLowercaseToken(name: string): boolean {
    return name.trim().split(/\s+/).some(tok => /^[a-z]/.test(tok[0] || ''));
  }

  /**
   * Validate date components
   */
  private isValidDate(year: number, month: number, day: number): boolean {
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    // Check month-specific day limits
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Leap year check
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (month === 2 && isLeap) {
      return day <= 29;
    }
    
    return day <= daysInMonth[month - 1];
  }

  /**
   * Normalize time unit to singular form
   */
  private normalizeUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      'day': 'day',
      'days': 'day',
      'month': 'month',
      'months': 'month',
      'year': 'year',
      'years': 'year',
      'business day': 'business_day',
      'business days': 'business_day',
      'calendar day': 'calendar_day',
      'calendar days': 'calendar_day',
    };
    
    return unitMap[unit.toLowerCase()] || unit.toLowerCase();
  }

  /**
   * Normalize currency code
   */
  private normalizeCurrency(currency: string): string {
    const currencyMap: Record<string, string> = {
      'dollar': 'USD',
      'dollars': 'USD',
      'usd': 'USD',
      'euro': 'EUR',
      'euros': 'EUR',
      'eur': 'EUR',
      'gbp': 'GBP',
      'pound': 'GBP',
      'pounds': 'GBP',
    };
    
    return currencyMap[currency.toLowerCase()] || currency.toUpperCase();
  }

  /**
   * Parse number words to digits
   */
  private parseNumberWord(word: string): number | null {
    const lower = word.toLowerCase().trim();
    
    // Direct lookup
    if (this.numberWords[lower] !== undefined) {
      return this.numberWords[lower];
    }
    
    // Handle compound numbers like "twenty four"
    const parts = lower.split(/\s+/);
    if (parts.length === 2) {
      const tens = this.numberWords[parts[0]];
      const ones = this.numberWords[parts[1]];
      if (tens !== undefined && ones !== undefined) {
        return tens + ones;
      }
    }
    
    return null;
  }
}
