const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadDataset(url, id, title) {
    try {
        const response = await axios.get(url);
        const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
        const fileName = `dataset_${id}_${timestamp}.json`;
        return { success: true, data: response.data, fileName };
    } catch (error) {
        console.error(`Dataset ${id} yuklab olishda xatolik: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function downloadAllDatasets() {
    try {
        // Statistika faylini o'qish
        const statsPath = path.join(__dirname, 'data', 'statistics_2025-03-11T04-23-45-733Z.json');
        const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        
        // JSON fayllarni saqlash uchun papka yaratish
        const jsonDir = path.join(__dirname, 'downloads', 'json');
        if (!fs.existsSync(jsonDir)) {
            fs.mkdirSync(jsonDir, { recursive: true });
        }

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // Har bir dataset uchun
        for (const dataset of statsData.content.datasets) {
            const { id, title, files } = dataset;
            
            if (files.json) {
                console.log(`Dataset ${id} - "${title}" yuklanmoqda...`);
                
                const result = await downloadDataset(files.json, id, title);
                
                if (result.success) {
                    const filePath = path.join(jsonDir, result.fileName);
                    fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf8');
                    console.log(`Dataset ${id} muvaffaqiyatli yuklandi`);
                    successCount++;
                } else {
                    console.error(`Dataset ${id} yuklanmadi: ${result.error}`);
                    errors.push({ id, title, error: result.error });
                    failCount++;
                }
                
                // Har bir so'rov orasida 1 soniya kutish
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Natijalarni chiqarish
        console.log('\nYuklash yakunlandi!');
        console.log(`Jami: ${successCount + failCount} ta dataset`);
        console.log(`Muvaffaqiyatli: ${successCount} ta`);
        console.log(`Xatoliklar: ${failCount} ta`);
        
        if (errors.length > 0) {
            console.log('\nXatolik yuz bergan datasetlar:');
            errors.forEach(err => {
                console.log(`- Dataset ${err.id} (${err.title}): ${err.error}`);
            });
        }
        
    } catch (error) {
        console.error('Xatolik yuz berdi:', error.message);
    }
}

downloadAllDatasets();
