import { App, TFile, TFolder } from 'obsidian';
import { PluginRegistry } from './plugin-registry';
import { ExportSettings, VaultStructure, VaultFile, VaultFolder, ExportedFile, ExportData, ExportFileData } from './types';

export class VaultExporter {
    private app: App;
    private pluginRegistry: PluginRegistry;
    private exportSettings: ExportSettings;
    private exportedFiles: ExportedFile[] = [];

    constructor(app: App, pluginRegistry: PluginRegistry) {
        this.app = app;
        this.pluginRegistry = pluginRegistry;
    }

    async exportVault(settings: ExportSettings): Promise<void> {
        this.exportSettings = settings;
        this.exportedFiles = [];

        console.log('Starting vault export as AsciiDoc with settings:', settings);

        // Ensure export path is outside vault
        const exportPath = this.resolveExportPath(settings.exportPath);
        this.exportSettings.exportPath = exportPath;

        // Create export directory
        await this.ensureDirectory(exportPath);
        
        // Get vault structure
        const vaultStructure = await this.getVaultStructure();

        // Export as AsciiDoc
        await this.exportAsAsciiDoc(vaultStructure);

        console.log(`AsciiDoc export completed. Generated ${this.exportedFiles.length} files.`);
    }

    async exportVaultToMemory(settings: ExportSettings): Promise<ExportData> {
        this.exportSettings = settings;
        this.exportedFiles = [];

        console.log('Starting in-memory vault export as AsciiDoc with settings:', settings);

        // Get vault structure
        const vaultStructure = await this.getVaultStructure();

        // Export as AsciiDoc to memory
        await this.exportAsAsciiDocToMemory(vaultStructure);

        const exportData: ExportData = {
            files: this.exportedFiles.map(file => ({
                path: file.path,
                content: file.content,
                type: file.type,
                size: Buffer.byteLength(file.content, 'utf8')
            })),
            metadata: {
                exportedAt: new Date().toISOString(),
                totalFiles: this.exportedFiles.length,
                settings: settings
            }
        };

        console.log(`In-memory AsciiDoc export completed. Generated ${exportData.files.length} files.`);
        return exportData;
    }

    private resolveExportPath(exportPath: string): string {
        // If exportPath is absolute, use it as-is
        if (this.isAbsolutePath(exportPath)) {
            return exportPath;
        }
        
        // If exportPath is relative, make it relative to a parent directory
        // This ensures the export is outside the vault
        return '../' + exportPath;
    }

    private isAbsolutePath(filePath: string): boolean {
        // Enhanced check for absolute paths (Windows and Unix)
        // Windows: C:\, D:\, etc. or \\server\share (UNC)
        // Unix/Linux: /path
        return filePath.startsWith('/') ||
               /^[A-Za-z]:[\\\/]/.test(filePath) ||
               filePath.startsWith('\\\\');
    }

    private async exportAsAsciiDoc(vaultStructure: VaultStructure): Promise<void> {
        console.log('Exporting as AsciiDoc...');
        
        // Recreate the entire vault structure
        await this.recreateVaultStructure(vaultStructure.files, this.exportSettings.exportPath);

        // Export all markdown files as AsciiDoc, preserving folder structure
        await this.exportMarkdownFilesAsAsciiDoc(vaultStructure.files, this.exportSettings.exportPath);

        // Copy ALL attachments (images, etc.)
        if (this.exportSettings.includeAttachments) {
            await this.copyAllAttachments(vaultStructure.files, this.exportSettings.exportPath);
        }

        // Generate index file
        await this.generateIndexAsciiDoc(vaultStructure);

        console.log('AsciiDoc export completed - vault structure preserved with AsciiDoc format');
    }

