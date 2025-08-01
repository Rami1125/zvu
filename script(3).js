// Function to show SweetAlert2 messages (Toast style)
function showToast(icon, title, text) {
    const duration = text.length > 19 ? 5000 : 3000; // 5 seconds for long text, 3 for short
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: duration,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

// Function to show loading overlay
function showLoading(message = 'טוען נתונים...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.querySelector('p').innerText = message;
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
    loadingOverlay.style.visibility = 'visible';
}

// Function to hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.visibility = 'hidden';
}

// Global data stores
let familiesData = {}; // Stores family details fetched from Google Sheet "לקוחות"
let productsCatalog = []; // Stores product catalog fetched from Google Sheet "מחסן מוצרים"
let previousOrdersHistory = []; // Stores previous orders for smart history from "הזמנות קודמות"
let currentOrderProducts = []; // Stores products currently added to the order for display/editing
let allContactsData = []; // Stores all contact data from Google Sheet for Contacts screen

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxvBPHFmT9trPCTGGzrhcKAxik28Pzco7OAhnY0gWLFKDHzfFyHpllheCt9ac78RMH-ZA/exec'; // This URL needs to be updated by the user!
// Company WhatsApp Number
const COMPANY_WHATSAPP_NUMBER = '972508860896';

// Current step in the order process (for progress bar)
let currentStep = 0; // 0 for login, 1 for family select, 2 for order form, 3 for products, 4 for confirmation

// Function to update live date and time in the header
function updateDateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24-hour format
    };
    const formattedDateTime = now.toLocaleString('he-IL', options).replace(/\./g, '/').replace(',', '');
    document.getElementById('currentDateTime').textContent = formattedDateTime;
}

// Function for typing effect (runs once)
let typingEffectPlayed = false;
function typeWriter(text, i, fnCallback) {
    const typingElement = document.getElementById('typingEffectText');
    if (i < text.length) {
        typingElement.innerHTML = text.substring(0, i + 1) + '<span class="typing-effect"></span>';
        setTimeout(function() {
            typeWriter(text, i + 1, fnCallback);
        }, 50); // Typing speed
    } else if (typeof fnCallback == 'function') {
        typingElement.innerHTML = text; // Remove blinking cursor
        // No loop, just call callback if provided
        if (fnCallback) fnCallback();
    }
}

// Function to start the typing animation (runs once)
function startTypingAnimation() {
    if (!typingEffectPlayed) {
        const phrase = "למשפחות זבולון עדירן ברוכים הבאים למערכת ההזמנות!";
        typeWriter(phrase, 0, () => {
            typingEffectPlayed = true;
        });
    }
}

// Function to update the progress bar and step labels
function updateProgressBar(step) {
    currentStep = step;
    const progressBar = document.getElementById('progressBar');
    const stepLabels = [
        document.getElementById('step1Label'),
        document.getElementById('step2Label'),
        document.getElementById('step3Label'),
        document.getElementById('step4Label')
    ];

    let progressWidth = 0;
    switch (step) {
        case 1: progressWidth = 25; break;
        case 2: progressWidth = 50; break;
        case 3: progressWidth = 75; break;
        case 4: progressWidth = 100; break;
        default: progressWidth = 0; // For login/other screens
    }
    progressBar.style.width = `${progressWidth}%`;

    stepLabels.forEach((label, index) => {
        if (index + 1 <= step) {
            label.classList.add('active-step');
        } else {
            label.classList.remove('active-step');
        }
    });
}

