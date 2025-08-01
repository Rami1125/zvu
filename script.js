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
let lastOrderSummaryData = null; // Stores the last order summary data for WhatsApp sharing
let currentChatContact = null; // Stores the name of the contact whose chat is currently open

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxvBPHFmT9trPCTGGzrhcKAxik28Pzco7OAhnY0gWLFKDHzfFyHpllheCt9ac78RMH-ZA/exec'; // Updated URL based on console error
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
        // Ensure data.families is an array before iterating
        if (Array.isArray(data.families)) {
            data.families.forEach(family => {
                familiesData[family['שם משפחה']] = {
                    address: family['כתובת'] || 'לא ידוע',
                    contact: family['איש קשר'] || 'לא ידוע',
                    phone: family['טלפון'] || 'לא ידוע',
                };
            });
        } else {
            console.warn("data.families is not an array:", data.families);
            familiesData = {}; // Ensure it's empty if not an array
        }


        // Ensure data.products is an array before mapping
        if (Array.isArray(data.products)) {
            productsCatalog = data.products.map(p => ({
                name: p['שם מוצר'],
                sku: p['מק"ט'], // This line correctly maps the SKU
                imageUrl: p['תמונה (URL)'] || 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg'
            }));
        } else {
            console.warn("data.products is not an array:", data.products);
            productsCatalog = []; // Ensure it's empty if not an array
        }

        // Ensure data.previousOrders is an array before assigning
        if (Array.isArray(data.previousOrders)) {
            previousOrdersHistory = data.previousOrders;
        } else {
            console.warn("data.previousOrders is not an array:", data.previousOrders);
            previousOrdersHistory = []; // Ensure it's empty if not an array
        }


        // Populate allContactsData for the Contacts screen
        allContactsData = Object.values(familiesData).map(family => ({
            familyName: family.name, // Assuming family.name exists, or adjust to family['שם משפחה'] if data structure is different
            contactPerson: family.contact,
            phoneNumber: family.phone,
            address: family.address
        }));
        populateContactsList(); // Populate contacts list on load

        populateFamilySelect();
        populateQuickFamilyButtons();
        populateProductDatalist(); // Ensure this is called once to populate the global datalist
        addProductSelection(); // Add the first product selection row

    } catch (error) {
        console.error('Error fetching initial data:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בטעינת הנתונים הראשוניים: ${error.message}. אנא ודא שה-Apps Script פרוס כראוי והגיליונות קיימים.`);
        // Ensure global data stores are reset to empty arrays/objects on error to prevent further TypeErrors
        familiesData = {};
        productsCatalog = [];
        previousOrdersHistory = [];
        allContactsData = [];
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

    const colorClasses = ['color-red', 'color-blue', 'color-yellow', 'color-purple', 'color-green', 'color-orange'];
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

// This function populates the GLOBAL datalist with ALL products.
// The browser's native datalist filtering will then provide suggestions.
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
        } else {
            freeTextProductInput.value = productToPrepopulate.name;
        }
        quantityInput.value = productToPrepopulate.quantity || 1;
        productNoteInput.value = productToPrepopulate.note || '';
        // Manually update the internal array for this new row
        addOrUpdateCurrentOrderProduct({
            name: productToPrepopulate.name,
            sku: productToPrepopulate.sku || 'N/A',
            imageUrl: productToPrepopulate.imageUrl || 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
            quantity: parseInt(quantityInput.value, 10),
            note: productNoteInput.value.trim()
        }, currentIndex);
        // After pre-populating, trigger the display update
        updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex);
    }


    // Event listener for product search input (datalist)
    productSearchInput.addEventListener('input', (event) => {
        updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex);
    });

    // Event listener for free text product input
    freeTextProductInput.addEventListener('input', (event) => {
        updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex);
    });

    // Event listeners for quantity and note changes to update currentOrderProducts
    quantityInput.addEventListener('input', () => {
        updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex);
    });

    productNoteInput.addEventListener('input', () => {
        updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex);
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

/**
 * Updates the product display and internal data based on input changes.
 * This function consolidates the logic for product search/free text, quantity, and notes.
 * It also handles auto-focusing the next field.
 */
function updateProductDisplayAndData(productSearchInput, freeTextProductInput, quantityInput, productNoteInput, productInfoDiv, productHistoryInfoDiv, currentIndex) {
    const searchInputValue = productSearchInput.value.trim();
    const freeTextInputValue = freeTextProductInput.value.trim();
    
    productInfoDiv.innerHTML = ''; // Clear info display
    productHistoryInfoDiv.innerHTML = ''; // Clear history display

    let productName = '';
    let productSku = 'N/A';
    let productImageUrl = 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg';

    // Determine the active product name and if it's from catalog
    let selectedProduct = null;
    if (searchInputValue !== '') {
        selectedProduct = productsCatalog.find(p => p.name === searchInputValue);
        if (selectedProduct) {
            productName = selectedProduct.name;
            productSku = selectedProduct.sku;
            productImageUrl = selectedProduct.imageUrl;
            freeTextProductInput.value = ''; // Clear free text if catalog product is selected
        } else {
            productName = searchInputValue; // Treat as free text if no exact match in catalog
        }
    } else if (freeTextInputValue !== '') {
        productName = freeTextInputValue;
    }

    // Update product info display based on determined product
    if (productName.length >= 3 || selectedProduct) { // Display info if >= 3 chars or exact match
        if (selectedProduct) {
            productInfoDiv.innerHTML = `
                <div class="product-item-display">
                    <img src="${productImageUrl}" alt="${productName}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=NoImg';" onclick="showImagePreviewModal('${productImageUrl}')">
                    <div class="product-details-display">
                        <p class="product-name-display">${productName}</p>
                        <p class="product-sku-display">מק"ט: ${productSku}</p>
                    </div>
                </div>
            `;
            updateProductHistoryDisplay(productName, productHistoryInfoDiv);
            // Auto-focus to quantity if a product is selected/identified
            quantityInput.focus();
        } else if (productName.length >= 3) { // Only show free text info if at least 3 chars
             productInfoDiv.innerHTML = `
                <div class="product-item-display">
                    <img src="${productImageUrl}" alt="${productName}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=NoImg';">
                    <div class="product-details-display">
                        <p class="product-name-display">${productName} (פריט חופשי)</p>
                        <p class="product-sku-display">מק"ט: N/A</p>
                    </div>
                </div>
            `;
            productHistoryInfoDiv.innerHTML = `<p class="text-gray-500">אין היסטוריית הזמנות לפריט חופשי.</p>`;
            quantityInput.focus(); // Auto-focus to quantity for free text too
        }
    } else if (productName.length > 0 && productName.length < 3) {
        productInfoDiv.innerHTML = `<p class="text-gray-500">הקלד לפחות 3 אותיות לחיפוש מוצר.</p>`;
    }

    // Update the global currentOrderProducts array
    addOrUpdateCurrentOrderProduct({
        name: productName,
        sku: productSku,
        imageUrl: productImageUrl,
        quantity: parseInt(quantityInput.value, 10) || 1, // Default to 1 if invalid
        note: productNoteInput.value.trim()
    }, currentIndex);
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
                    imageUrl: productFromCatalog ? productFromCatalog.imageUrl : 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
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
    ).sort((a, b) => {
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

    if (familyProductOrders.length > 0) {
        const totalQuantity = familyProductOrders.reduce((sum, order) => sum + (parseInt(order['כמות']) || 0), 0);
        
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
        const imageUrl = product ? product.imageUrl : 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg';

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
        const productDivToRemove = document.querySelector(`.product-selection input[id="productSearch_${formIndex}"]`)?.closest('.product-selection') ||
                                 document.querySelector(`.product-selection input[id="freeTextProduct_${formIndex}"]`)?.closest('.product-selection');
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

    const filteredProducts = currentOrderProducts.filter(p =>
        p.name.toLowerCase().includes(filterText) || (p.sku && p.sku.toLowerCase().includes(filterText))
    );

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
            <img src="${product.imageUrl}" alt="${product.name}" class="product-image-thumb" onerror="this.onerror=null;this.src='https://placehold.co/40x40/CCCCCC/000000?text=NoImg';" onclick="showImagePreviewModal('${product.imageUrl}')">
            <div class="product-details-summary">
                <strong>${product.name}</strong>
                <span>מק"ט: ${product.sku}</span>
                <input type="text" class="product-note-input-inline" value="${product.note || ''}" placeholder="הערה" data-form-index="${product.formIndex}">
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
                const productToUpdate = currentOrderProducts.find(p => p.formIndex === product.formIndex);
                if (productToUpdate) {
                    if (newQuantity > 0) {
                        productToUpdate.quantity = newQuantity;
                    } else { 
                        removeCurrentOrderProduct(product.formIndex);
                    }
                }
            });
            // Add keyboard event listener for Enter key to move to next field
            qtyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    const nextProductRow = itemDiv.nextElementSibling;
                    if (nextProductRow) {
                        const nextProductSearchInput = nextProductRow.querySelector('.product-search-input');
                        if (nextProductSearchInput) {
                            nextProductSearchInput.focus();
                        }
                    } else {
                        // If this is the last item, add a new row and focus its search input
                        addProductBtn.click(); // Simulate click to add new product row
                        // The new row will be added to the DOM; find its productSearchInput and focus it
                        const newProductSearchInput = productsContainer.lastElementChild.querySelector('.product-search-input');
                        if (newProductSearchInput) {
                            newProductSearchInput.focus();
                        }
                    }
                }
            });
        }

        // Add event listener for inline note editing
        const inlineNoteInput = itemDiv.querySelector('.product-note-input-inline');
        if (inlineNoteInput) {
            inlineNoteInput.addEventListener('input', (event) => {
                const updatedNote = event.target.value.trim();
                const productToUpdate = currentOrderProducts.find(p => p.formIndex === product.formIndex);
                if (productToUpdate) {
                    productToUpdate.note = updatedNote;
                }
            });
        }

        const deleteButton = itemDiv.querySelector('.delete-btn');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                removeCurrentOrderProduct(product.formIndex);
            });
        }
    });
}


