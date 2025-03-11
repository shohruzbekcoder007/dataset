require('dotenv').config();
const puppeteer = require('puppeteer');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

async function scrapeData() {
  let browser;
  try {
    console.log('Brauzer ishga tushmoqda...');
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log('Ma\'lumotlarni yuklash boshlandi...');
    
    // Navigate to the page with increased timeout
    await page.goto('https://stat.uz/uz/rasmiy-statistika/investments', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for the main content to load and be visible
    await page.waitForSelector('.item-page', { timeout: 30000 });
    console.log('Sahifa yuklandi, ma\'lumotlarni qidirish...');

    // Extract all data
    const data = await page.evaluate(() => {
      // Helper function to clean text
      const cleanText = (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ')
          .replace(/\n/g, ' ')
          .trim();
      };

      // Get page title
      const pageTitle = document.querySelector('.page-header')?.textContent || 
                       document.querySelector('h1')?.textContent || 
                       document.title;

      // Get all dataset containers
      const datasets = [];
      
      // Find all links that point to data files
      const fileLinks = Array.from(document.querySelectorAll('a[href*="sdmx_data_"]'))
        .map(link => ({
          text: cleanText(link.textContent),
          url: link.href,
          type: link.href.split('.').pop().toLowerCase()
        }))
        .filter(link => ['xlsx', 'xls', 'pdf', 'csv', 'json', 'xml'].includes(link.type));

      // Group files by dataset ID
      const datasetMap = new Map();
      
      fileLinks.forEach(link => {
        const match = link.url.match(/sdmx_data_(\d+)/);
        if (!match) return;
        
        const id = match[1];
        if (!datasetMap.has(id)) {
          // Try to find title from nearby elements
          let title = '';
          const linkElement = document.querySelector(`a[href*="sdmx_data_${id}"]`);
          if (linkElement) {
            // Look for title in parent elements
            let parent = linkElement.parentElement;
            while (parent && !title) {
              const prevSibling = parent.previousElementSibling;
              if (prevSibling && ['H2', 'H3', 'H4', 'P', 'DIV'].includes(prevSibling.tagName)) {
                const possibleTitle = cleanText(prevSibling.textContent);
                if (possibleTitle && !possibleTitle.match(/\.(xlsx|xls|pdf|csv|json|xml)$/i)) {
                  title = possibleTitle;
                  break;
                }
              }
              parent = parent.parentElement;
            }
          }
          
          datasetMap.set(id, {
            id,
            title: title || `Ma'lumotlar to'plami ${id}`,
            files: {}
          });
        }
        
        const dataset = datasetMap.get(id);
        dataset.files[link.type] = link.url;
      });

      // Convert map to array
      datasets.push(...Array.from(datasetMap.values()));

      // Get all text content (excluding dates and file links)
      const paragraphs = Array.from(document.querySelectorAll('.item-page p, .item-page div.text-justify'))
        .map(p => cleanText(p.textContent))
        .filter(text => {
          return text.length > 0 && 
                 !/^\d{2}\/\d{2}\/\d{4}$/.test(text) &&
                 !text.match(/\.(xlsx|xls|pdf|csv|json|xml)$/i);
        });

      return {
        url: window.location.href,
        title: cleanText(pageTitle),
        content: {
          description: paragraphs,
          datasets: datasets.sort((a, b) => a.id.localeCompare(b.id))
        }
      };
    });

    if (!data || !data.content || !data.content.datasets || data.content.datasets.length === 0) {
      throw new Error('Sahifada ma\'lumotlar topilmadi');
    }

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    // Save the scraped data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `statistics_${timestamp}.json`;
    const outputPath = path.join(dataDir, filename);
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    
    logger.info(`Ma'lumotlar saqlandi: ${filename}`);
    console.log(` Ma'lumotlar muvaffaqiyatli saqlandi: ${filename}`);
    
    // Print summary of found data
    console.log(`\nMa'lumotlar tarkibi:`);
    console.log(`- ${data.content.description.length} ta tavsif`);
    console.log(`- ${data.content.datasets.length} ta ma'lumotlar to'plami`);

    // Print sample of content if available
    if (data.content.description.length > 0) {
      console.log('\nBirinchi tavsif:', data.content.description[0].substring(0, 100) + '...');
    }
    if (data.content.datasets.length > 0) {
      const firstDataset = data.content.datasets[0];
      console.log(`\nBirinchi ma'lumotlar to'plami:`);
      console.log(`- ID: ${firstDataset.id}`);
      console.log(`- Sarlavha: ${firstDataset.title}`);
      console.log(`- Formatlar: ${Object.keys(firstDataset.files).join(', ')}`);
    }

    return data;
  } catch (error) {
    let errorMsg;
    
    if (error.name === 'TimeoutError') {
      errorMsg = 'Sahifa yuklash vaqti tugadi. Internet tezligini tekshiring.';
    } else if (error.name === 'ProtocolError') {
      errorMsg = 'Brauzer bilan aloqa o\'rnatishda xatolik yuz berdi.';
    } else {
      errorMsg = `Kutilmagan xatolik: ${error.message}`;
    }
    
    logger.error(errorMsg, { error: error.message });
    console.error(errorMsg);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Brauzer yopildi');
    }
  }
}

