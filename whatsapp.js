const puppeteer = require('puppeteer');
const qrcode = require('qrcode-terminal');

class WhatsAppClient {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.qrCode = null;
        this.messagesCount = 0;
        this.sendMsgCount = 0;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Set user agent to mimic a real browser
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            await this.page.goto('https://web.whatsapp.com', {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            await this.waitForLogin();
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing WhatsApp client:', error);
            throw error;
        }
    }

    async waitForLogin() {
        try {
            // Wait for QR code or main page to load
            await this.page.waitForSelector('body', { timeout: 60000 });
            
            // Check if already logged in
            const isLoggedIn = await this.checkIfLoggedIn();
            
            if (!isLoggedIn) {
                console.log('Waiting for QR code scan...');
                
                // Wait for QR code to appear
                await this.page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 30000 });
                
                // Get QR code data
                const qrCodeData = await this.page.evaluate(() => {
                    const canvas = document.querySelector('canvas[aria-label="Scan me!"]');
                    return canvas ? canvas.getAttribute('data-ref') : null;
                });
                
                if (qrCodeData) {
                    this.qrCode = qrCodeData;
                    console.log('QR Code available. Scan to login.');
                    qrcode.generate(qrCodeData, { small: true });
                }
                
                // Wait for login to complete
                await this.page.waitForSelector('._3WByx', { timeout: 120000 }); // Wait for chat list
                this.isLoggedIn = true;
                this.qrCode = null;
                console.log('Logged in successfully!');
                
            } else {
                this.isLoggedIn = true;
                console.log('Already logged in!');
            }
            
            // Setup message listener for auto-replies
            await this.setupMessageListener();
            
        } catch (error) {
            console.error('Error during login:', error);
            throw error;
        }
    }

    async checkIfLoggedIn() {
        try {
            // Check if main app is loaded (chat list visible)
            const chatList = await this.page.$('._3WByx');
            return chatList !== null;
        } catch (error) {
            return false;
        }
    }

    async setupMessageListener() {
        // Listen for new messages and auto-reply
        this.page.on('framenavigated', async () => {
            try {
                await this.handleNewMessages();
            } catch (error) {
                console.error('Error handling messages:', error);
            }
        });
    }

    async handleNewMessages() {
        try {
            // Get unread messages
            const unreadMessages = await this.page.evaluate(() => {
                const unreadElements = document.querySelectorAll('[data-testid="icon-unread-count"]');
                return Array.from(unreadElements).map(el => {
                    const chatElement = el.closest('[data-testid="cell-frame-container"]');
                    return chatElement ? chatElement.getAttribute('data-id') : null;
                }).filter(id => id !== null);
            });

            for (const chatId of unreadMessages) {
                await this.handleChat(chatId);
            }
        } catch (error) {
            console.error('Error handling unread messages:', error);
        }
    }

    async handleChat(chatId) {
        try {
            // Open the chat
            const chatSelector = `[data-id="${chatId}"]`;
            await this.page.click(chatSelector);
            await this.page.waitForTimeout(1000);

            // Get the last message
            const lastMessage = await this.page.evaluate(() => {
                const messages = document.querySelectorAll('[data-testid="conversation-panel-messages"] .message-in');
                if (messages.length === 0) return null;
                
                const lastMsg = messages[messages.length - 1];
                const textElement = lastMsg.querySelector('[data-testid="conversation-panel-messages"] .selectable-text');
                return textElement ? textElement.textContent.trim() : null;
            });

            if (lastMessage) {
                let reply = null;
                
                // Auto-reply logic
                if (lastMessage.toLowerCase().includes('hello')) {
                    reply = 'Hi';
                } else if (lastMessage.toLowerCase().includes('thanks') || 
                          lastMessage.toLowerCase().includes('thank you')) {
                    reply = 'Your Welcome';
                }

                if (reply) {
                    await this.sendMessage(reply);
                    this.messagesCount++;
                }
            }

        } catch (error) {
            console.error('Error handling chat:', error);
        }
    }

    async sendMessage(phoneNumber, message) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('WhatsApp client not logged in');
            }

            // Open chat with specific number
            await this.page.goto(`https://web.whatsapp.com/send?phone=${phoneNumber}`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for chat to load
            await this.page.waitForSelector('[data-testid="conversation-panel-messages"]', { timeout: 15000 });
            
            // Type and send message
            await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 10000 });
            await this.page.type('[data-testid="conversation-compose-box-input"]', message);
            await this.page.click('[data-testid="compose-btn-send"]');
            
            await this.page.waitForTimeout(2000); // Wait for message to send
            
            this.sendMsgCount++;
            return { success: true, message: 'Message sent successfully' };

        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, error: error.message };
        }
    }

    getStatus() {
        return {
            alive: this.isInitialized,
            isClientLogged: this.isLoggedIn,
            qr: this.isLoggedIn ? null : this.qrCode,
            messagesCount: this.messagesCount,
            sendMsgCount: this.sendMsgCount,
            initialized: this.isInitialized
        };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = WhatsAppClient;