// Image Preview Modal Functions
let imagePreviewTimeout;
function showImagePreviewModal(imageUrl) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');

    previewImage.src = imageUrl;
    previewImage.classList.remove('fade-out'); // Ensure no fade-out class from previous use

    modal.classList.remove('hidden');
    modal.classList.add('active');

    // Clear any existing timeout
    if (imagePreviewTimeout) {
        clearTimeout(imagePreviewTimeout);
    }

    // Set timeout to close modal after 5 seconds with fade effect
    imagePreviewTimeout = setTimeout(() => {
        previewImage.classList.add('fade-out'); // Add fade-out class
        // After animation, hide modal
        previewImage.addEventListener('animationend', () => {
            closeImagePreviewModal();
            previewImage.classList.remove('fade-out'); // Clean up class
        }, { once: true }); // Ensure listener runs only once
    }, 5000); // 5 seconds
}

function closeImagePreviewModal() {
    clearTimeout(imagePreviewTimeout); // Clear any pending timeout
    document.getElementById('imagePreviewModal').classList.remove('active');
    document.getElementById('imagePreviewModal').classList.add('hidden');
    document.getElementById('previewImage').src = '';
}

// Product Details/History Modal Functions
function showProductDetailsModal(product) {
    const modal = document.getElementById('productDetailsModal');
    document.getElementById('productDetailsModalTitle').innerText = `פרטי מוצר: ${product.name}`;
    document.getElementById('productDetailsImage').src = product.imageUrl;
    document.getElementById('productDetailsName').innerText = `שם: ${product.name}`;
    document.getElementById('productDetailsSku').innerText = `מק"ט: ${product.sku}`;
    document.getElementById('productDetailsQuantity').innerText = `כמות בהזמנה זו: ${product.quantity}`;
    document.getElementById('productDetailsNote').innerText = product.note ? `הערה: ${product.note}` : 'אין הערה.';

    const historyInModal = document.getElementById('productHistoryInModal');
    historyInModal.innerHTML = '<p class="text-gray-500">טוען היסטוריה...</p>';

    const selectedFamilyName = document.getElementById('familyNameDisplay').value; // Get from display field
    if (!selectedFamilyName.trim()) {
        historyInModal.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
        return;
    }
    
    // Check if previousOrdersHistory is defined before filtering
    if (!previousOrdersHistory) {
        console.error("previousOrdersHistory is undefined. Cannot update product history in modal.");
        historyInModal.innerHTML = '<p class="text-red-500">שגיאה: היסטוריית הזמנות לא נטענה.</p>';
        return;
    }

    const productSpecificHistory = previousOrdersHistory.filter(order =>
        order['שם משפחה'] && order['שם משפחה'].toLowerCase() === selectedFamilyName.toLowerCase() && order['שם מוצר'] === product.name
    ).sort((a, b) => {
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

    if (productSpecificHistory.length > 0) {
        historyInModal.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'list-none p-0';
        productSpecificHistory.forEach(order => {
            const li = document.createElement('li');
            li.className = 'bg-white p-2 rounded-md mb-2 shadow-sm border border-gray-200';
            li.innerHTML = `
                <p><strong>משפחה:</strong> ${order['שם משפחה']}</p>
                <p><strong>תאריך:</strong> ${order['תאריך ושעה'].split(',')[0]}</p>
                <p><strong>שעה:</strong> ${order['תאריך ושעה'].split(',')[1]}</p>
                <p><strong>כמות:</strong> ${order['כמות']}</p>
            `;
            ul.appendChild(li);
        });
        historyInModal.appendChild(ul);
    } else {
        historyInModal.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות למוצר זה על ידי משפחה זו.</p>';
    }

    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function closeProductDetailsModal() {
    document.getElementById('productDetailsModal').classList.remove('active');
    document.getElementById('productDetailsModal').classList.add('hidden');
}

// Modal functions for order confirmation
function showConfirmationModal(orderSummary) {
    const modal = document.getElementById('orderConfirmationModal');
    const receiptContent = document.getElementById('receiptContent');

    // Store the orderSummaryData globally for WhatsApp sharing
    lastOrderSummaryData = orderSummary;

    let productsHtml = '<ul>';
    orderSummary.products.forEach(p => {
        productsHtml += `<li><span class="product-receipt-name">${p.name}</span> <span class="product-receipt-qty">× ${p.quantity}</span></li>`;
        if (p.note) {
            productsHtml += `<li class="text-sm text-gray-600 mr-4">הערה: ${p.note}</li>`;
        }
    });
    productsHtml += '</ul>';

    receiptContent.innerHTML = `
        <h4 class="text-center">קבלה / תעודת משלוח</h4>
        <p><strong>משפחה:</strong> ${orderSummary.familyName}</p>
        <p><strong>כתובת:</strong> ${orderSummary.address}</p>
        <p><strong>איש קשר:</strong> ${orderSummary.contact}</p>
        <p><strong>טלפון:</strong> ${orderSummary.phone}</p>
        <p><strong>סוג הובלה:</strong> ${orderSummary.deliveryType || 'לא נבחר'}</p>
        <p><strong>תאריך:</strong> ${orderSummary.timestamp.split(',')[0]}</p>
        <p><strong>שעה:</strong> ${orderSummary.timestamp.split(',')[1]}</p>
        <h5 class="text-xl font-semibold text-dark-blue mt-4 mb-2">פרטי מוצרים:</h5>
        ${productsHtml}
        ${orderSummary.imageData ? '<p class="mt-4 text-center text-gray-600"><i class="fas fa-image"></i> צורפה תמונת מוצר מהשטח</p>' : ''}
        <p class="text-center text-lg font-bold text-dark-blue mt-6 animate-pulse-effect">
            לאחר בדיקת הנתונים, לחץ על הכפתור למטה לשליחה סופית!
        </p>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function closeConfirmationModal() {
    document.getElementById('orderConfirmationModal').classList.remove('active');
    document.getElementById('orderConfirmationModal').classList.add('hidden');
}

/**
 * Sends the order data to Google Apps Script.
 * @param {Object} orderData The structured order data.
 * @returns {Promise<Object>} The JSON response from the Apps Script.
 */
async function sendOrder(orderData) {
    showLoading('שולח הזמנה ושומר...');
    const formData = new FormData();
    formData.append('action', 'submitOrder');
    formData.append('timestamp', orderData.timestamp);
    formData.append('familyName', orderData.familyName);
    formData.append('address', orderData.address);
    formData.append('contact', orderData.contact);
    formData.append('phone', orderData.phone);
    formData.append('deliveryType', orderData.deliveryType);
    // Stringify the products array as FormData does not handle nested objects directly
    formData.append('products', JSON.stringify(orderData.products)); 
    
    if (orderData.imageData) {
        // If imageData is base64 string, append it directly. Apps Script will decode.
        formData.append('imageData', orderData.imageData);
        formData.append('imageFileName', orderData.imageFileName || 'image.png');
    }

    try {
        const response = await fetch(`${WEB_APP_URL}`, {
            method: 'POST',
            body: formData // No Content-Type header needed for FormData; browser sets it automatically
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error sending order:', error);
        throw new Error(`אירעה שגיאה בשליחת ההזמנה: ${error.message}. נסה שוב מאוחר יותר.`);
    } finally {
        hideLoading();
    }
}

/**
 * Generates and sends WhatsApp message.
 * @param {Object} orderData The structured order data.
 */
function sendOrderToWhatsApp(orderData) {
    let whatsappMessage = `*📦 הזמנה חדשה - ${orderData.contact} ממשפחת ${orderData.familyName}*\n\n`; // Updated title
    whatsappMessage += `*כתובת:* ${orderData.address}\n`;
    whatsappMessage += `*טלפון:* ${orderData.phone}\n`;
    whatsappMessage += `*סוג הובלה:* ${orderData.deliveryType || 'לא נבחר'}\n`;
    whatsappMessage += `\n🧾 *מוצרים:*\n`;
    orderData.products.forEach(p => {
        whatsappMessage += `• ${p.name} × ${p.quantity}`;
        if (p.note) {
            whatsappMessage += ` (הערה: ${p.note})`;
        }
        whatsappMessage += `\n`;
    });
    whatsappMessage += `\n🕓 *תאריך:* ${orderData.timestamp.split(',')[0]}\n`;
    whatsappMessage += `*שעה:* ${orderData.timestamp.split(',')[1]}\n`;
    if (orderData.imageData) { // Check imageData from the orderData object
        whatsappMessage += `\n*הערה:* צורפה תמונה של מוצר מהשטח.`;
    }

    const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    showToast('success', 'הודעה נשלחה', 'ההודעה נשלחה בהצלחה לווטסאפ.');
}

/**
 * Main function to handle saving order and sharing.
 * This function orchestrates sending the order and then sharing via WhatsApp.
 */
async function sendOrderAndShare() {
    const whatsappShareBtn = document.getElementById('whatsappShareBtn');
    whatsappShareBtn.disabled = true;
    whatsappShareBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

    // Ensure lastOrderSummaryData is available
    if (!lastOrderSummaryData) {
        showToast('error', 'שגיאה', 'אין נתוני הזמנה לשיתוף. אנא בצע הזמנה תחילה.');
        whatsappShareBtn.disabled = false;
        whatsappShareBtn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i> שלח לוואטסאפ';
        return;
    }

    // Convert image to base64 if it exists and hasn't been converted yet
    const productImageFile = document.getElementById('productImage').files[0];
    if (productImageFile && !lastOrderSummaryData.imageData) {
        try {
            lastOrderSummaryData.imageData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(productImageFile);
            });
            lastOrderSummaryData.imageFileName = productImageFile.name;
        } catch (error) {
                console.error('Error converting image to base64 for submission:', error);
            showToast('error', 'שגיאה', 'אירעה שגיאה בהמרת התמונה לשליחה. נסה שוב.');
            whatsappShareBtn.disabled = false;
            whatsappShareBtn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i> שלח לוואטסאפ';
            return;
        }
    }

    try {
        const result = await sendOrder(lastOrderSummaryData); // Call the new sendOrder function

        if (result.success) {
            // Updated success message
            showToast('success', 'הזמנה נשלחה בהצלחה!', `שלום ${lastOrderSummaryData.contact}, ההזמנה שלך בוצעה ותועבר למחלקת הזמנות. ניצור איתך קשר למועד אספקה.`);
            sendOrderToWhatsApp(lastOrderSummaryData); // Call the new sendOrderToWhatsApp function
            
            // Clear form after successful submission and reset to family selection
            resetOrderForm();
            showContent('step1Content'); // Go back to family selection
            updateProgressBar(1); // Reset progress bar to step 1

            // Re-fetch data to update history for next order
            fetchDataFromGoogleSheets();

        } else {
            showToast('error', 'שגיאה', result.message || 'אירעה שגיאה בשליחת ההזמנה.');
        }
    } catch (error) {
        console.error('Error in sendOrderAndShare:', error); // Log the error from sendOrder
        showToast('error', 'שגיאה', `אירעה שגיאה בשליחת ההזמנה: ${error.message}. נסה שוב מאוחר יותר.`);
    } finally {
        whatsappShareBtn.disabled = false;
        whatsappShareBtn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i> שלח לוואטסאפ';
        closeConfirmationModal(); // Close the confirmation modal
    }
}


// Function to reset the order form fields
function resetOrderForm() {
    document.getElementById('familySelect').value = ''; // Reset family select dropdown
    document.getElementById('familyNameDisplay').value = ''; // Clear display field
    document.getElementById('addressInput').value = '';
    document.getElementById('contactInput').value = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('deliveryType').value = '';
    document.getElementById('historyDisplay').innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
    document.getElementById('productsContainer').innerHTML = '';
    productRowCounter = 0;
    currentOrderProducts = [];
    addProductSelection(); // Add initial product row
    renderCurrentOrderProducts();
    document.getElementById('productImage').value = '';
    lastOrderSummaryData = null; // Clear stored order data
}

// Function to populate contacts list for the "Contacts" screen
function populateContactsList() {
    const contactsListContainer = document.getElementById('contactsList');
    const contactFilterInput = document.getElementById('contactFilterInput');
    const filterText = contactFilterInput.value.trim().toLowerCase();

    contactsListContainer.innerHTML = ''; // Clear existing list

    if (allContactsData.length === 0) {
        contactsListContainer.innerHTML = '<p class="text-gray-500 text-center">אין אנשי קשר זמינים.</p>';
        return;
    }

    const filteredContacts = allContactsData.filter(contact =>
        (contact.contactPerson && contact.contactPerson.toLowerCase().includes(filterText)) ||
        (contact.familyName && contact.familyName.toLowerCase().includes(filterText)) ||
        (contact.phoneNumber && contact.phoneNumber.includes(filterText))
    );

    if (filteredContacts.length === 0 && filterText !== '') {
        contactsListContainer.innerHTML = '<p class="text-gray-500 text-center">לא נמצאו אנשי קשר תואמים לחיפוש.</p>';
        return;
    }

    filteredContacts.sort((a, b) => (a.contactPerson || a.familyName).localeCompare(b.contactPerson || b.familyName, 'he'));

    filteredContacts.forEach(contact => {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-2 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200';
        contactDiv.innerHTML = `
            <div>
                <p class="font-semibold text-dark-blue">${contact.contactPerson || contact.familyName}</p>
                <p class="text-sm text-gray-600">${contact.familyName ? `משפחה: ${contact.familyName}` : ''} ${contact.phoneNumber ? `| טלפון: ${contact.phoneNumber}` : ''}</p>
                <p class="text-sm text-gray-600">${contact.address ? `כתובת: ${contact.address}` : ''}</p>
            </div>
            <div class="flex gap-2">
                <button class="btn-secondary px-3 py-1 text-sm glass-button show-orders-btn" data-family-name="${contact.familyName}">
                    <i class="fas fa-eye mr-1"></i> הצג הזמנות
                </button>
                <button class="btn-primary px-3 py-1 text-sm glass-button show-chat-btn" data-contact-person="${contact.contactPerson || contact.familyName}">
                    <i class="fas fa-comments mr-1"></i> פתח צ'אט
                </button>
            </div>
        `;
        contactsListContainer.appendChild(contactDiv);

        // Add event listener to the "Show Orders" button
        contactDiv.querySelector('.show-orders-btn').addEventListener('click', (event) => {
            const familyName = event.target.dataset.familyName;
            if (familyName) {
                // Navigate to order form and pre-fill family data
                showContent('orderFormContent');
                document.getElementById('familySelect').value = familyName; // Set dropdown value (if it were visible)
                // Manually set the familyNameDisplay as the select is hidden on this screen
                document.getElementById('familyNameDisplay').value = familyName;
                const familyDetails = familiesData[familyName];
                if (familyDetails) {
                    document.getElementById('addressInput').value = familyDetails.address || '';
                    document.getElementById('contactInput').value = familyDetails.contact || '';
                    document.getElementById('phoneInput').value = familyDetails.phone || '';
                }
                updateFamilyHistoryDisplay(familyName); // Update history for this family
                updateProgressBar(2); // Move to order form step
                showToast('info', 'פרטי משפחה נטענו', `פרטי משפחת ${familyName} נטענו לטופס ההזמנה.`);
            }
        });

        // Add event listener to the "Show Chat" button
        contactDiv.querySelector('.show-chat-btn').addEventListener('click', (event) => {
            const contactPerson = event.target.dataset.contactPerson;
            if (contactPerson) {
                currentChatContact = contactPerson; // Set the current chat contact
                document.getElementById('chatContactNameHeader').innerText = `צ'אט עם ${contactPerson}`;
                showContent('chatContent');
                updateProgressBar(0); // Reset progress
                fetchChatHistory(contactPerson); // Fetch and display chat history for this contact
            }
        });
    });
}

