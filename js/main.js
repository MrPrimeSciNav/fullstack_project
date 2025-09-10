function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }

    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}

document.querySelectorAll('input[name="connection-type"]').forEach((radio) => {
    radio.addEventListener("change", function () {
        const wifiForm = document.getElementById("wifi-form");
        const serialForm = document.getElementById("serial-form");

        if (this.value === "wifi") {
            wifiForm.style.display = "block";
            serialForm.style.display = "none";
        } else if (this.value === "serial") {
            wifiForm.style.display = "none";
            serialForm.style.display = "block";
        }
    });
});

async function testConnection() {
    const connectionType = document.querySelector('input[name="connection-type"]:checked').value;
    const statusElement = document.getElementById("connection-status");

    let connectionData;
    if (connectionType === "wifi") {
        connectionData = {
            type: "wifi",
            address: document.getElementById("wifi-address").value,
            username: document.getElementById("wifi-username").value,
            password: document.getElementById("wifi-password").value,
        };
    } else if (connectionType === "serial") {
        connectionData = {
            type: "serial",
            port: document.getElementById("serial-port").value,
            baudrate: parseInt(document.getElementById("serial-baudrate").value),
        };
    }

    try {
        const response = await fetch("/api/test-connection", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(connectionData),
        });

        const result = await response.json();
        statusElement.textContent = result.message;
        statusElement.style.color = result.success ? "green" : "red";
    } catch (error) {
        statusElement.textContent = "Connection test failed: " + error.message;
        statusElement.style.color = "red";
    }
}

async function refreshSerialPorts() {
    const serialPortSelect = document.getElementById("serial-port");
    serialPortSelect.innerHTML = '<option value="">Select a port...</option>';

    try {
        const response = await fetch("/api/serial-ports");
        const ports = await response.json();

        ports.forEach(port => {
            const option = document.createElement("option");
            option.value = port.device;
            option.textContent = `${port.device} (${port.description})`;
            serialPortSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to fetch serial ports:", error);
    }
}

document.getElementById("upload-files").addEventListener("change", function (e) {
    const fileListElement = document.getElementById("upload-file-list");
    fileListElement.innerHTML = "";

    for (const file of e.target.files) {
        const fileItem = document.createElement("div");
        fileItem.textContent = file.name;
        fileListElement.appendChild(fileItem);
    }
});

async function uploadFiles() {
    const files = document.getElementById("upload-files").files;
    const connectionType = document.querySelector('input[name="connection-type"]:checked').value;
    const statusElement = document.getElementById("upload-status");

    if (files.length === 0) {
        statusElement.textContent = "No files selected!";
        statusElement.style.color = "red";
        return;
    }

    let connectionData;
    if (connectionType === "wifi") {
        connectionData = {
            type: "wifi",
            address: document.getElementById("wifi-address").value,
            username: document.getElementById("wifi-username").value,
            password: document.getElementById("wifi-password").value,
        };
    } else if (connectionType === "serial") {
        connectionData = {
            type: "serial",
            port: document.getElementById("serial-port").value,
            baudrate: parseInt(document.getElementById("serial-baudrate").value),
        };
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append("files", file);
    }
    formData.append("connection", JSON.stringify(connectionData));

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        statusElement.textContent = result.message;
        statusElement.style.color = result.success ? "green" : "red";
    } catch (error) {
        statusElement.textContent = "Upload failed: " + error.message;
        statusElement.style.color = "red";
    }
}

async function downloadFiles() {
    const connectionType = document.querySelector('input[name="connection-type"]:checked').value;
    const filenames = ["main.py", "boot.py"]; // Example files; replace with user input
    const statusElement = document.getElementById("download-status");

    let connectionData;
    if (connectionType === "wifi") {
        connectionData = {
            type: "wifi",
            address: document.getElementById("wifi-address").value,
            username: document.getElementById("wifi-username").value,
            password: document.getElementById("wifi-password").value,
        };
    } else if (connectionType === "serial") {
        connectionData = {
            type: "serial",
            port: document.getElementById("serial-port").value,
            baudrate: parseInt(document.getElementById("serial-baudrate").value),
        };
    }

    try {
        const response = await fetch("/api/download", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                connection: connectionData,
                files: filenames,
            }),
        });

        const result = await response.json();
        if (result.success) {
            // Trigger download of the zip file
            window.location.href = `/download?path=${encodeURIComponent(result.zip_path)}`;
            statusElement.textContent = "Download successful!";
            statusElement.style.color = "green";
        } else {
            statusElement.textContent = result.message;
            statusElement.style.color = "red";
        }
    } catch (error) {
        statusElement.textContent = "Download failed: " + error.message;
        statusElement.style.color = "red";
    }
}


