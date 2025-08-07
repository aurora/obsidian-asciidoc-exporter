import { Plugin, TFile, Notice, Modal, App, Setting, PluginSettingTab } from 'obsidian';
import { VaultExporter } from './src/vault-exporter';
import { PluginRegistry } from './src/plugin-registry';
import { ExportSettings } from './src/types';
import { HttpExportServer } from './src/http-server';

interface VaultExporterSettings {
    lastExportPath?: string; // Letztes verwendetes Export-Verzeichnis
    includeAttachments: boolean;
    renderDiagrams: boolean;
    customPluginSupport: boolean;
    format: 'asciidoc';
    httpServer: {
        enabled: boolean;
        host: string;
        port: number;
    };
}

const DEFAULT_SETTINGS: VaultExporterSettings = {
    lastExportPath: undefined, // Kein Standard-Verzeichnis
    includeAttachments: true,
    renderDiagrams: false,
    customPluginSupport: true,
    format: 'asciidoc',
    httpServer: {
        enabled: false,
        host: 'localhost',
        port: 8080
    }
};

export default class VaultHtmlExporterPlugin extends Plugin {
    settings: VaultExporterSettings;
    pluginRegistry: PluginRegistry;
    vaultExporter: VaultExporter;
    httpServer: HttpExportServer;

