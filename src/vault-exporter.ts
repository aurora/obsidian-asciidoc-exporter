import { App, TFile, TFolder } from 'obsidian';
import { PluginRegistry } from './plugin-registry';
import { ExportSettings, VaultStructure, VaultFile, VaultFolder, ExportedFile } from './types';

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

    private resolveExportPath(exportPath: string): string {
        // If exportPath is relative, make it relative to a parent directory
        // This ensures the export is outside the vault
        if (!this.isAbsolutePath(exportPath)) {
            // Use a default parent directory
            return '../' + exportPath;
        }
        return exportPath;
    }

    private isAbsolutePath(filePath: string): boolean {
        // Simple check for absolute paths (Windows and Unix)
        return filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath);
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

        // Convert headers
        asciidocContent = this.convertHeaders(asciidocContent);

        // Convert emphasis and strong
        asciidocContent = this.convertEmphasis(asciidocContent);

        // Convert code blocks (keep diagrams as-is if renderDiagrams is false)
        asciidocContent = await this.convertCodeBlocks(asciidocContent, file);

        // Convert inline code
        asciidocContent = this.convertInlineCode(asciidocContent);

        // Convert lists
        asciidocContent = this.convertLists(asciidocContent);

        // Convert links
        asciidocContent = this.convertLinks(asciidocContent);

        // Convert images
        asciidocContent = this.convertImages(asciidocContent);

        // Convert tables
        asciidocContent = this.convertTables(asciidocContent);

        // Convert blockquotes
        asciidocContent = this.convertBlockquotes(asciidocContent);

        // Convert horizontal rules
        asciidocContent = this.convertHorizontalRules(asciidocContent);

        // Add document header
        asciidocContent = this.addDocumentHeader(asciidocContent, file);

        return asciidocContent;
    }

    private addDocumentHeader(content: string, file: VaultFile): string {
        const title = file.name.replace('.md', '');
        const header = `= ${title}
:doctype: article
:toc: left
:toclevels: 3
:sectlinks:
:sectanchors:
:source-highlighter: highlight.js

`;
        return header + content;
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
        // Convert Obsidian internal links [[Note Name]] to AsciiDoc cross-references
        content = content.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, target, pipe, text) => {
            const linkText = text || target;
            const fileName = target.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase() + '.adoc';
            return `link:${fileName}[${linkText}]`;
        });

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
                return `* link:${asciidocFileName}[${title}]`;
            })
            .join('\n');
    }

    private async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await this.app.vault.adapter.mkdir(dirPath);
        } catch (error) {
            // Directory might already exist, ignore error
        }
    }

    private async writeFile(filePath: string, content: string): Promise<void> {
        await this.app.vault.adapter.write(filePath, content);
    }

    private async writeBinaryFile(filePath: string, content: ArrayBuffer): Promise<void> {
        await this.app.vault.adapter.writeBinary(filePath, content);
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
        return parts.join('/').replace(/\/+/g, '/');
    }
}