async function formatRegionalData(dataset) {
  const data = dataset.data;
  let output = '';
  
  // Title - safely get metadata or use default
  const getMetadataValue = (nameEn) => {
    const item = dataset.metadata?.find(m => m.name_en === nameEn);
    return item ? item.value_uz : 'Ma\'lumot mavjud emas';
  };
  
  output += `${getMetadataValue("Data set name")}\n`;
  output += '='.repeat(50) + '\n\n';
  
  // Period
  output += `Davr: ${getMetadataValue("Periodicity")}\n`;
  
  // Unit
  output += `O'lchov birligi: ${getMetadataValue("Unit of measurement")}\n\n`;
  
  // Data by region
  if (Array.isArray(data)) {
    data.forEach(region => {
      if (!region) return;
      
      output += `${region.Klassifikator || 'Noma\'lum hudud'}:\n`;
      output += '-'.repeat(30) + '\n';
      
      // Get all quarters/years (excluding Code and Klassifikator fields)
      const periods = Object.keys(region).filter(key => 
        !['Code', 'Klassifikator', 'Klassifikator_ru', 'Klassifikator_en'].includes(key)
      );
      
      // Sort periods chronologically
      periods.sort();
      
      // Group by year if quarterly data
      const isQuarterly = periods[0]?.includes('Q');
      if (isQuarterly) {
        const years = [...new Set(periods.map(p => p.split('-')[0]))];
        years.forEach(year => {
          output += `\n${year}-yil:\n`;
          periods
            .filter(p => p.startsWith(year))
            .forEach(p => {
              const quarter = p.split('-')[1];
              const value = region[p];
              output += `  ${quarter}: ${typeof value === 'number' ? value.toLocaleString('uz-UZ') : value}\n`;
            });
        });
      } else {
        periods.forEach(year => {
          const value = region[year];
          output += `${year}: ${typeof value === 'number' ? value.toLocaleString('uz-UZ') : value}\n`;
        });
      }
      output += '\n';
    });
  } else {
    output += 'Ma\'lumotlar mavjud emas\n';
  }
  
  return output;
}

async function downloadDataset(dataset, format = 'json') {
  try {
    const url = dataset.files[format];
    if (!url) {
      throw new Error(`Format ${format} not available for dataset ${dataset.id}`);
    }

    console.log(`Yuklanmoqda: ${dataset.title}`);
    const response = await axios.get(url);
    
    // Create downloads directory if it doesn't exist
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
    }

    // Create format-specific directory
    const formatDir = path.join(downloadsDir, format);
    if (!fs.existsSync(formatDir)) {
      fs.mkdirSync(formatDir);
    }

    // Save file
    const filename = `dataset_${dataset.id}_${new Date().toISOString().split('T')[0]}.${format}`;
    const filepath = path.join(formatDir, filename);
    
    if (format === 'json') {
      // For JSON, save both formatted and text versions
      fs.writeFileSync(filepath, JSON.stringify(response.data, null, 2));
      
      // Create text version
      const textOutput = await formatRegionalData(response.data[0]);
      const textFilepath = filepath.replace('.json', '.txt');
      fs.writeFileSync(textFilepath, textOutput);
      
      console.log(`✓ Saqlandi: ${filepath}`);
      console.log(`✓ Matn ko'rinishida saqlandi: ${textFilepath}`);
    } else {
      // For other formats, save raw data
      fs.writeFileSync(filepath, response.data);
      console.log(`✓ Saqlandi: ${filepath}`);
    }

    return filepath;
  } catch (error) {
    console.error(`❌ Xatolik yuz berdi (${dataset.id}): ${error.message}`);
    throw error;
  }
}

async function downloadSelectedDatasets() {
  try {
    // First get the list of datasets
    const data = await scrapeData();
    
    // Select important economic indicators
    const selectedDatasets = data.content.datasets.filter(d => {
      // Get quarterly GDP data
      if (d.title.toLowerCase().includes('yalpi ichki') && d.title.toLowerCase().includes('choraklik')) {
        return true;
      }
      // Get sector growth rates
      if (d.title.toLowerCase().includes('o\'sish sur\'at') && d.title.toLowerCase().includes('choraklik')) {
        return true;
      }
      // Get informal economy data
      if (d.title.toLowerCase().includes('norasmiy iqtisodiyot')) {
        return true;
      }
      return false;
    });

    console.log(`\nTanlangan ma'lumotlar to'plamlari: ${selectedDatasets.length} ta`);
    
    // Download each dataset
    for (const dataset of selectedDatasets) {
      try {
        await downloadDataset(dataset, 'json');
      } catch (error) {
        console.error(`Ma'lumotlar to'plami ${dataset.id} yuklab olinmadi`);
      }
    }

    console.log('\nYuklash yakunlandi!');
  } catch (error) {
    console.error('Ma\'lumotlarni yuklashda xatolik:', error.message);
  }
}

// Execute scraping with retries
console.log('Dastur ishga tushmoqda...');

const maxRetries = 3;
let retryCount = 0;
let retryDelay = 5000; // Start with 5 seconds

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeWithRetry() {
  while (retryCount < maxRetries) {
    try {
      await scrapeData();
      console.log('Ma\'lumotlar yig\'ish muvaffaqiyatli yakunlandi');
      return;
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Qayta urinish ${retryCount}/${maxRetries} ${retryDelay/1000} soniyadan keyin...`);
        await delay(retryDelay);
        retryDelay *= 2; // Double the delay for next retry
      }
    }
  }
  console.error('Ma\'lumotlar yig\'ishda xatolik yuz berdi');
  process.exit(1);
}

scrapeWithRetry();

// If running directly, download datasets
if (require.main === module) {
  downloadSelectedDatasets();
}