// FAQ functionality
document.addEventListener('DOMContentLoaded', function () {
    // Check if we're on the FAQ page
    if (document.getElementById('faq-container')) {
        loadFAQData();
    }

    // Initialize other functionality if on main page
    if (document.querySelector('.tab-button')) {
        initializeMainPage();
    }
});

// Load FAQ data from the backend
async function loadFAQData() {
    try {
        const response = await fetch('/api/faq');
        const faqData = await response.json();

        if (response.ok) {
            renderFAQItems(faqData);
        } else {
            console.error('Failed to load FAQ data');
            showFAQError();
        }
    } catch (error) {
        console.error('Error loading FAQ data:', error);
        showFAQError();
    }
}

// Render FAQ items in the DOM
function renderFAQItems(faqData) {
    const container = document.getElementById('faq-container');
    container.innerHTML = '';

    faqData.forEach(item => {
        const faqItem = createFAQItem(item);
        container.appendChild(faqItem);
    });
}

// Create individual FAQ item element
function createFAQItem(faqItem) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'faq-item';
    itemDiv.setAttribute('data-faq-id', faqItem.id);

    itemDiv.innerHTML = `
        <div class="faq-question" onclick="toggleFAQAnswer(${faqItem.id})">
            <h3>${faqItem.question}</h3>
            <span class="faq-toggle">+</span>
        </div>
        <div class="faq-answer" id="faq-answer-${faqItem.id}">
            <p>${faqItem.answer}</p>
        </div>
    `;

    return itemDiv;
}

// Toggle FAQ answer visibility
function toggleFAQAnswer(faqId) {
    const answerElement = document.getElementById(`faq-answer-${faqId}`);
    const questionElement = answerElement.previousElementSibling;
    const toggleElement = questionElement.querySelector('.faq-toggle');

    if (answerElement.style.display === 'none' || answerElement.style.display === '') {
        answerElement.style.display = 'block';
        toggleElement.textContent = '-';
        questionElement.classList.add('active');
    } else {
        answerElement.style.display = 'none';
        toggleElement.textContent = '+';
        questionElement.classList.remove('active');
    }
}

// Show error message if FAQ data fails to load
function showFAQError() {
    const container = document.getElementById('faq-container');
    container.innerHTML = `
        <div class="error-message">
            <h3>Unable to load FAQ data</h3>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
            <button onclick="loadFAQData()" class="btn btn-primary">Retry</button>
        </div>
    `;
}

// Search functionality for FAQ
function searchFAQ(searchTerm) {
    const faqItems = document.querySelectorAll('.faq-item');
    const searchLower = searchTerm.toLowerCase();

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question h3').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer p').textContent.toLowerCase();

        if (question.includes(searchLower) || answer.includes(searchLower)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize main page functionality (existing code)
function initializeMainPage() {
    // Load serial ports on page load
    refreshSerialPorts();

    // Set up connection type toggle
    const connectionTypeRadios = document.querySelectorAll('input[name="connection-type"]');
    connectionTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleConnectionForm);
    });

    // Set up file upload drag and drop
    setupFileUpload();
}

// ... existing functions for main page functionality ...

// Tab functionality (if not already present)
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Connection form toggle
function toggleConnectionForm() {
    const wifiForm = document.getElementById('wifi-form');
    const serialForm = document.getElementById('serial-form');
    const selectedType = document.querySelector('input[name="connection-type"]:checked').value;

    if (selectedType === 'wifi') {
        wifiForm.style.display = 'block';
        serialForm.style.display = 'none';
    } else {
        wifiForm.style.display = 'none';
        serialForm.style.display = 'block';
    }
}

// Refresh serial ports
async function refreshSerialPorts() {
    try {
        const response = await fetch('/api/serial-ports');
        const ports = await response.json();

        const select = document.getElementById('serial-port');
        select.innerHTML = '<option value="">Select a port...</option>';

        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port;
            option.textContent = port;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading serial ports:', error);
    }
}


// FAQ functionality
document.addEventListener('DOMContentLoaded', function () {
    // Check if we're on the FAQ page
    if (document.getElementById('faq-container')) {
        loadFAQData();
    }

    // Initialize other functionality if on main page
    if (document.querySelector('.tab-button')) {
        initializeMainPage();
    }
});