// Function to switch between content sections
function showContent(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    // Update active navigation button
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(button => {
        if (button.dataset.targetView === sectionId.replace('Content', '')) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Reset progress bar if not on order form
    if (sectionId !== 'orderFormContent') {
        updateProgressBar(0);
    }
}

// Function to fetch data from Google Apps Script
async function fetchDataFromGoogleSheets() {
    showLoading('טוען נתוני משפחות, מוצרים והיסטוריית הזמנות...');
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getInitialData`);
        console.log('Fetch response status for getInitialData:', response.status);
        console.log('Fetch response headers for getInitialData:', response.headers);

        if (!response.ok) {
            const errorText = await response.text(); // Get raw error text
            console.error('HTTP error response text for getInitialData:', errorText);
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Parsed data from Apps Script (getInitialData):', data); // Log the parsed data

        if (data.success === false) { // Assuming Apps Script sends { success: false, message: ... } on error
            throw new Error(data.message || 'Failed to fetch initial data from Google Sheets.');
        }

        // Populate global data stores
        familiesData = {};
        data.families.forEach(family => {
            familiesData[family['שם משפחה']] = {
                address: family['כתובת'] || 'לא ידוע',
                contact: family['איש קשר'] || 'לא ידוע',
                phone: family['טלפון'] || 'לא ידוע',
            };
        });

        productsCatalog = data.products.map(p => ({
            name: p['שם מוצר'],
            sku: p['מק"ט'],
            imageUrl: p['תמונה (URL)'] || 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001'
        }));

        previousOrdersHistory = data.previousOrders;

        // Populate allContactsData for the Contacts screen
        allContactsData = data.families.map(family => ({
            familyName: family['שם משפחה'],
            contactPerson: family['איש קשר'],
            phoneNumber: family['טלפון'],
            address: family['כתובת']
        }));
        populateContactsList(); // Populate contacts list on load

        populateFamilySelect();
        populateQuickFamilyButtons();
        populateProductDatalist();
        addProductSelection(); // Add the first product selection row

    } catch (error) {
        console.error('Error fetching initial data:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בטעינת הנתונים הראשוניים: ${error.message}. אנא ודא שה-Apps Script פרוס כראוי והגיליונות קיימים.`);
    } finally {
        hideLoading();
    }
}

function populateFamilySelect() {
    const familySelect = document.getElementById('familySelect');
    // Clear existing options except the first one
    while (familySelect.options.length > 1) {
        familySelect.remove(1);
    }
    for (const familyName in familiesData) {
        const option = document.createElement('option');
        option.value = familyName;
        option.textContent = familyName;
        familySelect.appendChild(option);
    }
    // If no families loaded, disable select or show message
    if (Object.keys(familiesData).length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "אין משפחות זמינות";
        option.disabled = true;
        option.selected = true;
        familySelect.appendChild(option);
        familySelect.disabled = true;
    } else {
        familySelect.disabled = false;
    }
}

function populateQuickFamilyButtons() {
    const quickFamilyButtonsContainer = document.getElementById('quickFamilyButtons');
    // Clear existing buttons, keep the instruction paragraph
    const existingButtons = quickFamilyButtonsContainer.querySelectorAll('button');
    existingButtons.forEach(button => button.remove());

    const colorClasses = ['color-red', 'color-blue', 'color-yellow', 'color-purple'];
    let index = 0;

    for (const familyName in familiesData) {
        const button = document.createElement('button');
        button.className = 'quick-family-button ' + colorClasses[index % colorClasses.length]; // Use new class for styling and assign color
        button.textContent = familyName;
        button.onclick = () => {
            document.getElementById('familySelect').value = familyName;
            document.getElementById('familySelect').dispatchEvent(new Event('change')); // Trigger change event
        };
        quickFamilyButtonsContainer.appendChild(button);
        index++;
    }
}

function populateProductDatalist() {
    const productOptions = document.getElementById('productOptions');
    if (productOptions) {
        productOptions.innerHTML = ''; // Clear existing options
        productsCatalog.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.setAttribute('data-sku', product.sku);
            productOptions.appendChild(option);
        });
    } else {
        console.warn("Datalist element with ID 'productOptions' not found. It might be dynamically removed or not present.");
    }
}

let productRowCounter = 0; // To keep track of multiple product selection rows

