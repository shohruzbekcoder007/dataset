// Ma'lumotlarni yuklash
async function loadData() {
    try {
        const response = await fetch('/data/informal_economy_data.json');
        if (!response.ok) {
            throw new Error(`Ma'lumotlarni yuklashda xatolik: ${response.status}`);
        }
        const jsonData = await response.json();
        
        // Ma'lumotlar strukturasini tekshirish
        if (!Array.isArray(jsonData)) {
            throw new Error("Ma'lumotlar formati noto'g'ri");
        }

        // Ma'lumotlarni formatlash
        const data = {
            data: jsonData,
            metadata: {
                source: "O'zbekiston Respublikasi Statistika qo'mitasi (stat.uz)",
                datasetId: "3840",
                datasetName: "Norasmiy iqtisodiyotning YAIMdagi ulushi",
                updateDate: "2025-yil 11-mart",
                description: "Hududlar bo'yicha norasmiy iqtisodiyotning YAIMdagi ulushi (%)"
            }
        };

        return data;
    } catch (error) {
        console.error('Ma\'lumotlarni yuklashda xatolik:', error);
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        if (errorContainer && errorMessage) {
            errorMessage.textContent = `Ma'lumotlarni yuklashda xatolik yuz berdi: ${error.message}`;
            errorContainer.style.display = 'block';
        }
        return null;
    }
}

// Ma'lumotlar manbasini yangilash
function updateDatasetMetadata(data) {
    if (!data || !data.metadata) return;
    
    const metadata = data.metadata;
    const elements = {
        dataSource: document.getElementById('dataSource'),
        datasetId: document.getElementById('datasetId'),
        updateDate: document.getElementById('updateDate'),
        datasetDescription: document.getElementById('datasetDescription')
    };
    
    // Elementlarni yangilash
    if (elements.dataSource) elements.dataSource.textContent = metadata.source;
    if (elements.datasetId) elements.datasetId.textContent = `${metadata.datasetId} - ${metadata.datasetName}`;
    if (elements.updateDate) elements.updateDate.textContent = metadata.updateDate;
    if (elements.datasetDescription) elements.datasetDescription.textContent = metadata.description;
}

