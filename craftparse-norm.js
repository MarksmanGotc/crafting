let initialMaterials = {}; 
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.has('debug') && urlParams.get('debug') === 'true';


document.addEventListener('DOMContentLoaded', function() {
    createLevelStructure();
    addCalculateButton();
    generateMaterialList();
	formatedInputNumber();
	inputActive();
	
    // Kun footerin sisällä olevaa SVG:tä painetaan
    document.querySelectorAll('footer svg, #openGiftFromHeader').forEach(element => {
		element.addEventListener('click', function() {
			const pageDivs = document.querySelectorAll('.wrapper > div');
			const giftDiv = document.querySelector('.wrapper .gift');

			pageDivs.forEach(div => {
				div.style.display = 'none';
			});
			giftDiv.style.display = 'flex';
			gtag('event', 'donate_click', {
				'event_label_gift': 'Open domnate views'
			});
		});
	});

    document.querySelector('.gift button').addEventListener('click', function() {
        const pageDivs = document.querySelectorAll('.wrapper > div');
        const wrapperDiv = document.querySelector('#generatebychoice');

        pageDivs.forEach(div => {
            div.style.display = 'none';
        });

        wrapperDiv.style.display = 'block';
    });
});

function generateMaterialList() {
    const materialsListDiv = document.querySelector("#yourMaterials .materials-list");
    materialsListDiv.innerHTML = ""; // Tyhjennetään lista ensin, varmuuden vuoksi

    Object.entries(materials).forEach(([materialName, materialInfo]) => {
        const materialDiv = document.createElement('div');
        materialDiv.className = "my-material " + `${materialName.toLowerCase().replace(/\s/g, '-')}`;

        const img = document.createElement('img');
        img.src = materialInfo.img;
        materialDiv.appendChild(img);

        const infoDiv = document.createElement('div');
        const span = document.createElement('span');
        span.textContent = materialName;
        infoDiv.appendChild(span);

        //const firstNumber = Math.floor(Math.random() * 4) + 3; // Satunnainen numero välillä 3-6
		//const otherNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join(''); // Generoi kuusi satunnaista numeroa väliltä 0-9 ja liitä ne yhteen merkkijonoksi
		//const formattedPlaceholder = formatPlaceholderWithCommas(`${firstNumber}${otherNumbers}`);

		const input = document.createElement('input');
		input.type = "text";
		input.className = "numeric-input";
		input.id = `my-${materialName.toLowerCase().replace(/\s/g, '-')}`;
		input.name = `my-${materialName.toLowerCase().replace(/\s/g, '-')}`;
		input.placeholder = "value"; // Käytä formatoitua placeholderia
		input.pattern = "[0-9]*"; // Sallii vain numerot
		input.inputMode = "numeric";
		
		infoDiv.appendChild(input);

        materialDiv.appendChild(infoDiv);
        materialsListDiv.appendChild(materialDiv);
    });
}

function formatPlaceholderWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatedInputNumber(){
	document.addEventListener('input', function(e) {
		if (e.target.classList.contains('numeric-input')) {
			let inputValue = e.target.value;

			// Poista kaikki muut merkit paitsi numerot ja pilkut
			let numericValue = inputValue.replace(/[^0-9,]/g, '');

			// Muunna numero USA-formaattiin
			let formattedValue = numericValue
				.replace(/,/g, '') // Poista ensin olemassa olevat pilkut, jotta ne eivät häiritse
				.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Lisää pilkut joka kolmannen numeron jälkeen

			e.target.value = formattedValue;
		}
	});

}

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
	const generatebychoice = document.getElementById('generatebychoice');
    
    const calculateBtn = document.createElement('button');
    calculateBtn.textContent = 'Calculate';
	calculateBtn.classList.add('calculate-button'); 
    calculateBtn.addEventListener('click', calculateMaterials);
    manualInputDiv.appendChild(calculateBtn);

    // Luodaan "Generoi 480"-nappi
    const generateBtn = document.createElement('div');
	generateBtn.classList.add('generate-480')
    generateBtn.textContent = 'Generate 480';
    generateBtn.addEventListener('click', function() {
        // Tyhjennä kaikki aikaisemmat valinnat ja aseta arvot automaattisesti
        setTemplateValues({
            "1": { "Flax Legwraps": 214, "Copper Band": 232, "Dagger": 34 },
            "5": { "Boiled Leather Shirt": 175, "Wool Bandana": 152, "Spear": 153 },
            "10": { "Copper Pot": 70, "Padded Armor": 61, "Wool Leggings": 59, "Galoshes": 75, "Velvet Boots": 11, "Mace": 70, "Short Bow": 75, "Pyrite Lament": 59 }
        });

       
        calculateMaterials();
        addMultiplierButtons();
		if (!isDebugMode){
			gtag('event', 'auto_generate', {
				'value': 1
			});
		}
    });
    generatebychoice.appendChild(generateBtn);

    // Luodaan "Generoi materiaalien perusteella"-nappi
    /*const generateBasedOnMaterialsBtn = document.createElement('button');
    generateBasedOnMaterialsBtn.textContent = 'Generate based on materials';
    generateBasedOnMaterialsBtn.addEventListener('click', function() {
        document.getElementById("manualInput").style.display = "none";
        document.getElementById("generatebychoice").style.display = "block";
    });
	const closeMaterialsBtn = document.getElementById("closeMaterials");
    if(closeMaterialsBtn) { // Check if the button exists
        closeMaterialsBtn.addEventListener('click', function() {
            document.getElementById("manualInput").style.display = "block";
            document.getElementById("generatebychoice").style.display = "none";
        });
    }
    manualInputDiv.appendChild(generateBasedOnMaterialsBtn);*/
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
	const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
        if (input.value) {
            input.value = parseInt(input.value) * multiplier;
        }
    });
	if (!isDebugMode){
		gtag('event', 'generate_multiplier', {
			'event_multiplier_value': multiplier,
			'value': 1
		});
	}

    // Kutsu calculateMaterials uudelleen päivitetyillä arvoilla
    calculateMaterials();
	addMultiplierButtons();
}



// Funktio tulosten näyttämiseen (modifioi tämä toimimaan haluamallasi tavalla)
function showResults() {
	document.getElementById('results').style.display = 'block';
	document.getElementById('generatebychoice').style.display = 'none';
	window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
	
    document.querySelector('.spinner-wrap').classList.remove('active');

}

