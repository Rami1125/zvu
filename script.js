// Function to show SweetAlert2 messages (Toast style)
function showToast(icon, title, text) {
    // Determine toast duration based on text length
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

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzKYuXRpGAXXOn7pVfdjsDe4Xs7aNTmuEJcJqBgjhhXCt8N4EyLbKIsXLOwOqsUXx829Q/exec';
// Company WhatsApp Number
const COMPANY_WHATSAPP_NUMBER = '972508860896';

// Current step in the order process
let currentStep = 1;

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
        default: progressWidth = 0;
    }
    progressBar.style.width = `${progressWidth}%`;

    stepLabels.forEach((label, index) => {
        if (index + 1 <= step) {
            label.classList.add('active-step');
        } else {
            label.classList.remove('active-step');
        }
    });

    // Toggle content visibility based on step
    document.getElementById('step1Content').classList.toggle('hidden', step !== 1);
    document.getElementById('step2Content').classList.toggle('hidden', step === 1);
}


// Function to fetch data from Google Apps Script
async function fetchDataFromGoogleSheets() {
    showLoading('טוען נתוני משפחות ומוצרים...');
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getInitialData`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success === false) {
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
            imageUrl: p['תמונה (URL)'] || 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg'
        }));

        previousOrdersHistory = data.previousOrders;

        populateFamilySelect();
        populateQuickFamilyButtons(); // Populate quick select buttons
        populateProductDatalist(); // Populate the datalist for product search
        addProductSelection(); // Add the first product selection row (no index needed for initial call)

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
}

function populateQuickFamilyButtons() {
    const quickFamilyButtonsContainer = document.getElementById('quickFamilyButtons');
    // Clear existing buttons, keep the instruction paragraph
    const existingButtons = quickFamilyButtonsContainer.querySelectorAll('button');
    existingButtons.forEach(button => button.remove());

    for (const familyName in familiesData) {
        const button = document.createElement('button');
        button.className = 'bg-gray-200 px-4 py-2 rounded-full hover:bg-blue-100 transition-all duration-200 shadow-sm';
        button.textContent = familyName;
        button.onclick = () => {
            document.getElementById('familySelect').value = familyName;
            document.getElementById('familySelect').dispatchEvent(new Event('change')); // Trigger change event
        };
        quickFamilyButtonsContainer.appendChild(button);
    }
}


function populateProductDatalist() {
    const productOptions = document.getElementById('productOptions');
    // Check if productOptions element exists before trying to modify it
    if (productOptions) {
        productOptions.innerHTML = ''; // Clear existing options

        productsCatalog.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name; // Display product name in datalist
            option.setAttribute('data-sku', product.sku); // Store SKU for later use
            productOptions.appendChild(option);
        });
    } else {
        console.warn("Datalist element with ID 'productOptions' not found. It might be dynamically removed or not present.");
    }
}

let productRowCounter = 0; // To keep track of multiple product selection rows

function addProductSelection() {
    const productsContainer = document.getElementById('productsContainer');
    const currentIndex = productRowCounter++; // Increment counter for unique IDs

    const newProductDiv = document.createElement('div');
    newProductDiv.className = 'form-group product-selection';
    newProductDiv.innerHTML = `
        <label for="productSearch_${currentIndex}" class="input-label">שם מוצר / מק"ט:</label>
        <input type="text" id="productSearch_${currentIndex}" list="productOptions" class="form-control product-search-input" placeholder="הקלד לחיפוש מוצר או בחר מהרשימה">
        <!-- The datalist is now global, no need to create it here again -->

        <input type="text" id="freeTextProduct_${currentIndex}" class="form-control free-text-product-input mt-2" placeholder="הקלד שם מוצר ידנית (לא חובה)">

        <label for="quantityInput_${currentIndex}" class="input-label mt-2">כמות:</label>
        <input type="number" id="quantityInput_${currentIndex}" class="form-control quantity-input" value="1" min="1">
        <input type="text" id="productNote_${currentIndex}" class="form-control product-note-input mt-2" placeholder="הערה לאיש קשר למוצר (לא חובה)">
        <div class="product-info-display mt-2" id="productInfo_${currentIndex}"></div>
        <div class="product-history-info mt-2" id="productHistoryInfo_${currentIndex}"></div>
    `;
    productsContainer.appendChild(newProductDiv);

    // Add event listeners for the new product row
    const productSearchInput = document.getElementById(`productSearch_${currentIndex}`);
    const freeTextProductInput = document.getElementById(`freeTextProduct_${currentIndex}`);
    const quantityInput = document.getElementById(`quantityInput_${currentIndex}`);
    const productNoteInput = document.getElementById(`productNote_${currentIndex}`);
    const productInfoDiv = document.getElementById(`productInfo_${currentIndex}`);
    const productHistoryInfoDiv = document.getElementById(`productHistoryInfo_${currentIndex}`);

    // Event listener for product search input (datalist)
    productSearchInput.addEventListener('input', (event) => {
        const typedValue = event.target.value;
        const productOptionsDatalist = document.getElementById('productOptions');
        productOptionsDatalist.innerHTML = ''; // Clear previous options

        if (typedValue.length >= 3) {
            const filteredProducts = productsCatalog.filter(p =>
                p.name.toLowerCase().includes(typedValue.toLowerCase())
            );
            filteredProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product.name;
                option.setAttribute('data-sku', product.sku);
                productOptionsDatalist.appendChild(option);
            });
        }

        const selectedProductName = typedValue; // Use the typed value for lookup
        const selectedProduct = productsCatalog.find(p => p.name === selectedProductName);

        productInfoDiv.innerHTML = ''; // Clear previous info
        productHistoryInfoDiv.innerHTML = ''; // Clear history info
        freeTextProductInput.value = ''; // Clear free text input if datalist is used

        if (selectedProduct) {
            productInfoDiv.innerHTML = `
                <div class="product-item-display">
                    <img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=NoImg';" onclick="showImagePreviewModal('${selectedProduct.imageUrl}')">
                    <div class="product-details-display">
                        <p class="product-name-display">${selectedProduct.name}</p>
                        <p class="product-sku-display">מק"ט: ${selectedProduct.sku}</p>
                    </div>
                </div>
            `;
            updateProductHistoryDisplay(selectedProductName, productHistoryInfoDiv);
            // Add to currentOrderProducts immediately if selected from datalist
            addOrUpdateCurrentOrderProduct({
                name: selectedProductName,
                sku: selectedProduct.sku,
                imageUrl: selectedProduct.imageUrl,
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        } else {
            // If no product is selected from datalist, clear its entry from currentOrderProducts
            // This is crucial for when user types something that isn't a valid product
            removeCurrentOrderProduct(currentIndex); // Remove if no valid product found
        }
    });

    // Event listener for free text product input
    freeTextProductInput.addEventListener('input', (event) => {
        // If free text is entered, clear datalist selection display
        if (event.target.value.trim() !== '') {
            productSearchInput.value = ''; // Clear datalist input
            productInfoDiv.innerHTML = ''; // Clear product info display
            productHistoryInfoDiv.innerHTML = ''; // Clear history info
            // No history for free text products as they are not in catalog
            // Add to currentOrderProducts immediately if free text is entered
            addOrUpdateCurrentOrderProduct({
                name: event.target.value.trim(),
                sku: 'N/A', // SKU is N/A for free text
                imageUrl: 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        } else {
            // If free text is cleared, remove its entry from currentOrderProducts
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
                imageUrl: productsCatalog.find(p => p.name === selectedProductName)?.imageUrl || 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
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
                imageUrl: productsCatalog.find(p => p.name === selectedProductName)?.imageUrl || 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
                quantity: parseInt(quantityInput.value, 10),
                note: productNoteInput.value.trim()
            }, currentIndex);
        }
    });
}

function updateProductHistoryDisplay(productName, displayDiv) {
    const selectedFamilyName = document.getElementById('familySelect').value;
    if (!selectedFamilyName) {
        displayDiv.innerHTML = '';
        return;
    }

    // Filter history for the selected family and product
    const familyProductOrders = previousOrdersHistory.filter(order =>
        order['שם משפחה'] === selectedFamilyName && order['שם מוצר'] === productName
    );

    if (familyProductOrders.length > 0) {
        const totalQuantity = familyProductOrders.reduce((sum, order) => sum + (parseInt(order['כמות']) || 0), 0);
        // Sort by date to get the last order date
        familyProductOrders.sort((a, b) => {
            // Convert "DD.MM.YYYY,HH:MM:SS" to a comparable Date object
            const parseDateString = (dateStr) => {
                const [datePart, timePart] = dateStr.split(',');
                const [day, month, year] = datePart.split('.').map(Number);
                const [hours, minutes, seconds] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hours, minutes, seconds);
            };
            const dateA = parseDateString(a['תאריך ושעה']);
            const dateB = parseDateString(b['תאריך ושעה']);
            return dateB.getTime() - dateA.getTime(); // Latest date first
        });
        const lastOrderDate = familyProductOrders[0]['תאריך ושעה'].split(',')[0]; // Just the date part

        displayDiv.innerHTML = `
            <i class="fas fa-history"></i> המוצר '${productName}' הוזמן ${totalQuantity} פעמים (אחרונה: ${lastOrderDate})
        `;
    } else {
        displayDiv.innerHTML = `<i class="fas fa-info-circle"></i> המוצר '${productName}' לא הוזמן בעבר על ידי משפחה זו.`;
    }
}

// Global variable to store the product name clicked in history for the modal
let selectedHistoricalProductName = '';

// Functions for Quantity Selection Modal
function showQuantitySelectionModal(productName) {
    selectedHistoricalProductName = productName;
    document.getElementById('modalProductName').innerText = `הוסף: ${productName}`;
    document.getElementById('quantitySelectionModal').classList.add('active');
}

function closeQuantitySelectionModal() {
    document.getElementById('quantitySelectionModal').classList.remove('active');
    selectedHistoricalProductName = ''; // Clear selected product
    document.getElementById('modalQuantitySelect').value = '1'; // Reset quantity
}

function addHistoricalProductToOrderForm() {
    const quantity = parseInt(document.getElementById('modalQuantitySelect').value, 10);
    if (selectedHistoricalProductName && quantity > 0) {
        // Find the product in the catalog to get SKU and image (if available)
        const product = productsCatalog.find(p => p.name === selectedHistoricalProductName);
        const sku = product ? product.sku : 'N/A';
        const imageUrl = product ? product.imageUrl : 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg';

        // Add to currentOrderProducts directly
        // Assign a unique formIndex for this historical product, even if not tied to a visible form row initially
        const newFormIndex = productRowCounter++;
        addOrUpdateCurrentOrderProduct({
            name: selectedHistoricalProductName,
            sku: sku,
            imageUrl: imageUrl,
            quantity: quantity,
            note: '', // No note from history selection initially
            formIndex: newFormIndex // Assign a unique index
        });

        showToast('success', 'נוסף בהצלחה', `'${selectedHistoricalProductName}' בכמות ${quantity} נוסף להזמנה.`);
        closeQuantitySelectionModal();
    } else {
        showToast('error', 'שגיאה', 'אנא בחר כמות חוקית.');
    }
}


// Function to add or update a product in the currentOrderProducts array
// This function is called by the input change listeners in addProductSelection
function addOrUpdateCurrentOrderProduct(productData, formIndex) {
    // Ensure productData has a formIndex
    if (formIndex === undefined) {
        // If formIndex is not provided, this is likely a historical product being added
        // It will get its formIndex from addHistoricalProductToOrderForm
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
        if (existingIndex > -1) {
            currentOrderProducts[existingIndex] = { ...productData, formIndex };
        } else {
            currentOrderProducts.push({ ...productData, formIndex });
        }
    }
    renderCurrentOrderProducts(); // Re-render the display list
}


// Function to remove a product from currentOrderProducts
function removeCurrentOrderProduct(formIndex) {
    currentOrderProducts = currentOrderProducts.filter(p => p.formIndex !== formIndex);
    // Also remove the corresponding product selection row from the form if it exists
    const productSelectionDiv = document.querySelector(`#productsContainer .product-selection:has(#productSearch_${formIndex})`);
    if (productSelectionDiv) {
        productSelectionDiv.remove();
    }
    renderCurrentOrderProducts(); // Re-render the display list
    showToast('info', 'המוצר הוסר', 'המוצר הוסר מרשימת ההזמנה.');
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
                    } else { // If quantity becomes 0 or less, remove it
                        removeCurrentOrderProduct(product.formIndex);
                    }
                }
                // No need to call renderCurrentOrderProducts here, as the input value itself updates.
                // The array is updated, which is sufficient for submission.
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
function showImagePreviewModal(imageUrl) {
    document.getElementById('previewImage').src = imageUrl;
    document.getElementById('imagePreviewModal').classList.add('active');
}