    private async exportAsAsciiDocToMemory(vaultStructure: VaultStructure): Promise<void> {
        console.log('Exporting as AsciiDoc to memory...');
        
        // Export all markdown files as AsciiDoc to memory
        await this.exportMarkdownFilesAsAsciiDocToMemory(vaultStructure.files);

        // Copy ALL attachments to memory
        if (this.exportSettings.includeAttachments) {
            await this.copyAllAttachmentsToMemory(vaultStructure.files);
        }

        // Generate index file in memory
        await this.generateIndexAsciiDocToMemory(vaultStructure);

        console.log('AsciiDoc in-memory export completed - vault structure preserved with AsciiDoc format');
    }

    private async getVaultStructure(): Promise<VaultStructure> {
        const files: VaultFile[] = [];
        const folders: VaultFolder[] = [];

        const allFiles = this.app.vault.getFiles();
        
        for (const file of allFiles) {
            if (file instanceof TFile) {
                const vaultFile: VaultFile = {
                    path: file.path,
                    name: file.name,
                    extension: file.extension,
                    isMarkdown: file.extension === 'md',
                    lastModified: file.stat.mtime
                };

                if (vaultFile.isMarkdown) {
                    vaultFile.content = await this.app.vault.read(file);
                }

                files.push(vaultFile);
            }
        }

        return { files, folders };
    }

    private async recreateVaultStructure(files: VaultFile[], basePath: string): Promise<void> {
        console.log('Recreating vault folder structure...');
        
        // Get all unique directory paths from files
        const directories = new Set<string>();
        
        for (const file of files) {
            const dirPath = this.dirname(file.path);
            if (dirPath && dirPath !== '.') {
                // Add all parent directories
                const pathParts = dirPath.split('/');
                let currentPath = '';
                for (const part of pathParts) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    directories.add(currentPath);
                }
            }
        }
        
