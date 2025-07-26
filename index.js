const express = require("express");
const { Client, LocalAuth, AuthStrategy, Buttons } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const pages = require("./pages.js");
const cors = require("cors");
const https = require("https");
const { log } = require("console");

let runAi = function() {};

const app = express();
const localData = {};

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './sessions', // Store session data in this folder
  }),
  puppeteer: {
    headless: true, // Keep headless mode on for background execution
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

const writed = [];
let msgData = {
  sendCount: 0,
  messagesCount: 0,
  isClientLogged: false,
  activateAi: true,
};

function hype(write) {
  if (writed.length > 200) {
    writed.splice(0, 50);
  }
  writed.push({ write, date: new Date().toString() });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/pages", pages);

setInterval(() => {
  https.get("https://wbot-bodg.onrender.com/");
}, 30000);

// When the client is ready, run this code (only once)
client.once("ready", () => {
  msgData.isClientLogged = true;
  console.log("Client is ready!");
  hype("Client is ready");

  app.post(
    "/send/:phoneID",
    function(req, res, next) {
      const phone = req.params.phoneID;
      hype("Mannual message sending to " + phone);

      client.sendMessage(phone + "@c.us", req.body.msg).then(function() {
        msgData.sendCount += 1;
        next();
      });
    },
    function(req, res) {
      res.sendStatus(200);
      hype('Send success');
    }
  );
});

client.on('authenticated', () => {
  hype('Authenticated successfully!');
});

client.on('disconnected', (reason) => {
  hype('Client disconnected:', reason);
  hype('Reconnecting...');
  client.initialize(); // Restart the client
});


client.on('auth_failure', (msg) => {
  hype('Authentication failure:', msg);
  hype('Delete the ./sessions folder if the issue persists.');
});


var qr_code = "";

app.get("/qr", (req, res) => {
  // Set headers to enable SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(qr_code);
  var timer = setInterval(function() {
    res.write(`data: ${JSON.stringify({ qr: qr_code })} \n\n`);
  }, 2000);

  req.on("close", function() {
    clearInterval(timer);
  });
});

app.get("/writed", function(req, res) {
  res.json(writed);
});

// When the client received QR-Code
client.on("qr", (qr) => {
  qr_code = qr;
  hype("QR Code ready");
});

app.get("/", function(req, res) {
  res.send(qr_code);
});

app.get("/status", function(req, res) {
  res.send(msgData);
});

app.post("/activateAI/:bool", function(req, res) {
  var bool = req.params.bool;
  msgData.activateAi = bool;
  res.send(msgData);
});

(async function() {
  runAi = (await import("./ai.mjs")).runAi;
  client.on("message_create", handleMessages);
})();

function handleMessages(message, res = null) {
  msgData.messagesCount += 1;
  hype("New message found.");
  if (res) res.write(`data: ${JSON.stringify(message)} \n\n`);

  function sendRes(answer, type = 'text') {
    hype("Remoted " + message.id.remote);
    hype("AI Response: " + answer);
    client.sendMessage(message.id.remote, answer, type).then(function() {
      msgData.sendCount += 1;
      hype("Message sended by AI".fontcolor('yellow'));
    });
  }

  if (message.body.startsWith('/ai')) {
    message.body = message.body.replace('/ai', '')
    //runAi(message.body).then(sendRes).catch(hype);
  } else if (message.body.startsWith('/gpt')) {

    message.body = message.body.replace('/gpt', '')

    let pr = encodeURIComponent(message.body);
    fetch('https://text.pollinations.ai/' + pr +
      "?system=You're helpful bot you doesn't provide explanation if i asked you can provide").then(function(res) {
      res.text().then(function(t) {
        sendRes(t)
      })
    })


  } else if (message.body.startsWith('/speak')) {

    message.body = message.body.replace('/speak', '')
    let pr = encodeURIComponent(message.body);
    let mediaUrl = "https://text.pollinations.ai/"+pr+"?model=openai-audio&voice=verse"
    sendRes(mediaUrl, 'audio');
    
  } else if (message.body.startsWith('/pic')) {

    message.body = message.body.replace('/pic', '')

    let pr = encodeURIComponent(message.body);
    let mediaUrl = "https://image.pollinations.ai/prompt/"+pr+"?width=1024&height=1024&seed=280&nologo=true"
    sendRes(mediaUrl, 'image')
  }

  hype("Signal Good");
}

// Start your client
client.initialize();

app.get("/events", (req, res) => {
  // Set headers to enable SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write("");

  function handleMSG(msg) {
    handleMessages(msg, res);
  }

  req.on("close", function() {
    client.off("message_create", handleMSG);
  });
  client.on("message_create", handleMSG);
});

app.listen(process.env.PORT || 3000);


// html pages host link