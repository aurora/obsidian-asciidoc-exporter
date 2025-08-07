# Obsidian Vault AsciiDoc Exporter

![AI Generated](https://img.shields.io/badge/AI%20Generated-Yes-blue)
> Model: Claude Sonnet-4 (2025-05-14) via Roo

Export your entire Obsidian vault as AsciiDoc with preserved structure and diagrams.

## Features

### 🚀 Complete Vault Export
- Exports all Markdown files as AsciiDoc (.adoc)
- Preserves your vault's folder structure exactly
- Exports outside the vault directory to prevent conflicts

### 🔗 Obsidian-Specific Features
- **Wikilinks**: `[[Note]]` → `xref:note.adoc[]`
- **Tags**: `#tag` → `[.tag]#tag#`
- **Callouts**: `> [!note]` → `[NOTE]` admonitions
- **Embeds**: `![[file]]` → `include::file[]` or `image::file[]`
- **Block References**: `^block-id` → `[[block-id]]` anchors
- **Frontmatter**: YAML → AsciiDoc document attributes
- **Math**: `$formula$` → `latexmath:[formula]`

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

### 🆕 HTTP REST API
- **Remote Export Triggering**: Trigger exports via HTTP requests
- **TAR Stream Download**: Receive exports as downloadable TAR archives
- **Configurable Server**: Customizable host/IP and port settings
- **Multiple Endpoints**: Support for GET and POST requests with parameters
- **CORS Support**: Cross-origin requests for web applications

## Installation

1. Download the latest release
2. Extract to your `.obsidian/plugins/obsidian-vault-exporter/` folder
3. Enable the plugin in Obsidian settings

## Usage

### Manual Export
1. Click the export icon in the ribbon
2. Or use the command "Export Vault as AsciiDoc" (Ctrl+P)
3. Configure export settings
4. Click "Export Vault"

### HTTP REST API Export

The plugin provides a built-in HTTP server for remote export triggering:

1. **Enable HTTP Server**: Go to plugin settings and enable the HTTP server
2. **Configure Server**: Set host/IP (default: localhost) and port (default: 8080)
3. **Use API Endpoints**: Make HTTP requests to trigger exports

**Quick API Examples:**
```bash
# Health check
curl http://localhost:8080/health

# Simple export
curl -o vault-export.tar "http://localhost:8080/export"

# Export with parameters
curl -o vault-export.tar "http://localhost:8080/export?includeAttachments=true&renderDiagrams=false"

# POST request with JSON
curl -X POST -H "Content-Type: application/json" \
  -d '{"exportPath":"my-vault","includeAttachments":true}' \
  -o vault-export.tar http://localhost:8080/export
```

**API Endpoints:**
- `GET /health` - Server status check
- `POST /export` - Export with JSON parameters
- `GET /export?params` - Export with URL parameters

See [API-DOCUMENTATION.md](API-DOCUMENTATION.md) for complete API reference.

### Plugin Settings

**Export Settings:**
- **Export Path**: Target folder for AsciiDoc files (created outside vault)
- **Include Attachments**: Copies images and other files
- **Keep Diagrams as Code Blocks**: Preserves diagrams in original format (recommended)

**HTTP Server Settings:**
- **Enable HTTP Server**: Activate the REST API server
- **Server Host/IP**: Host or IP address to bind to (default: localhost)
- **Server Port**: Port number for the HTTP server (default: 8080)

## AsciiDoc Output

The exported files use comprehensive AsciiDoc syntax with full Obsidian feature support:

### Document Structure with Frontmatter
```asciidoc
= Document Title
:author: Harald Lapp
:keywords: obsidian, export, asciidoc
:revdate: 2024-01-15
:description: Exported from Obsidian
:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:
:source-highlighter: highlight.js
:stem: latexmath

== Main Heading
=== Sub Heading
```

### Obsidian Features in AsciiDoc

**Wikilinks:**
```asciidoc
xref:other-note.adoc[Other Note]
xref:other-note.adoc#section[Section Link]
```

**Tags:**
```asciidoc
[.tag]#obsidian# [.tag]#export# [.tag]#multi-word-tag#
```

**Callouts:**
```asciidoc
[NOTE]
.Important Information
====
This is a note callout with multiple lines.
It preserves the original structure.
====

[WARNING]
.Collapsible Warning
[%collapsible]
====
This warning can be collapsed.
====
```

**Math Formulas:**
```asciidoc
Inline: latexmath:[E = mc^2]

Block:
[stem]
++++
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
++++
```

**Block References:**
```asciidoc
This is an important paragraph. [[block-important]]

Reference: <<block-important>>
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
- **Obsidian Compatible**: Full support for Obsidian-specific features
- **Standardized**: Well-defined specification
- **Toolchain**: Excellent conversion tools (Asciidoctor)
- **Publishing**: Direct conversion to PDF, HTML, EPUB
- **Documentation**: Industry standard for technical documentation
- **Extensible**: Rich attribute system for metadata and styling

## Use Cases

### Manual Documentation Export
Perfect for creating documentation packages from your Obsidian notes.

### Automated Workflows
Use the HTTP API to integrate vault exports into:
- **CI/CD Pipelines**: Automated documentation generation
- **Backup Systems**: Regular vault exports
- **Content Management**: Integration with external systems
- **Web Applications**: Remote export triggering

### Remote Access
Trigger exports from external applications, scripts, or web interfaces without direct Obsidian access.

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
