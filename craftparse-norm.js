let initialMaterials = {}; 
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.has('debug') && urlParams.get('debug') === 'true';


document.addEventListener('DOMContentLoaded', function() {
    createLevelStructure();
    addCalculateButton();
    generateMaterialList();
	addWarlordToggle();
	formatedInputNumber();
        inputActive();

    if (urlParams.has('data')) {
        try {
            const decoded = JSON.parse(decodeURIComponent(atob(urlParams.get('data'))));
            setTemplateValues(decoded);
            const calcBtn = document.querySelector('.calculate-button');
            if (calcBtn) calcBtn.click();
        } catch (e) {
            console.error('Failed to load shared data', e);
        }
    }
	
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
        span.textContent = materialInfo["Original-name"] || materialName;
        infoDiv.appendChild(span);


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

function addWarlordToggle() {
    const wrap = document.querySelector('.templateAmountWrap');

    const includeDiv = document.createElement('div');
    includeDiv.className = 'warlord-toggle';

    const includeCheckbox = document.createElement('input');
    includeCheckbox.type = 'checkbox';
    includeCheckbox.id = 'includeWarlords';
    includeCheckbox.checked = false;

    const includeLabel = document.createElement('label');
    includeLabel.htmlFor = 'includeWarlords';
    includeLabel.textContent = 'Include CTW items';

    includeDiv.appendChild(includeCheckbox);
    includeDiv.appendChild(includeLabel);

    const level1Div = document.createElement('div');
    level1Div.className = 'warlord-toggle';

    const level1Checkbox = document.createElement('input');
    level1Checkbox.type = 'checkbox';
    level1Checkbox.id = 'level1OnlyWarlords';

    const level1Label = document.createElement('label');
    level1Label.htmlFor = 'level1OnlyWarlords';
    level1Label.textContent = 'Use only CTW items for Level 1';
    level1Checkbox.checked = true; 

    level1Div.appendChild(level1Checkbox);
    level1Div.appendChild(level1Label);

    // Lisää toggle <div> heti .templateAmountWrap-divin jälkeen
    wrap.parentNode.insertBefore(includeDiv, wrap.nextSibling);
    includeDiv.parentNode.insertBefore(level1Div, includeDiv.nextSibling);
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
	const remainingUse = {};
    
    // Kerää tiedot kaikista syötetyistä itemeistä
    document.querySelectorAll('div[id^="level-"]').forEach(levelDiv => {
        const level = parseInt(levelDiv.id.split('-')[1]);
        levelDiv.querySelectorAll('input[type="number"]').forEach(input => {
            const amount = parseInt(input.value) || 0;
            const productName = input.name;
            //const product = craftItem.products.find(p => p.name === productName);
			const product = craftItem.products.find(p => p.name === productName && p.level === level);

    
            if (product && amount > 0) {
                templateCounts[level].push({ name: productName, amount: amount, img: product.img, materials: product.materials });
    
                Object.entries(product.materials).forEach(([rawName, requiredAmount]) => {
					const materialName = Object.keys(materials).find(
						key => key.toLowerCase().replace(/\s/g, '-') === rawName.toLowerCase().replace(/\s/g, '-')
					) || rawName;

                    if (!materialCounts[materialName]) {
						materialCounts[materialName] = {
							amount: 0,
							img: materials[materialName] ? materials[materialName].img : ''
						};
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
        const pRemaining = document.createElement('p');
        const pAvailableMaterials = document.createElement('p');
        pMatName.className = 'name';
        pMatAmount.className = 'amount';
        pRemaining.className = 'remaining-to-use';
        pAvailableMaterials.className = 'available-materials';
		
		//pMatName.textContent = `${materialName}`;
		pMatName.textContent = materials[materialName]["Original-name"] || materialName;
        pMatAmount.textContent = `-${new Intl.NumberFormat('en-US').format(data.amount)}`;
		pRemaining.textContent = pMatAmount.textContent;
        remainingUse[materialName] = data.amount;
		// Laske ja näytä jäljellä oleva materiaalimäärä
		const matchedKey = Object.keys(initialMaterials).find(
			key => key.toLowerCase().replace(/\s/g, '-') === materialName.toLowerCase().replace(/\s/g, '-')
		);
		const originalAmount = matchedKey ? initialMaterials[matchedKey] : 0;

		
		if(originalAmount>0){
			const remainingAmount = originalAmount - data.amount;
			if(remainingAmount>=0){
				pAvailableMaterials.textContent = `${new Intl.NumberFormat('en-US').format(remainingAmount)}`;
			}
		}
		
		
        materialContainer.dataset.material = materialName;
        materialContainer.appendChild(pMatName);
        materialContainer.appendChild(pMatAmount);
        materialContainer.appendChild(pRemaining);
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

                const matsDiv = document.createElement('div');
                matsDiv.className = 'item-mats';
                const materialUsage = {};
                Object.entries(template.materials).forEach(([mat, amt]) => {
                    const totalAmt = amt * template.amount;
                    materialUsage[mat] = totalAmt;
                    const pLine = document.createElement('p');
                    pLine.className = 'item-material';
                    pLine.innerHTML = `${mat} <span>${new Intl.NumberFormat('en-US').format(totalAmt)}</span>`;
                    matsDiv.appendChild(pLine);
                });
                templateDiv.dataset.materials = JSON.stringify(materialUsage);
                templateDiv.appendChild(matsDiv);

                templateDiv.addEventListener('click', function() {
                    this.classList.toggle('opacity');
                    const used = JSON.parse(this.dataset.materials);
                    const done = this.classList.contains('opacity');
                    Object.entries(used).forEach(([mat, amt]) => {
                        if (done) {
                            remainingUse[mat] -= amt;
                        } else {
                            remainingUse[mat] += amt;
                        }
                        const target = materialsDiv.querySelector(`div[data-material="${mat}"] .remaining-to-use`);
                        if (target) {
                            target.textContent = `-${new Intl.NumberFormat('en-US').format(remainingUse[mat])}`;
                        }
                    });
                });

                levelGroup.appendChild(templateDiv);
            });
        }
    });


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
	const templateAmountInput = document.querySelector('#templateAmount');
	const allInputs = [...materialInputs, templateAmountInput];

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
			document.querySelector('.spinner-wrap').classList.remove('active');
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
    let materialsInput = {};
    document.querySelectorAll('.my-material input[type="text"]').forEach(input => {
        const id = input.getAttribute('id').replace('my-', '');
        const materialName = Object.keys(materials).find(name => name.toLowerCase().replace(/\s/g, '-') === id);
        const materialAmount = parseInt(input.value.replace(/,/g, ''), 10);
        if (!materialName) {
            return;
        }
        if (!isNaN(materialAmount)) {
            materialsInput[materialName] = materialAmount;
        }
    });

    return materialsInput;
}



function calculateProductionPlan(availableMaterials, totalTemplates) {
    let productionPlan = { "1": [], "5": [], "10": [] };
	const includeWarlords = document.getElementById('includeWarlords')?.checked ?? true;
    const level1OnlyWarlords = document.getElementById('level1OnlyWarlords')?.checked ?? false;

    for (let i = 0; i < totalTemplates; i++) {
        let preferences = getUserPreferences(availableMaterials);
        let productsSelectedThisRound = { "1": null, "5": null, "10": null }; // Tämän kierroksen valitut tuotteet

        for (let level of [1, 5, 10]) {
            //const levelProducts = craftItem.products.filter(product => product.level === level).filter(product => includeWarlords || !product.warlord);
			//const levelProducts = craftItem.products.filter(product => product.level === level && (includeWarlords || !product.warlord));
            let levelProducts;
            if (level === 1 && level1OnlyWarlords) {
                levelProducts = craftItem.products.filter(product => product.level === 1 && product.warlord);
            } else {
                levelProducts = craftItem.products.filter(product => product.level === level && (includeWarlords || !product.warlord));
            }
			
			
            //const selectedProduct = selectProductForLevel(levelProducts, preferences.mostAvailableMaterials, preferences.secondMostAvailableMaterials, preferences.leastAvailableMaterials, availableMaterials);
			const selectedProduct = selectBestAvailableProduct(levelProducts, preferences.mostAvailableMaterials, preferences.secondMostAvailableMaterials, preferences.leastAvailableMaterials, availableMaterials);
    
	
	

			
            if (selectedProduct && canProductBeProduced(selectedProduct, availableMaterials)) {
                productionPlan[level].push(selectedProduct.name);
                productsSelectedThisRound[level] = selectedProduct; // Tallennetaan valittu tuote
                updateAvailableMaterials(availableMaterials, selectedProduct); // Päivitetään materiaalien määrä
            } else {
                // Jos tuotetta ei voi valita, keskeytetään prosessi ja poistetaan edelliset tuotteet
                if (level > 1) {
					if (productsSelectedThisRound[1]) {
						rollbackMaterials(availableMaterials, productsSelectedThisRound[1]);
						productionPlan[1].pop();
					}
					if (level > 5 && productsSelectedThisRound[5]) {
						rollbackMaterials(availableMaterials, productsSelectedThisRound[5]);
						productionPlan[5].pop();
					}
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
        const normalizedMaterial = material.toLowerCase().replace(/\s/g, '-');
        const matchedKey = Object.keys(availableMaterials).find(key =>
            key.toLowerCase().replace(/\s/g, '-') === normalizedMaterial
        );

        if (matchedKey) {
            availableMaterials[matchedKey] -= amountRequired;
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

function selectBestAvailableProduct(levelProducts, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials, availableMaterials) {
    // Järjestä tuotteet pisteiden mukaan
    const candidates = levelProducts
        .map(product => ({
            product,
            score: getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials)
        }))
        .sort((a, b) => b.score - a.score); // suurimmasta pienimpään

    // Etsi ensimmäinen tuote, jonka materiaalit riittävät
    for (const { product } of candidates) {
        if (canProductBeProduced(product, availableMaterials)) {
            return product;
        }
    }

    return null; // Mikään tuote ei kelpaa
}

function rollbackMaterials(availableMaterials, product) {

    Object.entries(product.materials).forEach(([material, amountRequired]) => {
        const normalizedMaterial = material.toLowerCase().replace(/\s/g, '-');
        const matchedKey = Object.keys(availableMaterials).find(key =>
            key.toLowerCase().replace(/\s/g, '-') === normalizedMaterial
        );

        if (matchedKey) {
            availableMaterials[matchedKey] += amountRequired;
        }
    });
}




function getMaterialScore(product, mostAvailableMaterials, secondMostAvailableMaterials, leastAvailableMaterials) {
    let score = 0;
    Object.entries(product.materials).forEach(([material, _]) => {
        if (mostAvailableMaterials.includes(material)) {
            score += 10;
        }
        if (secondMostAvailableMaterials.includes(material)) {
            score += 5;
        }
        if (leastAvailableMaterials.includes(material)) {
            score -= 10;
        }
    });
    return score;
}

function canProductBeProduced(product, availableMaterials) {
    return Object.entries(product.materials).every(([material, amountRequired]) => {
        const normalizedMaterial = material.toLowerCase().replace(/\s/g, '-');
        const matchedKey = Object.keys(availableMaterials).find(key =>
            key.toLowerCase().replace(/\s/g, '-') === normalizedMaterial
        );

        if (!matchedKey) {
            return false;
        }

        return availableMaterials[matchedKey] >= amountRequired;
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