function addProductSelection(productToPrepopulate = null) {
    const productsContainer = document.getElementById('productsContainer');
    const currentIndex = productRowCounter++; // Increment counter for unique IDs

    const newProductDiv = document.createElement('div');
    newProductDiv.className = 'form-group product-selection';
    newProductDiv.innerHTML = `
        <label for="productSearch_${currentIndex}" class="input-label">שם מוצר / מק"ט:</label>
        <input type="text" id="productSearch_${currentIndex}" list="productOptions" class="form-control product-search-input" placeholder="הקלד לחיפוש מוצר או בחר מהרשימה">

        <input type="text" id="freeTextProduct_${currentIndex}" class="form-control free-text-product-input mt-2" placeholder="הקלד שם מוצר ידנית (לא חובה)">

        <label for="quantityInput_${currentIndex}" class="input-label mt-2">כמות:</label>
        <input type="number" id="quantityInput_${currentIndex}" class="form-control quantity-input" value="1" min="1">
        <input type="text" id="productNote_${currentIndex}" class="form-control product-note-input mt-2" placeholder="הערה לאיש קשר למוצר (לא חובה)">
        <div class="product-info-display mt-2" id="productInfo_${currentIndex}"></div>
        <div class="product-history-info mt-2" id="productHistoryInfo_${currentIndex}"></div>
        <button type="button" class="delete-product-row-btn btn-secondary mt-2 w-full glass-button" data-index="${currentIndex}">
            <i class="fas fa-times-circle mr-2"></i> הסר מוצר זה
        </button>
    `;
    productsContainer.appendChild(newProductDiv);

    // Get references to the newly created elements
    const productSearchInput = document.getElementById(`productSearch_${currentIndex}`);
    const freeTextProductInput = document.getElementById(`freeTextProduct_${currentIndex}`);
    const quantityInput = document.getElementById(`quantityInput_${currentIndex}`);
    const productNoteInput = document.getElementById(`productNote_${currentIndex}`);
    const productInfoDiv = document.getElementById(`productInfo_${currentIndex}`);
    const productHistoryInfoDiv = document.getElementById(`productHistoryInfo_${currentIndex}`);
    const deleteRowBtn = document.querySelector(`.delete-product-row-btn[data-index="${currentIndex}"]`);

    // Pre-populate if productToPrepopulate is provided (e.g., from history)
    if (productToPrepopulate) {
        if (productsCatalog.some(p => p.name === productToPrepopulate.name)) {
            productSearchInput.value = productToPrepopulate.name;
            productSearchInput.dispatchEvent(new Event('input')); // Trigger to update info/history
        } else {
            freeTextProductInput.value = productToPrepopulate.name;
            freeTextProductInput.dispatchEvent(new Event('input')); // Trigger to update info/history
        }
        quantityInput.value = productToPrepopulate.quantity || 1;
        productNoteInput.value = productToPrepopulate.note || '';
        // Manually update the internal array for this new row
        addOrUpdateCurrentOrderProduct({
            name: productToPrepopulate.name,
            sku: productToPrepopulate.sku || 'N/A',
            imageUrl: productToPrepopulate.imageUrl || 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001',
            quantity: parseInt(quantityInput.value, 10),
            note: productNoteInput.value.trim()
        }, currentIndex);
    }


    // Event listener for product search input (datalist)
    productSearchInput.addEventListener('input', (event) => {
        const typedValue = event.target.value;
        const productOptionsDatalist = document.getElementById('productOptions');
        productOptionsDatalist.innerHTML = ''; // Clear previous options in the datalist

        if (typedValue.length >= 2) {
            const filteredProducts = productsCatalog.filter(p =>
                p.name.toLowerCase().includes(typedValue.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(typedValue.toLowerCase()))
            );
            filteredProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product.name;
                option.setAttribute('data-sku', product.sku);
                productOptionsDatalist.appendChild(option);
            });
        }

        const selectedProductName = typedValue;
        const selectedProduct = productsCatalog.find(p => p.name === selectedProductName);

        productInfoDiv.innerHTML = '';
        productHistoryInfoDiv.innerHTML = '';
        freeTextProductInput.value = ''; // Clear free text input if datalist is used

        if (selectedProduct) {
            productInfoDiv.innerHTML = `
                <div class="product-item-display">
                    <img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=תמונת מוצר בקרוב';" onclick="showImagePreviewModal('${selectedProduct.imageUrl}')">
                    <div class="product-details-display">
                        <p class="product-name-display">${selectedProduct.name}</p>
                        <p class="product-sku-display">מק"ט: ${selectedProduct.sku}</p>
                    </div>
                </div>
            `;
            updateProductHistoryDisplay(selectedProductName, productHistoryInfoDiv);
            addOrUpdateCurrentOrderProduct({
                name: selectedProductName,
                sku: selectedProduct.sku,
                imageUrl: selectedProduct.imageUrl,
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        } else {
            removeCurrentOrderProduct(currentIndex);
        }
    });

    // Event listener for free text product input
    freeTextProductInput.addEventListener('input', (event) => {
        if (event.target.value.trim() !== '') {
            productSearchInput.value = ''; // Clear datalist input
            productInfoDiv.innerHTML = '';
            productHistoryInfoDiv.innerHTML = '';
            addOrUpdateCurrentOrderProduct({
                name: event.target.value.trim(),
                sku: 'N/A',
                imageUrl: 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001',
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        } else {
            removeCurrentOrderProduct(currentIndex);
        }
    });

    // Event listeners for quantity and note changes to update currentOrderProducts
    quantityInput.addEventListener('input', () => {
        const selectedProductName = freeTextProductInput.value.trim() || productSearchInput.value.trim();
        if (selectedProductName) {
            addOrUpdateCurrentOrderProduct({
                name: selectedProductName,
                sku: productsCatalog.find(p => p.name === selectedProductName)?.sku || 'N/A',
                imageUrl: productsCatalog.find(p => p.name === selectedProductName)?.imageUrl || 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001',
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        }
    });

    productNoteInput.addEventListener('input', () => {
        const selectedProductName = freeTextProductInput.value.trim() || productSearchInput.value.trim();
        if (selectedProductName) {
            addOrUpdateCurrentOrderProduct({
                name: selectedProductName,
                sku: productsCatalog.find(p => p.name === selectedProductName)?.sku || 'N/A',
                imageUrl: productsCatalog.find(p => p.name === selectedProductName)?.imageUrl || 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001',
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        }
    });

    // Event listener for deleting the product row from the form
    if (deleteRowBtn) {
        deleteRowBtn.addEventListener('click', () => {
            newProductDiv.remove();
            removeCurrentOrderProduct(currentIndex);
            showToast('info', 'המוצר הוסר', 'שורת המוצר הוסרה מהטופס.');
        });
    }
}

// Function to update the history display based on the family name input
function updateFamilyHistoryDisplay(familyName) {
    const historyDisplay = document.getElementById('historyDisplay');
    historyDisplay.innerHTML = ''; // Clear existing history

    if (!familyName.trim()) {
        historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
        return;
    }
    
    // Check if previousOrdersHistory is defined before filtering
    if (!previousOrdersHistory) {
        console.error("previousOrdersHistory is undefined. Cannot update family history display.");
        historyDisplay.innerHTML = '<p class="text-red-500">שגיאה: היסטוריית הזמנות לא נטענה. אנא רענן את הדף.</p>';
        return;
    }

    const familyHistory = previousOrdersHistory.filter(order =>
        order['שם משפחה'] && order['שם משפחה'].toLowerCase() === familyName.toLowerCase()
    );

    if (familyHistory.length > 0) {
        const aggregatedHistory = {};
        familyHistory.forEach(order => {
            const productName = order['שם מוצר'];
            const quantity = parseInt(order['כמות']) || 0;
            const orderDate = order['תאריך ושעה'];

            if (!aggregatedHistory[productName]) {
                aggregatedHistory[productName] = { totalQty: 0, lastDate: '' };
            }
            aggregatedHistory[productName].totalQty += quantity;
            if (orderDate > aggregatedHistory[productName].lastDate) {
                aggregatedHistory[productName].lastDate = orderDate;
            }
        });

        for (const prodName in aggregatedHistory) {
            const item = aggregatedHistory[prodName];
            const p = document.createElement('p');
            p.className = 'history-item';
            p.innerHTML = `<i class="fas fa-box"></i> ${prodName} (סה"כ: ${item.totalQty}, אחרונה: ${item.lastDate.split(',')[0]})`;
            p.addEventListener('click', () => {
                const productFromCatalog = productsCatalog.find(p => p.name === prodName);
                showProductDetailsModal({
                    name: prodName,
                    sku: productFromCatalog ? productFromCatalog.sku : 'N/A',
                    imageUrl: productFromCatalog ? productFromCatalog.imageUrl : 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001',
                    quantity: item.totalQty, // This is the total historical quantity, not current order quantity
                    note: '' // No note from history display
                });
            });
            historyDisplay.appendChild(p);
        }
    } else {
        historyDisplay.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות זמינה למשפחה זו.</p>';
    }
}


function updateProductHistoryDisplay(productName, displayDiv) {
    const selectedFamilyName = document.getElementById('familyNameDisplay').value; // Get from display field
    if (!selectedFamilyName.trim()) {
        displayDiv.innerHTML = '';
        return;
    }

    // Check if previousOrdersHistory is defined before filtering
    if (!previousOrdersHistory) {
        console.error("previousOrdersHistory is undefined. Cannot update product history display.");
        displayDiv.innerHTML = '<p class="text-red-500">שגיאה: היסטוריית הזמנות לא נטענה.</p>';
        return;
    }

    const familyProductOrders = previousOrdersHistory.filter(order =>
        order['שם משפחה'] && order['שם משפחה'].toLowerCase() === selectedFamilyName.toLowerCase() && order['שם מוצר'] === productName
    );

    if (familyProductOrders.length > 0) {
        const totalQuantity = familyProductOrders.reduce((sum, order) => sum + (parseInt(order['כמות']) || 0), 0);
        familyProductOrders.sort((a, b) => {
            const parseDateString = (dateStr) => {
                const [datePart, timePart] = dateStr.split(',');
                const [day, month, year] = datePart.split('.').map(Number);
                const [hours, minutes, seconds] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hours, minutes, seconds);
            };
            const dateA = parseDateString(a['תאריך ושעה']);
            const dateB = parseDateString(b['תאריך ושעה']);
            return dateB.getTime() - dateA.getTime();
        });
        const lastOrderDate = familyProductOrders[0]['תאריך ושעה'].split(',')[0];

        displayDiv.innerHTML = `
            <i class="fas fa-history"></i> המוצר '${productName}' הוזמן ${totalQuantity} פעמים (אחרונה: ${lastOrderDate})
        `;
    } else {
        displayDiv.innerHTML = `<i class="fas fa-info-circle"></i> המוצר '${productName}' לא הוזמן בעבר על ידי משפחה זו.`;
    }
}

let selectedHistoricalProductName = '';

function showQuantitySelectionModal(productName) {
    selectedHistoricalProductName = productName;
    document.getElementById('modalProductName').innerText = `הוסף: ${productName}`;
    document.getElementById('modalQuantitySelect').value = '1'; // Reset quantity
    document.getElementById('quantitySelectionModal').classList.remove('hidden');
    document.getElementById('quantitySelectionModal').classList.add('active');
}

function closeQuantitySelectionModal() {
    document.getElementById('quantitySelectionModal').classList.remove('active');
    document.getElementById('quantitySelectionModal').classList.add('hidden');
    selectedHistoricalProductName = '';
}

function addHistoricalProductToOrderForm() {
    const quantity = parseInt(document.getElementById('modalQuantitySelect').value, 10);
    if (selectedHistoricalProductName && quantity > 0) {
        const product = productsCatalog.find(p => p.name === selectedHistoricalProductName);
        const sku = product ? product.sku : 'N/A';
        const imageUrl = product ? product.imageUrl : 'https://www.citypng.com/public/uploads/preview/coming-soon-diamond-sign-yellow-illustration-704081694791855pr8gisffbq.png?v=2025062001';

        // Check if the product is already in the current order before adding
        const isProductAlreadyInOrder = currentOrderProducts.some(p => p.name === selectedHistoricalProductName);

        if (isProductAlreadyInOrder) {
            // Show the interactive pop-up for duplicate product
            document.getElementById('productExistsMessage').innerText = `המוצר '${selectedHistoricalProductName}' כבר קיים בהזמנה. האם תרצה להוסיף אותו שוב?`;
            document.getElementById('productExistsConfirmationModal').classList.remove('hidden');
            document.getElementById('productExistsConfirmationModal').classList.add('active');

            // Store the product data and a flag indicating it's from history for the pop-up's action
            document.getElementById('productExistsConfirmationModal').dataset.tempProductData = JSON.stringify({
                name: selectedHistoricalProductName,
                sku: sku,
                imageUrl: imageUrl,
                quantity: quantity,
                note: ''
            });
            document.getElementById('productExistsConfirmationModal').dataset.fromHistory = 'true';

            closeQuantitySelectionModal(); // Close the quantity selection modal
            return; // Stop further processing until user confirms
        }

        addProductSelection({
            name: selectedHistoricalProductName,
            sku: sku,
            imageUrl: imageUrl,
            quantity: quantity,
            note: ''
        });

        showToast('success', 'נוסף בהצלחה', `'${selectedHistoricalProductName}' בכמות ${quantity} נוסף להזמנה.`);
        closeQuantitySelectionModal();
        closeProductDetailsModal(); // Close the product details modal after adding a product from it
    } else {
        showToast('error', 'שגיאה', 'אנא בחר כמות חוקית.');
    }
}

function addOrUpdateCurrentOrderProduct(productData, formIndex) {
    if (formIndex === undefined) {
        console.warn("addOrUpdateCurrentOrderProduct called without formIndex. This should ideally come from addHistoricalProductToOrderForm or addProductSelection.");
        return;
    }

    const existingIndex = currentOrderProducts.findIndex(p => p.formIndex === formIndex);

    // Filter out invalid products (empty name or zero/negative quantity)
    if (!productData.name.trim() || productData.quantity <= 0) {
        if (existingIndex > -1) {
            currentOrderProducts.splice(existingIndex, 1); // Remove invalid product
        }
    } else {
        // Check for duplicate product names, excluding the current row being edited
        const isProductAlreadyInOrder = currentOrderProducts.some(p =>
            p.name === productData.name && p.formIndex !== formIndex
        );

        if (isProductAlreadyInOrder) {
            // Show the interactive pop-up
            document.getElementById('productExistsMessage').innerText = `המוצר '${productData.name}' כבר קיים בהזמנה. האם תרצה להוסיף אותו שוב?`;
            document.getElementById('productExistsConfirmationModal').classList.remove('hidden');
            document.getElementById('productExistsConfirmationModal').classList.add('active');

            // Store the productData and formIndex temporarily for the pop-up's action
            document.getElementById('productExistsConfirmationModal').dataset.tempProductData = JSON.stringify(productData);
            document.getElementById('productExistsConfirmationModal').dataset.tempFormIndex = formIndex;
            document.getElementById('productExistsConfirmationModal').dataset.fromHistory = 'false'; // Not from history button

            // Remove the product from currentOrderProducts if it was just added by mistake
            if (existingIndex > -1) {
                currentOrderProducts.splice(existingIndex, 1);
            }
            renderCurrentOrderProducts(); // Re-render to reflect removal
            return; // Stop further processing until user confirms
        }

        if (existingIndex > -1) {
            currentOrderProducts[existingIndex] = { ...productData, formIndex };
        } else {
            currentOrderProducts.push({ ...productData, formIndex });
        }
    }
    renderCurrentOrderProducts(); // Re-render the display list
}

// Function to handle confirmation from the "Product Exists" modal
function handleProductExistsConfirmation(confirm) {
    const modal = document.getElementById('productExistsConfirmationModal');
    modal.classList.remove('active');
    modal.classList.add('hidden');
    const productData = JSON.parse(modal.dataset.tempProductData);
    const formIndex = parseInt(modal.dataset.tempFormIndex, 10);
    const fromHistory = modal.dataset.fromHistory === 'true';
    if (confirm) {
        // User confirmed, add the product
        const existingIndex = currentOrderProducts.findIndex(p => p.formIndex === formIndex);
        if (existingIndex > -1) {
            currentOrderProducts[existingIndex] = { ...productData, formIndex };
        } else {
            currentOrderProducts.push({ ...productData, formIndex });
        }
        showToast('info', 'המוצר נוסף', `'${productData.name}' נוסף שוב להזמנה.`);
    } else {
        // User cancelled, remove the product row from the form
        const productDivToRemove = document.querySelector(`.product-selection input[id="productSearch_${formIndex}"]`)?.closest('.product-selection') || document.querySelector(`.product-selection input[id="freeTextProduct_${formIndex}"]`)?.closest('.product-selection');
        if (productDivToRemove) {
            productDivToRemove.remove();
        }
        // If it was from history, also clear the temporary data
        if (fromHistory) {
            selectedHistoricalProductName = '';
        }
        showToast('info', 'הפעולה בוטלה', `'${productData.name}' לא נוסף שוב להזמנה.`);
    }
    renderCurrentOrderProducts(); // Re-render the display list
}

// Function to remove a product from currentOrderProducts
function removeCurrentOrderProduct(formIndex) {
    currentOrderProducts = currentOrderProducts.filter(p => p.formIndex !== formIndex);
    renderCurrentOrderProducts(); // Re-render the display list
    showToast('info', 'המוצר הוסר', 'שורת המוצר הוסרה מרשימת ההזמנה.');
}

// Function to render the current order products list (the "table")
function renderCurrentOrderProducts() {
    const listContainer = document.getElementById('currentOrderProductsList');
    const filterInput = document.getElementById('productFilterInput');
    const filterText = filterInput.value.trim().toLowerCase();
    listContainer.innerHTML = ''; // Clear existing list
    if (currentOrderProducts.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-center">אין מוצרים בהזמנה זו עדיין.</p>';
        return;
    }
    const filteredProducts = currentOrderProducts.filter(p => p.name.toLowerCase().includes(filterText) || (p.sku && p.sku.toLowerCase().includes(filterText)) );
    if (filteredProducts.length === 0 && filterText !== '') {
        listContainer.innerHTML = '<p class="text-gray-500 text-center">לא נמצאו מוצרים תואמים לחיפוש.</p>';
        return;
    }
    // Sort products alphabetically by name for consistent display
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    filteredProducts.forEach(product => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'current-order-product-item';
        itemDiv.innerHTML = `
            <img src="${product.imageUrl}" alt="${product.name}" class="product-image-thumb" onerror="this.onerror=null;this.src='https://placehold.co/40x40/CCCCCC/000000?text=תמונת מוצר בקרוב';" onclick="showImagePreviewModal('${product.imageUrl}')">
            <div class="product-details-summary">
                <strong>${product.name}</strong>
                <span>מק"ט: ${product.sku}</span>
                ${product.note ? `<span class="product-note-display">הערה: ${product.note}</span>` : ''}
            </div>
            <div class="product-quantity-controls">
                <label for="qty_item_${product.formIndex}" class="sr-only">כמות</label>
                <input type="number" id="qty_item_${product.formIndex}" class="quantity-input-small" value="${product.quantity}" min="1">
            </div>
            <div class="action-buttons">
                <button class="delete-btn glass-button" data-form-index="${product.formIndex}"><i class="fas fa-trash"></i> מחק</button>
            </div>
        `;
        listContainer.appendChild(itemDiv);
        // Add event listeners for quantity change and delete button
        const qtyInput = itemDiv.querySelector(`#qty_item_${product.formIndex}`);
        if (qtyInput) {
            qtyInput.addEventListener('input', (event) => {
                const newQuantity = parseInt(event.target.value, 10);
                // Find the original product in currentOrderProducts by formIndex
                const productToUpdate = currentOrderProducts.find(p => p.formIndex === product.formIndex);
                if (productToUpdate) {
                    if (newQuantity > 0) {
                        productToUpdate.quantity = newQuantity;
                    } else {
                        event.target.value = 1; // Reset to 1 if user enters invalid value
                    }
                }
                renderCurrentOrderProducts(); // Re-render the display list to reflect the change
            });
        }
        const deleteBtn = itemDiv.querySelector(`.delete-btn`);
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                removeCurrentOrderProduct(product.formIndex);
            });
        }
    });
}

// Function to share order details on WhatsApp
function shareOrderOnWhatsApp() {
    const familyName = document.getElementById('familyNameDisplay').value;
    const address = document.getElementById('addressInput').value;
    const contact = document.getElementById('contactInput').value;
    const phone = document.getElementById('phoneInput').value;
    const deliveryType = document.getElementById('deliveryType').value;
    const generalNotes = document.getElementById('generalNotes').value;

    if (!familyName) {
        showToast('error', 'שגיאה', 'אנא בחר/י משפחה לפני השיתוף.');
        return;
    }
    
    if (currentOrderProducts.length === 0) {
        showToast('error', 'שגיאה', 'יש להוסיף מוצרים להזמנה לפני השיתוף.');
        return;
    }

    let whatsappMessage = `*הזמנה חדשה - סבן*\n\n`;
    whatsappMessage += `*פרטי המשפחה:*\n`;
    whatsappMessage += `שם משפחה: ${familyName}\n`;
    whatsappMessage += `איש קשר: ${contact}\n`;
    whatsappMessage += `טלפון: ${phone}\n`;
    whatsappMessage += `כתובת: ${address}\n`;
    whatsappMessage += `סוג הובלה: ${deliveryType || 'לא נבחר'}\n\n`;

    whatsappMessage += `*רשימת מוצרים:*\n`;
    currentOrderProducts.forEach(product => {
        whatsappMessage += `- ${product.name}, כמות: ${product.quantity}`;
        if (product.note) {
            whatsappMessage += `, הערה: ${product.note}`;
        }
        whatsappMessage += '\n';
    });

    if (generalNotes) {
        whatsappMessage += `\n*הערות כלליות:*\n${generalNotes}\n`;
    }

    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
}

// Event listener for the new WhatsApp button
document.addEventListener('DOMContentLoaded', () => {
    // ... all existing event listeners ...
    const whatsappShareBtn = document.getElementById('whatsappShareBtn');
    if (whatsappShareBtn) {
        whatsappShareBtn.addEventListener('click', shareOrderOnWhatsApp);
    }
});

// ... rest of the existing code ...
