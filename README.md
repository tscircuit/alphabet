# Alphabet SVG Path Library

A TypeScript library that provides SVG path data and line segments for rendering letters, numbers and basic symbols. Each character is normalized to fit within a 1x1 unit square.

## Features

- SVG path data for letters A-Z, **lowercase a-z**, numbers 0-9, and common symbols
- Includes punctuation characters such as `:`, `!`, and `?`
- Normalized coordinates (all paths fit in [0,1] x [0,1] bounds)
- Line segment representation for each character
- Support for basic punctuation and mathematical symbols

## Installation

To install dependencies:

```bash
bun install
```

## Usage

The library exports two main objects:

- `svgAlphabet`: Raw SVG path data for each character
- `lineAlphabet`: Pre-processed line segments for each character, with coordinates normalized to [0,1]

```typescript
import { svgAlphabet, lineAlphabet } from '@tscircuit/alphabet'

// Get SVG path data for 'A'
const aPath = svgAlphabet['A']

// Get line segments for 'A'
const aLines = lineAlphabet['A'] // Array of {x1,y1,x2,y2} coordinates
```

## Development

To run the project:

```bash
bun run index.ts
```

This project uses [Bun](https://bun.sh) as its JavaScript/TypeScript runtime.
