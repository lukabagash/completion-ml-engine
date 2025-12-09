/**
 * PDF Parser Interface
 * Responsible for extracting raw text and structure from PDF files
 */

import { Buffer } from 'buffer';
import { Section } from '../types';

export interface PDFParserResult {
  text: string;
  sections: Section[];
  metadata?: {
    pages: number;
    title?: string;
    author?: string;
  };
}

export interface IPDFParser {
  /**
   * Parse a PDF file and extract text and sections
   * @param pdfBuffer - Buffer containing the PDF file
   * @returns Parsed document structure
   */
  parse(pdfBuffer: Buffer): Promise<PDFParserResult>;
}
