document.addEventListener('DOMContentLoaded', function() {
    createLevelStructure();
    addCalculateButton();
	
});


function setTemplateValues(templates) {
    // Tyhjennä ensin kaikki aikaisemmat valinnat
    document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
        input.value = ''; // Nollaa kaikki input-kentät
    });

    // Aseta sitten uudet arvot
    Object.entries(templates).forEach(([level, items]) => {
        Object.entries(items).forEach(([itemName, amount]) => {
            const inputElement = document.querySelector(`input[name="${itemName}"]`);
            if (inputElement) {
                inputElement.value = amount;
            }
        });
    });
}

// Oletetaan, että addCalculateButton-funktio on jo määritelty ja se lisää sekä Laske että Generoi 480 -napit
function addCalculateButton() {
    const manualInputDiv = document.getElementById('manualInput');
    
    const calculateBtn = document.createElement('button');
    calculateBtn.textContent = 'Calculate';
    calculateBtn.addEventListener('click', calculateMaterials);
    manualInputDiv.appendChild(calculateBtn);

    // Luodaan "Generoi 480"-nappi
    const generateBtn = document.createElement('button');
    generateBtn.textContent = 'Generate 480';
    generateBtn.addEventListener('click', function() {
        // Tyhjennä kaikki aikaisemmat valinnat ja aseta arvot automaattisesti
        setTemplateValues({
            "1": { "Flax Legwraps": 214, "Copper Band": 232, "Dagger": 34 },
            "5": { "Boiled Leather Shirt": 175, "Wool Bandana": 152, "Spear": 153 },
            "10": { "Copper Pot": 70, "Padded Armor": 61, "Wool Leggings": 59, "Galoshes": 75, "Velvet Boots": 11, "Mace": 70, "Short Bow": 75, "Pyrite Lament": 59 }
        });

        // Laske materiaalit uusilla arvoilla
        
		calculateMaterials();
		addMultiplierButtons();
    });
	
	/*
	const openPreferencesBtn = document.createElement('button');
    openPreferencesBtn.textContent = 'Generate by choice';
    openPreferencesBtn.addEventListener('click', function() {
      	
        document.getElementById('manualInput').style.display = 'none';
		populateMaterialChoices();
        document.getElementById('generatebychoice').style.display = 'block';
        
    });
    manualInputDiv.appendChild(openPreferencesBtn);*/
    manualInputDiv.appendChild(generateBtn);
}


function addMultiplierButtons() {
    const resultsDiv = document.getElementById('results');
    // Etsi olemassa oleva generateDiv tai luo uusi, jos sitä ei löydy
    let generateDiv = resultsDiv.querySelector('.generate');
    if (!generateDiv) {
        generateDiv = document.createElement('div');
        generateDiv.className = 'generate';
        // Lisää generateDiv ennen itemeitä mutta materiaalien jälkeen
        const materialsDiv = resultsDiv.querySelector('.materials');
        if (materialsDiv.nextSibling) {
            resultsDiv.insertBefore(generateDiv, materialsDiv.nextSibling);
        } else {
            resultsDiv.appendChild(generateDiv);
        }
    } else {
        // Tyhjennä olemassa oleva generateDiv ennen uusien nappien lisäämistä
        generateDiv.innerHTML = '';
    }

    // Lisää kerroin-napit generateDiviin
    const multipliers = [2, 3, 4];
    multipliers.forEach(multiplier => {
        const button = document.createElement('button');
        button.textContent = `x${multiplier}`;
        button.className = 'multiplier-btn';
        button.addEventListener('click', () => multiplyValues(multiplier));
        generateDiv.appendChild(button);
    });
}




function multiplyValues(multiplier) {
    document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
        if (input.value) {
            input.value = parseInt(input.value) * multiplier;
        }
    });

    // Kutsu calculateMaterials uudelleen päivitetyillä arvoilla
    calculateMaterials();
	addMultiplierButtons();
}



// Funktio tulosten näyttämiseen (modifioi tämä toimimaan haluamallasi tavalla)
function showResults() {
	document.getElementById('results').style.display = 'block';
	document.getElementById('manualInput').style.display = 'none';
}

function closeResults() {
	document.getElementById('results').style.display = 'none';
	document.getElementById('manualInput').style.display = 'block';
}

