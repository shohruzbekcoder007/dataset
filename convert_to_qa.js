const fs = require('fs');
const path = require('path');

// Korrelyatsion tahlil funksiyasi
function calculateCorrelation(x, y) {
    const n = x.length;
    const sum_x = x.reduce((a, b) => a + b, 0);
    const sum_y = y.reduce((a, b) => a + b, 0);
    const sum_xy = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sum_x2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sum_y2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const correlation = (n * sum_xy - sum_x * sum_y) / 
        Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));
    
    return correlation;
}

function generateQuestionsForDataset(data, datasetId, datasetTitle) {
    const qaData = [];
    const metadata = data[0].metadata;
    const statsData = data[0].data;

    // Dataset haqida umumiy savollar
    qaData.push({
        dataset_id: datasetId,
        question: "Bu dataset nima haqida?",
        answer: datasetTitle
    });

    // Metodologiya haqida savol
    const methodologyInfo = metadata.find(m => m.name_uz === "Hisoblash metodikasi (qisqacha)");
    if (methodologyInfo) {
        qaData.push({
            dataset_id: datasetId,
            question: "Bu ma'lumotlar qanday metodologiya asosida hisoblanadi?",
            answer: methodologyInfo.value_uz
        });
    }

    // Mas'ul xodim haqida savol
    const responsiblePerson = metadata.find(m => m.name_uz === "Mas'ul xodim FISh");
    if (responsiblePerson) {
        qaData.push({
            dataset_id: datasetId,
            question: "Bu ma'lumotlar uchun kim mas'ul?",
            answer: responsiblePerson.value_uz
        });
    }

    // Statistik ma'lumotlar bo'yicha savollar
    const years = Object.keys(statsData[0]).filter(key => /^\d{4}$/.test(key));
    const regions = statsData.map(item => item.Klassifikator).filter(Boolean);

    // Yillik statistika
    years.forEach(year => {
        const yearData = statsData.map(item => ({
            region: item.Klassifikator,
            value: parseFloat(item[year])
        })).filter(item => !isNaN(item.value));

        if (yearData.length > 0) {
            // Eng yuqori ko'rsatkich
            const maxData = yearData.reduce((max, curr) => curr.value > max.value ? curr : max);
            qaData.push({
                dataset_id: datasetId,
                question: `${year} yilda ${datasetTitle} bo'yicha eng yuqori ko'rsatkich qaysi hududda qayd etilgan?`,
                answer: `${year} yilda eng yuqori ko'rsatkich ${maxData.value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})} bilan ${maxData.region}da qayd etilgan.`
            });

            // Eng past ko'rsatkich
            const minData = yearData.reduce((min, curr) => curr.value < min.value ? curr : min);
            qaData.push({
                dataset_id: datasetId,
                question: `${year} yilda ${datasetTitle} bo'yicha eng past ko'rsatkich qaysi hududda qayd etilgan?`,
                answer: `${year} yilda eng past ko'rsatkich ${minData.value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})} bilan ${minData.region}da qayd etilgan.`
            });

            // O'rtacha ko'rsatkich
            const avgValue = (yearData.reduce((sum, curr) => sum + curr.value, 0) / yearData.length).toFixed(1);
            qaData.push({
                dataset_id: datasetId,
                question: `${year} yilda O'zbekiston bo'yicha ${datasetTitle}ning o'rtacha ko'rsatkichi qancha edi?`,
                answer: `${year} yilda O'zbekiston bo'yicha o'rtacha ko'rsatkich ${parseFloat(avgValue).toLocaleString('uz-UZ', {maximumFractionDigits: 1})}ni tashkil etgan.`
            });

            // O'sish sur'ati
            if (years.indexOf(year) > 0) {
                const prevYear = years[years.indexOf(year) - 1];
                const prevYearData = statsData.map(item => ({
                    region: item.Klassifikator,
                    value: parseFloat(item[prevYear])
                })).filter(item => !isNaN(item.value));

                if (prevYearData.length > 0) {
                    const growthData = regions.map(region => {
                        const curr = yearData.find(d => d.region === region);
                        const prev = prevYearData.find(d => d.region === region);
                        if (curr && prev && prev.value !== 0) {
                            return {
                                region: region,
                                growth: ((curr.value - prev.value) / prev.value * 100).toFixed(1)
                            };
                        }
                        return null;
                    }).filter(Boolean);

                    if (growthData.length > 0) {
                        // Eng yuqori o'sish
                        const maxGrowth = growthData.reduce((max, curr) => parseFloat(curr.growth) > parseFloat(max.growth) ? curr : max);
                        qaData.push({
                            dataset_id: datasetId,
                            question: `${year} yilda ${datasetTitle} bo'yicha eng yuqori o'sish sur'ati qaysi hududda qayd etilgan?`,
                            answer: `${year} yilda eng yuqori o'sish sur'ati ${maxGrowth.growth}% bilan ${maxGrowth.region}da qayd etilgan.`
                        });

                        // Eng past o'sish
                        const minGrowth = growthData.reduce((min, curr) => parseFloat(curr.growth) < parseFloat(min.growth) ? curr : min);
                        qaData.push({
                            dataset_id: datasetId,
                            question: `${year} yilda ${datasetTitle} bo'yicha eng past o'sish sur'ati qaysi hududda qayd etilgan?`,
                            answer: `${year} yilda eng past o'sish sur'ati ${minGrowth.growth}% bilan ${minGrowth.region}da qayd etilgan.`
                        });
                    }
                }
            }
        }
    });

    // Hududiy dinamika
    regions.forEach(region => {
        const regionData = statsData.find(item => item.Klassifikator === region);
        if (regionData) {
            const values = years.map(year => parseFloat(regionData[year])).filter(val => !isNaN(val));
            if (values.length > 0) {
                const avgValue = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
                const maxValue = Math.max(...values).toFixed(1);
                const minValue = Math.min(...values).toFixed(1);
                const trend = values[values.length - 1] < values[0] ? "pasayish" : "o'sish";

                qaData.push({
                    dataset_id: datasetId,
                    question: `${region}da ${datasetTitle} ko'rsatkichlari qanday dinamikaga ega?`,
                    answer: `${region}da ko'rsatkichlarning o'rtacha qiymati ${parseFloat(avgValue).toLocaleString('uz-UZ', {maximumFractionDigits: 1})}, eng yuqori ko'rsatkich ${parseFloat(maxValue).toLocaleString('uz-UZ', {maximumFractionDigits: 1})}, eng past ko'rsatkich ${parseFloat(minValue).toLocaleString('uz-UZ', {maximumFractionDigits: 1})}ni tashkil etgan. Umumiy tendensiya ${trend} tomon yo'nalgan.`
                });

                // Ko'p yillik o'rtacha o'sish sur'ati
                const growthRates = [];
                for (let i = 1; i < values.length; i++) {
                    const growthRate = ((values[i] - values[i-1]) / values[i-1] * 100);
                    if (!isNaN(growthRate)) {
                        growthRates.push(growthRate);
                    }
                }
                if (growthRates.length > 0) {
                    const avgGrowth = (growthRates.reduce((a, b) => a + b, 0) / growthRates.length).toFixed(1);
                    qaData.push({
                        dataset_id: datasetId,
                        question: `${region}da ${datasetTitle}ning ko'p yillik o'rtacha o'sish sur'ati qanday?`,
                        answer: `${region}da ${years[0]}-${years[years.length-1]} yillar oralig'ida o'rtacha yillik o'sish sur'ati ${avgGrowth}%ni tashkil etgan.`
                    });
                }
            }
        }
    });

    // O'zgarish dinamikasi
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    
    regions.forEach(region => {
        const regionData = statsData.find(item => item.Klassifikator === region);
        if (regionData) {
            const firstValue = parseFloat(regionData[firstYear]);
            const lastValue = parseFloat(regionData[lastYear]);
            if (!isNaN(firstValue) && !isNaN(lastValue)) {
                const change = ((lastValue - firstValue) / firstValue * 100).toFixed(1);
                
                qaData.push({
                    dataset_id: datasetId,
                    question: `${firstYear}-${lastYear} yillar oralig'ida ${region}da ${datasetTitle} qanday o'zgargan?`,
                    answer: `${firstYear}-${lastYear} yillar oralig'ida ${region}da ko'rsatkich ${Math.abs(change)}% ga ${change < 0 ? 'kamaygan' : 'oshgan'}.`
                });
            }
        }
    });

    // Solishtirma tahlil
    if (regions.length > 1) {
        const latestYear = years[years.length - 1];
        const latestData = statsData.map(item => ({
            region: item.Klassifikator,
            value: parseFloat(item[latestYear])
        })).filter(item => !isNaN(item.value));

        if (latestData.length > 1) {
            const sortedRegions = latestData.sort((a, b) => b.value - a.value);
            const topRegions = sortedRegions.slice(0, 3);
            const bottomRegions = sortedRegions.slice(-3);

            qaData.push({
                dataset_id: datasetId,
                question: `${latestYear} yil holatiga ko'ra ${datasetTitle} bo'yicha yetakchi hududlar qaysilar?`,
                answer: `${latestYear} yilda eng yuqori ko'rsatkichlar:\n1. ${topRegions[0].region} - ${topRegions[0].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}\n2. ${topRegions[1].region} - ${topRegions[1].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}\n3. ${topRegions[2].region} - ${topRegions[2].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}`
            });

            qaData.push({
                dataset_id: datasetId,
                question: `${latestYear} yil holatiga ko'ra ${datasetTitle} bo'yicha eng past ko'rsatkichli hududlar qaysilar?`,
                answer: `${latestYear} yilda eng past ko'rsatkichlar:\n1. ${bottomRegions[2].region} - ${bottomRegions[2].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}\n2. ${bottomRegions[1].region} - ${bottomRegions[1].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}\n3. ${bottomRegions[0].region} - ${bottomRegions[0].value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})}`
            });
        }
    }

    // Maxsus savollar
    if (datasetId === "3840" || datasetId === "3846") {
        // Norasmiy iqtisodiyot uchun maxsus savollar
        const yaimData = statsData.find(item => item.Klassifikator === "JAMI");
        const sanoatData = statsData.find(item => item.Klassifikator === "Sanoat");
        const xizmatlarData = statsData.find(item => item.Klassifikator === "Xizmatlar");
        
        if (yaimData && sanoatData && xizmatlarData) {
            const yaimValues = years.map(year => parseFloat(yaimData[year])).filter(val => !isNaN(val));
            const sanoatValues = years.map(year => parseFloat(sanoatData[year])).filter(val => !isNaN(val));
            const xizmatlarValues = years.map(year => parseFloat(xizmatlarData[year])).filter(val => !isNaN(val));

            // Korrelyatsion tahlil
            if (yaimValues.length > 0 && sanoatValues.length > 0) {
                const corrYaimSanoat = calculateCorrelation(yaimValues, sanoatValues);
                const trend = corrYaimSanoat > 0 ? "to'g'ri" : "teskari";
                const strength = Math.abs(corrYaimSanoat) > 0.7 ? "kuchli" : Math.abs(corrYaimSanoat) > 0.3 ? "o'rtacha" : "kuchsiz";
                
                qaData.push({
                    dataset_id: datasetId,
                    question: `Norasmiy iqtisodiyotning YAIMdagi ulushi va sanoatdagi ulushi o'rtasida qanday bog'liqlik mavjud?`,
                    answer: `YAIMdagi va sanoatdagi norasmiy iqtisodiyot ulushi o'rtasida ${strength} ${trend} bog'liqlik mavjud (korrelyatsiya koeffitsienti: ${corrYaimSanoat.toFixed(2)}).`
                });
            }

            if (yaimValues.length > 0 && xizmatlarValues.length > 0) {
                const corrYaimXizmatlar = calculateCorrelation(yaimValues, xizmatlarValues);
                const trend = corrYaimXizmatlar > 0 ? "to'g'ri" : "teskari";
                const strength = Math.abs(corrYaimXizmatlar) > 0.7 ? "kuchli" : Math.abs(corrYaimXizmatlar) > 0.3 ? "o'rtacha" : "kuchsiz";
                
                qaData.push({
                    dataset_id: datasetId,
                    question: `Norasmiy iqtisodiyotning YAIMdagi ulushi va xizmatlardagi ulushi o'rtasida qanday bog'liqlik mavjud?`,
                    answer: `YAIMdagi va xizmatlardagi norasmiy iqtisodiyot ulushi o'rtasida ${strength} ${trend} bog'liqlik mavjud (korrelyatsiya koeffitsienti: ${corrYaimXizmatlar.toFixed(2)}).`
                });
            }

            // Yillar bo'yicha o'zgarish tendensiyasi
            const firstHalfAvg = yaimValues.slice(0, Math.floor(yaimValues.length/2))
                .reduce((a, b) => a + b, 0) / Math.floor(yaimValues.length/2);
            const secondHalfAvg = yaimValues.slice(Math.floor(yaimValues.length/2))
                .reduce((a, b) => a + b, 0) / (yaimValues.length - Math.floor(yaimValues.length/2));
            
            qaData.push({
                dataset_id: datasetId,
                question: `${years[0]}-${years[years.length-1]} yillar oralig'ida norasmiy iqtisodiyotning YAIMdagi ulushida qanday tendensiya kuzatilgan?`,
                answer: `Davr boshidagi o'rtacha ko'rsatkich ${firstHalfAvg.toFixed(1)}%, oxiridagi o'rtacha ko'rsatkich ${secondHalfAvg.toFixed(1)}%. ${secondHalfAvg < firstHalfAvg ? "Norasmiy iqtisodiyotning YAIMdagi ulushi pasayish tendensiyasiga ega." : "Norasmiy iqtisodiyotning YAIMdagi ulushi o'sish tendensiyasiga ega."}`
            });
        }
    } else if (datasetId === "1582") {
        // YaIM uchun maxsus savollar
        const yaimTotal = statsData.find(item => item.Klassifikator === "Yalpi ichki mahsulot");
        if (yaimTotal) {
            const values = years.map(year => parseFloat(yaimTotal[year])).filter(val => !isNaN(val));
            if (values.length > 1) {
                // O'rtacha o'sish sur'ati
                const avgGrowth = values.slice(1).reduce((sum, curr, idx) => 
                    sum + ((curr - values[idx]) / values[idx] * 100), 0) / (values.length - 1);
                
                qaData.push({
                    dataset_id: datasetId,
                    question: `${years[0]}-${years[years.length-1]} yillar oralig'ida YaIMning o'rtacha yillik o'sish sur'ati qanday bo'lgan?`,
                    answer: `${years[0]}-${years[years.length-1]} yillar oralig'ida YaIMning o'rtacha yillik o'sish sur'ati ${avgGrowth.toFixed(1)}% ni tashkil etgan.`
                });
            }
        }
    } else if (datasetId === "3104") {
        // YaIM (yakuniy iste'mol) uchun maxsus savollar
        const uyXojaliklari = statsData.find(item => item.Klassifikator === "Uy xo'jaliklarining yakuniy iste'mol xarajatlari");
        const davlatBoshqaruvi = statsData.find(item => item.Klassifikator === "Davlat boshqaruvi organlarining yakuniy iste'mol xarajatlari");
        
        if (uyXojaliklari && davlatBoshqaruvi) {
            const latestYear = years[years.length - 1];
            const uyXojaligiUlushi = parseFloat(uyXojaliklari[latestYear]);
            const davlatUlushi = parseFloat(davlatBoshqaruvi[latestYear]);
            
            if (!isNaN(uyXojaligiUlushi) && !isNaN(davlatUlushi)) {
                const total = uyXojaligiUlushi + davlatUlushi;
                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestYear} yilda yakuniy iste'molda uy xo'jaliklari va davlat boshqaruvi organlarining ulushi qanday?`,
                    answer: `${latestYear} yilda yakuniy iste'molda uy xo'jaliklarining ulushi ${(uyXojaligiUlushi/total*100).toFixed(1)}%, davlat boshqaruvi organlarining ulushi ${(davlatUlushi/total*100).toFixed(1)}% ni tashkil etgan.`
                });
            }
        }
    }

    return qaData;
}

async function convertToQA() {
    try {
        // Statistika faylini o'qish
        const statsPath = path.join(__dirname, 'data', 'statistics_2025-03-11T04-23-45-733Z.json');
        const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        
        const downloadsDir = path.join(__dirname, 'downloads', 'json');
        const dataDir = path.join(__dirname, 'data');
        
        let allQAData = [];
        let processedDatasets = 0;
        let failedDatasets = 0;
        
        // Har bir dataset uchun QA generatsiya qilish
        for (const dataset of statsData.content.datasets) {
            const { id, title } = dataset;
            
            // Eng so'nggi versiyani topish
            const datasetFiles = fs.readdirSync(downloadsDir)
                .filter(file => file.startsWith(`dataset_${id}_`))
                .sort()
                .reverse();
            
            if (datasetFiles.length > 0) {
                try {
                    const filePath = path.join(downloadsDir, datasetFiles[0]);
                    const rawData = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(rawData);
                    
                    const qaData = generateQuestionsForDataset(data, id, title);
                    allQAData = allQAData.concat(qaData);
                    
                    console.log(`Dataset ${id} uchun ${qaData.length} ta savol-javob juftligi yaratildi`);
                    processedDatasets++;
                } catch (error) {
                    console.error(`Dataset ${id} uchun xatolik: ${error.message}`);
                    failedDatasets++;
                }
            }
        }

        // QA ma'lumotlarini saqlash
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const outputPath = path.join(dataDir, 'qa_dataset.json');
        fs.writeFileSync(outputPath, JSON.stringify(allQAData, null, 2), 'utf8');

        console.log('\nQA dataset yaratish yakunlandi!');
        console.log(`Jami: ${processedDatasets + failedDatasets} ta dataset`);
        console.log(`Muvaffaqiyatli: ${processedDatasets} ta`);
        console.log(`Xatoliklar: ${failedDatasets} ta`);
        console.log(`Jami ${allQAData.length} ta savol-javob juftligi yaratildi`);

    } catch (error) {
        console.error('Xatolik yuz berdi:', error.message);
    }
}

convertToQA();
