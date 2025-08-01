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
// IMPORTANT: Replace this with your actual deployed Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOjjBNd3ziRd66OrIcSw7Q0x9-7_0nSUHMvYskSkGv_8UPS4BYhdvV0zVlvE1dM4ny/exec'; // This URL needs to be updated by the user!
// Company WhatsApp Number
const COMPANY_WHATSAPP_NUMBER = '972508860896';

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

// Function for typing effect
function typeWriter(text, i, fnCallback) {
    const typingElement = document.getElementById('typingEffectText');
    if (i < text.length) {
        typingElement.innerHTML = text.substring(0, i + 1) + '<span class="typing-effect"></span>';
        setTimeout(function() {
            typeWriter(text, i + 1, fnCallback);
        }, 50); // Typing speed
    } else if (typeof fnCallback == 'function') {
        // Call callback once animation is complete
        typingElement.innerHTML = text; // Remove blinking cursor
        setTimeout(fnCallback, 1000); // Pause before next action
    }
}

// Function to start the typing animation
function startTypingAnimation() {
    const phrases = [
        "למשפחות זבולון עדירן ברוכים הבאים למערכת ההזמנות המתקדמת!",
        "מייעלים את תהליך ההזמנות שלכם.",
        "הזמינו בקלות ובמהירות!"
    ];
    let phraseIndex = 0;

    function nextPhrase() {
        typeWriter(phrases[phraseIndex], 0, function() {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            setTimeout(nextPhrase, 2000); // Wait 2 seconds before typing next phrase
        });
    }
    nextPhrase();
}