function createCloseButton(parentElement) {
    const closeButton = document.createElement('button');
    closeButton.id = 'closeResults';
    closeButton.onclick = closeResults;
    closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M345 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-119 119L73 103c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l119 119L39 375c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l119-119L311 409c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-119-119L345 137z"/></svg>`;
    parentElement.appendChild(closeButton);
}

function createLevelStructure() {
    const manualInputDiv = document.getElementById('manualInput');
    manualInputDiv.style.display = 'block'; // Aseta näkyväksi

    const levels = [1, 5, 10];
    levels.forEach(level => {
        const levelHeader = document.createElement('h3');
        levelHeader.textContent = `Level ${level}`;
        levelHeader.style.cursor = 'pointer'; // Osoittaa, että elementtiä voi klikata
        manualInputDiv.appendChild(levelHeader);

        const itemsDiv = document.createElement('div');
        itemsDiv.id = `level-${level}-items`;
        // Aseta Level 1 näkyväksi ja muut piiloon
        if (level === 1) {
            itemsDiv.style.display = 'block'; // Aseta Level 1 itemit näkyviksi
        } else {
            itemsDiv.style.display = 'none'; // Muut tasot piiloon oletuksena
        }
        manualInputDiv.appendChild(itemsDiv);

        // Togglea itemsDivin näkyvyyttä klikattaessa
        levelHeader.addEventListener('click', () => {
            itemsDiv.style.display = itemsDiv.style.display === 'none' ? 'block' : 'none';
        });

        // Lisää kunkin tason itemit niiden containeriin
        craftItem.products.filter(product => product.level === level).forEach(product => {
            const productDiv = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = product.name;
            const input = document.createElement('input');
            input.type = 'number';
            input.name = product.name;
            input.placeholder = 'amount';

            productDiv.appendChild(label);
            productDiv.appendChild(input);
            itemsDiv.appendChild(productDiv);
        });
    });
}


function calculateMaterials() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Tyhjennä aiemmat tulokset

    const materialsDiv = document.createElement('div');
    materialsDiv.className = 'materials';
    resultsDiv.appendChild(materialsDiv);

    // Täytä materialsDiv materiaalien tiedoilla...

    const templateCounts = { 1: [], 5: [], 10: [] };
    const materialCounts = {};
    
    // Kerää tiedot kaikista syötetyistä itemeistä
    document.querySelectorAll('div[id^="level-"]').forEach(levelDiv => {
        const level = parseInt(levelDiv.id.split('-')[1]);
        levelDiv.querySelectorAll('input[type="number"]').forEach(input => {
            const amount = parseInt(input.value) || 0;
            const productName = input.name;
            const product = craftItem.products.find(p => p.name === productName);
    
            if (product && amount > 0) {
                templateCounts[level].push({ name: productName, amount: amount, img: product.img });
    
                Object.entries(product.materials).forEach(([materialName, requiredAmount]) => {
                    if (!materialCounts[materialName]) {
                        materialCounts[materialName] = { amount: 0, img: materials[materialName].img };
                    }
                    materialCounts[materialName].amount += requiredAmount * amount;
                });
            }
        });
    });
	Object.entries(materialCounts).forEach(([materialName, data]) => {
        const materialContainer = document.createElement('div');
        const img = document.createElement('img');
        img.src = data.img; // Oleta, että osoittaa materiaalin kuvaan
        img.alt = materialName;
        materialContainer.appendChild(img);

        const pMatName = document.createElement('p');
		const pMatAmount = document.createElement('p');
		pMatName.className = 'name';
		pMatAmount.className = 'amount';
		
		pMatName.textContent = `${materialName}`;
        pMatAmount.textContent = `${new Intl.NumberFormat('en-US').format(data.amount)}`;
		
        materialContainer.appendChild(pMatName);
		materialContainer.appendChild(pMatAmount);

        materialsDiv.appendChild(materialContainer);
    });
	
	
    // Luo generateDiv ja lisää se heti materialsDivin jälkeen
    const generateDiv = document.createElement('div');
    generateDiv.className = 'generate';
    materialsDiv.after(generateDiv);

    // Lisää kerroin-napit generateDiviin, jos tarpeen (x2, x3, x4)...

    // Tarkista, ovatko kaikkien tasojen item-määrät samat
    const levelItemCounts = calculateTotalItemsByLevel(templateCounts);
    const allSameCount = areAllCountsSame(levelItemCounts);

    if (allSameCount && levelItemCounts["1"] > 0) {
        // Jos kaikkien tasojen määrät ovat samat, lisää "Total templates" -teksti materialsDivin jälkeen
        const totalTemplatesHeader = document.createElement('h2');
        totalTemplatesHeader.textContent = `Total templates: ${new Intl.NumberFormat('en-US').format(levelItemCounts["1"])} pcs`;

        materialsDiv.after(totalTemplatesHeader);
        totalTemplatesHeader.after(generateDiv); // generateDiv lisätään totalTemplatesHeaderin jälkeen
    } else {
        materialsDiv.after(generateDiv); // Jos määrät eivät ole samat, generateDiv lisätään materialsDivin jälkeen
    }

    // Luo itemsDiv kaikille itemeille yhteisesti ja lisää se generateDivin jälkeen
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'items';
    allSameCount ? generateDiv.after(itemsDiv) : generateDiv.after(itemsDiv);

    // Lisää itemit ja tasot itemsDiviin
    Object.entries(templateCounts).forEach(([level, templates]) => {
        if (templates.length > 0) {
            const levelHeader = document.createElement('h4');
			levelHeader.textContent = allSameCount ? `Level ${level}` : `Level ${level} (${new Intl.NumberFormat('en-US').format(levelItemCounts[level])} pcs)`;

            itemsDiv.appendChild(levelHeader);
			


            const levelGroup = document.createElement('div');
            levelGroup.className = 'level-group';
            itemsDiv.appendChild(levelGroup);

            templates.forEach(template => {
                const templateDiv = document.createElement('div');
                const img = document.createElement('img');
                img.src = template.img;
                img.alt = template.name;
                templateDiv.appendChild(img);

                const pTemplateName = document.createElement('p');
				const pTemplateamount = document.createElement('p');
				pTemplateName.className = 'name';
				pTemplateamount.className = 'amount';
				
				pTemplateName.textContent = `${template.name}`;
				pTemplateamount.textContent = `${new Intl.NumberFormat('en-US').format(template.amount)}`;
				
				
                templateDiv.appendChild(pTemplateName);
				templateDiv.appendChild(pTemplateamount);

                levelGroup.appendChild(templateDiv);
            });
        }
    });

    // Lisää sulje-nappi
    createCloseButton(resultsDiv);
    showResults();
}

