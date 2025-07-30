// Function to show custom message box
function showMessageBox(title, message) {
    const messageBox = document.getElementById('messageBox');
    document.getElementById('messageBoxTitle').innerText = title;
    document.getElementById('messageBoxContent').innerText = message;
    messageBox.style.display = 'block';
}

// Function to hide custom message box
function hideMessageBox() {
    document.getElementById('messageBox').style.display = 'none';
}

// Function to show loading overlay
function showLoading(message = 'טוען נתונים...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.querySelector('p').innerText = message;
    loadingOverlay.style.display = 'flex';
}

// Function to hide loading overlay
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Mock data for products (replace with actual data fetched from Google Sheet "מחסן נתונים")
const mockProducts = [
    { name: "מסמר 4", sku: "MSR-001", imageUrl: "https://placehold.co/60x60/FF5733/FFFFFF?text=MSR1" },
    { name: "מסמר 6", sku: "MSR-002", imageUrl: "https://placehold.co/60x60/33FF57/FFFFFF?text=MSR2" },
    { name: "מסמר 10", sku: "MSR-003", imageUrl: "https://placehold.co/60x60/3357FF/FFFFFF?text=MSR3" },
    { name: "מסמר פלדה לבטון", sku: "MSR-004", imageUrl: "https://placehold.co/60x60/FF33A1/FFFFFF?text=MSR4" },
    { name: "חוט שיזור", sku: "HUT-001", imageUrl: "https://placehold.co/60x60/A133FF/FFFFFF?text=HUT1" },
    { name: "חוט קשירה", sku: "HUT-002", imageUrl: "https://placehold.co/60x60/FFC733/FFFFFF?text=HUT2" },
    { name: "בלוקים", sku: "BLK-001", imageUrl: "https://placehold.co/60x60/33FFC7/FFFFFF?text=BLK1" },
    { name: "טיט", sku: "TIT-001", imageUrl: "https://placehold.co/60x60/C733FF/FFFFFF?text=TIT1" },
    { name: "דבק קרמיקה", sku: "DBK-001", imageUrl: "https://placehold.co/60x60/FF3333/FFFFFF?text=DBK1" },
    { name: "שקיות פוגה", sku: "SHK-001", imageUrl: "https://placehold.co/60x60/33A1FF/FFFFFF?text=SHK1" },
    { name: "מטאטא כביש + ידית", sku: "MTA-001", imageUrl: "https://placehold.co/60x60/FF5733/FFFFFF?text=MTA1" },
    { name: "ניילון", sku: "NYL-001", imageUrl: "https://placehold.co/60x60/33FF57/FFFFFF?text=NYL1" },
    { name: "קרטון סיליקון שקוף", sku: "CRT-001", imageUrl: "https://placehold.co/60x60/3357FF/FFFFFF?text=CRT1" },
    { name: "משולשים 1.5/1.5 100 מ\"א", sku: "MSL-001", imageUrl: "https://placehold.co/60x60/FF33A1/FFFFFF?text=MSL1" },
    { name: "כבל חשמל 30 מטר", sku: "KBL-001", imageUrl: "https://placehold.co/60x60/A133FF/FFFFFF?text=KBL1" },
    { name: "סכין למסור חשמלי", sku: "SKN-001", imageUrl: "https://placehold.co/60x60/FFC733/FFFFFF?text=SKN1" },
    { name: "ברז 3/4", sku: "BRZ-001", imageUrl: "https://placehold.co/60x60/33FFC7/FFFFFF?text=BRZ1" },
    { name: "ברגים 4 ס\"מ", sku: "BRG-001", imageUrl: "https://placehold.co/60x60/C733FF/FFFFFF?text=BRG1" },
    { name: "נקניקיות סיקה בצבע אפור", sku: "NKN-001", imageUrl: "https://placehold.co/60x60/FF3333/FFFFFF?text=NKN1" },
    { name: "דיסקיות 9 ״", sku: "DSK-001", imageUrl: "https://placehold.co/60x60/33A1FF/FFFFFF?text=DSK1" },
    { name: "דסקיות 4״", sku: "DSK-002", imageUrl: "https://placehold.co/60x60/FF5733/FFFFFF?text=DSK2" },
    { name: "מסורית למסור חשמלי מקיטה", sku: "MSRT-001", imageUrl: "https://placehold.co/60x60/33FF57/FFFFFF?text=MSRT1" },
    { name: "מקצץ", sku: "MKZ-001", imageUrl: "https://placehold.co/60x60/3357FF/FFFFFF?text=MKZ1" },
    { name: "פטיש תפס", sku: "PTT-001", imageUrl: "https://placehold.co/60x60/FF33A1/FFFFFF?text=PTT1" },
    { name: "שומרי מרחק עגולים לכלונסאות", sku: "SMR-001", imageUrl: "https://placehold.co/60x60/A133FF/FFFFFF?text=SMR1" },
    { name: "קונוסים לקידוח דיבידג קוטר 20 וקוטר 25", sku: "KNS-001", imageUrl: "https://placehold.co/60x60/FFC733/FFFFFF?text=KNS1" },
    { name: "אום פרפר - 60 יחידות", sku: "OUM-001", imageUrl: "https://placehold.co/60x60/33FFC7/FFFFFF?text=OUM1" }
];