// Function to fetch data from Google Apps Script
async function fetchDataFromGoogleSheets() {
    showLoading('טוען נתוני מוצרים והיסטוריית הזמנות...');
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getInitialData`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success === false) {
            throw new Error(data.message || 'Failed to fetch initial data from Google Sheets.');
        }

        // Populate global data stores (familiesData is still populated for internal lookups for history)
        familiesData = {}; // This will now be populated but not used for a dropdown
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

        populateProductDatalist(); // Populate the datalist for product search
        addProductSelection(); // Add the first product selection row (no index needed for initial call)

    } catch (error) {
        console.error('Error fetching initial data:', error);
        showToast('error', 'שגיאה', `אירעה שגיאה בטעינת הנתונים הראשוניים: ${error.message}. אנא ודא שה-Apps Script פרוס כראוי והגיליונות קיימים.`);
    } finally {
        hideLoading();
    }
}

// Removed populateFamilySelect() and populateQuickFamilyButtons() as they are no longer needed.

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

function addProductSelection() {
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

    // Add event listeners for the new product row
    const productSearchInput = document.getElementById(`productSearch_${currentIndex}`);
    const freeTextProductInput = document.getElementById(`freeTextProduct_${currentIndex}`);
    const quantityInput = document.getElementById(`quantityInput_${currentIndex}`);
    const productNoteInput = document.getElementById(`productNote_${currentIndex}`);
    const productInfoDiv = document.getElementById(`productInfo_${currentIndex}`);
    const productHistoryInfoDiv = document.getElementById(`productHistoryInfo_${currentIndex}`);
    const deleteRowBtn = document.querySelector(`.delete-product-row-btn[data-index="${currentIndex}"]`);

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
                    <img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=NoImg';" onclick="showImagePreviewModal('${selectedProduct.imageUrl}')">
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
                imageUrl: 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg',
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
        historyDisplay.innerHTML = '<p class="text-gray-500">הקלד שם משפחה כדי לראות היסטוריה.</p>';
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
                    quantity: item.totalQty,
                    note: ''
                });
            });
            historyDisplay.appendChild(p);
        }
    } else {
        historyDisplay.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות זמינה למשפחה זו.</p>';
    }
}


function updateProductHistoryDisplay(productName, displayDiv) {
    const selectedFamilyName = document.getElementById('familyNameInput').value; // Get from new input field
    if (!selectedFamilyName.trim()) {
        displayDiv.innerHTML = '';
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
    document.getElementById('quantitySelectionModal').classList.remove('hidden');
    document.getElementById('quantitySelectionModal').classList.add('active');
}

function closeQuantitySelectionModal() {
    document.getElementById('quantitySelectionModal').classList.remove('active');
    document.getElementById('quantitySelectionModal').classList.add('hidden');
    selectedHistoricalProductName = '';
    document.getElementById('modalQuantitySelect').value = '1';
}

function addHistoricalProductToOrderForm() {
    const quantity = parseInt(document.getElementById('modalQuantitySelect').value, 10);
    if (selectedHistoricalProductName && quantity > 0) {
        const product = productsCatalog.find(p => p.name === selectedHistoricalProductName);
        const sku = product ? product.sku : 'N/A';
        const imageUrl = product ? product.imageUrl : 'https://placehold.co/60x60/CCCCCC/000000?text=NoImg';

        addProductSelection();
        const lastIndex = productRowCounter - 1;

        const productSearchInput = document.getElementById(`productSearch_${lastIndex}`);
        const freeTextProductInput = document.getElementById(`freeTextProduct_${lastIndex}`);
        const quantityInput = document.getElementById(`quantityInput_${lastIndex}`);

        if (product) {
            productSearchInput.value = selectedHistoricalProductName;
            productSearchInput.dispatchEvent(new Event('input')); // Trigger input event to update display and array
        } else {
            freeTextProductInput.value = selectedHistoricalProductName;
            freeTextProductInput.dispatchEvent(new Event('input')); // Trigger input event
        }
        quantityInput.value = quantity;
        quantityInput.dispatchEvent(new Event('input')); // Trigger input event to update quantity in array

        showToast('success', 'נוסף בהצלחה', `'${selectedHistoricalProductName}' בכמות ${quantity} נוסף להזמנה.`);
        closeQuantitySelectionModal();
    } else {
        showToast('error', 'שגיאה', 'אנא בחר כמות חוקית.');
    }
}

function addOrUpdateCurrentOrderProduct(productData, formIndex) {
    if (formIndex === undefined) {
        console.warn("addOrUpdateCurrentOrderProduct called without formIndex.");
        return;
    }

    const existingIndex = currentOrderProducts.findIndex(p => p.formIndex === formIndex);

    if (!productData.name.trim() || productData.quantity <= 0) {
        if (existingIndex > -1) {
            currentOrderProducts.splice(existingIndex, 1);
        }
    } else {
        if (existingIndex > -1) {
            currentOrderProducts[existingIndex] = { ...productData, formIndex };
        } else {
            currentOrderProducts.push({ ...productData, formIndex });
        }
    }
    renderCurrentOrderProducts();
}

function removeCurrentOrderProduct(formIndex) {
    currentOrderProducts = currentOrderProducts.filter(p => p.formIndex !== formIndex);
    renderCurrentOrderProducts();
    showToast('info', 'המוצר הוסר', 'שורת המוצר הוסרה מרשימת ההזמנה.');
}

function renderCurrentOrderProducts() {
    const listContainer = document.getElementById('currentOrderProductsList');
    const filterInput = document.getElementById('productFilterInput');
    const filterText = filterInput.value.trim().toLowerCase();

    listContainer.innerHTML = '';

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
    document.getElementById('imagePreviewModal').classList.remove('hidden');
    document.getElementById('imagePreviewModal').classList.add('active');
}

function closeImagePreviewModal() {
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

    const selectedFamilyName = document.getElementById('familyNameInput').value; // Get from new input field
    if (selectedFamilyName.trim()) {
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
    } else {
        historyInModal.innerHTML = '<p class="text-gray-500">הקלד שם משפחה כדי לראות היסטוריית הזמנות למוצר.</p>';
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

async function handleSaveAndShare() {
    const orderConfirmationModalButton = document.querySelector('#orderConfirmationModal .btn-primary');
    orderConfirmationModalButton.disabled = true;
    orderConfirmationModalButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

    closeConfirmationModal();
    showLoading('שולח הזמנה ושומר...');

    const familyName = document.getElementById('familyNameInput').value;
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
        action: 'submitOrder',
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
        const response = await fetch(`${WEB_APP_URL}`, {
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
            document.getElementById('familyNameInput').value = '';
            document.getElementById('addressInput').value = '';
            document.getElementById('contactInput').value = '';
            document.getElementById('phoneInput').value = '';
            document.getElementById('deliveryType').value = '';
            document.getElementById('historyDisplay').innerHTML = '<p class="text-gray-500">הקלד שם משפחה כדי לראות היסטוריה.</p>';
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
    setInterval(updateDateTime, 1000);

    // Start typing animation
    startTypingAnimation();

    fetchDataFromGoogleSheets(); // Load initial data

    const familyNameInput = document.getElementById('familyNameInput'); // New input field
    const addProductBtn = document.getElementById('addProductBtn');
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    const addHistoricalProductButton = document.getElementById('addHistoricalProductBtn');
    const productFilterInput = document.getElementById('productFilterInput');
    const saveAndShareButton = document.querySelector('#orderConfirmationModal .btn-primary');

    // Event listener for family name input to update history display
    if (familyNameInput) {
        familyNameInput.addEventListener('input', (event) => {
            updateFamilyHistoryDisplay(event.target.value);
        });
    }

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

    addProductBtn.addEventListener('click', addProductSelection);

    submitOrderBtn.addEventListener('click', async () => {
        const familyName = document.getElementById('familyNameInput').value;
        const address = document.getElementById('addressInput').value;
        const contact = document.getElementById('contactInput').value;
        const phone = document.getElementById('phoneInput').value;
        const deliveryType = document.getElementById('deliveryType').value;

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
            imageData: null,
            imageFileName: null,
            deliveryType
        };

        showConfirmationModal(orderSummaryData);
    });
});
