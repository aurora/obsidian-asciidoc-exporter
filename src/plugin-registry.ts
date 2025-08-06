import { App } from 'obsidian';
import { DetectedPlugin, DiagramRenderer, RenderContext } from './types';
import { MermaidRenderer } from './renderers/mermaid-renderer';
import { RackVisualizationRenderer } from './renderers/rack-visualization-renderer';

export class PluginRegistry {
    private app: App;
    private detectedPlugins: DetectedPlugin[] = [];
    private renderers: Map<string, DiagramRenderer> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    async initialize(): Promise<void> {
        console.log('Initializing Plugin Registry...');
        
        // Register built-in renderers
        this.registerBuiltInRenderers();
        
        // Detect installed plugins
        await this.detectInstalledPlugins();
        
        console.log(`Detected ${this.detectedPlugins.length} diagram plugins`);
    }

    private registerBuiltInRenderers(): void {
        // Mermaid renderer (built-in to Obsidian)
        const mermaidRenderer = new MermaidRenderer();
        this.renderers.set('mermaid', mermaidRenderer);
        
        this.detectedPlugins.push({
            id: 'mermaid',
            name: 'Mermaid',
            supportedTypes: ['mermaid'],
            renderer: mermaidRenderer
        });
    }

    private async detectInstalledPlugins(): Promise<void> {
        // @ts-ignore - Access internal Obsidian API
        const plugins = this.app.plugins;
        
        if (!plugins || !plugins.enabledPlugins) {
            console.warn('Could not access plugin registry');
            return;
        }

        // Check for rack-visualization plugin
        if (plugins.enabledPlugins.has('obsidian-rack-visualization')) {
            const rackRenderer = new RackVisualizationRenderer(this.app);
            this.renderers.set('rack-visualization', rackRenderer);
            
            this.detectedPlugins.push({
                id: 'obsidian-rack-visualization',
                name: 'Rack Visualization',
                supportedTypes: ['rack-xml', 'rack-text', 'rackml', 'rack'],
                renderer: rackRenderer
            });
        }

        // Check for other common diagram plugins
        this.checkForExcalidraw(plugins);
        this.checkForDataview(plugins);
        this.checkForCharts(plugins);
    }

    private checkForExcalidraw(plugins: any): void {
        if (plugins.enabledPlugins.has('obsidian-excalidraw-plugin')) {
            this.detectedPlugins.push({
                id: 'obsidian-excalidraw-plugin',
                name: 'Excalidraw',
                supportedTypes: ['excalidraw']
            });
        }
    }

    private checkForDataview(plugins: any): void {
        if (plugins.enabledPlugins.has('dataview')) {
            this.detectedPlugins.push({
                id: 'dataview',
                name: 'Dataview',
                supportedTypes: ['dataview', 'dataviewjs']
            });
        }
    }

    private checkForCharts(plugins: any): void {
        if (plugins.enabledPlugins.has('obsidian-charts')) {
            this.detectedPlugins.push({
                id: 'obsidian-charts',
                name: 'Charts',
                supportedTypes: ['chart']
            });
        }
    }

    getDetectedPlugins(): DetectedPlugin[] {
        return [...this.detectedPlugins];
    }

    getRenderer(language: string): DiagramRenderer | undefined {
        // First check direct language match
        for (const [key, renderer] of this.renderers) {
            if (renderer.canRender(language, '')) {
                return renderer;
            }
        }

        // Check if any detected plugin supports this language
        for (const plugin of this.detectedPlugins) {
            if (plugin.supportedTypes.includes(language) && plugin.renderer) {
                return plugin.renderer;
            }
        }

        return undefined;
    }

    async renderDiagram(language: string, content: string, context: RenderContext): Promise<string | null> {
        const renderer = this.getRenderer(language);
        
        if (!renderer) {
            console.warn(`No renderer found for language: ${language}`);
            return null;
        }

        try {
            return await renderer.render(language, content, context);
        } catch (error) {
            console.error(`Error rendering ${language} diagram:`, error);
            return null;
        }
    }

    canRender(language: string): boolean {
        return this.getRenderer(language) !== undefined;
    }
}