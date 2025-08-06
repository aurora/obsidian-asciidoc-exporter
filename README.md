# Obsidian Vault AsciiDoc Exporter

Export your entire Obsidian vault as AsciiDoc with preserved structure and diagrams.

## Features

### 🚀 Complete Vault Export
- Exports all Markdown files as AsciiDoc (.adoc)
- Preserves your vault's folder structure exactly
- Exports outside the vault directory to prevent conflicts

### 📊 Diagram Preservation
- **Mermaid**: Keeps diagrams in original code block format
- **Excalidraw**: Preserves hand-drawn diagrams as code blocks
- **All Diagram Types**: Maintains original format for best compatibility
- **No Rendering**: Diagrams stay as code blocks for maximum flexibility

### 🎯 AsciiDoc Features
- Document headers with table of contents
- Proper heading hierarchy conversion
- Code blocks with syntax highlighting
- Image references with alt text
- Cross-references between documents
- Table formatting conversion
- Emphasis and strong text conversion
- Lists and blockquotes conversion

### 📎 Asset Management
- Copies all images and attachments
- Maintains original file structure
- Preserves relative paths
- Supports all file types

## Installation

1. Download the latest release
2. Extract to your `.obsidian/plugins/obsidian-vault-exporter/` folder
3. Enable the plugin in Obsidian settings

## Usage

### Quick Start
1. Click the export icon in the ribbon
2. Or use the command "Export Vault as AsciiDoc" (Ctrl+P)
3. Configure export settings
4. Click "Export Vault"

### Export Settings
- **Export Path**: Target folder for AsciiDoc files (created outside vault)
- **Include Attachments**: Copies images and other files
- **Keep Diagrams as Code Blocks**: Preserves diagrams in original format (recommended)

## AsciiDoc Output

The exported files use comprehensive AsciiDoc syntax:

### Document Structure
```asciidoc
= Document Title
:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:
:source-highlighter: highlight.js

== Main Heading
=== Sub Heading
```

### Code Blocks
```asciidoc
[source,mermaid]
----
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
----
```

### Images
```asciidoc
image::path/to/image.png[Alt text]
```

### Links
```asciidoc
link:other-document.adoc[Link Text]
```

### Tables
```asciidoc
[cols="1,1,1"]
|===
|*Header 1* |*Header 2* |*Header 3*
|Cell 1 |Cell 2 |Cell 3
|Cell 4 |Cell 5 |Cell 6
|===
```

## Why AsciiDoc?

- **Powerful**: More features than Markdown
- **Standardized**: Well-defined specification
- **Toolchain**: Excellent conversion tools (Asciidoctor)
- **Publishing**: Direct conversion to PDF, HTML, EPUB
- **Documentation**: Industry standard for technical documentation

## Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.