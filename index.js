const express = require('express');
const WhatsAppClient = require('./whatsapp');
const https = require("https");

const app = express();
const port = process.env.PORT || 3000;

// Initialize WhatsApp client
const whatsappClient = new WhatsAppClient();

// Middleware
app.use(cors());
app.use(express.json());


setInterval(() => {
  https.get("https://wbot-bodg.onrender.com/status");
}, 30000);


// Routes
app.get('/status', (req, res) => {
    const status = whatsappClient.getStatus();
    res.json(status);
});

app.get('/qr', (req, res) => {
    const status = whatsappClient.getStatus();
    
    if (status.isClientLogged) {
        return res.status(400).json({ error: 'Client already logged in' });
    }
    
    if (!status.qr) {
        return res.status(404).json({ error: 'QR code not available yet' });
    }
    
    res.json({ qr: status.qr });
});

app.post('/chat/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { msg } = req.body;

        if (!msg) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Validate phone number format (countrycode+number)
        const phoneRegex = /^[1-9][0-9]{9,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({ 
                error: 'Invalid phone number format. Use countrycode+number (e.g., 911234567890)' 
            });
        }

        const result = await whatsappClient.sendMessage(phoneNumber, msg);
        
        if (result.success) {
            res.json({ 
                success: true, 
                message: 'Message sent successfully',
                stats: whatsappClient.getStatus()
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.error 
            });
        }

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Initialize WhatsApp client and start server
async function startServer() {
    try {
        console.log('Initializing WhatsApp client...');
        await whatsappClient.initialize();
        
        app.listen(port, () => {
            console.log(`WhatsApp bot server running on port ${port}`);
            console.log(`API endpoints:`);
            console.log(`- GET  /status - Check bot status`);
            console.log(`- GET  /qr - Get QR code`);
            console.log(`- POST /chat/:phoneNumber - Send message`);
        });

    } catch (error) {
        console.error('Failed to initialize WhatsApp client:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await whatsappClient.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await whatsappClient.close();
    process.exit(0);
});

startServer();