function calculateTotalItemsByLevel(templateCounts) {
    let totalItemsByLevel = {};

    // Käydään läpi jokainen taso templateCounts-objektissa
    Object.keys(templateCounts).forEach(level => {
        // Laske tämän tason kaikkien templatejen määrät yhteen
        const totalItems = templateCounts[level].reduce((sum, template) => sum + template.amount, 0);
        totalItemsByLevel[level] = totalItems;
    });

    return totalItemsByLevel;
}


function getTotalItemsByLevel(templateCounts) {
    let totalItemsByLevel = {};
    Object.keys(templateCounts).forEach(level => {
        // Lasketaan kunkin tason itemien kokonaismäärä
        totalItemsByLevel[level] = templateCounts[level].reduce((total, item) => total + item.amount, 0);
    });
    return totalItemsByLevel;
}

function areAllCountsSame(levelItemCounts) {
    const counts = Object.values(levelItemCounts);
    return counts.every(count => count === counts[0]);
}


/*
function populateMaterialChoices() {
    const materialsToUseLessDiv = document.getElementById('materialsToUseLess').querySelector('.materials-list');
    const materialsToUseMoreDiv = document.getElementById('materialsToUseMore').querySelector('.materials-list');

    Object.entries(materials).forEach(([materialName, materialData]) => {
        const imgElementLess = createMaterialImageElement(materialName, materialData.img, 'less');
        const imgElementMore = createMaterialImageElement(materialName, materialData.img, 'more');
        
        materialsToUseLessDiv.appendChild(imgElementLess);
        materialsToUseMoreDiv.appendChild(imgElementMore);
    });
} */

function createMaterialImageElement(materialName, imgUrl, preference) {
    const imgElement = document.createElement('img');
    imgElement.src = imgUrl;
    imgElement.alt = materialName;
    imgElement.className = 'material-image';
    imgElement.dataset.materialName = materialName;
    imgElement.dataset.preference = preference;

    imgElement.addEventListener('click', function() {
        this.classList.toggle('selected');
        // Täällä voit lisätä logiikkaa valintojen tallentamiseen tai käsittelyyn
    });

    return imgElement;
}