function closeResults() {
	const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Tyhjennä aiemmat tulokset
	document.getElementById('results').style.display = 'none';
	document.getElementById('generatebychoice').style.display = 'block';
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
    //manualInputDiv.style.display = 'block'; // Aseta näkyväksi

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
    //resultsDiv.innerHTML = ''; // Tyhjennä aiemmat tulokset

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
		const pAvailableMaterials = document.createElement('p');
		pMatName.className = 'name';
		pMatAmount.className = 'amount';
		pAvailableMaterials.className = 'available-materials';
		
		pMatName.textContent = `${materialName}`;
        pMatAmount.textContent = `-${new Intl.NumberFormat('en-US').format(data.amount)}`;
		// Laske ja näytä jäljellä oleva materiaalimäärä
		const normalizedMaterialName = materialName.toLowerCase().replace(/\s+/g, '-'); // Korvaa välilyönnit viivoilla
		const originalAmount = initialMaterials[normalizedMaterialName] || 0;
		if(originalAmount>0){
			const remainingAmount = originalAmount - data.amount;
			if(remainingAmount>=0){
				pAvailableMaterials.textContent = `${new Intl.NumberFormat('en-US').format(remainingAmount)}`;
			}
		}
		
		
        materialContainer.appendChild(pMatName);
		materialContainer.appendChild(pMatAmount);
		materialContainer.appendChild(pAvailableMaterials);

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
	
		if (!isDebugMode){
			gtag('event', 'total_templates', {
				'event_total_templates': levelItemCounts,
				'value': 1
			});
		}
		
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

/*
function getTotalItemsByLevel(templateCounts) {
    let totalItemsByLevel = {};
    Object.keys(templateCounts).forEach(level => {
        // Lasketaan kunkin tason itemien kokonaismäärä
        totalItemsByLevel[level] = templateCounts[level].reduce((total, item) => total + item.amount, 0);
    });
    return totalItemsByLevel;
}*/

function areAllCountsSame(levelItemCounts) {
    const counts = Object.values(levelItemCounts);
    return counts.every(count => count === counts[0]);
}

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

document.getElementById('calculateWithPreferences').addEventListener('click', function() {
	const materialInputs = document.querySelectorAll('.my-material input[type="text"]');
	const templateAmountInput = document.querySelectorAll('#templateAmount');
	const allInputs = [...materialInputs, ...templateAmountInput];
	let isValid = true;

	allInputs.forEach(input => {
		if (!input.value || parseInt(input.value.replace(/,/g, '')) === 0) {
			isValid = false;
			input.classList.add('missing-input');
			setTimeout(() => {
				input.classList.remove('missing-input');
			}, 3000);
		}
	});

	if (!isValid) {
		return; // Estä laskennan suoritus
	}
	
	document.querySelector('.spinner-wrap').classList.add('active');
	
	setTimeout(() => {
		
		
		let availableMaterials = gatherMaterialsFromInputs();
		if (Object.keys(initialMaterials).length === 0) {
			initialMaterials = { ...availableMaterials };
		}
		let totalTemplates = parseInt(document.getElementById('templateAmount').value.replace(/,/g, ''));
		if (isNaN(totalTemplates)) {
			return;
		} else {
			if (!isDebugMode){ 
				gtag('event', 'total_material_templates', {
					'event_material_templates': totalTemplates,
					'value': 1
				});
			}
		}
		
		let materialAmounts = Object.values(availableMaterials).map(amount => {
			// Tarkista, onko arvo merkkijono ja sisältääkö se pilkkuja
			if (typeof amount === 'string' && amount.includes(',')) {
				// Muunna merkkijono numeroksi poistamalla pilkut ja käyttämällä parseInt
				return parseInt(amount.replace(/,/g, ''), 10);
			} else {
				// Jos arvo on jo numero tai merkkijono ilman pilkkuja, palauta se sellaisenaan
				return parseInt(amount, 10);
			}
		});
		
		if (!isDebugMode){
			let totalMaterialAmount = materialAmounts.reduce((total, amount) => total + amount, 0);
			let averageMaterialAmount = materialAmounts.length > 0 ? totalMaterialAmount / materialAmounts.length : 0;
			let maxMaterialAmount = Math.max(...materialAmounts);
			let maxMaterialIndex = materialAmounts.findIndex(amount => amount === maxMaterialAmount);
			let maxMaterialName = Object.keys(availableMaterials)[maxMaterialIndex];

			gtag('event', 'material_analytics', {
				'average_material_amount': parseInt(averageMaterialAmount),
				'max_material_amount': maxMaterialAmount,
				'max_material_name': maxMaterialName,
				'value': 1
			});
		}

		let productionPlan = calculateProductionPlan(availableMaterials, totalTemplates);

		document.querySelectorAll('#manualInput input[type="number"]').forEach(input => {
			input.value = ''; // Nollaa kaikki input-kentät
		});
		listSelectedProducts(productionPlan);
		const calculateBtn = document.querySelector('.calculate-button');
		if (calculateBtn) {
			calculateBtn.click(); // Simuloi napin klikkausta
		}
	}, 0);
});

function gatherMaterialsFromInputs() {
    let materials = {};
    document.querySelectorAll('.my-material input[type="text"]').forEach(input => {
        const materialName = input.getAttribute('name').replace('my-', '');
        const materialAmount = parseInt(input.value.replace(/,/g, ''), 10);
        if (!isNaN(materialAmount)) {
            materials[materialName] = materialAmount;
        }
    });
    return materials;
}


function calculateProductionPlan(availableMaterials, totalTemplates) {
    let productionPlan = { "1": [], "5": [], "10": [] };

    for (let i = 0; i < totalTemplates; i++) {
        let preferences = getUserPreferences(availableMaterials);
        let productsSelectedThisRound = { "1": null, "5": null, "10": null }; // Tämän kierroksen valitut tuotteet

        for (let level of [1, 5, 10]) {
            const levelProducts = craftItem.products.filter(product => product.level === level);
            const selectedProduct = selectProductForLevel(levelProducts, preferences.mostAvailableMaterials, preferences.secondMostAvailableMaterials, preferences.leastAvailableMaterials, availableMaterials);

            if (selectedProduct) {
                productionPlan[level].push(selectedProduct.name);
                productsSelectedThisRound[level] = selectedProduct; // Tallennetaan valittu tuote
                updateAvailableMaterials(availableMaterials, selectedProduct); // Päivitetään materiaalien määrä
            } else {
                // Jos tuotetta ei voi valita, keskeytetään prosessi ja poistetaan edelliset tuotteet
                if (level > 1) { // Tarkistetaan, että ollaan yli ensimmäisen tason
                    productionPlan[1].pop(); // Poistetaan viimeisin level 1 tuote
                    if (level > 5) {
                        productionPlan[5].pop(); // Poistetaan viimeisin level 5 tuote, jos keskeytys tapahtuu level 10:ssä
                    }
					displayUserMessage(`The given materials ran out. <br>Only ${i} templates could be produced.`);
					
                }
                return productionPlan; // Palautetaan jo tuotettu tuotantosuunnitelma
            }
        }
    }

    return productionPlan; // Kaikki pyydetyt templatet onnistuttiin tuottamaan
}

function displayUserMessage(message) {
    const resultsDiv = document.getElementById('results');
    const messageElement = document.createElement('h3');
    messageElement.innerHTML = message;
    const generateDiv = resultsDiv.querySelector('.generate');

    // Lisää viesti ennen generateDiviä
    resultsDiv.insertBefore(messageElement, generateDiv);
}




function updateAvailableMaterials(availableMaterials, selectedProduct) {
    Object.entries(selectedProduct.materials).forEach(([material, amountRequired]) => {
        // Yhtenäistä materiaalin nimi
        const normalizedMaterial = material.toLowerCase().replace(/ /g, '-');
        if (availableMaterials[normalizedMaterial] !== undefined) {
            availableMaterials[normalizedMaterial] -= amountRequired;
        } 
    });
}





function getUserPreferences(availableMaterials) {
	let sortedMaterials = Object.entries(availableMaterials).sort((a, b) => b[1] - a[1]);
    let uniqueAmounts = [...new Set(sortedMaterials.map(([_, amount]) => amount))];

    let mostAvailableMaterials = [], secondMostAvailableMaterials = [], leastAvailableMaterials = [];

    // Määritä materiaalit, joita on eniten
    let maxAmount = uniqueAmounts[0];
    mostAvailableMaterials = sortedMaterials.filter(([_, amount]) => amount === maxAmount).map(([material, _]) => material);

    if (mostAvailableMaterials.length < 4) {
        let nextAmountIndex = 1;
        while (secondMostAvailableMaterials.length < 4 - mostAvailableMaterials.length && nextAmountIndex < uniqueAmounts.length) {
            let currentAmount = uniqueAmounts[nextAmountIndex];
            let currentMaterials = sortedMaterials.filter(([_, amount]) => amount === currentAmount).map(([material, _]) => material);
            secondMostAvailableMaterials.push(...currentMaterials);
            nextAmountIndex++;
        }
        secondMostAvailableMaterials = secondMostAvailableMaterials.slice(0, 4 - mostAvailableMaterials.length);
    }

    // Määritä materiaalit, joita on vähiten, huomioiden most ja second
    if (mostAvailableMaterials.length + secondMostAvailableMaterials.length < 12) {
        let leastAmountsNeeded = 4;
        if (mostAvailableMaterials.length + secondMostAvailableMaterials.length > 8) {
            leastAmountsNeeded = 12 - (mostAvailableMaterials.length + secondMostAvailableMaterials.length);
        }

        let leastIndexStart = uniqueAmounts.length - leastAmountsNeeded;
        for (let i = leastIndexStart; i < uniqueAmounts.length; i++) {
            let currentAmount = uniqueAmounts[i];
            leastAvailableMaterials.push(...sortedMaterials.filter(([_, amount]) => amount === currentAmount).map(([material, _]) => material));
        }
        leastAvailableMaterials = leastAvailableMaterials.slice(0, leastAmountsNeeded);
    }

    return { mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials };
}


function selectProductForLevel(levelProducts, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials, availableMaterials) {
    let selectedProduct = null;
    let highestScore = -Infinity;

    levelProducts.forEach(product => {
        let score = getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials);
        if (canProductBeProduced(product, availableMaterials) && score > highestScore) {
            selectedProduct = product;
            highestScore = score;
            // Vähennä valitun tuotteen materiaalit jäljellä olevista materiaaleista
            Object.entries(product.materials).forEach(([material, amountRequired]) => {
                if (availableMaterials[material] !== undefined) {
                    availableMaterials[material] -= amountRequired;
                }
            });
			
        }
    });

    return selectedProduct;
}


function getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials) {
    let score = 0;
    Object.entries(product.materials).forEach(([material, _]) => {
        let normalizedMaterial = material.toLowerCase().replace(/ /g, "-"); // Oletetaan, että " " korvataan "-"
        if (mostAvailableMaterials.includes(normalizedMaterial)) {
            score += 10;
        }
        if (secondMostAvailableMaterials.includes(normalizedMaterial)) {
            score += 5;
        }
        if (leastAvailableMaterials.includes(normalizedMaterial)) {
            score -= 10;
        }
    });
    return score;
}


function canProductBeProduced(product, availableMaterials) {
    return Object.entries(product.materials).every(([material, amountRequired]) => {
        // Muunna materiaalin nimi yhtenäiseen muotoon
        const normalizedMaterial = material.toLowerCase().replace(/ /g, "-");
        const isEnough = availableMaterials[normalizedMaterial] && availableMaterials[normalizedMaterial] >= amountRequired;
        return isEnough;
    });
}

function listSelectedProducts(productionPlan) {
    Object.entries(productionPlan).forEach(([level, productNames]) => {
        productNames.forEach(productName => {
            // Etsi olemassa oleva input-kenttä tuotenimen perusteella
            const inputElement = document.querySelector(`#level-${level}-items input[name="${productName}"]`);
            if (inputElement) {
                // Päivitä input-kentän arvo valittujen tuotteiden määrällä
                inputElement.value = (parseInt(inputElement.value) || 0) + 1;
            }
        });
    });
}


