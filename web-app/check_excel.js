const xlsx = require('xlsx');

function checkOrganicFile() {
    const workbook = xlsx.readFile("D:\\Project-Tracking-System\\Organik MS Glow Beauty 3 apr - 2 Juli.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: null });
    
    let contentTypes = new Set();
    let sampleVideo = null;
    let sampleLivestream = null;
    let sampleNull = null;
    
    for (let row of data) {
        let type = row['Content Type'] || row['Tipe Konten'] || row['Type'] || row['Content type'];
        let id = row['Content ID'] || row['Content id'] || row['ID Konten'] || row['Content Id'];
        
        if (type) contentTypes.add(type);
        
        if (type === 'Video' && !sampleVideo && id) sampleVideo = id;
        if (type === 'Livestream' && !sampleLivestream && id) sampleLivestream = id;
        if (!type && !sampleNull && id) sampleNull = id;
    }
    
    console.log("Content Types found:", Array.from(contentTypes));
    console.log("Sample Video ID:", sampleVideo);
    console.log("Sample Livestream ID:", sampleLivestream);
    console.log("Sample Null ID:", sampleNull);
}

checkOrganicFile();
