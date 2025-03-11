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
    const months = Object.keys(statsData[0]).filter(key => key.includes('/'));
    const periods = months.length > 0 ? months : years;
    const regions = statsData.map(item => item.Klassifikator).filter(Boolean);

    // Davr bo'yicha statistika
    periods.forEach(period => {
        const periodData = statsData.map(item => ({
            region: item.Klassifikator,
            value: parseFloat(item[period])
        })).filter(item => !isNaN(item.value));

        if (periodData.length > 0) {
            // Eng yuqori ko'rsatkich
            const maxData = periodData.reduce((max, curr) => curr.value > max.value ? curr : max);
            qaData.push({
                dataset_id: datasetId,
                question: `${period} davrida ${datasetTitle} bo'yicha eng yuqori ko'rsatkich qaysi hududda qayd etilgan?`,
                answer: `${period} davrida eng yuqori ko'rsatkich ${maxData.value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})} bilan ${maxData.region}da qayd etilgan.`
            });

            // Eng past ko'rsatkich
            const minData = periodData.reduce((min, curr) => curr.value < min.value ? curr : min);
            qaData.push({
                dataset_id: datasetId,
                question: `${period} davrida ${datasetTitle} bo'yicha eng past ko'rsatkich qaysi hududda qayd etilgan?`,
                answer: `${period} davrida eng past ko'rsatkich ${minData.value.toLocaleString('uz-UZ', {maximumFractionDigits: 1})} bilan ${minData.region}da qayd etilgan.`
            });

            // O'rtacha ko'rsatkich
            const avgValue = (periodData.reduce((sum, curr) => sum + curr.value, 0) / periodData.length).toFixed(1);
            qaData.push({
                dataset_id: datasetId,
                question: `${period} davrida O'zbekiston bo'yicha ${datasetTitle}ning o'rtacha ko'rsatkichi qancha edi?`,
                answer: `${period} davrida O'zbekiston bo'yicha o'rtacha ko'rsatkich ${parseFloat(avgValue).toLocaleString('uz-UZ', {maximumFractionDigits: 1})}ni tashkil etgan.`
            });
        }
    });

    // Mintaqaviy tahlil uchun maxsus savollar
    if (datasetId === "1287" || datasetId === "1288") {
        const regions = statsData.filter(item => !item.Klassifikator.includes("O'zbekiston"));
        const latestPeriod = periods[periods.length - 1];
        
        if (regions.length > 0) {
            // Mintaqalar reytingi
            const regionRanking = regions.map(region => ({
                name: region.Klassifikator,
                value: parseFloat(region[latestPeriod])
            })).filter(item => !isNaN(item.value))
              .sort((a, b) => b.value - a.value);

            if (regionRanking.length > 0) {
                const top3 = regionRanking.slice(0, 3);
                const bottom3 = regionRanking.slice(-3);

                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestPeriod} davrida mintaqalar bo'yicha narx indeksining eng yuqori va eng past ko'rsatkichlari qanday?`,
                    answer: `${latestPeriod} davrida eng yuqori narx indeksi ${top3.map(r => `${r.name}da (${r.value.toFixed(1)}%)`).join(', ')} qayd etilgan. Eng past ko'rsatkichlar esa ${bottom3.reverse().map(r => `${r.name}da (${r.value.toFixed(1)}%)`).join(', ')} kuzatilgan.`
                });

                // Respublika o'rtacha ko'rsatkichi bilan taqqoslash
                const republicData = statsData.find(item => item.Klassifikator.includes("O'zbekiston"));
                if (republicData) {
                    const republicValue = parseFloat(republicData[latestPeriod]);
                    const aboveAvg = regionRanking.filter(r => r.value > republicValue);
                    
                    qaData.push({
                        dataset_id: datasetId,
                        question: `${latestPeriod} davrida qancha mintaqa respublika o'rtacha ko'rsatkichidan yuqori narx indeksiga ega bo'lgan?`,
                        answer: `${latestPeriod} davrida ${aboveAvg.length} ta mintaqa respublika o'rtacha ko'rsatkichidan (${republicValue.toFixed(1)}%) yuqori narx indeksiga ega bo'lgan. ${
                            aboveAvg.length > 0 ? `Bular: ${aboveAvg.map(r => r.name).join(', ')}.` : ''}`
                    });
                }
            }
        }
    }

    // Xalqaro taqqoslash uchun maxsus savollar
    if (datasetId === "1576" || datasetId === "1577") {
        const countries = statsData.filter(item => !item.Klassifikator.includes("O'zbekiston"));
        const latestPeriod = periods[periods.length - 1];
        
        if (countries.length > 0) {
            // Mamlakatlar reytingi
            const countryRanking = countries.map(country => ({
                name: country.Klassifikator,
                value: parseFloat(country[latestPeriod])
            })).filter(item => !isNaN(item.value))
              .sort((a, b) => b.value - a.value);

            if (countryRanking.length > 0) {
                const uzbekData = statsData.find(item => item.Klassifikator.includes("O'zbekiston"));
                if (uzbekData) {
                    const uzbekValue = parseFloat(uzbekData[latestPeriod]);
                    const uzbekRank = countryRanking.findIndex(c => c.value <= uzbekValue) + 1;
                    
                    qaData.push({
                        dataset_id: datasetId,
                        question: `${latestPeriod} davrida O'zbekistonning narx indeksi MDH davlatlari orasida qanday o'rinda turgan?`,
                        answer: `${latestPeriod} davrida O'zbekiston ${uzbekValue.toFixed(1)}% ko'rsatkich bilan MDH davlatlari orasida ${uzbekRank}-o'rinni egallagan. ${
                            uzbekRank <= 3 ? "Bu yuqori inflyatsion bosim mavjudligini ko'rsatadi." :
                            uzbekRank <= countryRanking.length/2 ? "Bu o'rtacha darajadagi narx o'sishini ko'rsatadi." :
                            "Bu nisbatan past narx o'sishi sur'atini ko'rsatadi."}`
                    });

                    // Qo'shni davlatlar bilan taqqoslash
                    const neighborCountries = ["Qozog'iston", "Qirg'iziston", "Tojikiston"];
                    const neighbors = countryRanking.filter(c => 
                        neighborCountries.some(n => c.name.includes(n)));
                    
                    if (neighbors.length > 0) {
                        qaData.push({
                            dataset_id: datasetId,
                            question: `${latestPeriod} davrida O'zbekistonning narx indeksi qo'shni davlatlarga nisbatan qanday?`,
                            answer: `${latestPeriod} davrida O'zbekistonda (${uzbekValue.toFixed(1)}%) ${
                                neighbors.every(n => n.value < uzbekValue) ? "barcha qo'shni davlatlarga nisbatan yuqoriroq" :
                                neighbors.every(n => n.value > uzbekValue) ? "barcha qo'shni davlatlarga nisbatan pastroq" :
                                "qo'shni davlatlarga nisbatan o'rtacha"} narx o'sishi kuzatilgan. ${
                                neighbors.map(n => `${n.name}da ${n.value.toFixed(1)}%`).join(', ')}.`
                        });
                    }
                }
            }
        }
    }

    // Narxlar va indekslar uchun maxsus savollar
    if (datasetId === "1285" || datasetId === "1286") {
        // Iste'mol narxlari indeksi uchun maxsus savollar
        const totalData = statsData.find(item => item.Klassifikator === "Jami");
        const oziqOvqat = statsData.find(item => item.Klassifikator === "Oziq-ovqat mahsulotlari");
        const nooziqOvqat = statsData.find(item => item.Klassifikator === "Nooziq-ovqat mahsulotlari");
        const xizmatlar = statsData.find(item => item.Klassifikator === "Xizmatlar");

        if (totalData && oziqOvqat && nooziqOvqat && xizmatlar) {
            const latestPeriod = periods[periods.length - 1];
            
            // Tarkibiy qismlar tahlili
            const components = [
                { name: "Oziq-ovqat mahsulotlari", value: parseFloat(oziqOvqat[latestPeriod]) },
                { name: "Nooziq-ovqat mahsulotlari", value: parseFloat(nooziqOvqat[latestPeriod]) },
                { name: "Xizmatlar", value: parseFloat(xizmatlar[latestPeriod]) }
            ].filter(item => !isNaN(item.value))
             .sort((a, b) => b.value - a.value);

            if (components.length > 0) {
                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestPeriod} davrida iste'mol narxlari indeksining asosiy tarkibiy qismlari orasida eng yuqori o'sish qaysi yo'nalishda bo'lgan?`,
                    answer: `${latestPeriod} davrida eng yuqori o'sish ${components[0].name.toLowerCase()}da (${components[0].value.toFixed(1)}%) qayd etilgan. Keyingi o'rinlarda ${components[1].name.toLowerCase()} (${components[1].value.toFixed(1)}%) va ${components[2].name.toLowerCase()} (${components[2].value.toFixed(1)}%) turadi.`
                });
            }

            // Mavsumiy o'zgarishlar tahlili
            if (periods.length >= 12) {
                const monthlyData = periods.slice(-12).map(period => ({
                    period,
                    value: parseFloat(totalData[period])
                })).filter(item => !isNaN(item.value));

                if (monthlyData.length === 12) {
                    const maxMonth = monthlyData.reduce((max, curr) => curr.value > max.value ? curr : max);
                    const minMonth = monthlyData.reduce((min, curr) => curr.value < min.value ? curr : min);

                    qaData.push({
                        dataset_id: datasetId,
                        question: `So'nggi 12 oyda iste'mol narxlari indeksining mavsumiy o'zgarishlari qanday bo'lgan?`,
                        answer: `So'nggi 12 oyda eng yuqori o'sish ${maxMonth.period} davrida (${maxMonth.value.toFixed(1)}%), eng past o'sish esa ${minMonth.period} davrida (${minMonth.value.toFixed(1)}%) kuzatilgan.`
                    });
                }
            }
        }
    } else if (datasetId === "1301" || datasetId === "1302") {
        // Sanoat mahsulotlari narx indeksi uchun maxsus savollar
        const totalData = statsData.find(item => item.Klassifikator === "Jami sanoat");
        const qaytaIshlash = statsData.find(item => item.Klassifikator.includes("Qayta ishlash"));
        const energetika = statsData.find(item => item.Klassifikator.includes("Elektr"));
        
        if (totalData && qaytaIshlash && energetika) {
            const latestPeriod = periods[periods.length - 1];
            
            // Tarmoqlararo taqqoslash
            const sectors = [
                { name: "Qayta ishlash sanoati", value: parseFloat(qaytaIshlash[latestPeriod]) },
                { name: "Energetika", value: parseFloat(energetika[latestPeriod]) }
            ].filter(item => !isNaN(item.value));

            if (sectors.length > 0) {
                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestPeriod} davrida sanoatning turli tarmoqlarida narx indeksi qanday farqlangan?`,
                    answer: `${latestPeriod} davrida ${sectors[0].value > sectors[1].value ? 
                        `qayta ishlash sanoatida (${sectors[0].value.toFixed(1)}%) energetika tarmog'iga (${sectors[1].value.toFixed(1)}%) nisbatan` : 
                        `energetika tarmog'ida (${sectors[1].value.toFixed(1)}%) qayta ishlash sanoatiga (${sectors[0].value.toFixed(1)}%) nisbatan`} yuqoriroq narx o'sishi kuzatilgan.`
                });
            }

            // Uzoq muddatli tendensiya
            if (periods.length > 1) {
                const values = periods.map(period => parseFloat(totalData[period])).filter(val => !isNaN(val));
                const avgGrowth = values.slice(1).reduce((sum, curr, idx) => 
                    sum + ((curr - values[idx]) / values[idx] * 100), 0) / (values.length - 1);

                qaData.push({
                    dataset_id: datasetId,
                    question: `Sanoat mahsulotlari narx indeksining uzoq muddatli tendensiyasi qanday?`,
                    answer: `${periods[0]}-${periods[periods.length-1]} davrida sanoat mahsulotlari narxining o'rtacha oylik o'sishi ${avgGrowth.toFixed(1)}% ni tashkil etgan. ${
                        avgGrowth > 1 ? "Bu sezilarli inflyatsion bosim mavjudligini ko'rsatadi." : 
                        avgGrowth > 0 ? "Bu mo''tadil narx o'sishi mavjudligini ko'rsatadi." : 
                        "Bu narxlar barqaror yoki pasayish tendensiyasiga ega ekanligini ko'rsatadi."}`
                });
            }
        }
    }

    // Iqtisodiy faoliyat turlari bo'yicha tahlil
    if (datasetId === "1320" || datasetId === "1321") {
        const sectors = statsData.filter(item => !item.Klassifikator.includes("Jami"));
        const latestPeriod = periods[periods.length - 1];
        
        if (sectors.length > 0) {
            // Eng yuqori o'sish ko'rsatgan sektorlar
            const sectorGrowth = sectors.map(sector => ({
                name: sector.Klassifikator,
                value: parseFloat(sector[latestPeriod])
            })).filter(item => !isNaN(item.value))
              .sort((a, b) => b.value - a.value);

            if (sectorGrowth.length > 0) {
                const top3 = sectorGrowth.slice(0, 3);
                const bottom3 = sectorGrowth.slice(-3);

                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestPeriod} davrida qaysi iqtisodiy faoliyat turlarida narxlarning eng yuqori va eng past o'sishi kuzatilgan?`,
                    answer: `${latestPeriod} davrida eng yuqori narx o'sishi ${top3.map(s => `${s.name.toLowerCase()}da (${s.value.toFixed(1)}%)`).join(', ')} qayd etilgan. Eng past o'sish esa ${bottom3.reverse().map(s => `${s.name.toLowerCase()}da (${s.value.toFixed(1)}%)`).join(', ')} kuzatilgan.`
                });

                // Inflyatsion bosim tahlili
                const highInflation = sectorGrowth.filter(s => s.value > 5);
                if (highInflation.length > 0) {
                    qaData.push({
                        dataset_id: datasetId,
                        question: `${latestPeriod} davrida qaysi iqtisodiy faoliyat turlarida sezilarli inflyatsion bosim kuzatilgan?`,
                        answer: `${latestPeriod} davrida ${highInflation.length} ta sektorda sezilarli inflyatsion bosim (5% dan yuqori o'sish) kuzatilgan: ${
                            highInflation.map(s => `${s.name.toLowerCase()}da ${s.value.toFixed(1)}%`).join(', ')}.`
                    });
                }
            }
        }
    }

    // Transport turlari bo'yicha tahlil
    if (datasetId === "1327" || datasetId === "1329") {
        const transportTypes = statsData.filter(item => !item.Klassifikator.includes("Jami"));
        const latestPeriod = periods[periods.length - 1];
        
        if (transportTypes.length > 0) {
            // Transport turlari bo'yicha narx o'zgarishlari
            const transportGrowth = transportTypes.map(type => ({
                name: type.Klassifikator,
                value: parseFloat(type[latestPeriod])
            })).filter(item => !isNaN(item.value))
              .sort((a, b) => b.value - a.value);

            if (transportGrowth.length > 0) {
                qaData.push({
                    dataset_id: datasetId,
                    question: `${latestPeriod} davrida transport xizmatlari narxining o'zgarishi transport turlari bo'yicha qanday taqsimlangan?`,
                    answer: `${latestPeriod} davrida transport xizmatlari narxining o'zgarishi: ${
                        transportGrowth.map(t => `${t.name.toLowerCase()}da ${t.value.toFixed(1)}%`).join(', ')}.`
                });

                // Yo'lovchi va yuk tashish taqqoslamasi
                const passengerTransport = transportGrowth.filter(t => t.name.toLowerCase().includes("yo'lovchi"));
                const cargoTransport = transportGrowth.filter(t => t.name.toLowerCase().includes("yuk"));

                if (passengerTransport.length > 0 && cargoTransport.length > 0) {
                    const avgPassenger = passengerTransport.reduce((sum, t) => sum + t.value, 0) / passengerTransport.length;
                    const avgCargo = cargoTransport.reduce((sum, t) => sum + t.value, 0) / cargoTransport.length;

                    qaData.push({
                        dataset_id: datasetId,
                        question: `${latestPeriod} davrida yo'lovchi va yuk tashish xizmatlari narxlarining o'rtacha o'sishi qanday farqlangan?`,
                        answer: `${latestPeriod} davrida yo'lovchi tashish xizmatlarida o'rtacha ${avgPassenger.toFixed(1)}%, yuk tashish xizmatlarida esa ${avgCargo.toFixed(1)}% narx o'sishi qayd etilgan. ${
                            avgPassenger > avgCargo ? "Yo'lovchi tashish xizmatlarida narx o'sishi yuqoriroq bo'lgan." :
                            avgPassenger < avgCargo ? "Yuk tashish xizmatlarida narx o'sishi yuqoriroq bo'lgan." :
                            "Ikkala yo'nalishda ham narx o'sishi bir xil darajada bo'lgan."}`
                    });
                }
            }
        }
    }

    return qaData;
}