// Mock data for families (replace with actual data from analysis)
// This should be populated from the Python script's summary_df
let familiesData = {}; // Will be populated dynamically

// Function to fetch data from Google Apps Script (simulated here)
async function fetchDataFromGoogleSheets() {
    showLoading('טוען נתוני משפחות ומוצרים...');
    try {
        // In a real scenario, this would be a fetch call to your Google Apps Script Web App URL
        // Example: const response = await fetch('YOUR_WEB_APP_URL?action=getInitialData');
        // const data = await response.json();
        // For now, we'll use the mock data derived from the Python analysis
        const mockFamilyData = [
            { "משפחה": "סמדרי", "כתובת": "הניצנים 20 כפר סבא", "איש קשר": "עלא", "טלפון": "0506620029", "מוצרים שהוזמנו": "1 מסמר 4, 5 מסמר 6, 3 מסמר 10, 1000 מסמר פלדה, 2 פטיש תפסנים פשוט, 50 חוט שזור, 50 חוט קשירה, 1 מטאטא כביש + ידית, 2 ניילון, 10 קרטון סיליקון שקוף, 1 משולשים 1.5/1.5 100 מ\"א" },
            { "משפחה": "ארבוב", "כתובת": "האשל 139 הרצליה", "איש קשר": "סמיר", "טלפון": "0524421272", "מוצרים שהוזמנו": "1 כבל חשמל 30 מטר, 1 סכין למסור חשמלי, 1 ברז 3/4, 50 חוט שזור, 30 חוט קשירה, 4 ברגים 4 ס\"מ" },
            { "משפחה": "הופמן", "כתובת": "החורש 21 כפר שמריהו", "איש קשר": "אבו עלי", "טלפון": "0524656174", "מוצרים שהוזמנו": "4 שומרי מרחק עגולים לכלונסאות" },
            { "משפחה": "ויזל", "כתובת": "הגדרות 45 סביון", "איש קשר": "עלי", "טלפון": "0523993017", "מוצרים שהוזמנו": "40 חוט שיזור, 30 חוט קשירה, 6 מסמר 6, 1000 מסמר בטון 10, 10 נקניקיות סיקה בצבע אפור, 10 דיסקיות 9 ״, 10 דסקיות 4״, 1 מסורית למסור חשמלי מקיטה, 1 מקצץ, 1 פטיש תפס" }
        ];

        // Populate familiesData for quick lookup
        mockFamilyData.forEach(family => {
            familiesData[family['משפחה']] = {
                address: family['כתובת'],
                contact: family['איש קשר'],
                phone: family['טלפון'],
                history: family['מוצרים שהוזמנו']
            };
        });

        populateFamilySelect();
        populateProductSelect(0); // Populate the first product selection dropdown

    } catch (error) {
        console.error('Error fetching initial data:', error);
        showMessageBox('שגיאה', 'אירעה שגיאה בטעינת הנתונים הראשוניים. נסה לרענן את הדף.');
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

function populateProductSelect(index) {
    const productSelect = document.getElementById(`productSelect_${index}`);
    // Clear existing options except the first one
    while (productSelect.options.length > 1) {
        productSelect.remove(1);
    }
    mockProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.sku; // Use SKU as value
        option.textContent = product.name;
        productSelect.appendChild(option);
    });

    // Add event listener for product selection change
    productSelect.addEventListener('change', (event) => {
        const selectedSku = event.target.value;
        const productInfoDiv = document.getElementById(`productInfo_${index}`);
        productInfoDiv.innerHTML = ''; // Clear previous info

        if (selectedSku) {
            const selectedProduct = mockProducts.find(p => p.sku === selectedSku);
            if (selectedProduct) {
                productInfoDiv.innerHTML = `
                    <div class="product-item">
                        <img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}" onerror="this.onerror=null;this.src='https://placehold.co/60x60/CCCCCC/000000?text=NoImg';">
                        <div class="product-details">
                            <p class="product-name">${selectedProduct.name}</p>
                            <p class="product-sku">מק"ט: ${selectedProduct.sku}</p>
                        </div>
                    </div>
                `;
            }
        }
    });
}

