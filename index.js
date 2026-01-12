const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration constants
const MAX_LOGS = 200;
const LOG_TRIM_COUNT = 50;
const RECONNECT_DELAY_MS = process.env.RECONNECT_DELAY_MS || 5000;

// Common browser executable paths to check
const BROWSER_PATHS = [
    // Linux
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
    "/snap/bin/chromium",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/local/bin/chromium",
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

// Find an available browser executable path
function findBrowserPath() {
    // If CHROMIUM_PATH is set, validate it exists
    if (process.env.CHROMIUM_PATH) {
        if (fs.existsSync(process.env.CHROMIUM_PATH)) {
            return process.env.CHROMIUM_PATH;
        }
        console.warn(`Warning: CHROMIUM_PATH (${process.env.CHROMIUM_PATH}) does not exist, falling back to auto-detection.`);
    }

    // Check common paths for an existing browser
    for (const browserPath of BROWSER_PATHS) {
        if (fs.existsSync(browserPath)) {
            return browserPath;
        }
    }

    // Return null if no browser found
    return null;
}

const CHROMIUM_PATH = findBrowserPath();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// State management
const logs = [];
let qrCode = "";
let msgData = {
    sendCount: 0,
    messagesCount: 0,
    isClientLogged: false,
    activateAi: true,
};

// Logging function
function log(message) {
    if (logs.length > MAX_LOGS) {
        logs.splice(0, LOG_TRIM_COUNT);
    }
    logs.push({ write: message, date: new Date().toString() });
    console.log(message);
}

// Build puppeteer options
const puppeteerOptions = {
    headless: true,
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
    ],
};

// Only set executablePath if a browser was found
if (CHROMIUM_PATH) {
    puppeteerOptions.executablePath = CHROMIUM_PATH;
}

// WhatsApp Client initialization
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./sessions",
    }),
    puppeteer: {
        headless: true,
        executablePath: "/opt/render/.cache/puppeteer/chrome/linux-143.0.7499.192/chrome-linux64/chrome",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
        ],
    },
});

// Event listeners for WhatsApp client
client.on("qr", (qr) => {
    qrCode = qr;
    log("QR Code ready - scan to authenticate");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    msgData.isClientLogged = true;
    qrCode = "";
    log("WhatsApp client is ready!");
});

client.on("authenticated", () => {
    log("Authenticated successfully!");
});

client.on("auth_failure", (msg) => {
    log("Authentication failure: " + msg);
});

client.on("disconnected", (reason) => {
    msgData.isClientLogged = false;
    log("Client disconnected: " + reason);
    log("Attempting to reconnect...");
    setTimeout(() => {
        client.initialize();
    }, RECONNECT_DELAY_MS);
});

// Message handling
client.on("message_create", async (message) => {
    msgData.messagesCount += 1;
    log("New message received");

    if (!msgData.activateAi) return;

    const body = message.body;

    try {
        if (body.startsWith("/gpt ")) {
            const prompt = body.replace("/gpt ", "");
            const encodedPrompt = encodeURIComponent(prompt);
            const response = await fetch(
                `https://text.pollinations.ai/${encodedPrompt}?system=You're a helpful bot`
            );
            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }
            const text = await response.text();
            await client.sendMessage(message.from, text);
            msgData.sendCount += 1;
            log("GPT response sent");
        } else if (body.startsWith("/pic ")) {
            const prompt = body.replace("/pic ", "");
            const encodedPrompt = encodeURIComponent(prompt);
            const mediaUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
            await client.sendMessage(message.from, mediaUrl);
            msgData.sendCount += 1;
            log("Image URL sent");
        }
    } catch (error) {
        const errorMessage = error.message || "Unknown error occurred";
        log("Error processing message: " + errorMessage);
        try {
            await client.sendMessage(message.from, "Sorry, an error occurred while processing your request.");
        } catch (sendError) {
            log("Failed to send error message: " + sendError.message);
        }
    }
});

// REST API Routes

// Get QR code as text
app.get("/", (req, res) => {
    res.send(qrCode);
});

// Get QR code via Server-Sent Events
app.get("/qr", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify({ qr: qrCode })}\n\n`);

    const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ qr: qrCode })}\n\n`);
    }, 2000);

    req.on("close", () => {
        clearInterval(interval);
    });
});

// Get bot status
app.get("/status", (req, res) => {
    res.json(msgData);
});

// Get logs
app.get("/writed", (req, res) => {
    res.json(logs);
});

// Toggle AI activation
app.post("/activateAI/:bool", (req, res) => {
    const bool = req.params.bool === "true";
    msgData.activateAi = bool;
    res.json(msgData);
});

// Send message to phone number
app.post("/send/:phoneID", async (req, res) => {
    const phone = req.params.phoneID;
    const message = req.body.msg;

    if (!msgData.isClientLogged) {
        return res.status(503).json({ error: "WhatsApp client not connected" });
    }

    try {
        log("Sending message to " + phone);
        await client.sendMessage(phone + "@c.us", message);
        msgData.sendCount += 1;
        log("Message sent successfully");
        res.sendStatus(200);
    } catch (error) {
        log("Error sending message: " + error.message);
        res.status(500).json({ error: error.message });
    }
});

// Message events via Server-Sent Events
app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const messageHandler = (message) => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    client.on("message_create", messageHandler);

    req.on("close", () => {
        client.off("message_create", messageHandler);
    });
});

// Serve static pages
app.get("/pages/:fileID", (req, res) => {
    const filePath = path.join(__dirname, "localStore", req.params.fileID);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send("File not found");
        }
    });
});

// Initialize WhatsApp client
if (CHROMIUM_PATH) {
    log(`Using browser at: ${CHROMIUM_PATH}`);
} else {
    log("No browser executable found. Puppeteer will attempt to use its bundled browser or you can set CHROMIUM_PATH environment variable.");
}

client.initialize().catch((err) => {
    log("Failed to initialize WhatsApp client: " + err.message);
    if (err.message.includes("executablePath") || err.message.includes("Browser")) {
        log("Hint: Install Chromium/Chrome or set CHROMIUM_PATH environment variable to your browser executable.");
    }
});

// Start server
app.listen(PORT, () => {
    log(`Server running on port ${PORT}`);
});