/**
 * Fetches chat history for a given contact from Google Apps Script.
 * @param {string} contactName The name of the contact to fetch chat history for.
 */
async function fetchChatHistory(contactName) {
    showLoading(`טוען היסטוריית צ'אט עבור ${contactName}...`);
    const chatMessagesContainer = document.getElementById('chatMessages');
    chatMessagesContainer.innerHTML = ''; // Clear existing messages

    try {
        const response = await fetch(`${WEB_APP_URL}?action=getChatHistory&contactName=${encodeURIComponent(contactName)}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }
        const data = await response.json();
        console.log('Chat history data:', data);

        if (data.success && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
            data.chatHistory.sort((a, b) => {
                // Assuming 'תאריך ושעה' is in 'DD.MM.YYYY, HH:MM:SS' format
                const parseDateTime = (dtStr) => {
                    const [datePart, timePart] = dtStr.split(', ');
                    const [day, month, year] = datePart.split('.').map(Number);
                    const [hours, minutes, seconds] = timePart.split(':').map(Number);
                    return new Date(year, month - 1, day, hours, minutes, seconds);
                };
                return parseDateTime(a['תאריך ושעה']).getTime() - parseDateTime(b['תאריך ושעה']).getTime();
            });

            data.chatHistory.forEach(message => {
                if (message['הודעת משתמש']) {
                    appendChatMessage(message['הודעת משתמש'], message['תאריך ושעה'], 'user');
                }
                if (message['תשובת מנהל מערכת']) {
                    appendChatMessage(message['תשובת מנהל מערכת'], message['תאריך ושעה'], 'admin');
                }
            });
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Scroll to bottom
        } else {
            chatMessagesContainer.innerHTML = '<p class="text-gray-500 text-center">אין היסטוריית צ\'אט עבור איש קשר זה.</p>';
        }
    } catch (error) {
        console.error('Error fetching chat history:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בטעינת היסטוריית הצ'אט: ${error.message}`);
        chatMessagesContainer.innerHTML = '<p class="text-red-500 text-center">שגיאה בטעינת היסטוריית צ\'אט.</p>';
    } finally {
        hideLoading();
    }
}

