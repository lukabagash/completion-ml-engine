# Legal Document ML Engine

A TypeScript/Node.js engine for extracting and analyzing properties from legal documents. This package processes PDF files and identifies consistency issues across document sections.

## Features

- **PDF Parsing**: Extract text and sections from PDF documents
- **Property Extraction**: Identify Name&Role, Date, and Terms properties within sections
- **Graph Analysis**: Build section-property graphs to detect relationships
- **Consistency Checking**: Identify inconsistencies and suggest corrections
- **Extensible Architecture**: Plugin-based design for custom extractors and analyzers

## Installation

```bash
npm install completion-ml-engine
```

## Quick Start

```typescript
import { createEngine } from 'completion-ml-engine';
import * as fs from 'fs';

// Create engine with default configuration
const engine = createEngine();

// Load PDF file
const pdfBuffer = fs.readFileSync('path/to/document.pdf');

// Process the document
const result = await engine.process(pdfBuffer);

// Access results
console.log('Sections:', result.sections);
console.log('Property Inventory:', result.inventory);
console.log('Graph:', result.graph);
console.log('Suggestions:', result.suggestions);
```

## Output Format

The engine returns a complete analysis:

```typescript
{
  sections: Section[],           // Detected document sections
  inventory: DocumentInventory,  // Properties extracted per section
  graph: SectionGraph,          // Section-property relationship graph
  suggestions: SuggestionsReport // Consistency issues and fixes
}
```

### Example Output

```json
{
  "sections": [
    {
      "id": "section-1",
      "title": "DEFINITIONS",
      "startOffset": 0,
      "endOffset": 1500,
      "content": "..."
    }
  ],
  "inventory": {
    "section-1": {
      "Name&Role": [
        {
          "role": "CTO",
          "person": "John Doe",
          "span": { "start": 1012, "end": 1025 },
          "conf": 0.96
        }
      ],
      "Date": [
        {
          "iso": "2021-10-08",
          "surface": "10/08/2021",
          "span": { "start": 612, "end": 622 },
          "conf": 0.99
        }
      ],
      "Terms": []
    }
  }
}
```

## Configuration

Customize the engine behavior:

```typescript
import { createEngine, EngineConfig } from 'completion-ml-engine';

const config: EngineConfig = {
  confidenceThreshold: 0.85,
  enableNER: true,
  enableLLMAssist: false,
  policyRules: {
    authoritativeSections: ['Definitions', 'Cover Page'],
    requiredProperties: {
      'Definitions': ['Name&Role', 'Date'],
      'Terms and Termination': ['Terms']
    }
  }
};

const engine = createEngine(config);
```

## Architecture

The engine follows a modular pipeline:

1. **PDF Parser** → Extracts text and detects sections
2. **Property Extractor** → Identifies Name&Role, Date, and Terms
3. **Graph Builder** → Creates section-property relationship graph
4. **Suggestion Engine** → Detects inconsistencies and generates fixes

## Custom Implementations

Replace any component with your own implementation:

```typescript
import { 
  LegalDocEngine, 
  IPDFParser, 
  IPropertyExtractor,
  IGraphBuilder,
  ISuggestionEngine 
} from 'completion-ml-engine';

class CustomPDFParser implements IPDFParser {
  async parse(pdfBuffer: Buffer) {
    // Your implementation
  }
}

const engine = new LegalDocEngine(
  new CustomPDFParser(),
  new CustomPropertyExtractor(),
  new CustomGraphBuilder(),
  new CustomSuggestionEngine()
);
```

## Property Types

### Name&Role
Identifies persons with their roles (e.g., "CTO John Doe", "CFO Jane Smith")

### Date
Extracts dates in various formats and normalizes to ISO-8601

### Terms
Captures durations, renewal conditions, and numeric clauses

## Development Status

This is a skeleton implementation. The following areas need development:

- [ ] Advanced section detection (ToC parsing, numbering schemes)
- [ ] NER integration for Name&Role extraction
- [ ] BM25 indexing for anchor selection
- [ ] Delta computation for suggestions
- [ ] Policy-based authoritative section selection
- [ ] Comprehensive test suite
- [ ] LLM integration (optional)

## API Reference

See [API.md](./API.md) for complete API documentation.

## License

MIT

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.