// Load FAQ data from the backend
async function loadFAQData() {
    try {
        const response = await fetch('/api/faq');
        const faqData = await response.json();

        if (response.ok) {
            renderFAQItems(faqData);
        } else {
            console.error('Failed to load FAQ data');
            showFAQError();
        }
    } catch (error) {
        console.error('Error loading FAQ data:', error);
        showFAQError();
    }
}

// Render FAQ items in the DOM
function renderFAQItems(faqData) {
    const container = document.getElementById('faq-container');
    container.innerHTML = '';

    faqData.forEach(item => {
        const faqItem = createFAQItem(item);
        container.appendChild(faqItem);
    });
}

// Create individual FAQ item element
function createFAQItem(faqItem) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'faq-item';
    itemDiv.setAttribute('data-faq-id', faqItem.id);

    itemDiv.innerHTML = `
        <div class="faq-question" onclick="toggleFAQAnswer(${faqItem.id})">
            <h3>${faqItem.question}</h3>
            <span class="faq-toggle">+</span>
        </div>
        <div class="faq-answer" id="faq-answer-${faqItem.id}">
            <p>${faqItem.answer}</p>
        </div>
    `;

    return itemDiv;
}

// Toggle FAQ answer visibility
function toggleFAQAnswer(faqId) {
    const answerElement = document.getElementById(`faq-answer-${faqId}`);
    const questionElement = answerElement.previousElementSibling;
    const toggleElement = questionElement.querySelector('.faq-toggle');

    if (answerElement.style.display === 'none' || answerElement.style.display === '') {
        answerElement.style.display = 'block';
        toggleElement.textContent = '-';
        questionElement.classList.add('active');
    } else {
        answerElement.style.display = 'none';
        toggleElement.textContent = '+';
        questionElement.classList.remove('active');
    }
}

// Show error message if FAQ data fails to load
function showFAQError() {
    const container = document.getElementById('faq-container');
    container.innerHTML = `
        <div class="error-message">
            <h3>Unable to load FAQ data</h3>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
            <button onclick="loadFAQData()" class="btn btn-primary">Retry</button>
        </div>
    `;
}

// Search functionality for FAQ
function searchFAQ(searchTerm) {
    const faqItems = document.querySelectorAll('.faq-item');
    const searchLower = searchTerm.toLowerCase();

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question h3').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer p').textContent.toLowerCase();

        if (question.includes(searchLower) || answer.includes(searchLower)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize main page functionality (existing code)
function initializeMainPage() {
    // Load serial ports on page load
    refreshSerialPorts();

    // Set up connection type toggle
    const connectionTypeRadios = document.querySelectorAll('input[name="connection-type"]');
    connectionTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleConnectionForm);
    });

    // Set up file upload drag and drop
    setupFileUpload();
}

// ... existing functions for main page functionality ...

// Tab functionality (if not already present)
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Connection form toggle
function toggleConnectionForm() {
    const wifiForm = document.getElementById('wifi-form');
    const serialForm = document.getElementById('serial-form');
    const selectedType = document.querySelector('input[name="connection-type"]:checked').value;

    if (selectedType === 'wifi') {
        wifiForm.style.display = 'block';
        serialForm.style.display = 'none';
    } else {
        wifiForm.style.display = 'none';
        serialForm.style.display = 'block';
    }
}

// Refresh serial ports
async function refreshSerialPorts() {
    try {
        const response = await fetch('/api/serial-ports');
        const ports = await response.json();

        const select = document.getElementById('serial-port');
        select.innerHTML = '<option value="">Select a port...</option>';

        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port;
            option.textContent = port;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading serial ports:', error);
    }
}

// Test connection
async function testConnection() {
    const connectionType = document.querySelector('input[name="connection-type"]:checked').value;

    document.getElementById("download-button").addEventListener("click", downloadFiles);
    document.getElementById("refresh-ports").addEventListener("click", refreshSerialPorts);
    document.getElementById("test-connection").addEventListener("click", testConnection);
    document.getElementById("upload-button").addEventListener("click", uploadFiles);

    // Initialize default view
    document.addEventListener("DOMContentLoaded", function () {
        document.querySelector('input[name="connection-type"][value="wifi"]').checked = true;
        document.getElementById("wifi-form").style.display = "block";
        document.getElementById("serial-form").style.display = "none";
        refreshSerialPorts();
    }
    );


