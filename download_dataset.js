const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function downloadDataset(id, title, files) {
    try {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonUrl = files.json;
        const txtUrl = files.csv;

        // JSON formatida yuklash
        const jsonResponse = await axios.get(jsonUrl);
        const jsonFilename = `dataset_${id}_${timestamp}.json`;
        const jsonPath = path.join(__dirname, 'downloads', 'json', jsonFilename);
        fs.writeFileSync(jsonPath, JSON.stringify(jsonResponse.data, null, 2));

        // TXT (CSV) formatida yuklash
        const txtResponse = await axios.get(txtUrl);
        const txtFilename = `dataset_${id}_${timestamp}.txt`;
        const txtPath = path.join(__dirname, 'downloads', 'json', txtFilename);
        fs.writeFileSync(txtPath, txtResponse.data);

        console.log(`Dataset ${id} muvaffaqiyatli yuklandi`);
        return true;
    } catch (error) {
        console.error(`Dataset ${id} yuklanishida xatolik: ${error.message}`);
        return false;
    }
}

async function downloadAllDatasets() {
    try {
        // Eng yangi statistika faylini topish
        const dataDir = path.join(__dirname, 'data');
        const files = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('statistics_') && file.endsWith('.json'))
            .sort()
            .reverse();

        if (files.length === 0) {
            throw new Error('Statistika fayli topilmadi');
        }

        const statsFile = path.join(dataDir, files[0]);
        const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        
        console.log(`Statistika fayli: ${files[0]}`);
        console.log(`Jami datasetlar: ${stats.content.datasets.length}`);

        let successCount = 0;
        let failCount = 0;

        // downloads/json papkasini yaratish
        const downloadDir = path.join(__dirname, 'downloads', 'json');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        // Har bir datasetni yuklash
        for (const dataset of stats.content.datasets) {
            const success = await downloadDataset(dataset.id, dataset.title, dataset.files);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log('\nYuklash yakunlandi!');
        console.log(`Jami: ${stats.content.datasets.length} ta dataset`);
        console.log(`Muvaffaqiyatli: ${successCount} ta`);
        console.log(`Xatoliklar: ${failCount} ta`);

    } catch (error) {
        console.error('Xatolik yuz berdi:', error.message);
    }
}

downloadAllDatasets();