async function convertToQA() {
    try {
        // Eng yangi statistika faylini topish
        const dataDir = path.join(__dirname, 'data');
        const statsFiles = fs.readdirSync(dataDir)
            .filter(file => file.startsWith('statistics_') && file.endsWith('.json'))
            .sort()
            .reverse();

        if (statsFiles.length === 0) {
            throw new Error('Statistika fayli topilmadi');
        }

        const statsFile = path.join(dataDir, statsFiles[0]);
        const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        
        const downloadDir = path.join(__dirname, 'downloads', 'json');
        const qaData = [];
        let successCount = 0;
        let failCount = 0;

        for (const dataset of stats.content.datasets) {
            try {
                const files = fs.readdirSync(downloadDir)
                    .filter(file => file.startsWith(`dataset_${dataset.id}_`) && file.endsWith('.json'));
                
                if (files.length > 0) {
                    const datasetFile = path.join(downloadDir, files[0]);
                    const datasetData = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));
                    
                    const questions = generateQuestionsForDataset(datasetData, dataset.id, dataset.title);
                    qaData.push(...questions);
                    
                    console.log(`Dataset ${dataset.id} uchun ${questions.length} ta savol-javob juftligi yaratildi`);
                    successCount++;
                }
            } catch (error) {
                console.error(`Dataset ${dataset.id} uchun QA yaratishda xatolik: ${error.message}`);
                failCount++;
            }
        }

        // QA dataset ni saqlash
        const qaDataset = {
            created_at: new Date().toISOString(),
            source_url: stats.url,
            qa_pairs: qaData
        };

        fs.writeFileSync(
            path.join(__dirname, 'data', 'qa_dataset.json'),
            JSON.stringify(qaDataset, null, 2)
        );

        console.log('\nQA dataset yaratish yakunlandi!');
        console.log(`Jami: ${stats.content.datasets.length} ta dataset`);
        console.log(`Muvaffaqiyatli: ${successCount} ta`);
        console.log(`Xatoliklar: ${failCount} ta`);
        console.log(`Jami ${qaData.length} ta savol-javob juftligi yaratildi`);

    } catch (error) {
        console.error('Xatolik yuz berdi:', error.message);
    }
}

convertToQA();