    async onload() {
        console.log('Loading Vault HTML Exporter Plugin');

        await this.loadSettings();

        // Initialize plugin registry to detect available diagram plugins
        this.pluginRegistry = new PluginRegistry(this.app);
        await this.pluginRegistry.initialize();

        // Initialize vault exporter
        this.vaultExporter = new VaultExporter(this.app, this.pluginRegistry);

        // Initialize HTTP server
        this.httpServer = new HttpExportServer(this.app, this.pluginRegistry);

        // Start HTTP server if enabled
        if (this.settings.httpServer.enabled) {
            this.startHttpServer();
        }

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

    async onunload() {
        console.log('Unloading Vault AsciiDoc Exporter Plugin');
        
        // Stop HTTP server if running
        if (this.httpServer && this.httpServer.isServerRunning()) {
            await this.httpServer.stop();
        }
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

    async startHttpServer(): Promise<void> {
        try {
            await this.httpServer.start({
                host: this.settings.httpServer.host,
                port: this.settings.httpServer.port
            });
            new Notice(`HTTP Export Server gestartet auf ${this.settings.httpServer.host}:${this.settings.httpServer.port}`);
        } catch (error) {
            new Notice(`Fehler beim Starten des HTTP-Servers: ${error.message}`);
            console.error('HTTP Server start error:', error);
        }
    }

    async stopHttpServer(): Promise<void> {
        try {
            await this.httpServer.stop();
            new Notice('HTTP Export Server gestoppt');
        } catch (error) {
            new Notice(`Fehler beim Stoppen des HTTP-Servers: ${error.message}`);
            console.error('HTTP Server stop error:', error);
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
        this.exportPath = plugin.settings.lastExportPath || '';
        this.includeAttachments = plugin.settings.includeAttachments;
        this.renderDiagrams = plugin.settings.renderDiagrams;
        this.format = plugin.settings.format;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Export Vault as AsciiDoc' });

        // Export path setting with directory chooser
        new Setting(contentEl)
            .setName('Export Verzeichnis')
            .setDesc('Wählen Sie das Verzeichnis für den AsciiDoc Export')
            .addText(text => text
                .setPlaceholder('Kein Verzeichnis ausgewählt')
                .setValue(this.exportPath)
                .setDisabled(true))
            .addButton(button => button
                .setButtonText('Verzeichnis wählen')
                .onClick(async () => {
                    await this.chooseExportDirectory();
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
                    if (!this.exportPath) {
                        await this.chooseExportDirectory();
                        if (!this.exportPath) {
                            return; // Benutzer hat abgebrochen
                        }
                    }
                    
                    // Prüfe ob Verzeichnis existiert
                    if (!(await this.directoryExists(this.exportPath))) {
                        await this.chooseExportDirectory();
                        if (!this.exportPath) {
                            return; // Benutzer hat abgebrochen
                        }
                    }
                    
                    this.close();
                    
                    const exportSettings: ExportSettings = {
                        exportPath: this.exportPath,
                        includeAttachments: this.includeAttachments,
                        renderDiagrams: this.renderDiagrams,
                        format: this.format
                    };

                    // Speichere das gewählte Verzeichnis
                    this.plugin.settings.lastExportPath = this.exportPath;
                    await this.plugin.saveSettings();

                    await this.plugin.exportVault(exportSettings);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async chooseExportDirectory(): Promise<void> {
        try {
            // Verwende Electron's Dialog API über das app Objekt
            const { dialog } = require('electron').remote || require('@electron/remote');
            
            const result = await dialog.showOpenDialog({
                title: 'Export-Verzeichnis wählen',
                properties: ['openDirectory', 'createDirectory'],
                defaultPath: this.exportPath || undefined
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.exportPath = result.filePaths[0];
                // Aktualisiere das Textfeld
                this.onOpen(); // Neu rendern um den neuen Pfad anzuzeigen
            }
        } catch (error) {
            console.error('Fehler beim Öffnen des Verzeichnis-Dialogs:', error);
            // Fallback: Verwende ein einfaches Prompt
            const path = prompt('Bitte geben Sie den Export-Pfad ein:', this.exportPath || '');
            if (path) {
                this.exportPath = path;
                this.onOpen(); // Neu rendern
            }
        }
    }

    private async directoryExists(path: string): Promise<boolean> {
        try {
            const fs = require('fs').promises;
            const stat = await fs.stat(path);
            return stat.isDirectory();
        } catch {
            return false;
        }
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
            .setName('Letztes Export-Verzeichnis')
            .setDesc('Das zuletzt verwendete Verzeichnis für AsciiDoc Exports')
            .addText(text => text
                .setPlaceholder('Kein Verzeichnis gespeichert')
                .setValue(this.plugin.settings.lastExportPath || '')
                .setDisabled(true))
            .addButton(button => button
                .setButtonText('Verzeichnis wählen')
                .onClick(async () => {
                    await this.chooseExportDirectory();
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

        containerEl.createEl('h3', { text: 'HTTP Export Server' });

        new Setting(containerEl)
            .setName('Enable HTTP Server')
            .setDesc('Enable HTTP REST API for remote export triggering')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.httpServer.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.httpServer.enabled = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        await this.plugin.startHttpServer();
                    } else {
                        await this.plugin.stopHttpServer();
                    }
                }));

        new Setting(containerEl)
            .setName('Server Host/IP')
            .setDesc('Host or IP address for the HTTP server to bind to')
            .addText(text => text
                .setPlaceholder('localhost')
                .setValue(this.plugin.settings.httpServer.host)
                .onChange(async (value) => {
                    this.plugin.settings.httpServer.host = value || 'localhost';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Server Port')
            .setDesc('Port number for the HTTP server')
            .addText(text => text
                .setPlaceholder('8080')
                .setValue(this.plugin.settings.httpServer.port.toString())
                .onChange(async (value) => {
                    const port = parseInt(value) || 8080;
                    this.plugin.settings.httpServer.port = port;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.httpServer && this.plugin.httpServer.isServerRunning()) {
            const statusEl = containerEl.createEl('div', {
                text: `✅ HTTP Server läuft auf ${this.plugin.settings.httpServer.host}:${this.plugin.settings.httpServer.port}`,
                cls: 'setting-item-description'
            });
            statusEl.style.color = 'var(--text-success)';
            statusEl.style.fontWeight = 'bold';
            statusEl.style.marginTop = '10px';

            containerEl.createEl('div', {
                text: `API Endpoints:`,
                cls: 'setting-item-description'
            }).style.marginTop = '10px';

            containerEl.createEl('div', {
                text: `• GET /health - Server Status`,
                cls: 'setting-item-description'
            }).style.marginLeft = '20px';

            containerEl.createEl('div', {
                text: `• POST /export - Export mit JSON-Parametern`,
                cls: 'setting-item-description'
            }).style.marginLeft = '20px';

            containerEl.createEl('div', {
                text: `• GET /export?exportPath=...&includeAttachments=true&renderDiagrams=false`,
                cls: 'setting-item-description'
            }).style.marginLeft = '20px';
        }

    }

    private async chooseExportDirectory(): Promise<void> {
        try {
            // Verwende Electron's Dialog API über das app Objekt
            const { dialog } = require('electron').remote || require('@electron/remote');
            
            const result = await dialog.showOpenDialog({
                title: 'Export-Verzeichnis wählen',
                properties: ['openDirectory', 'createDirectory'],
                defaultPath: this.plugin.settings.lastExportPath || undefined
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.plugin.settings.lastExportPath = result.filePaths[0];
                await this.plugin.saveSettings();
                // Aktualisiere die Anzeige
                this.display();
            }
        } catch (error) {
            console.error('Fehler beim Öffnen des Verzeichnis-Dialogs:', error);
            // Fallback: Verwende ein einfaches Prompt
            const path = prompt('Bitte geben Sie den Export-Pfad ein:', this.plugin.settings.lastExportPath || '');
            if (path) {
                this.plugin.settings.lastExportPath = path;
                await this.plugin.saveSettings();
                this.display();
            }
        }
    }
}