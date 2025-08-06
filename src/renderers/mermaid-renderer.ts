import { DiagramRenderer, RenderContext } from '../types';

export class MermaidRenderer implements DiagramRenderer {
    canRender(language: string, content: string): boolean {
        return language === 'mermaid';
    }

    async render(language: string, content: string, context: RenderContext): Promise<string> {
        try {
            // Try to render using Obsidian's built-in Mermaid support
            const svgContent = await this.renderMermaidToSvg(content, context);
            
            if (svgContent) {
                return `
                    <div class="mermaid-diagram-container" style="text-align: center; margin: 1em 0;">
                        ${svgContent}
                    </div>
                `;
            }
            
            // Fallback: return as code block with error message
            return this.renderAsCodeBlock(content);
            
        } catch (error) {
            console.error('Error rendering Mermaid diagram:', error);
            return `
                <div class="mermaid-diagram-error" style="color: red; border: 1px solid red; padding: 1em; border-radius: 4px; background-color: #ffe6e6;">
                    <strong>Mermaid Diagram Error:</strong><br>
                    ${error.message}<br><br>
                    <details>
                        <summary>Original Code</summary>
                        <pre><code class="language-mermaid">${this.escapeHtml(content)}</code></pre>
                    </details>
                </div>
            `;
        }
    }

    private async renderMermaidToSvg(content: string, context: RenderContext): Promise<string | null> {
        try {
            // Try to access Obsidian's Mermaid renderer
            // @ts-ignore - Access internal Obsidian API
            const mermaidPlugin = context.app.plugins.plugins['mermaid'];
            
            if (mermaidPlugin && mermaidPlugin.render) {
                // Use the plugin's render method if available
                return await mermaidPlugin.render(content);
            }
            
            // Try to use the global mermaid instance if available
            // @ts-ignore - Access global mermaid
            if (typeof window !== 'undefined' && (window as any).mermaid) {
                const mermaid = (window as any).mermaid;
                
                // Initialize mermaid with safe settings
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    fontFamily: 'inherit'
                });
                
                // Generate unique ID
                const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Render to SVG
                const { svg } = await mermaid.render(diagramId, content);
                return svg;
            }
            
            // Try to import and use mermaid directly
            try {
                const mermaid = require('mermaid');
                
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    fontFamily: 'inherit'
                });
                
                const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(diagramId, content);
                return svg;
            } catch (importError) {
                console.warn('Could not import mermaid directly:', importError);
            }
            
            return null;
            
        } catch (error) {
            console.error('Error in renderMermaidToSvg:', error);
            return null;
        }
    }

    private renderAsCodeBlock(content: string): string {
        return `
            <div class="mermaid-diagram-fallback" style="border: 2px dashed #ccc; padding: 1em; margin: 1em 0; background-color: #f9f9f9;">
                <p style="margin-top: 0; color: #666; font-style: italic;">
                    Mermaid diagram could not be rendered. Showing original code:
                </p>
                <pre><code class="language-mermaid">${this.escapeHtml(content)}</code></pre>
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
}