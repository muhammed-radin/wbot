# WBot - WhatsApp Bot

A WhatsApp Bot built with Express.js and whatsapp-web.js that provides AI-powered responses using Pollinations AI.

## Features

- QR code authentication for WhatsApp Web
- AI-powered text responses via `/gpt <prompt>`
- AI-powered image generation via `/pic <prompt>`
- REST API for sending messages
- Server-Sent Events for real-time updates
- Auto-reconnection on disconnect
- Self-ping mechanism to prevent server sleeping on Render

## Installation

### Prerequisites

Before running the bot, you need to have the following installed:

1. **Node.js** (v16 or higher)
2. **Chromium or Google Chrome browser**

### Installing Puppeteer and Chromium/Chrome

#### On Ubuntu/Debian

```bash
# Update package list
sudo apt-get update

# Install Chromium browser
sudo apt-get install -y chromium-browser

# Or install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f
```

#### On macOS

```bash
# Using Homebrew
brew install --cask chromium
# or
brew install --cask google-chrome
```

#### On Windows

Download and install Google Chrome from the [official website](https://www.google.com/chrome/).

### Project Setup

```bash
# Clone the repository
git clone <repository-url>
cd wbot

# Install dependencies
npm install

# Start the bot
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CHROMIUM_PATH` | Custom path to Chromium/Chrome executable | Auto-detected |
| `RECONNECT_DELAY_MS` | Delay before reconnection attempt | `5000` |
| `RENDER_EXTERNAL_URL` | External URL for self-ping (auto-set by Render) | `http://localhost:PORT` |

## Hosting on Render

### Setup Steps

1. **Create a new Web Service** on [Render](https://render.com)

2. **Connect your repository**

3. **Configure Build Settings:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

4. **Add Environment Variables:**
   - `CHROMIUM_PATH`: `/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome` (Render auto-installs Puppeteer's Chrome)

5. **Configure the Render environment:**
   
   Create a `render.yaml` file in your repository root (optional):
   ```yaml
   services:
     - type: web
       name: wbot
       env: node
       buildCommand: npm install
       startCommand: npm start
       envVars:
         - key: NODE_ENV
           value: production
   ```

### Installing Puppeteer on Render

Render's native Node.js environment includes most dependencies needed for Puppeteer. The bot uses `puppeteer-core` which expects Chrome to be pre-installed.

**Option 1: Use Render's Docker Environment (Recommended)**

Create a `Dockerfile` in your repository:

```dockerfile
FROM node:18-slim

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium

CMD ["npm", "start"]
```

Then set Render to use Docker as the environment.

**Option 2: Use puppeteer instead of puppeteer-core**

Modify `package.json` to use `puppeteer` instead of `puppeteer-core`. Puppeteer will download its own bundled Chromium during `npm install`.

### Keep Server Alive

The bot includes a built-in self-ping mechanism that sends a request to itself every 10 seconds to prevent the server from sleeping on Render's free tier.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get QR code as text |
| `/qr` | GET | Get QR code via Server-Sent Events |
| `/status` | GET | Get bot status |
| `/writed` | GET | Get logs |
| `/activateAI/:bool` | POST | Toggle AI activation |
| `/send/:phoneID` | POST | Send message to phone number |
| `/events` | GET | Message events via Server-Sent Events |
| `/pages/:fileID` | GET | Serve static pages |

## Usage

### Sending a Message

```bash
curl -X POST http://localhost:3000/send/1234567890 \
  -H "Content-Type: application/json" \
  -d '{"msg": "Hello, World!"}'
```

### WhatsApp Commands

- `/gpt <prompt>` - Get AI-powered text response
- `/pic <prompt>` - Get AI-generated image URL

## License

ISC
