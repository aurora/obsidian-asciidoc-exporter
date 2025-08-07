// Test script to verify Obsidian to AsciiDoc conversion
const fs = require('fs');

// Mock the necessary Obsidian classes and methods for testing
class MockVaultFile {
    constructor(path, name, content) {
        this.path = path;
        this.name = name;
        this.content = content;
        this.extension = 'md';
        this.isMarkdown = true;
        this.lastModified = Date.now();
    }
}

class MockApp {
    constructor() {
        this.vault = {
            getFiles: () => [],
            read: () => '',
            readBinary: () => new ArrayBuffer(0),
            adapter: {
                mkdir: () => Promise.resolve(),
                write: () => Promise.resolve(),
                writeBinary: () => Promise.resolve()
            }
        };
    }
}

class MockPluginRegistry {
    canRender(language) {
        return ['mermaid', 'plantuml', 'excalidraw'].includes(language.toLowerCase());
    }
}

// Import the VaultExporter class (we'll need to modify this for testing)
// For now, let's create a simplified test of the conversion methods

// Test the conversion methods individually
function testFrontmatterExtraction() {
    console.log('Testing Frontmatter Extraction...');
    
    const content = `---
title: Test Document
author: Harald Lapp
tags: [test, obsidian, asciidoc]
aliases: [Test Doc, Example]
created: 2024-01-01
---

# Content here`;

    // Simple frontmatter extraction logic
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
        console.log('✓ Frontmatter detected');
        console.log('Frontmatter content:', match[1]);
        
        const contentWithoutFrontmatter = content.replace(frontmatterRegex, '');
        console.log('Content without frontmatter:', contentWithoutFrontmatter.substring(0, 50) + '...');
    } else {
        console.log('✗ No frontmatter found');
    }
}

function testObsidianTagsConversion() {
    console.log('\nTesting Obsidian Tags Conversion...');
    
    const content = 'Here are some tags: #test #obsidian/export #multi-word-tag';
    const converted = content.replace(/#([a-zA-Z0-9\-_\/]+)/g, (match, tag) => {
        return `[.tag]#${tag}#`;
    });
    
    console.log('Original:', content);
    console.log('Converted:', converted);
}

function testObsidianWikilinks() {
    console.log('\nTesting Obsidian Wikilinks Conversion...');
    
    const testCases = [
        '[[Other Note]]',
        '[[Other Note|Alias]]',
        '[[Other Note#Section]]',
        '[[Other Note#Section|Custom Text]]'
    ];
    
    testCases.forEach(testCase => {
        const converted = testCase.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, target, pipe, text) => {
            const linkText = text || target;
            
            if (target.includes('#')) {
                const [noteName, section] = target.split('#');
                const fileName = noteName.toLowerCase().replace(/[^a-z0-9\-_]/g, '-') + '.adoc';
                const sectionId = section.toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
                return `xref:${fileName}#${sectionId}[${linkText}]`;
            } else {
                const fileName = target.toLowerCase().replace(/[^a-z0-9\-_]/g, '-') + '.adoc';
                return `xref:${fileName}[${linkText}]`;
            }
        });
        
        console.log(`${testCase} → ${converted}`);
    });
}

function testObsidianMath() {
    console.log('\nTesting Obsidian Math Conversion...');
    
    const testCases = [
        'Inline math: $E = mc^2$',
        'Block math:\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$'
    ];
    
    testCases.forEach(testCase => {
        let converted = testCase;
        
        // Convert inline math
        converted = converted.replace(/\$([^$]+)\$/g, 'latexmath:[$1]');
        
        // Convert block math
        converted = converted.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            return `[stem]\n++++\n${formula.trim()}\n++++`;
        });
        
        console.log('Original:');
        console.log(testCase);
        console.log('Converted:');
        console.log(converted);
        console.log('---');
    });
}

function testObsidianEmbeds() {
    console.log('\nTesting Obsidian Embeds Conversion...');
    
    const testCases = [
        '![[Other Document]]',
        '![[image.png]]',
        '![[image.png|Alt Text]]'
    ];
    
    testCases.forEach(testCase => {
        const converted = testCase.replace(/!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, filename, pipe, alt) => {
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
            const isImage = imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
            
            if (isImage) {
                const altText = alt || filename.replace(/\.[^.]+$/, '');
                return `image::${filename}[${altText}]`;
            } else {
                const includeFile = filename.endsWith('.md') ? filename.replace('.md', '.adoc') : filename;
                return `include::${includeFile}[]`;
            }
        });
        
        console.log(`${testCase} → ${converted}`);
    });
}

// Run all tests
console.log('=== Obsidian to AsciiDoc Conversion Tests ===\n');

testFrontmatterExtraction();
testObsidianTagsConversion();
testObsidianWikilinks();
testObsidianMath();
testObsidianEmbeds();

console.log('\n=== Tests completed ===');