// Yillarni olish
function getYears() {
    return [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
}

// O'sish tendensiyalarini hisoblash
function calculateGrowthTrends(data) {
    if (!data || !Array.isArray(data.data)) return [];
    
    const regions = data.data;
    
    return regions.map(region => {
        // Yillik o'sish sur'atlari
        const yearlyGrowth = [];
        const values = region.values;
        
        for (let i = 1; i < values.length; i++) {
            const prevValue = values[i-1].value;
            const currentValue = values[i].value;
            const growth = ((currentValue - prevValue) / prevValue) * 100;
            yearlyGrowth.push({
                year: values[i].year,
                growth: growth.toFixed(1)
            });
        }

        // O'rtacha o'sish sur'ati
        const avgGrowth = yearlyGrowth.reduce((acc, curr) => acc + parseFloat(curr.growth), 0) / yearlyGrowth.length;
        
        // Tezlanish (so'nggi 3 yil va undan oldingi 3 yil o'rtacha o'sishini taqqoslash)
        const recentGrowth = yearlyGrowth.slice(-3).reduce((acc, curr) => acc + parseFloat(curr.growth), 0) / 3;
        const previousGrowth = yearlyGrowth.slice(-6, -3).reduce((acc, curr) => acc + parseFloat(curr.growth), 0) / 3;
        const acceleration = (recentGrowth - previousGrowth).toFixed(1);

        return {
            region: region.region_name,
            yearlyGrowth,
            avgGrowth: avgGrowth.toFixed(1),
            acceleration
        };
    }).sort((a, b) => b.avgGrowth - a.avgGrowth);
}

// O'sish grafigini yangilash
function createGrowthTrendChart(data) {
    if (!data) return;
    
    const trends = calculateGrowthTrends(data);
    const canvas = document.getElementById('growthChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Eski grafik mavjud bo'lsa, uni o'chirish
    if (window.growthChart instanceof Chart) {
        window.growthChart.destroy();
    }

    // Har bir hudud uchun alohida rang
    const colors = [
        'rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)',
        'rgba(75, 192, 192, 0.6)', 'rgba(255, 206, 86, 0.6)',
        'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(76, 175, 80, 0.6)', 'rgba(233, 30, 99, 0.6)',
        'rgba(3, 169, 244, 0.6)', 'rgba(255, 152, 0, 0.6)',
        'rgba(156, 39, 176, 0.6)', 'rgba(121, 85, 72, 0.6)',
        'rgba(33, 150, 243, 0.6)', 'rgba(255, 87, 34, 0.6)'
    ];

    window.growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: getYears().slice(1),
            datasets: trends.map((trend, index) => ({
                label: trend.region,
                data: trend.yearlyGrowth.map(y => y.growth),
                borderColor: colors[index].replace('0.6', '1'),
                backgroundColor: colors[index],
                fill: false,
                tension: 0.4
            }))
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Hududlar bo\'yicha yillik o\'zgarish sur\'atlari (%)'
                },
                tooltip: {
                    callbacks: {
                        afterTitle: function(context) {
                            const regionIndex = context[0].datasetIndex;
                            const trend = trends[regionIndex];
                            return [
                                `O'rtacha o'zgarish: ${trend.avgGrowth}%`,
                                `O'zgarish tezlanishi: ${trend.acceleration}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'O\'zgarish sur\'ati (%)'
                    }
                }
            }
        }
    });

    // Statistika yangilash
    updateGrowthStatistics(trends);
}

// O'sish statistikasini yangilash
function updateGrowthStatistics(trends) {
    if (!trends || trends.length === 0) return;
    
    // Eng yuqori o'rtacha o'sish
    const maxAvgGrowth = Math.max(...trends.map(t => parseFloat(t.avgGrowth)));
    const maxGrowthRegion = trends.find(t => parseFloat(t.avgGrowth) === maxAvgGrowth);
    
    // Eng yuqori tezlanish
    const maxAccel = Math.max(...trends.map(t => parseFloat(t.acceleration)));
    const maxAccelRegion = trends.find(t => parseFloat(t.acceleration) === maxAccel);

    // DOM elementlarini yangilash
    const elements = {
        maxGrowth: document.getElementById('maxGrowth'),
        avgAccel: document.getElementById('avgAccel')
    };
    
    if (elements.maxGrowth && maxGrowthRegion) {
        elements.maxGrowth.innerHTML = `${maxGrowthRegion.region}<br>${maxAvgGrowth}%`;
    }
    
    if (elements.avgAccel && maxAccelRegion) {
        elements.avgAccel.innerHTML = `${maxAccelRegion.region}<br>${maxAccel}%`;
    }
}

// Ko'rsatkichlar grafigini yaratish
function createIndicatorChart(data, year) {
    if (!data || !data.data) return;
    
    const regions = data.data;
    const sortedData = [...regions].sort((a, b) => {
        const aValue = a.values.find(v => v.year === parseInt(year))?.value || 0;
        const bValue = b.values.find(v => v.year === parseInt(year))?.value || 0;
        return bValue - aValue;
    });
    
    const canvas = document.getElementById('gdpChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Eski grafik mavjud bo'lsa, uni o'chirish
    if (window.gdpChart instanceof Chart) {
        window.gdpChart.destroy();
    }

    const values = sortedData.map(r => r.values.find(v => v.year === parseInt(year))?.value || 0);
    const maxValue = Math.max(...values);

    window.gdpChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(r => r.region_name),
            datasets: [{
                label: `Norasmiy iqtisodiyotning ulushi (%)`,
                data: values,
                backgroundColor: values.map(v => `rgba(54, 162, 235, ${v/maxValue})`),
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `${year}-yil ko'rsatkichlari`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = values.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                `Ulushi: ${value.toFixed(1)}%`,
                                `Umumiy ulushdagi ulushi: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ulushi (%)'
                    }
                }
            }
        }
    });

    // O'sish tendensiyalari grafigini yaratish
    createGrowthTrendChart(data);
}

// Asosiy ishga tushirish funksiyasi
async function initialize() {
    try {
        const data = await loadData();
        if (!data) return;

        // Ma'lumotlar manbasini yangilash
        updateDatasetMetadata(data);

        // Yil tanlovini to'ldirish
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) {
            const years = getYears();
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `${year}-yil`;
                yearSelect.appendChild(option);
            });
            yearSelect.value = '2024';

            // Grafiklarni yaratish
            createIndicatorChart(data, yearSelect.value);

            // O'zgarishlarni kuzatish
            yearSelect.addEventListener('change', () => createIndicatorChart(data, yearSelect.value));
        }
    } catch (error) {
        console.error('Ma\'lumotlarni yuklashda xatolik:', error);
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        if (errorContainer && errorMessage) {
            errorMessage.textContent = `Ma'lumotlarni yuklashda xatolik yuz berdi: ${error.message}`;
            errorContainer.style.display = 'block';
        }
    }
}

// Sahifa yuklanganda ishga tushirish
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initialize);
}