function addProductSelection() {
    const productsContainer = document.getElementById('productsContainer');
    const currentIndex = productsContainer.children.length;

    const newProductDiv = document.createElement('div');
    newProductDiv.className = 'form-group product-selection';
    newProductDiv.innerHTML = `
        <label for="productSelect_${currentIndex}">בחר מוצר:</label>
        <select id="productSelect_${currentIndex}" class="form-control product-select">
            <option value="">בחר מוצר</option>
        </select>
        <label for="quantityInput_${currentIndex}" class="mt-2">כמות:</label>
        <input type="number" id="quantityInput_${currentIndex}" class="form-control quantity-input" value="1" min="1">
        <div class="product-info mt-2" id="productInfo_${currentIndex}"></div>
    `;
    productsContainer.appendChild(newProductDiv);
    populateProductSelect(currentIndex); // Populate the new dropdown
}

document.addEventListener('DOMContentLoaded', () => {
    fetchDataFromGoogleSheets(); // Load initial data

    const familySelect = document.getElementById('familySelect');
    const addressInput = document.getElementById('addressInput');
    const contactInput = document.getElementById('contactInput');
    const phoneInput = document.getElementById('phoneInput');
    const historyDisplay = document.getElementById('historyDisplay');
    const addProductBtn = document.getElementById('addProductBtn');
    const submitOrderBtn = document.getElementById('submitOrderBtn');

    familySelect.addEventListener('change', (event) => {
        const selectedFamily = event.target.value;
        if (selectedFamily && familiesData[selectedFamily]) {
            const data = familiesData[selectedFamily];
            addressInput.value = data.address || '';
            contactInput.value = data.contact || '';
            phoneInput.value = data.phone || '';

            historyDisplay.innerHTML = '';
            if (data.history && data.history !== "לא זוהו מוצרים") {
                data.history.split(', ').forEach(item => {
                    const p = document.createElement('p');
                    p.className = 'history-item';
                    p.textContent = item;
                    historyDisplay.appendChild(p);
                });
            } else {
                historyDisplay.innerHTML = '<p class="text-gray-500">אין היסטוריית הזמנות זמינה למשפחה זו.</p>';
            }
        } else {
            addressInput.value = '';
            contactInput.value = '';
            phoneInput.value = '';
            historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
        }
    });

    addProductBtn.addEventListener('click', addProductSelection);

    submitOrderBtn.addEventListener('click', async () => {
        const familyName = familySelect.value;
        const address = addressInput.value;
        const contact = contactInput.value;
        const phone = phoneInput.value;

        if (!familyName || !address || !contact || !phone) {
            showMessageBox('שגיאה', 'אנא מלא את כל פרטי המשפחה, הכתובת, איש הקשר והטלפון.');
            return;
        }

        const orderedProducts = [];
        const productSelections = document.querySelectorAll('.product-selection');
        productSelections.forEach((selection, index) => {
            const productSelect = selection.querySelector('.product-select');
            const quantityInput = selection.querySelector('.quantity-input');

            const selectedSku = productSelect.value;
            const quantity = parseInt(quantityInput.value, 10);

            if (selectedSku && quantity > 0) {
                const product = mockProducts.find(p => p.sku === selectedSku);
                if (product) {
                    orderedProducts.push({
                        name: product.name,
                        sku: product.sku,
                        quantity: quantity
                    });
                }
            }
        });

        if (orderedProducts.length === 0) {
            showMessageBox('שגיאה', 'אנא בחר לפחות מוצר אחד להזמנה.');
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
                showMessageBox('שגיאה', 'אירעה שגיאה בהמרת התמונה. נסה שוב.');
                hideLoading();
                return;
            }
            hideLoading();
        }

        const orderData = {
            timestamp: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
            familyName,
            address,
            contact,
            phone,
            products: orderedProducts,
            imageData: base64Image,
            imageFileName: productImageFile ? productImageFile.name : null
        };

        showLoading('שולח הזמנה...');
        try {
            // In a real scenario, this would be a fetch call to your Google Apps Script Web App URL
            // Example: const response = await fetch('YOUR_WEB_APP_URL?action=submitOrder', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(orderData)
            // });
            // const result = await response.json();

            // Simulate API call success
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
            const result = { success: true, message: "הזמנה נשלחה בהצלחה!" };

            if (result.success) {
                showMessageBox('הזמנה נשלחה', result.message);
                // Generate WhatsApp message
                let whatsappMessage = `*הזמנה חדשה - משפחת ${familyName}*\n\n`;
                whatsappMessage += `*כתובת:* ${address}\n`;
                whatsappMessage += `*איש קשר:* ${contact}\n`;
                whatsappMessage += `*טלפון:* ${phone}\n\n`;
                whatsappMessage += `*פרטי הזמנה:*\n`;
                orderedProducts.forEach(p => {
                    whatsappMessage += `- ${p.name} (מק"ט: ${p.sku}): ${p.quantity}\n`;
                });
                if (productImageFile) {
                    whatsappMessage += `\n*הערה:* צורפה תמונה של מוצר מהשטח.`;
                }

                // Replace with your company's WhatsApp number
                const companyWhatsappNumber = 'YOUR_COMPANY_WHATSAPP_NUMBER'; // e.g., '9725XXXXXXXX'
                const whatsappUrl = `https://wa.me/${companyWhatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
                window.open(whatsappUrl, '_blank');

                // Clear form (optional)
                familySelect.value = '';
                addressInput.value = '';
                contactInput.value = '';
                phoneInput.value = '';
                historyDisplay.innerHTML = '<p class="text-gray-500">בחר משפחה כדי לראות היסטוריה.</p>';
                document.getElementById('productsContainer').innerHTML = `
                    <div class="form-group product-selection">
                        <label for="productSelect_0">בחר מוצר:</label>
                        <select id="productSelect_0" class="form-control product-select">
                            <option value="">בחר מוצר</option>
                        </select>
                        <label for="quantityInput_0" class="mt-2">כמות:</label>
                        <input type="number" id="quantityInput_0" class="form-control quantity-input" value="1" min="1">
                        <div class="product-info mt-2" id="productInfo_0"></div>
                    </div>
                `;
                populateProductSelect(0);
                document.getElementById('productImage').value = ''; // Clear file input

            } else {
                showMessageBox('שגיאה', result.message || 'אירעה שגיאה בשליחת ההזמנה.');
            }
        } catch (error) {
            console.error('Error submitting order:', error);
            showMessageBox('שגיאה', 'אירעה שגיאה בשליחת ההזמנה. נסה שוב מאוחר יותר.');
        } finally {
            hideLoading();
        }
    });
});
