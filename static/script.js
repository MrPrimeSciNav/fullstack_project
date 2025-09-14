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

// REPL WebSocket connection
let replSocket = null;

function initializeREPL() {
    const connectionType = document.querySelector('input[name="connection-type"]:checked').value;
    const replOutput = document.getElementById('repl-output');
    const replInput = document.getElementById('repl-input');

    // Close existing connection if any
    if (replSocket) {
        replSocket.close();
    }

    // Create WebSocket connection
    replSocket = new WebSocket(`ws://${window.location.host}/repl`);

    replSocket.onopen = () => {
        appendToREPL('Connected to board REPL\n');
        
        // Send connection info
        const connectionData = {
            type: connectionType,
            config: connectionType === 'wifi' ? {
                address: document.getElementById('wifi-address').value,
                username: document.getElementById('wifi-username').value,
                password: document.getElementById('wifi-password').value
            } : {
                port: document.getElementById('serial-port').value,
                baudrate: parseInt(document.getElementById('serial-baudrate').value)
            }
        };
        replSocket.send(JSON.stringify(connectionData));
    };

    replSocket.onmessage = (event) => {
        appendToREPL(event.data);
    };

    replSocket.onclose = () => {
        appendToREPL('Disconnected from board REPL\n');
    };

    replSocket.onerror = (error) => {
        appendToREPL(`Error: ${error.message}\n`);
    };

    // Handle input
    replInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const command = replInput.value;
            replSocket.send(command);
            replInput.value = '';
            appendToREPL(`>>>> ${command}\n`);
        }
    });
}

function appendToREPL(text) {
    const replOutput = document.getElementById('repl-output');
    replOutput.textContent += text;
    replOutput.scrollTop = replOutput.scrollHeight;
}

function clearREPL() {
    document.getElementById('repl-output').textContent = '';
}

function interruptREPL() {
    if (replSocket && replSocket.readyState === WebSocket.OPEN) {
        replSocket.send('\x03');  // Send Ctrl+C
        appendToREPL('\n*** Interrupted ***\n');
    }
}

function softResetREPL() {
    if (replSocket && replSocket.readyState === WebSocket.OPEN) {
        replSocket.send('\x04');  // Send Ctrl+D
        appendToREPL('\n*** Soft Reset ***\n');
    }
}

// Add REPL initialization to connection test
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

        if (result.success) {
            initializeREPL();  // Initialize REPL when connection is successful
        }
    } catch (error) {
        statusElement.textContent = "Connection test failed: " + error.message;
        statusElement.style.color = "red";
    }
}


