export interface ExportSettings {
    exportPath: string;
    includeAttachments: boolean;
    renderDiagrams: boolean;
    format: 'asciidoc';
}

export interface DetectedPlugin {
    id: string;
    name: string;
    supportedTypes: string[];
    renderer?: DiagramRenderer;
}

export interface DiagramRenderer {
    canRender(language: string, content: string): boolean;
    render(language: string, content: string, context: RenderContext): Promise<string>;
}

export interface RenderContext {
    filePath: string;
    fileName: string;
    vault: any;
    app: any;
}

export interface ExportedFile {
    path: string;
    content: string;
    type: 'asciidoc' | 'asset';
}

export interface VaultStructure {
    files: VaultFile[];
    folders: VaultFolder[];
}

export interface VaultFile {
    path: string;
    name: string;
    extension: string;
    content?: string;
    isMarkdown: boolean;
    lastModified: number;
}

export interface VaultFolder {
    path: string;
    name: string;
    files: VaultFile[];
    subfolders: VaultFolder[];
}

export interface NavigationItem {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: NavigationItem[];
}

export interface SearchIndex {
    documents: SearchDocument[];
    index: any; // Lunr index
}

export interface SearchDocument {
    id: string;
    title: string;
    content: string;
    path: string;
    tags: string[];
}

export interface AssetInfo {
    originalPath: string;
    exportPath: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'other';
    size: number;
}

export interface ExportData {
    files: ExportFileData[];
    metadata: {
        exportedAt: string;
        totalFiles: number;
        settings: ExportSettings;
    };
}

export interface ExportFileData {
    path: string;
    content: string | Buffer;
    type: 'asciidoc' | 'asset';
    size: number;
}