const express = require("express");
const app = express();
const { Client, LocalAuth, AuthStrategy, Buttons } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const pages = require("./pages");
const localData = {};
const cors = require("cors");
const https = require('https');


const client = new Client({
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

const writed = [];

function hype(write) {
  writed.push({ write, date: new Date().toString() })
}

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/pages", pages);


setInterval(() => {
    https.get('https://wbot-bodg.onrender.com/');
}, 30000);

// When the client is ready, run this code (only once)
client.once("ready", () => {
  console.log("Client is ready!");
  hype('Client is ready')

  app.post(
    "/send/:phoneID",
    function(req, res, next) {
      const phone = req.params.phoneID;
      console.log(req.body);
      hype('Mannual message sending to ' + phone);

      client.sendMessage(phone + "@c.us", req.body.msg).then(function() {
        next();
      });
    },
    function(req, res) {
      res.sendStatus(200);
      console.log("API LOGS");
    }
  );
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

app.get('/writed', function(req, res) {
  res.json(writed);
})

// When the client received QR-Code
client.on("qr", (qr) => {
  qr_code = qr;
  hype('QR Code ready')
});

app.get("/", function(req, res) {
  res.send(qr_code);
  console.log('UPDATED')
});

// Start your client
client.initialize();

app.get("/events", (req, res) => {
  // Set headers to enable SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write("");

  function handleMessages(message) {
    console.log(message.from);
    console.log(message.body);
    console.log(message.fromMe);
    hype('New message found.')

    res.write(`data: ${JSON.stringify(message)} \n\n`);
  }

  client.on("message_create", handleMessages);

  req.on("close", function() {
    client.off("message_create", handleMessages);
  });
});

app.listen((process.env.PORT || 3000));