/**
 * Appends a chat message to the display.
 * @param {string} messageText The text of the message.
 * @param {string} timestamp The timestamp of the message.
 * @param {'user'|'admin'} senderType The type of sender ('user' or 'admin').
 */
function appendChatMessage(messageText, timestamp, senderType) {
    const chatMessagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${senderType}-message`;
    messageDiv.innerHTML = `
        <p>${messageText}</p>
        <span class="message-timestamp">${timestamp.split(',')[0]} ${timestamp.split(',')[1]}</span>
    `;
    chatMessagesContainer.appendChild(messageDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Scroll to bottom
}


/**
 * Sends a chat message (saves to sheet and sends to WhatsApp).
 * @param {string} message The message to send.
 */
async function sendChatMessage(message) {
    if (!message.trim()) {
        showToast('warning', 'הודעה ריקה', 'אנא הקלד הודעה לשליחה.');
        return;
    }
    if (!currentChatContact) {
        showToast('error', 'שגיאה', 'אנא בחר איש קשר לפני שליחת הודעה.');
        return;
    }

    showLoading('שולח הודעה ושומר היסטוריה...');
    const currentTimestamp = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

    try {
        const formData = new FormData();
        formData.append('action', 'saveChatMessage');
        formData.append('contactName', currentChatContact);
        formData.append('timestamp', currentTimestamp);
        formData.append('userMessage', message); // User's message

        const response = await fetch(`${WEB_APP_URL}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            appendChatMessage(message, currentTimestamp, 'user'); // Add to local display immediately
            document.getElementById('chatInput').value = ''; // Clear input
            showToast('success', 'הודעה נשלחה', 'ההודעה נשלחה ונשמרה בהיסטוריה.');

            // Now, send to WhatsApp externally
            const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodeURIComponent(`הודעה מ${currentChatContact}:\n${message}`)}`;
            window.open(whatsappUrl, '_blank');

            // Re-fetch chat history to get potential admin response (polling)
            setTimeout(() => fetchChatHistory(currentChatContact), 1000); // Fetch after a short delay
        } else {
            showToast('error', 'שגיאה', result.message || 'אירעה שגיאה בשמירת ההודעה.');
        }
    } catch (error) {
        console.error('Error sending chat message:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בשליחת ההודעה: ${error.message}`);
    } finally {
        hideLoading();
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Initialize live date and time
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Start typing animation (runs once on load)
    startTypingAnimation();

    fetchDataFromGoogleSheets(); // Load initial data

    // Initial view: Login screen
    showContent('loginContent');

    // Get elements
    const loginBtn = document.getElementById('loginBtn');
    const familySelect = document.getElementById('familySelect');
    const dynamicFamilyHeading = document.getElementById('dynamicFamilyHeading');
    const familyNameDisplay = document.getElementById('familyNameDisplay'); // New display field
    const addressInput = document.getElementById('addressInput');
    const contactInput = document.getElementById('contactInput');
    const phoneInput = document.getElementById('phoneInput');
    const historyDisplay = document.getElementById('historyDisplay');
    const addProductBtn = document.getElementById('addProductBtn');
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    const deliveryTypeSelect = document.getElementById('deliveryType');
    const addHistoricalProductButton = document.getElementById('addHistoricalProductBtn');
    const productFilterInput = document.getElementById('productFilterInput');
    const confirmAddProductBtn = document.getElementById('confirmAddProductBtn');
    const cancelAddProductBtn = document.getElementById('cancelAddProductBtn');
    const contactFilterInput = document.getElementById('contactFilterInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const emojiButtons = document.querySelectorAll('.emoji-btn');
    const whatsappShareBtn = document.getElementById('whatsappShareBtn'); // New WhatsApp share button


    // Event listeners for navigation buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetView = button.dataset.targetView;
            if (targetView === 'families') {
                showContent('step1Content');
                updateProgressBar(1); // Set progress to step 1
            } else if (targetView === 'login') {
                showContent('loginContent');
                updateProgressBar(0); // Reset progress
            } else if (targetView === 'contacts') {
                showContent('contactsContent');
                populateContactsList(); // Re-populate contacts list on view
                updateProgressBar(0); // Reset progress
            } else if (targetView === 'chat') {
                showContent('chatContent');
                updateProgressBar(0); // Reset progress
                // If a chat contact is already selected, load its history
                if (currentChatContact) {
                    document.getElementById('chatContactNameHeader').innerText = `צ'אט עם ${currentChatContact}`;
                    fetchChatHistory(currentChatContact);
                } else {
                    document.getElementById('chatContactNameHeader').innerText = `צ'אט וואטסאפ`;
                    document.getElementById('chatMessages').innerHTML = '<p class="text-gray-500 text-center">אנא בחר איש קשר כדי להתחיל צ\'אט.</p>';
                }
            }
        });
    });


    // Login Button (basic for now)
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const username = document.getElementById('usernameInput').value;
            const password = document.getElementById('passwordInput').value;

            // Simple mock login for demonstration
            if (username === 'סבן' && password === '1234') { // Updated username and password
                showToast('success', 'התחברת בהצלחה', `שלום ${username}, ברוך הבא למערכת ההזמנות!`);
                showContent('step1Content'); // Go to family selection after login
                updateProgressBar(1); // Set progress to step 1
            } else {
                showToast('error', 'שגיאת התחברות', 'שם משתמש או סיסמה שגויים.');
            }
        });
    }


    // Event listener for adding historical product from modal
    if (addHistoricalProductButton) {
        addHistoricalProductButton.addEventListener('click', addHistoricalProductToOrderForm);
    }

    // Event listeners for product exists confirmation modal
    if (confirmAddProductBtn) {
        confirmAddProductBtn.addEventListener('click', () => handleProductExistsConfirmation(true));
    }
    if (cancelAddProductBtn) {
        cancelAddProductBtn.addEventListener('click', () => handleProductExistsConfirmation(false));
    }

    // Event listener for product filter in the current order list
    if (productFilterInput) {
        productFilterInput.addEventListener('input', renderCurrentOrderProducts);
    }

    // Event listener for contact filter in the contacts list
    if (contactFilterInput) {
        contactFilterInput.addEventListener('input', populateContactsList);
    }

    // Attach event listener for the new WhatsApp share button
    if (whatsappShareBtn) {
        whatsappShareBtn.addEventListener('click', () => {
            if (lastOrderSummaryData) {
                sendOrderToWhatsApp(lastOrderSummaryData);
            } else {
                showToast('error', 'שגיאה', 'אין נתוני הזמנה לשיתוף. אנא בצע הזמנה תחילה.');
            }
        });
    }


    familySelect.addEventListener('change', (event) => {
        const selectedFamilyName = event.target.value;
        // Check if selectedFamilyName is valid before accessing familiesData
        if (selectedFamilyName && familiesData[selectedFamilyName]) {
            showContent('orderFormContent'); // Show order form content
            updateProgressBar(2); // Move to Step 2 (Order Details)

            const data = familiesData[selectedFamilyName];
            dynamicFamilyHeading.textContent = `הזמנה עבור משפחת ${selectedFamilyName}`;
            familyNameDisplay.value = selectedFamilyName; // Populate the display field

            // Make fields editable and populate
            addressInput.value = data.address || '';
            addressInput.removeAttribute('readonly'); // Make editable
            contactInput.value = data.contact || '';
            contactInput.removeAttribute('readonly'); // Make editable
            phoneInput.value = data.phone || '';
            phoneInput.removeAttribute('readonly'); // Make editable

            // Show welcome message
            showToast('info', 'ברוך הבא!', `שלום ${data.contact || selectedFamilyName}, ברוך הבא למערכת ההזמנות!`);

            // Populate history display
            updateFamilyHistoryDisplay(selectedFamilyName);

            // Clear existing product selections and add a fresh one
            document.getElementById('productsContainer').innerHTML = '';
            productRowCounter = 0; // Reset counter
            currentOrderProducts = []; // Clear current order products when family changes
            addProductSelection(); // Add initial product row
            renderCurrentOrderProducts(); // Render the empty or updated current order list

        } else {
            // If no family selected or invalid, reset form and go back to family selection
            resetOrderForm();
            showContent('step1Content');
            updateProgressBar(1);
            // Show a specific error if family data is missing unexpectedly
            if (selectedFamilyName && !familiesData[selectedFamilyName]) {
                showToast('error', 'שגיאה', `פרטי משפחת "${selectedFamilyName}" לא נמצאו. אנא בחר משפחה אחרת או רענן את הדף.`);
            }
        }
    });

    addProductBtn.addEventListener('click', () => {
        addProductSelection();
        updateProgressBar(3); // Move to Step 3 (Product Selection)
        // Auto-focus the new product search input
        const newProductSearchInput = document.getElementById(`productSearch_${productRowCounter - 1}`);
        if (newProductSearchInput) {
            newProductSearchInput.focus();
        }
    });

    submitOrderBtn.addEventListener('click', async () => {
        const familyName = familyNameDisplay.value; // Get from display field
        const address = addressInput.value;
        const contact = contactInput.value;
        const phone = phoneInput.value;
        const deliveryType = deliveryTypeSelect.value;

        if (!familyName.trim() || !address.trim() || !contact.trim() || !phone.trim()) {
            showToast('error', 'שגיאה', 'אנא מלא את כל פרטי המשפחה, הכתובת, איש הקשר והטלפון.');
            return;
        }

        let hasValidProduct = currentOrderProducts.some(p => p.quantity > 0 && p.name.trim() !== '');

        if (!hasValidProduct) {
            showToast('error', 'שגיאה', 'אנא בחר לפחות מוצר אחד להזמנה או הזן שם מוצר ידנית.');
            return;
        }

        if (!deliveryType) {
            showToast('error', 'שגיאה', 'אנא בחר סוג הובלה.');
            return;
        }

        const orderSummaryData = {
            timestamp: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
            familyName,
            address,
            contact,
            phone,
            products: currentOrderProducts.map(p => ({
                name: p.name,
                sku: p.sku,
                quantity: p.quantity,
                note: p.note
            })),
            imageData: null, // Placeholder, will be populated in sendOrderAndShare
            imageFileName: null, // Placeholder
            deliveryType
        };

        // Before showing confirmation modal, convert image to base64 if it exists
        const productImageFile = document.getElementById('productImage').files[0];
        if (productImageFile) {
            try {
                orderSummaryData.imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(productImageFile);
                });
                orderSummaryData.imageFileName = productImageFile.name;
            } catch (error) {
                console.error('Error converting image to base64 for display:', error);
                showToast('error', 'שגיאה', 'אירעה שגיאה בהמרת התמונה לתצוגה. ההזמנה תישלח ללא תמונה.');
                orderSummaryData.imageData = null;
                orderSummaryData.imageFileName = null;
            }
        }

        updateProgressBar(4); // Move to Step 4 (Summary)
        showConfirmationModal(orderSummaryData);
    });

    // Chat functionality
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
            sendChatMessage(chatInput.value); // Use the new sendChatMessage function
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage(chatInput.value); // Use the new sendChatMessage function
            }
        });
    }

    if (emojiButtons) {
        emojiButtons.forEach(button => {
            button.addEventListener('click', () => {
                chatInput.value += button.dataset.emoji;
                chatInput.focus(); // Keep focus on input after adding emoji
            });
        });
    }
});
