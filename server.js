var express = require('express');
var http = require('http');
var opengraph = require('./lib/opengraph.js');

// Initialize & Configure Express
var app = module.exports = express();
app.use(express.static(__dirname + '/public'));

// Initialize the Server
var server = http.createServer(app).listen(process.env.PORT || 3000);


app.get('/og/', function(req, res) {
	function print_info(data){
		res.type('application/json');
		res.send(JSON.stringify(data));
	}
	function print_err(){
		res.type('application/json');
		res.send(JSON.stringify({}));
	}
	Promise.resolve(opengraph.getPage(req.query.url))
		.then(print_info)
		.catch(print_err);
});

// Load Main (Loads Socket.io & IRC)
require('./lib/main.js')(server);
