# Project Structure

```
completion-ml-engine/
├── src/
│   ├── types/
│   │   └── index.ts              # Type definitions
│   ├── parsers/
│   │   ├── IPDFParser.ts         # PDF parser interface
│   │   └── BasicPDFParser.ts     # Basic implementation
│   ├── extractors/
│   │   ├── IPropertyExtractor.ts # Property extractor interface
│   │   └── BasicPropertyExtractor.ts
│   ├── graph/
│   │   ├── IGraphBuilder.ts      # Graph builder interface
│   │   └── BasicGraphBuilder.ts  # Basic implementation
│   ├── suggestions/
│   │   ├── ISuggestionEngine.ts  # Suggestion engine interface
│   │   └── BasicSuggestionEngine.ts
│   ├── __tests__/
│   │   └── engine.test.ts        # Tests
│   ├── engine.ts                 # Main engine class
│   └── index.ts                  # Public API exports
├── examples/
│   ├── basic-usage.ts            # Basic usage example
│   └── custom-implementation.ts  # Custom component example
├── dist/                         # Compiled output (gitignored)
├── node_modules/                 # Dependencies (gitignored)
├── package.json                  # NPM package configuration
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest test configuration
├── .eslintrc.json                # ESLint configuration
├── .gitignore                    # Git ignore rules
├── README.md                     # Main documentation
├── TODO.md                       # Development roadmap
├── LICENSE                       # MIT license
└── STRUCTURE.md                  # This file
```

## Module Organization

### Core Modules

**types/** - Type definitions and interfaces
- Defines all data structures used throughout the engine
- Property types (Name&Role, Date, Terms)
- Section and graph structures
- Configuration types

**parsers/** - PDF parsing and section detection
- Interface: `IPDFParser`
- Extracts text and structure from PDFs
- Detects document sections
- Provides metadata

**extractors/** - Property extraction from sections
- Interface: `IPropertyExtractor`
- Identifies Name&Role properties
- Extracts dates in various formats
- Finds terms and conditions
- Returns confidence scores

**graph/** - Section-property graph construction
- Interface: `IGraphBuilder`
- Builds nodes (sections) and edges (shared properties)
- Calculates similarity weights
- Tracks evidence for relationships

**suggestions/** - Consistency analysis and recommendations
- Interface: `ISuggestionEngine`
- Analyzes graph for inconsistencies
- Generates update suggestions
- Provides rationales and confidence scores

**engine.ts** - Main orchestrator
- Coordinates all pipeline steps
- Manages configuration
- Provides simple API for processing documents

### Testing
- Unit tests in `__tests__/`
- Test coverage for all components
- Mock data for consistent testing

### Examples
- Demonstrate basic usage
- Show custom implementation patterns
- Provide integration examples

## Design Principles

1. **Interface-based**: All major components implement interfaces for easy substitution
2. **Modular**: Each module has a single responsibility
3. **Extensible**: Users can provide custom implementations
4. **Type-safe**: Full TypeScript typing throughout
5. **Testable**: Dependency injection enables easy mocking

## Data Flow

```
PDF Buffer
    ↓
[PDF Parser]
    ↓
Sections
    ↓
[Property Extractor]
    ↓
Property Inventory (per section)
    ↓
[Graph Builder]
    ↓
Section-Property Graph
    ↓
[Suggestion Engine]
    ↓
Suggestions & Analysis
```

## Adding New Components

To add a new property type:
1. Define types in `src/types/index.ts`
2. Update `IPropertyExtractor` interface
3. Implement extraction logic in your extractor
4. Update graph builder to handle new property
5. Extend suggestion engine for new property type
