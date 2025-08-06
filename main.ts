import { Plugin, TFile, Notice, Modal, App, Setting, PluginSettingTab } from 'obsidian';
import { VaultExporter } from './src/vault-exporter';
import { PluginRegistry } from './src/plugin-registry';
import { ExportSettings } from './src/types';

interface VaultExporterSettings {
    exportPath: string;
    includeAttachments: boolean;
    renderDiagrams: boolean;
    customPluginSupport: boolean;
    format: 'asciidoc';
}

const DEFAULT_SETTINGS: VaultExporterSettings = {
    exportPath: 'vault-export',
    includeAttachments: true,
    renderDiagrams: false,
    customPluginSupport: true,
    format: 'asciidoc'
};

export default class VaultHtmlExporterPlugin extends Plugin {
    settings: VaultExporterSettings;
    pluginRegistry: PluginRegistry;
    vaultExporter: VaultExporter;

    async onload() {
        console.log('Loading Vault HTML Exporter Plugin');

        await this.loadSettings();

        // Initialize plugin registry to detect available diagram plugins
        this.pluginRegistry = new PluginRegistry(this.app);
        await this.pluginRegistry.initialize();

        // Initialize vault exporter
        this.vaultExporter = new VaultExporter(this.app, this.pluginRegistry);

        // Add ribbon icon
        this.addRibbonIcon('download', 'Export Vault as AsciiDoc', () => {
            this.showExportModal();
        });

        // Add command
        this.addCommand({
            id: 'export-vault-asciidoc',
            name: 'Export Vault as AsciiDoc',
            callback: () => {
                this.showExportModal();
            }
        });

        // Add settings tab
        this.addSettingTab(new VaultExporterSettingTab(this.app, this));
    }

    onunload() {
        console.log('Unloading Vault AsciiDoc Exporter Plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private showExportModal() {
        new ExportModal(this.app, this).open();
    }

    async exportVault(settings: ExportSettings): Promise<void> {
        const notice = new Notice('Starting vault export...', 0);
        
        try {
            await this.vaultExporter.exportVault(settings);
            notice.setMessage('✅ Vault export completed successfully!');
            setTimeout(() => notice.hide(), 3000);
        } catch (error) {
            notice.setMessage(`❌ Export failed: ${error.message}`);
            setTimeout(() => notice.hide(), 5000);
            console.error('Export error:', error);
        }
    }
}

class ExportModal extends Modal {
    plugin: VaultHtmlExporterPlugin;
    exportPath: string;
    includeAttachments: boolean;
    renderDiagrams: boolean;
    format: 'asciidoc';

    constructor(app: App, plugin: VaultHtmlExporterPlugin) {
        super(app);
        this.plugin = plugin;
        this.exportPath = plugin.settings.exportPath;
        this.includeAttachments = plugin.settings.includeAttachments;
        this.renderDiagrams = plugin.settings.renderDiagrams;
        this.format = plugin.settings.format;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Export Vault as AsciiDoc' });

        // Export path setting
        new Setting(contentEl)
            .setName('Export path')
            .setDesc('Folder name for the exported AsciiDoc files')
            .addText(text => text
                .setPlaceholder('vault-export')
                .setValue(this.exportPath)
                .onChange(async (value) => {
                    this.exportPath = value;
                }));

        // Include attachments setting
        new Setting(contentEl)
            .setName('Include attachments')
            .setDesc('Copy images and other attachments to the export')
            .addToggle(toggle => toggle
                .setValue(this.includeAttachments)
                .onChange(async (value) => {
                    this.includeAttachments = value;
                }));

        // Render diagrams setting
        new Setting(contentEl)
            .setName('Keep diagrams as code blocks')
            .setDesc('Keep Mermaid, Excalidraw and other diagrams in their original code block format')
            .addToggle(toggle => toggle
                .setValue(!this.renderDiagrams)
                .onChange(async (value) => {
                    this.renderDiagrams = !value;
                }));

        // Detected plugins info
        const detectedPlugins = this.plugin.pluginRegistry.getDetectedPlugins();
        if (detectedPlugins.length > 0) {
            contentEl.createEl('h3', { text: 'Detected Diagram Plugins' });
            const pluginList = contentEl.createEl('ul');
            detectedPlugins.forEach(plugin => {
                const li = pluginList.createEl('li');
                li.createEl('strong', { text: plugin.name });
                li.createSpan({ text: ` - ${plugin.supportedTypes.join(', ')}` });
            });
        }

        // Export button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Export Vault')
                .setCta()
                .onClick(async () => {
                    this.close();
                    
                    const exportSettings: ExportSettings = {
                        exportPath: this.exportPath || 'vault-export',
                        includeAttachments: this.includeAttachments,
                        renderDiagrams: this.renderDiagrams,
                        format: this.format
                    };

                    await this.plugin.exportVault(exportSettings);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class VaultExporterSettingTab extends PluginSettingTab {
    plugin: VaultHtmlExporterPlugin;

    constructor(app: App, plugin: VaultHtmlExporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Vault AsciiDoc Exporter Settings' });

        new Setting(containerEl)
            .setName('Default export path')
            .setDesc('Default folder name for exported AsciiDoc files')
            .addText(text => text
                .setPlaceholder('vault-export')
                .setValue(this.plugin.settings.exportPath)
                .onChange(async (value) => {
                    this.plugin.settings.exportPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include attachments by default')
            .setDesc('Whether to include images and attachments in exports by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeAttachments)
                .onChange(async (value) => {
                    this.plugin.settings.includeAttachments = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Keep diagrams as code blocks by default')
            .setDesc('Whether to keep diagrams in their original code block format by default')
            .addToggle(toggle => toggle
                .setValue(!this.plugin.settings.renderDiagrams)
                .onChange(async (value) => {
                    this.plugin.settings.renderDiagrams = !value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom plugin support')
            .setDesc('Enable support for custom diagram plugins')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.customPluginSupport)
                .onChange(async (value) => {
                    this.plugin.settings.customPluginSupport = value;
                    await this.plugin.saveSettings();
                }));

    }
}