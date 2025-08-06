import { DiagramRenderer, RenderContext } from '../types';

export class RackVisualizationRenderer implements DiagramRenderer {
    private app: any;

    constructor(app: any) {
        this.app = app;
    }

    canRender(language: string, content: string): boolean {
        return ['rack-xml', 'rack-text', 'rackml', 'rack'].includes(language);
    }

    async render(language: string, content: string, context: RenderContext): Promise<string> {
        try {
            // Get the rack visualization plugin instance
            const rackPlugin = this.app.plugins.plugins['obsidian-rack-visualization'];
            
            if (!rackPlugin) {
                console.warn('Rack Visualization plugin not found, falling back to code block');
                return this.renderAsCodeBlock(language, content);
            }

            // Try to access the plugin's API directly
            if (rackPlugin.api && typeof rackPlugin.api.renderRack === 'function') {
                try {
                    const svgContent = await rackPlugin.api.renderRack(content, language);
                    return `
                        <div class="rack-visualization-container" style="text-align: center; margin: 1em 0;">
                            ${svgContent}
                        </div>
                    `;
                } catch (apiError) {
                    console.error('Error using plugin API:', apiError);
                }
            }

            // Fallback: Try to use the plugin's internal methods
            try {
                // Access the plugin's internal parser and generator
                const parser = rackPlugin.textMarkupParser || rackPlugin.parser;
                const svgGenerator = rackPlugin.svgGenerator || rackPlugin.generator;
                
                if (parser && svgGenerator) {
                    let rackSet;
                    
                    // Parse based on language type
                    if (language === 'rack-xml' || language === 'rackml') {
                        // Try to use RackML parser if available
                        if (rackPlugin.rackMLParser) {
                            rackSet = rackPlugin.rackMLParser.parseRackML(content.trim());
                        } else {
                            throw new Error('RackML parser not available');
                        }
                    } else if (language === 'rack-text' || language === 'rack') {
                        // Use text markup parser
                        if (typeof parser.parse === 'function') {
                            parser.setContent(content.trim());
                            rackSet = parser.parse();
                        } else {
                            rackSet = new parser(content.trim()).parse();
                        }
                    } else {
                        throw new Error(`Unsupported rack language: ${language}`);
                    }

                    // Convert any Obsidian links to proper HTML links
                    this.convertObsidianLinks(rackSet, context);

                    // Generate SVG
                    const svgContent = svgGenerator.generateSvg(rackSet);

                    // Wrap SVG in a container with proper styling
                    return `
                        <div class="rack-visualization-container" style="text-align: center; margin: 1em 0;">
                            ${svgContent}
                        </div>
                    `;
                }
            } catch (internalError) {
                console.error('Error using plugin internals:', internalError);
            }

            // Final fallback: render as code block with error message
            console.warn('Could not render rack diagram, falling back to code block');
            return this.renderAsCodeBlock(language, content);

        } catch (error) {
            console.error('Error rendering rack diagram:', error);
            return `
                <div class="rack-visualization-error" style="color: red; border: 1px solid red; padding: 1em; border-radius: 4px; background-color: #ffe6e6;">
                    <strong>Rack Visualization Error:</strong><br>
                    ${error.message}<br><br>
                    <details>
                        <summary>Original Code</summary>
                        <pre><code>${this.escapeHtml(content)}</code></pre>
                    </details>
                </div>
            `;
        }
    }

    private renderAsCodeBlock(language: string, content: string): string {
        return `
            <div class="rack-visualization-fallback" style="border: 2px dashed #ccc; padding: 1em; margin: 1em 0; background-color: #f9f9f9;">
                <p style="margin-top: 0; color: #666; font-style: italic;">
                    Rack diagram could not be rendered. Showing original code:
                </p>
                <pre><code class="language-${language}">${this.escapeHtml(content)}</code></pre>
            </div>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private convertObsidianLinks(rackSet: any, context: RenderContext): void {
        // Convert Obsidian-style links [[Note Name]] to proper HTML links
        for (const rack of rackSet.racks) {
            for (const device of rack.devices) {
                if (device.href) {
                    device.href = this.resolveObsidianLink(device.href, context);
                }
                
                // Also check for Obsidian links in device names
                if (device.name) {
                    const linkMatch = device.name.match(/\[\[([^\]]+)\]\]/);
                    if (linkMatch) {
                        const linkText = linkMatch[1];
                        const resolvedLink = this.resolveObsidianLink(linkText, context);
                        device.name = device.name.replace(linkMatch[0], linkText);
                        device.href = resolvedLink;
                    }
                }
            }
        }
    }

    private resolveObsidianLink(link: string, context: RenderContext): string {
        // Handle Obsidian internal links
        if (link.startsWith('[[') && link.endsWith(']]')) {
            // Extract the note name
            const noteName = link.slice(2, -2);
            return this.convertToHtmlLink(noteName, context);
        }
        
        // Handle regular Obsidian links without brackets
        if (!link.startsWith('http://') && !link.startsWith('https://') && !link.startsWith('obsidian://')) {
            // Assume it's an internal note reference
            return this.convertToHtmlLink(link, context);
        }
        
        return link;
    }

    private convertToHtmlLink(noteName: string, context: RenderContext): string {
        // Convert note name to HTML file path
        const htmlFileName = noteName.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase() + '.html';
        
        // Calculate relative path from current file to target file
        const currentDir = context.filePath.split('/').slice(0, -1).join('/');
        const relativePath = this.calculateRelativePath(currentDir, htmlFileName);
        
        return relativePath;
    }

    private calculateRelativePath(currentDir: string, targetFile: string): string {
        // Simple relative path calculation
        // In a real implementation, this would be more sophisticated
        const depth = currentDir.split('/').filter(p => p).length;
        const prefix = depth > 0 ? '../'.repeat(depth) : './';
        return prefix + 'notes/' + targetFile;
    }
}