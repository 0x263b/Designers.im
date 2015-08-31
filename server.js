var express = require('express');
var http = require('http');

// Initialize & Configure Express
var app = module.exports = express();
app.use(express.static(__dirname + '/public'));

// Initialize the Server
var server = http.createServer(app).listen(process.env.PORT || 3000);

// Load Main (Loads Socket.io & IRC)
require('./lib/main.js')(server);
