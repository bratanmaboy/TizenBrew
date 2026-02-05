const JSZip = require('jszip');
const fs = require('fs');

async function createWgt() {
    // Lade das Original
    const originalBuffer = fs.readFileSync('original.wgt');
    const originalZip = await JSZip.loadAsync(originalBuffer);
    
    console.log('Original files:');
    Object.keys(originalZip.files).slice(0, 10).forEach(f => console.log('  ', f));
    
    // Erstelle neues ZIP
    const newZip = new JSZip();
    
    // Kopiere alle Dateien vom Original
    for (const [filename, file] of Object.entries(originalZip.files)) {
        if (file.dir) continue;
        
        // Skip signature files
        if (filename.includes('signature')) continue;
        
        const content = await file.async('nodebuffer');
        newZip.file(filename, content);
    }
    
    // Ersetze debugger.js mit unserer gefixten Version
    const fixedDebugger = fs.readFileSync('service-nextgen/service/utils/debugger.js');
    newZip.file('service-nextgen/service/utils/debugger.js', fixedDebugger);
    
    // Ersetze index.js mit unserer gefixten Version (wichtig für evaluateScriptOnDocumentStart fix!)
    const fixedIndex = fs.readFileSync('service-nextgen/service/index.js');
    newZip.file('service-nextgen/service/index.js', fixedIndex);
    
    // Ersetze dist/index.js mit unserem gefixten Bundle
    const fixedBundle = fs.readFileSync('service-nextgen/service/dist/index.js');
    newZip.file('service-nextgen/service/dist/index.js', fixedBundle);
    
    // Generiere das neue wgt
    const buffer = await newZip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });
    
    fs.writeFileSync('TizenBrewStandalone.wgt', buffer);
    console.log('\\nCreated TizenBrewStandalone.wgt:', buffer.length, 'bytes');
    
    // Verifiziere
    const verifyZip = await JSZip.loadAsync(buffer);
    console.log('\\nVerification - First 10 files:');
    Object.keys(verifyZip.files).slice(0, 10).forEach(f => console.log('  ', f));
}

createWgt().catch(console.error);