function closeImagePreviewModal() {
    document.getElementById('imagePreviewModal').classList.remove('active');
    document.getElementById('previewImage').src = ''; // Clear image source
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

    const selectedFamilyName = document.getElementById('familySelect').value;
    if (selectedFamilyName) {
        const productSpecificHistory = previousOrdersHistory.filter(order =>
            order['שם מוצר'] === product.name
        ).sort((a, b) => {
            // Sort by date descending
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
            historyInModal.innerHTML = ''; // Clear loading message
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
            historyInModal.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות למוצר זה.</p>';
        }
    } else {
        historyInModal.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריית הזמנות.</p>';
    }

    modal.classList.add('active');
}

function closeProductDetailsModal() {
    document.getElementById('productDetailsModal').classList.remove('active');
}


// Modal functions for order confirmation
function showConfirmationModal(orderSummary) {
    console.log('Confirmation modal attempting to show.'); // Added log
    const modal = document.getElementById('orderConfirmationModal');
    const receiptContent = document.getElementById('receiptContent');

    // Format the products for the receipt
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
    `;

    modal.classList.add('active');
}

function closeConfirmationModal() {
    document.getElementById('orderConfirmationModal').classList.remove('active');
}

async function handleSaveAndShare() {
    const orderConfirmationModalButton = document.querySelector('#orderConfirmationModal .btn-primary');
    orderConfirmationModalButton.disabled = true; // Disable button to prevent double click
    orderConfirmationModalButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

    closeConfirmationModal(); // Close modal first
    showLoading('שולח הזמנה ושומר...');

    const familyName = document.getElementById('familySelect').value;
    const address = document.getElementById('addressInput').value;
    const contact = document.getElementById('contactInput').value;
    const phone = document.getElementById('phoneInput').value;
    const deliveryType = document.getElementById('deliveryType').value;
    const productImageFile = document.getElementById('productImage').files[0];
    let base64Image = null;

    if (productImageFile) {
        try {
            base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(productImageFile);
            });
        } catch (error) {
            console.error('Error converting image to base64 for submission:', error);
            showToast('error', 'שגיאה', 'אירעה שגיאה בהמרת התמונה לשליחה. נסה שוב.');
            hideLoading();
            orderConfirmationModalButton.disabled = false;
            orderConfirmationModalButton.innerHTML = '<i class="fas fa-camera"></i> שמור כתמונה / שתף בוואטסאף';
            return;
        }
    }

    const orderData = {
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
        imageData: base64Image,
        imageFileName: productImageFile ? productImageFile.name : null,
        deliveryType
    };

    try {
        const response = await fetch(`${WEB_APP_URL}?action=submitOrder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();

        if (result.success) {
            showToast('success', 'הזמנה נשלחה', result.message);

            // Generate WhatsApp message
            let whatsappMessage = `📦 הזמנה חדשה מבית סבן\n\n`;
            whatsappMessage += `*משפחה:* ${familyName}\n`;
            whatsappMessage += `*כתובת:* ${address}\n`;
            whatsappMessage += `*איש קשר:* ${contact} ${phone}\n`;
            whatsappMessage += `*סוג הובלה:* ${deliveryType || 'לא נבחר'}\n`;
            whatsappMessage += `\n🧾 *מוצרים:*\n`;
            currentOrderProducts.forEach(p => {
                whatsappMessage += `• ${p.name} × ${p.quantity}`;
                if (p.note) {
                    whatsappMessage += ` (הערה: ${p.note})`;
                }
                whatsappMessage += `\n`;
            });
            whatsappMessage += `\n🕓 *תאריך:* ${new Date().toLocaleDateString('he-IL')}\n`;
            if (productImageFile) {
                whatsappMessage += `\n*הערה:* צורפה תמונה של מוצר מהשטח.`;
            }

            const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
            window.open(whatsappUrl, '_blank');

            // Clear form after successful submission
            document.getElementById('familySelect').value = '';
            updateProgressBar(1); // Reset to Step 1
            document.getElementById('dynamicFamilyHeading').classList.add('hidden');
            document.getElementById('familyDetailsForm').classList.add('hidden');
            document.getElementById('addressInput').value = '';
            document.getElementById('addressInput').setAttribute('readonly', true);
            document.getElementById('contactInput').value = '';
            document.getElementById('contactInput').setAttribute('readonly', true);
            document.getElementById('phoneInput').value = '';
            document.getElementById('phoneInput').setAttribute('readonly', true);
            document.getElementById('deliveryType').value = '';
            document.getElementById('historyDisplay').innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
            document.getElementById('productsContainer').innerHTML = '';
            productRowCounter = 0;
            currentOrderProducts = [];
            addProductSelection();
            renderCurrentOrderProducts();
            document.getElementById('productImage').value = '';

            // Re-fetch data to update history for next order
            fetchDataFromGoogleSheets();

        } else {
            showToast('error', 'שגיאה', result.message || 'אירעה שגיאה בשליחת ההזמנה.');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בשליחת ההזמנה: ${error.message}. נסה שוב מאוחר יותר.`);
    } finally {
        hideLoading();
        orderConfirmationModalButton.disabled = false;
        orderConfirmationModalButton.innerHTML = '<i class="fas fa-camera"></i> שמור כתמונה / שתף בוואטסאף';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Initialize live date and time
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update every second

    fetchDataFromGoogleSheets(); // Load initial data

    const familySelect = document.getElementById('familySelect');
    const dynamicFamilyHeading = document.getElementById('dynamicFamilyHeading');
    const familyDetailsForm = document.getElementById('familyDetailsForm');
    const addressInput = document.getElementById('addressInput');
    const contactInput = document.getElementById('contactInput');
    const phoneInput = document.getElementById('phoneInput');
    const historyDisplay = document.getElementById('historyDisplay');
    const addProductBtn = document.getElementById('addProductBtn');
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    const deliveryTypeSelect = document.getElementById('deliveryType');
    const addHistoricalProductButton = document.getElementById('addHistoricalProductBtn');
    const productFilterInput = document.getElementById('productFilterInput');
    const saveAndShareButton = document.querySelector('#orderConfirmationModal .btn-primary');


    // Event listener for adding historical product from modal
    if (addHistoricalProductButton) {
        addHistoricalProductButton.addEventListener('click', addHistoricalProductToOrderForm);
    }

    // Event listener for product filter in the current order list
    if (productFilterInput) {
        productFilterInput.addEventListener('input', renderCurrentOrderProducts);
    }

    // Attach the single event listener for the modal's primary button
    if (saveAndShareButton) {
        saveAndShareButton.addEventListener('click', handleSaveAndShare);
    }


    familySelect.addEventListener('change', (event) => {
        const selectedFamilyName = event.target.value;
        if (selectedFamilyName && familiesData[selectedFamilyName]) {
            updateProgressBar(2); // Move to Step 2
            const data = familiesData[selectedFamilyName];
            dynamicFamilyHeading.textContent = `הזמנה עבור משפחת ${selectedFamilyName}`;
            dynamicFamilyHeading.classList.remove('hidden');
            familyDetailsForm.classList.remove('hidden');

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
            historyDisplay.innerHTML = '';
            const familyHistory = previousOrdersHistory.filter(order => order['שם משפחה'] === selectedFamilyName);
            if (familyHistory.length > 0) {
                // Aggregate history for display (e.g., unique products and last order date)
                const aggregatedHistory = {};
                familyHistory.forEach(order => {
                    const productName = order['שם מוצר'];
                    const quantity = parseInt(order['כמות']) || 0;
                    const orderDate = order['תאריך ושעה'];

                    if (!aggregatedHistory[productName]) {
                        aggregatedHistory[productName] = { totalQty: 0, lastDate: '' };
                    }
                    aggregatedHistory[productName].totalQty += quantity;
                    // Keep the latest date
                    if (orderDate > aggregatedHistory[productName].lastDate) {
                        aggregatedHistory[productName].lastDate = orderDate;
                    }
                });

                for (const prodName in aggregatedHistory) {
                    const item = aggregatedHistory[prodName];
                    const p = document.createElement('p');
                    p.className = 'history-item';
                    p.innerHTML = `<i class="fas fa-box"></i> ${prodName} (סה"כ: ${item.totalQty}, אחרונה: ${item.lastDate.split(',')[0]})`;
                    // Add click listener to open quantity selection modal
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

            // Clear existing product selections and add a fresh one
            document.getElementById('productsContainer').innerHTML = '';
            productRowCounter = 0; // Reset counter
            currentOrderProducts = []; // Clear current order products when family changes
            addProductSelection(); // Add initial product row
            renderCurrentOrderProducts(); // Render the empty or updated current order list

        } else {
            updateProgressBar(1); // Reset to Step 1
            dynamicFamilyHeading.classList.add('hidden');
            familyDetailsForm.classList.add('hidden');
            addressInput.value = '';
            addressInput.setAttribute('readonly', true); // Make readonly again
            contactInput.value = '';
            contactInput.setAttribute('readonly', true); // Make readonly again
            phoneInput.value = '';
            phoneInput.setAttribute('readonly', true); // Make readonly again
            deliveryTypeSelect.value = ''; // Clear delivery type
            historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
            document.getElementById('productsContainer').innerHTML = '';
            productRowCounter = 0;
            currentOrderProducts = [];
            addProductSelection();
            renderCurrentOrderProducts();
        }
    });

    addProductBtn.addEventListener('click', addProductSelection);

    submitOrderBtn.addEventListener('click', async () => {
        // --- Debugging logs for validation ---
        console.log('Submit button clicked!');
        const familyName = familySelect.value;
        const address = addressInput.value;
        const contact = contactInput.value;
        const phone = phoneInput.value;
        const deliveryType = deliveryTypeSelect.value;

        console.log('Validation Check 1: Family Details');
        console.log(`Family Name: "${familyName}" (Valid: ${!!familyName})`);
        console.log(`Address: "${address}" (Valid: ${!!address})`);
        console.log(`Contact: "${contact}" (Valid: ${!!contact})`);
        console.log(`Phone: "${phone}" (Valid: ${!!phone})`);

        if (!familyName || !address || !contact || !phone) {
            showToast('error', 'שגיאה', 'אנא מלא את כל פרטי המשפחה, הכתובת, איש הקשר והטלפון.');
            console.error('Validation failed: Missing family details.');
            return;
        }

        // Use currentOrderProducts for validation and submission
        console.log('Validation Check 2: Valid Products in currentOrderProducts');
        console.log(`Current Order Products Count: ${currentOrderProducts.length}`);
        let hasValidProduct = currentOrderProducts.some(p => p.quantity > 0 && p.name.trim() !== '');

        if (!hasValidProduct) {
            showToast('error', 'שגיאה', 'אנא בחר לפחות מוצר אחד להזמנה או הזן שם מוצר ידנית.');
            console.error('Validation failed: No valid products selected.');
            return;
        }

        console.log('Validation Check 3: Delivery Type');
        console.log(`Delivery Type: "${deliveryType}" (Valid: ${!!deliveryType})`);

        if (!deliveryType) {
            showToast('error', 'שגיאה', 'אנא בחר סוג הובלה.');
            console.error('Validation failed: No delivery type selected.');
            return;
        }

        console.log('All validations passed. Proceeding with order submission.');
        // --- End Debugging logs ---

        // Prepare data for the confirmation modal
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
            // Image data will be retrieved again in handleSaveAndShare to avoid stale data
            imageData: null, // Placeholder, will be populated in handleSaveAndShare
            imageFileName: null, // Placeholder
            deliveryType
        };

        updateProgressBar(4); // Move to Step 4 (Summary)
        showConfirmationModal(orderSummaryData);
    });
});