function inputActive(){

	const materialChoices = document.querySelector('.material-choices');

    materialChoices.addEventListener('click', (e) => {
        // Poista 'active' luokka kaikista div.my-material elementeistä, jos input on tyhjä
        document.querySelectorAll('.material-choices .my-material').forEach(div => {
            if (div.querySelector('.numeric-input').value === '') {
                div.classList.remove('active');
            }
        });

        // Lisää 'active' luokka klikatulle elementille
        const clickedDiv = e.target.closest('.my-material');
        if (clickedDiv) {
            clickedDiv.classList.add('active');
            clickedDiv.querySelector('.numeric-input').focus();
        }
    });

    // Käsittele input-kenttien focusout ja focusin tapahtumat
    document.querySelectorAll('.material-choices .my-material .numeric-input').forEach(input => {
        input.addEventListener('focusout', () => {
            // Jos input on tyhjä, poista 'active' luokka
            // Muuten, säilytä 'active' luokka
            if (input.value === '') {
                input.closest('.my-material').classList.remove('active');
            }
        });

        input.addEventListener('focus', () => {
            // Lisää 'active' luokka tälle elementille
            document.querySelectorAll('.material-choices .my-material').forEach(div => {
                // Poista 'active' luokka muista elementeistä vain, jos niiden input on tyhjä
                if (div.querySelector('.numeric-input').value === '') {
                    div.classList.remove('active');
                }
            });
            input.closest('.my-material').classList.add('active');
        });
    });
	
	const templateInput = document.querySelector('#templateAmount');
    const templateWrap = document.querySelector('.templateAmountWrap');

    templateInput.addEventListener('focus', () => {
        templateWrap.classList.add('active');
    });

    templateInput.addEventListener('blur', () => {
        if (!templateInput.value) {
            templateWrap.classList.remove('active');
        }
    });
	
}
