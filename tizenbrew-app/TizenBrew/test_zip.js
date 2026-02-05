const JSZip = require('jszip');
const fs = require('fs');

async function test() {
    try {
        const buffer = fs.readFileSync('TizenBrewStandalone.wgt');
        console.log('File size:', buffer.length);
        
        const zip = await JSZip.loadAsync(buffer);
        console.log('ZIP loaded successfully!');
        console.log('Files in ZIP:', Object.keys(zip.files).slice(0, 10));
        
        const hasConfigXml = Object.keys(zip.files).indexOf('config.xml') !== -1;
        console.log('Has config.xml in root:', hasConfigXml);
        
        if (hasConfigXml) {
            const configXml = await zip.files['config.xml'].async('string');
            console.log('config.xml first 200 chars:', configXml.substring(0, 200));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