        // Create all directories
        for (const dir of directories) {
            const fullDirPath = this.joinPath(basePath, dir);
            await this.ensureDirectory(fullDirPath);
            console.log(`Created directory: ${dir}`);
        }
    }

    private async exportMarkdownFilesAsAsciiDoc(files: VaultFile[], basePath: string): Promise<void> {
        const markdownFiles = files.filter(f => f.isMarkdown);
        
        for (const file of markdownFiles) {
            await this.exportMarkdownFileAsAsciiDoc(file, basePath);
        }
    }

    private async exportMarkdownFileAsAsciiDoc(file: VaultFile, basePath: string): Promise<void> {
        if (!file.content) return;

        console.log(`Exporting as AsciiDoc: ${file.path}`);

        // Convert markdown content to AsciiDoc
        const asciidocContent = await this.convertMarkdownToAsciiDoc(file.content, file);

        // Change file extension from .md to .adoc
        const asciidocPath = this.joinPath(basePath, file.path.replace(/\.md$/, '.adoc'));

        await this.writeFile(asciidocPath, asciidocContent);

        this.exportedFiles.push({
            path: asciidocPath,
            content: asciidocContent,
            type: 'asciidoc'
        });
    }

    private async convertMarkdownToAsciiDoc(content: string, file: VaultFile): Promise<string> {
        console.log(`Converting markdown to AsciiDoc: ${file.path}`);

        let asciidocContent = content;

        // Extract and process frontmatter first
        const { content: contentWithoutFrontmatter, frontmatter } = this.extractFrontmatter(asciidocContent);
        asciidocContent = contentWithoutFrontmatter;

        // Convert Obsidian-specific features first
        asciidocContent = this.convertObsidianTags(asciidocContent);
        asciidocContent = this.convertObsidianCallouts(asciidocContent);
        asciidocContent = this.convertObsidianEmbeds(asciidocContent);
        asciidocContent = this.convertObsidianWikilinks(asciidocContent);
        asciidocContent = this.convertObsidianBlockReferences(asciidocContent);
        asciidocContent = this.convertObsidianMath(asciidocContent);

        // Convert standard markdown features
        asciidocContent = this.convertHeaders(asciidocContent);
        asciidocContent = this.convertEmphasis(asciidocContent);
        asciidocContent = await this.convertCodeBlocks(asciidocContent, file);
        asciidocContent = this.convertInlineCode(asciidocContent);
        asciidocContent = this.convertLists(asciidocContent);
        asciidocContent = this.convertLinks(asciidocContent);
        asciidocContent = this.convertImages(asciidocContent);
        asciidocContent = this.convertTables(asciidocContent);
        asciidocContent = this.convertBlockquotes(asciidocContent);
        asciidocContent = this.convertHorizontalRules(asciidocContent);

        // Add document header with frontmatter
        asciidocContent = this.addDocumentHeader(asciidocContent, file, frontmatter);

        return asciidocContent;
    }

    private addDocumentHeader(content: string, file: VaultFile, frontmatter?: any): string {
        const title = file.name.replace('.md', '');
        let header = `= ${title}\n`;
        
        // Add frontmatter attributes if available
        if (frontmatter) {
            if (frontmatter.author) header += `:author: ${frontmatter.author}\n`;
            if (frontmatter.email) header += `:email: ${frontmatter.email}\n`;
            if (frontmatter.created) header += `:revdate: ${frontmatter.created}\n`;
            if (frontmatter.modified) header += `:revdate: ${frontmatter.modified}\n`;
            if (frontmatter.description) header += `:description: ${frontmatter.description}\n`;
            if (frontmatter.keywords) {
                const keywords = Array.isArray(frontmatter.keywords) ? frontmatter.keywords.join(', ') : frontmatter.keywords;
                header += `:keywords: ${keywords}\n`;
            }
            if (frontmatter.tags) {
                const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : frontmatter.tags;
                header += `:keywords: ${tags}\n`;
            }
            if (frontmatter.aliases) {
                const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases.join(', ') : frontmatter.aliases;
                header += `:aliases: ${aliases}\n`;
            }
            if (frontmatter.cssclass) header += `:stylesheet: ${frontmatter.cssclass}.css\n`;
        }
        
        // Add standard AsciiDoc attributes
        header += `:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:
:source-highlighter: highlight.js
:stem: latexmath

`;
        return header + content;
    }

    private extractFrontmatter(content: string): { content: string; frontmatter?: any } {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return { content };
        }
        
        try {
            // Simple YAML parsing for common frontmatter fields
            const yamlContent = match[1];
            const frontmatter: any = {};
            
            const lines = yamlContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex === -1) continue;
                
                const key = trimmed.substring(0, colonIndex).trim();
                let value: any = trimmed.substring(colonIndex + 1).trim();
                
                // Handle arrays [item1, item2] or - item format
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map((v: string) => v.trim().replace(/['"]/g, ''));
                } else if (value.startsWith('-')) {
                    // Multi-line array format - collect following lines
                    const arrayItems = [value.substring(1).trim()];
                    let j = lines.indexOf(line) + 1;
                    while (j < lines.length && lines[j].trim().startsWith('-')) {
                        arrayItems.push(lines[j].trim().substring(1).trim());
                        j++;
                    }
                    value = arrayItems;
                } else {
                    // Remove quotes
                    value = value.replace(/^['"]|['"]$/g, '');
                }
                
                frontmatter[key] = value;
            }
            
            const contentWithoutFrontmatter = content.replace(frontmatterRegex, '');
            return { content: contentWithoutFrontmatter, frontmatter };
        } catch (error) {
            console.warn('Failed to parse frontmatter:', error);
            return { content };
        }
    }

    private convertObsidianTags(content: string): string {
        // Convert #tag to AsciiDoc inline formatting with tag role
        return content.replace(/#([a-zA-Z0-9\-_\/]+)/g, (match, tag) => {
            return `[.tag]#${tag}#`;
        });
    }

    private convertObsidianCallouts(content: string): string {
        // Convert Obsidian callouts to AsciiDoc admonitions
        const lines = content.split('\n');
        const result: string[] = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            const calloutMatch = line.match(/^>\s*\[!(note|tip|important|warning|caution|example|quote)([+-])?\]\s*(.*?)$/);
            
            if (calloutMatch) {
                const [, type, collapsible, title] = calloutMatch;
                const admonitionType = type.toUpperCase();
                const isCollapsible = collapsible === '-';
                
                // Start building the admonition
                let admonition = `[${admonitionType}]`;
                if (title) {
                    admonition += `\n.${title}`;
                }
                if (isCollapsible) {
                    admonition += `\n[%collapsible]`;
                }
                admonition += '\n====';
                
                result.push(admonition);
                i++;
                
                // Collect all following lines that start with >
                while (i < lines.length && lines[i].startsWith('>')) {
                    const contentLine = lines[i].replace(/^>\s?/, '');
                    result.push(contentLine);
                    i++;
                }
                
                // Close the admonition
                result.push('====');
            } else {
                result.push(line);
                i++;
            }
        }
        
        return result.join('\n');
    }

    private convertObsidianEmbeds(content: string): string {
        // Convert ![[filename]] to AsciiDoc include
        content = content.replace(/!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, filename, pipe, alt) => {
            // Check if it's an image file
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
            const isImage = imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
            
            if (isImage) {
                const altText = alt || filename.replace(/\.[^.]+$/, '');
                return `image::${filename}[${altText}]`;
            } else {
                // For markdown files, convert to include
                const includeFile = filename.endsWith('.md') ? filename.replace('.md', '.adoc') : filename;
                return `include::${includeFile}[]`;
            }
        });
        
        return content;
    }

    private convertObsidianWikilinks(content: string): string {
        // Convert [[Note Name]] to AsciiDoc cross-references
        return content.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, target, pipe, text) => {
            const linkText = text || target;
            
            // Handle section links [[Note#Section]]
            if (target.includes('#')) {
                const [noteName, section] = target.split('#');
                const fileName = this.sanitizeFileName(noteName) + '.adoc';
                const sectionId = this.sanitizeSectionId(section);
                return `xref:${fileName}#${sectionId}[${linkText}]`;
            } else {
                const fileName = this.sanitizeFileName(target) + '.adoc';
                return `xref:${fileName}[${linkText}]`;
            }
        });
    }

    private convertObsidianBlockReferences(content: string): string {
        // Convert block references ^block-id to AsciiDoc anchors
        content = content.replace(/\s+\^([a-zA-Z0-9\-_]+)$/gm, ' [[block-$1]]');
        
        // Convert block reference links [[note#^block-id]] to xref
        content = content.replace(/\[\[([^\]|]+)#\^([a-zA-Z0-9\-_]+)(\|([^\]]+))?\]\]/g, (match, noteName, blockId, pipe, text) => {
            const linkText = text || `${noteName} (Block)`;
            const fileName = this.sanitizeFileName(noteName) + '.adoc';
            return `xref:${fileName}#block-${blockId}[${linkText}]`;
        });
        
        return content;
    }

    private convertObsidianMath(content: string): string {
        // Convert block math $$formula$$ to AsciiDoc stem block first (to avoid conflicts)
        content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            return `[stem]\n++++\n${formula.trim()}\n++++`;
        });
        
        // Convert inline math $formula$ to AsciiDoc stem
        content = content.replace(/\$([^$]+)\$/g, 'latexmath:[$1]');
        
        return content;
    }

    private sanitizeFileName(name: string): string {
        // Convert to lowercase and replace special characters with hyphens
        return name.toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private sanitizeSectionId(section: string): string {
        // Convert section names to valid AsciiDoc IDs
        return section.toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private convertHeaders(content: string): string {
        // Convert markdown headers to AsciiDoc
        return content.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, title) => {
            const level = hashes.length;
            return '='.repeat(level) + ' ' + title;
        });
    }

    private convertEmphasis(content: string): string {
        // Convert **bold** to *bold*
        content = content.replace(/\*\*([^*]+)\*\*/g, '*$1*');
        
        // Convert *italic* to _italic_
        content = content.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_');
        
        // Convert __bold__ to *bold*
        content = content.replace(/__([^_]+)__/g, '*$1*');
        
        // Convert _italic_ to _italic_ (already correct)
        
        return content;
    }

    private async convertCodeBlocks(content: string, file: VaultFile): Promise<string> {
        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
        
        return content.replace(codeBlockRegex, (match, language, code) => {
            // If renderDiagrams is false, keep diagrams as code blocks
            if (!this.exportSettings.renderDiagrams) {
                const lang = language || 'text';
                return `[source,${lang}]\n----\n${code.trim()}\n----`;
            }
            
            // Check if this is a diagram language
            if (language && this.pluginRegistry.canRender(language.toLowerCase())) {
                // Keep diagrams as code blocks in original format for AsciiDoc
                return `[source,${language}]\n----\n${code.trim()}\n----`;
            }
            
            // Regular code block
            const lang = language || 'text';
            return `[source,${lang}]\n----\n${code.trim()}\n----`;
        });
    }

    private convertInlineCode(content: string): string {
        // Convert `code` to `code` (same in AsciiDoc)
        return content;
    }

    private convertLists(content: string): string {
        // Convert unordered lists
        content = content.replace(/^(\s*)[-*+]\s+(.+)$/gm, (match, indent, item) => {
            const level = Math.floor(indent.length / 2) + 1;
            return '*'.repeat(level) + ' ' + item;
        });

        // Convert ordered lists
        content = content.replace(/^(\s*)\d+\.\s+(.+)$/gm, (match, indent, item) => {
            const level = Math.floor(indent.length / 2) + 1;
            return '.'.repeat(level) + ' ' + item;
        });

        return content;
    }

    private convertLinks(content: string): string {
        // Note: Obsidian wikilinks are now handled by convertObsidianWikilinks()
        // This method now only handles standard markdown links
        
        // Convert markdown links [text](url) to AsciiDoc links
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return `${url}[${text}]`;
            } else {
                return `link:${url}[${text}]`;
            }
        });

        return content;
    }

    private convertImages(content: string): string {
        // Convert Obsidian image syntax ![[image.png]] to AsciiDoc
        content = content.replace(/!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, imagePath, pipe, alt) => {
            const altText = alt || this.basename(imagePath).replace(/\.[^.]+$/, '');
            return `image::${imagePath}[${altText}]`;
        });

        // Convert markdown images ![alt](path) to AsciiDoc
        content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imagePath) => {
            const altText = alt || this.basename(imagePath).replace(/\.[^.]+$/, '');
            return `image::${imagePath}[${altText}]`;
        });

        return content;
    }

    private convertTables(content: string): string {
        // Convert markdown tables to AsciiDoc tables
        const lines = content.split('\n');
        const result: string[] = [];
        let inTable = false;
        let tableRows: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this is a table row
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else if (inTable && line.trim().match(/^\|[\s\-:]+\|$/)) {
                // This is a table separator line, skip it
                continue;
            } else {
                if (inTable) {
                    // End of table, convert it
                    result.push(this.convertTableToAsciiDoc(tableRows));
                    inTable = false;
                    tableRows = [];
                }
                result.push(line);
            }
        }

        // Handle table at end of content
        if (inTable && tableRows.length > 0) {
            result.push(this.convertTableToAsciiDoc(tableRows));
        }

        return result.join('\n');
    }

    private convertTableToAsciiDoc(tableRows: string[]): string {
        if (tableRows.length === 0) return '';

        const rows = tableRows.map(row => {
            return row.trim().slice(1, -1).split('|').map(cell => cell.trim());
        });

        let result = '[cols="' + '1,'.repeat(rows[0].length).slice(0, -1) + '"]\n';
        result += '|===\n';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (i === 0) {
                // Header row
                result += row.map(cell => `|*${cell}*`).join(' ') + '\n';
            } else {
                result += row.map(cell => `|${cell}`).join(' ') + '\n';
            }
        }

        result += '|===\n';
        return result;
    }

    private convertBlockquotes(content: string): string {
        // Convert > blockquotes to AsciiDoc blockquotes
        return content.replace(/^>\s*(.+)$/gm, '____\n$1\n____');
    }

    private convertHorizontalRules(content: string): string {
        // Convert --- or *** to AsciiDoc horizontal rule
        return content.replace(/^(---|\*\*\*|___)\s*$/gm, "'''");
    }

    private async copyAllAttachments(files: VaultFile[], basePath: string): Promise<void> {
        console.log('Copying all attachments for AsciiDoc export...');
        
        const allFiles = this.app.vault.getFiles();
        let copiedCount = 0;
        
        for (const file of allFiles) {
            if (file instanceof TFile && !file.path.endsWith('.md')) {
                try {
                    // Preserve original file path structure
                    const targetPath = this.joinPath(basePath, file.path);
                    
                    // Ensure target directory exists
                    const targetDir = this.dirname(targetPath);
                    if (targetDir) {
                        await this.ensureDirectory(targetDir);
                    }
                    
                    // Copy file (binary or text)
                    if (this.isBinaryFile(file.path)) {
                        const content = await this.app.vault.readBinary(file);
                        await this.writeBinaryFile(targetPath, content);
                    } else {
                        const content = await this.app.vault.read(file);
                        await this.writeFile(targetPath, content);
                    }
                    
                    this.exportedFiles.push({
                        path: targetPath,
                        content: '',
                        type: 'asset'
                    });
                    
                    copiedCount++;
                    console.log(`Copied: ${file.path} -> ${file.path}`);
                    
                } catch (error) {
                    console.error(`Error copying file ${file.path}:`, error);
                }
            }
        }
        
        console.log(`Copied ${copiedCount} files to maintain vault structure`);
    }

    private isBinaryFile(filePath: string): boolean {
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.mp4', '.mp3', '.webp', '.bmp', '.tiff', '.zip', '.rar', '.7z', '.exe', '.dmg'];
        return binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    private async generateIndexAsciiDoc(vaultStructure: VaultStructure): Promise<void> {
        const indexContent = `= Vault Export
:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:

Exported on ${new Date().toLocaleDateString('de-DE')}

== Files

${this.generateAsciiDocFileList(vaultStructure.files)}

---

_This export was generated by the Obsidian Vault Exporter plugin._
`;

        const indexPath = this.joinPath(this.exportSettings.exportPath, 'index.adoc');
        await this.writeFile(indexPath, indexContent);

        this.exportedFiles.push({
            path: indexPath,
            content: indexContent,
            type: 'asciidoc'
        });
    }

    private generateAsciiDocFileList(files: VaultFile[]): string {
        const markdownFiles = files.filter(f => f.isMarkdown);
        
        return markdownFiles
            .map(file => {
                const asciidocFileName = file.path.replace(/\.md$/, '.adoc');
                const title = file.name.replace('.md', '');
                return `* xref:${asciidocFileName}[${title}]`;
            })
            .join('\n');
    }

    private async ensureDirectory(dirPath: string): Promise<void> {
        try {
            // Für absolute Pfade verwende Node.js fs, für relative Pfade den Vault Adapter
            if (this.isAbsolutePath(dirPath)) {
                const fs = require('fs').promises;
                await fs.mkdir(dirPath, { recursive: true });
            } else {
                await this.app.vault.adapter.mkdir(dirPath);
            }
        } catch (error) {
            // Directory might already exist, ignore error
            console.log(`Directory creation info: ${error.message}`);
        }
    }

    private async writeFile(filePath: string, content: string): Promise<void> {
        // Für absolute Pfade verwende Node.js fs, für relative Pfade den Vault Adapter
        if (this.isAbsolutePath(filePath)) {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, content, 'utf8');
        } else {
            await this.app.vault.adapter.write(filePath, content);
        }
    }

    private async writeBinaryFile(filePath: string, content: ArrayBuffer): Promise<void> {
        // Für absolute Pfade verwende Node.js fs, für relative Pfade den Vault Adapter
        if (this.isAbsolutePath(filePath)) {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, Buffer.from(content));
        } else {
            await this.app.vault.adapter.writeBinary(filePath, content);
        }
    }

    private dirname(filePath: string): string {
        const parts = filePath.split('/');
        if (parts.length <= 1) return '.';
        return parts.slice(0, -1).join('/');
    }

    private basename(filePath: string): string {
        const parts = filePath.split('/');
        return parts[parts.length - 1];
    }

    private joinPath(...parts: string[]): string {
        // Wenn der erste Teil ein absoluter Pfad ist, verwende ihn direkt
        if (parts.length > 0 && this.isAbsolutePath(parts[0])) {
            // Für Windows-Pfade: Verwende den korrekten Separator
            if (parts[0].includes('\\')) {
                return parts.join('\\').replace(/\\+/g, '\\');
            }
        }
        return parts.join('/').replace(/\/+/g, '/');
    }

    // In-Memory Export Methods
    private async exportMarkdownFilesAsAsciiDocToMemory(files: VaultFile[]): Promise<void> {
        const markdownFiles = files.filter(f => f.isMarkdown);
        
        for (const file of markdownFiles) {
            await this.exportMarkdownFileAsAsciiDocToMemory(file);
        }
    }

    private async exportMarkdownFileAsAsciiDocToMemory(file: VaultFile): Promise<void> {
        if (!file.content) return;

        console.log(`Exporting to memory as AsciiDoc: ${file.path}`);

        // Convert markdown content to AsciiDoc
        const asciidocContent = await this.convertMarkdownToAsciiDoc(file.content, file);

        // Change file extension from .md to .adoc
        const asciidocPath = file.path.replace(/\.md$/, '.adoc');

        this.exportedFiles.push({
            path: asciidocPath,
            content: asciidocContent,
            type: 'asciidoc'
        });
    }

    private async copyAllAttachmentsToMemory(files: VaultFile[]): Promise<void> {
        console.log('Copying all attachments to memory for AsciiDoc export...');
        
        const allFiles = this.app.vault.getFiles();
        let copiedCount = 0;
        
        for (const file of allFiles) {
            if (file instanceof TFile && !file.path.endsWith('.md')) {
                try {
                    // Read file content
                    let content: string;
                    if (this.isBinaryFile(file.path)) {
                        const binaryContent = await this.app.vault.readBinary(file);
                        content = Buffer.from(binaryContent).toString('base64');
                    } else {
                        content = await this.app.vault.read(file);
                    }
                    
                    this.exportedFiles.push({
                        path: file.path,
                        content: content,
                        type: 'asset'
                    });
                    
                    copiedCount++;
                    console.log(`Copied to memory: ${file.path}`);
                    
                } catch (error) {
                    console.error(`Error copying file ${file.path} to memory:`, error);
                }
            }
        }
        
        console.log(`Copied ${copiedCount} files to memory`);
    }

    private async generateIndexAsciiDocToMemory(vaultStructure: VaultStructure): Promise<void> {
        const indexContent = `= Vault Export
:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:

Exported on ${new Date().toLocaleDateString('de-DE')}

== Files

${this.generateAsciiDocFileList(vaultStructure.files)}

---

_This export was generated by the Obsidian Vault Exporter plugin._
`;

        this.exportedFiles.push({
            path: 'index.adoc',
            content: indexContent,
            type: 'asciidoc'
        });
    }
}