// Function to show SweetAlert2 messages (Toast style)
function showToast(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
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

// Google Apps Script Web App URL (REPLACE THIS WITH YOUR DEPLOYED WEB APP URL)
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxvBPHFmT9trPCTGGzrhcKAxik28Pzco7OAhnY0gWLFKDHzfFyHpllheCt9ac78RMH-ZA/execL';
// Company WhatsApp Number (REPLACE THIS WITH YOUR COMPANY'S WHATSAPP NUMBER, e.g., '9725XXXXXXXX')
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
        addProductSelection(0); // Add the first product selection row

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
    productOptions.innerHTML = ''; // Clear existing options

    productsCatalog.forEach(product => {
        const option = document.createElement('option');
        option.value = product.name; // Display product name in datalist
        option.setAttribute('data-sku', product.sku); // Store SKU for later use
        productOptions.appendChild(option);
    });
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
        <datalist id="productOptions"></datalist>

        <input type="text" id="freeTextProduct_${currentIndex}" class="form-control free-text-product-input mt-2" placeholder="הקלד שם מוצר ידנית (לא חובה)">

        <label for="quantityInput_${currentIndex}" class="input-label mt-2">כמות:</label>
        <input type="number" id="quantityInput_${currentIndex}" class="form-control quantity-input" value="1" min="1">
        <div class="product-info-display mt-2" id="productInfo_${currentIndex}"></div>
        <div class="product-history-info mt-2" id="productHistoryInfo_${currentIndex}"></div>
    `;
    productsContainer.appendChild(newProductDiv);

    // Re-populate datalist for new input (it's shared, but good practice)
    populateProductDatalist();

    // Add event listeners for the new product row
    const productSearchInput = document.getElementById(`productSearch_${currentIndex}`);
    const freeTextProductInput = document.getElementById(`freeTextProduct_${currentIndex}`);
    const productInfoDiv = document.getElementById(`productInfo_${currentIndex}`);
    const productHistoryInfoDiv = document.getElementById(`productHistoryInfo_${currentIndex}`);

    // Event listener for product search input (datalist)
    productSearchInput.addEventListener('input', (event) => {
        const selectedProductName = event.target.value;
        const selectedProduct = productsCatalog.find(p => p.name === selectedProductName);

        productInfoDiv.innerHTML = ''; // Clear previous info
        productHistoryInfoDiv.innerHTML = ''; // Clear history info
        freeTextProductInput.value = ''; // Clear free text input if datalist is used

        if (selectedProduct) {
            productInfoDiv.innerHTML = `
                <div class="product-item-display">
                    <img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/CCCCCC/000000?text=NoImg';">
                    <div class="product-details-display">
                        <p class="product-name-display">${selectedProduct.name}</p>
                        <p class="product-sku-display">מק"ט: ${selectedProduct.sku}</p>
                    </div>
                </div>
            `;
            updateProductHistoryDisplay(selectedProduct.name, productHistoryInfoDiv);
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


// Modal functions for order confirmation
function showConfirmationModal(orderSummary) {
    const modal = document.getElementById('orderConfirmationModal');
    const receiptContent = document.getElementById('receiptContent');

    // Format the products for the receipt
    let productsHtml = '<ul>';
    orderSummary.products.forEach(p => {
        productsHtml += `<li><span class="product-receipt-name">${p.name}</span> <span class="product-receipt-qty">× ${p.quantity}</span></li>`;
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

async function saveReceiptAsImage() {
    showLoading('מכין תמונה...');
    const receiptContent = document.getElementById('receiptContent');
    try {
        const canvas = await html2canvas(receiptContent, {
            scale: 2, // Increase scale for better quality
            useCORS: true, // Enable CORS for images if any
            backgroundColor: '#f0f4f8' // Match receipt background
        });
        const imageDataURL = canvas.toDataURL('image/png');

        // Create a temporary link to download the image
        const link = document.createElement('a');
        link.href = imageDataURL;
        link.download = `הזמנה_${document.getElementById('familySelect').value}_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        hideLoading();
        showToast('success', 'תמונה נשמרה', 'תעודת המשלוח נשמרה כתמונה!');

        // Optionally, offer to share on WhatsApp with the image
        Swal.fire({
            title: 'האם תרצה לשתף את סיכום ההזמנה בוואטסאפ?',
            showCancelButton: true,
            confirmButtonText: 'כן, שתף',
            cancelButtonText: 'לא תודה',
            icon: 'question',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-secondary'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                // Re-generate WhatsApp text message
                const familyName = document.getElementById('familySelect').value;
                const address = document.getElementById('addressInput').value;
                const contact = document.getElementById('contactInput').value;
                const phone = document.getElementById('phoneInput').value;
                const deliveryType = document.getElementById('deliveryType').value;

                const orderedProducts = [];
                document.querySelectorAll('.product-selection').forEach(selection => {
                    const productSearchInput = selection.querySelector('.product-search-input');
                    const freeTextProductInput = selection.querySelector('.free-text-product-input');
                    const quantityInput = selection.querySelector('.quantity-input');

                    const selectedProductName = freeTextProductInput.value.trim() || productSearchInput.value.trim();
                    const quantity = parseInt(quantityInput.value, 10);

                    if (selectedProductName && quantity > 0) {
                        const product = productsCatalog.find(p => p.name === selectedProductName);
                        orderedProducts.push({
                            name: selectedProductName,
                            sku: product ? product.sku : 'N/A', // Use SKU if found, else N/A
                            quantity: quantity
                        });
                    }
                });

                let whatsappMessage = `📦 הזמנה חדשה מבית סבן\n\n`;
                whatsappMessage += `*משפחה:* ${familyName}\n`;
whatsappMessage += `*כתובת:* ${address}\n`;
whatsappMessage += `*איש קשר:* ${contact} ${phone}\n`;
whatsappMessage += `*סוג הובלה:* ${deliveryType || 'לא נבחר'}\n`;
whatsappMessage += `\n🧾 *מוצרים:*\n`;
orderedProducts.forEach(p => {
    whatsappMessage += `• ${p.name} × ${p.quantity}\n`;
});
whatsappMessage += `\n🕓 *תאריך:* ${new Date().toLocaleDateString('he-IL')}\n`;
                const productImageFile = document.getElementById('productImage').files[0];
                if (productImageFile) {
                    whatsappMessage += `\n*הערה:* צורפה תמונה של מוצר מהשטח.`;
                }

                const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
                window.open(whatsappUrl, '_blank');
            }
        });

    } catch (error) {
        console.error('Error converting to image:', error);
        hideLoading();
        showToast('error', 'שגיאה', 'אירעה שגיאה בשמירת התמונה. נסה שוב.');
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


    familySelect.addEventListener('change', (event) => {
        const selectedFamilyName = event.target.value;
        if (selectedFamilyName && familiesData[selectedFamilyName]) {
            updateProgressBar(2); // Move to Step 2
            const data = familiesData[selectedFamilyName];
            dynamicFamilyHeading.textContent = `הזמנה עבור משפחת ${selectedFamilyName}`;
            dynamicFamilyHeading.classList.remove('hidden');
            familyDetailsForm.classList.remove('hidden');

            addressInput.value = data.address || '';
            contactInput.value = data.contact || '';
            phoneInput.value = data.phone || '';

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
                    historyDisplay.appendChild(p);
                }
            } else {
                historyDisplay.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות זמינה למשפחה זו.</p>';
            }

            // Clear existing product selections and add a fresh one
            document.getElementById('productsContainer').innerHTML = '';
            productRowCounter = 0; // Reset counter
            addProductSelection(); // Add initial product row

        } else {
            updateProgressBar(1); // Reset to Step 1
            dynamicFamilyHeading.classList.add('hidden');
            familyDetailsForm.classList.add('hidden');
            addressInput.value = '';
            contactInput.value = '';
            phoneInput.value = '';
            historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
            document.getElementById('productsContainer').innerHTML = ''; // Clear product rows
            productRowCounter = 0;
        }
    });

    addProductBtn.addEventListener('click', addProductSelection);

    submitOrderBtn.addEventListener('click', async () => {
        const familyName = familySelect.value;
        const address = addressInput.value;
        const contact = contactInput.value;
        const phone = phoneInput.value;
        const deliveryType = deliveryTypeSelect.value; // Get selected delivery type

        if (!familyName || !address || !contact || !phone) {
            showToast('error', 'שגיאה', 'אנא מלא את כל פרטי המשפחה, הכתובת, איש הקשר והטלפון.');
            return;
        }

        const orderedProducts = [];
        const productSelections = document.querySelectorAll('.product-selection');
        let hasValidProduct = false;

        productSelections.forEach((selection) => {
            const productSearchInput = selection.querySelector('.product-search-input');
            const freeTextProductInput = selection.querySelector('.free-text-product-input');
            const quantityInput = selection.querySelector('.quantity-input');

            const selectedProductName = freeTextProductInput.value.trim() || productSearchInput.value.trim();
            const quantity = parseInt(quantityInput.value, 10);

            if (selectedProductName && quantity > 0) {
                hasValidProduct = true;
                const product = productsCatalog.find(p => p.name === selectedProductName);
                orderedProducts.push({
                    name: selectedProductName,
                    sku: product ? product.sku : 'N/A', // Use SKU if found, else N/A
                    quantity: quantity
                });
            }
        });

        if (!hasValidProduct) {
            showToast('error', 'שגיאה', 'אנא בחר לפחות מוצר אחד להזמנה או הזן שם מוצר ידנית.');
            return;
        }

        if (!deliveryType) {
            showToast('error', 'שגיאה', 'אנא בחר סוג הובלה.');
            return;
        }

        const productImageFile = document.getElementById('productImage').files[0];
        let base64Image = null;
        if (productImageFile) {
            showLoading('מעלה תמונה...');
            try {
                base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(productImageFile);
                });
            } catch (error) {
                console.error('Error converting image to base64:', error);
                showToast('error', 'שגיאה', 'אירעה שגיאה בהמרת התמונה. נסה שוב.');
                hideLoading();
                return;
            }
        }

        const orderData = {
            timestamp: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
            familyName,
            address,
            contact,
            phone,
            products: orderedProducts,
            imageData: base64Image,
            imageFileName: productImageFile ? productImageFile.name : null,
            deliveryType // Include delivery type in order data
        };

        updateProgressBar(4); // Move to Step 4 (Summary)
        showConfirmationModal(orderData);

        // Add an event listener to the "Save as Image" button in the modal
        // This button will also trigger the actual submission to Google Sheets
        document.querySelector('#orderConfirmationModal .btn-primary').onclick = async () => {
            closeConfirmationModal(); // Close modal first
            showLoading('שולח הזמנה ושומר...');
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
                    orderedProducts.forEach(p => {
                        whatsappMessage += `• ${p.name} × ${p.quantity}\n`;
                    });
                    whatsappMessage += `\n🕓 *תאריך:* ${new Date().toLocaleDateString('he-IL')}\n`;
                    if (productImageFile) {
                        whatsappMessage += `\n*הערה:* צורפה תמונה של מוצר מהשטח.`;
                    }

                    const whatsappUrl = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
                    window.open(whatsappUrl, '_blank');

                    // Clear form after successful submission
                    familySelect.value = '';
                    updateProgressBar(1); // Reset to Step 1
                    dynamicFamilyHeading.classList.add('hidden');
                    familyDetailsForm.classList.add('hidden');
                    addressInput.value = '';
                    contactInput.value = '';
                    phoneInput.value = '';
                    deliveryTypeSelect.value = '';
                    historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
                    document.getElementById('productsContainer').innerHTML = '';
                    productRowCounter = 0; // Reset counter
                    addProductSelection(); // Add initial product row
                    document.getElementById('productImage').value = ''; // Clear file input

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
            }
        };
    });
});
