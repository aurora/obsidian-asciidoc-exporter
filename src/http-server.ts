import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import * as tar from 'tar-stream';
import { VaultExporter } from './vault-exporter';
import { ExportSettings } from './types';
import { App } from 'obsidian';
import { PluginRegistry } from './plugin-registry';

export interface HttpServerConfig {
    host: string;
    port: number;
}

export class HttpExportServer {
    private server: any;
    private app: App;
    private pluginRegistry: PluginRegistry;
    private vaultExporter: VaultExporter;
    private isRunning: boolean = false;

    constructor(app: App, pluginRegistry: PluginRegistry) {
        this.app = app;
        this.pluginRegistry = pluginRegistry;
        this.vaultExporter = new VaultExporter(app, pluginRegistry);
    }

    async start(config: HttpServerConfig): Promise<void> {
        if (this.isRunning) {
            throw new Error('HTTP-Server läuft bereits');
        }

        this.server = createServer((req, res) => {
            this.handleRequest(req, res);
        });

        return new Promise((resolve, reject) => {
            this.server.listen(config.port, config.host, () => {
                this.isRunning = true;
                console.log(`HTTP Export Server gestartet auf ${config.host}:${config.port}`);
                resolve();
            });

            this.server.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.server) {
            return;
        }

        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                console.log('HTTP Export Server gestoppt');
                resolve();
            });
        });
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // CORS Headers hinzufügen
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            
            if (req.method === 'GET' && url.pathname === '/health') {
                await this.handleHealthCheck(res);
            } else if (req.method === 'POST' && url.pathname === '/export') {
                await this.handleExport(req, res);
            } else if (req.method === 'GET' && url.pathname === '/export') {
                await this.handleExportGet(url, res);
            } else {
                this.sendError(res, 404, 'Endpoint nicht gefunden');
            }
        } catch (error) {
            console.error('Fehler beim Verarbeiten der Anfrage:', error);
            this.sendError(res, 500, 'Interner Serverfehler');
        }
    }

    private async handleHealthCheck(res: ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'Obsidian AsciiDoc Export API'
        }));
    }

    private async handleExport(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let exportSettings: ExportSettings;

        try {
            const requestData = JSON.parse(body);
            exportSettings = this.parseExportSettings(requestData);
        } catch (error) {
            this.sendError(res, 400, 'Ungültige JSON-Daten oder Export-Parameter');
            return;
        }

        await this.performExportAndStream(exportSettings, res);
    }

    private async handleExportGet(url: URL, res: ServerResponse): Promise<void> {
        const params = url.searchParams;
        
        const exportSettings: ExportSettings = {
            exportPath: params.get('exportPath') || 'vault-export',
            includeAttachments: params.get('includeAttachments') === 'true',
            renderDiagrams: params.get('renderDiagrams') === 'true',
            format: 'asciidoc'
        };

        await this.performExportAndStream(exportSettings, res);
    }

    private parseExportSettings(data: any): ExportSettings {
        return {
            exportPath: data.exportPath || 'vault-export',
            includeAttachments: data.includeAttachments !== false,
            renderDiagrams: data.renderDiagrams === true,
            format: 'asciidoc'
        };
    }

    private async performExportAndStream(settings: ExportSettings, res: ServerResponse): Promise<void> {
        try {
            console.log('Starte Export mit Einstellungen:', settings);

            // Export-Daten in Memory generieren
            const exportData = await this.vaultExporter.exportVaultToMemory(settings);

            // TAR-Stream erstellen
            const pack = tar.pack();
            
            // Response Headers setzen
            res.writeHead(200, {
                'Content-Type': 'application/x-tar',
                'Content-Disposition': `attachment; filename="vault-export-${Date.now()}.tar"`,
                'Transfer-Encoding': 'chunked'
            });

            // TAR-Stream an Response weiterleiten
            pack.pipe(res);

            // Dateien zum TAR hinzufügen
            for (const file of exportData.files) {
                if (file.type === 'asset' && typeof file.content === 'string') {
                    // Binary files are base64 encoded, decode them
                    const buffer = Buffer.from(file.content, 'base64');
                    pack.entry({ name: file.path }, buffer);
                } else {
                    // Text files (AsciiDoc)
                    pack.entry({ name: file.path }, file.content as string);
                }
            }

            // TAR-Stream beenden
            pack.finalize();

            console.log(`Export abgeschlossen: ${exportData.files.length} Dateien gestreamt`);

        } catch (error) {
            console.error('Fehler beim Export:', error);
            if (!res.headersSent) {
                this.sendError(res, 500, `Export-Fehler: ${error.message}`);
            }
        }
    }

    private async readRequestBody(req: IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', (error) => {
                reject(error);
            });
        });
    }

    private sendError(res: ServerResponse, statusCode: number, message: string): void {
        if (!res.headersSent) {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    isServerRunning(): boolean {
        return this.isRunning;
    }
}