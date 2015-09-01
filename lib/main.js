var cheerio = require("cheerio");
var request = require("request");
var es = require('event-stream');

module.exports = function(server) {

	var io = require('socket.io').listen(server);
	var irc = require('./irc');

	io.sockets.on("connection", function(client) {

		client.on("connectToIRC", function(data) {
			// initialize irc connection
			var opts = {
				port: 6697,
				channels: ["#DN"],
				password: null,
				userName: data.options.userName || data.options.nickname,
				secure: true,
				selfSigned: true,
				certExpired: true,
				stripColors: true
			};

			var ircClient = new irc.Client('chat.freenode.net', data.options.nickname, opts);

			// messages to print in client's ui
			ircClient.addListener("message", function(message) {
				var links = [];
				var split = message.message.split(" ");
				split.forEach(function(w) {
					// ignore localhost links
					if (w.match(/^(http|https):\/\/localhost/g)) {
						return;
					}
					var match = w.indexOf("http://") === 0 || w.indexOf("https://") === 0;
					if (match) {
						links.push(w);
					}
				});

				// don't parse links from status messages
				if (links.length === 0 || typeof message.from === "undefined" || message.receiver === "status") {
					message.embed = false;
					client.emit("message", message);
				} else {
					var link = links[0];
					fetch(link, function(res) {
						parse(message, link, res, client);
					});
				}
			});

			// join channel listener
			ircClient.addListener("successfullyJoinedChannel", function(channel) {
				client.emit("successfullyJoinedChannel", {
					channel: channel
				});
			});

			ircClient.addListener("channel_add_nicks", function(data) {
				client.emit("channel_add_nicks", data);
			});

			ircClient.addListener("channel_remove_nick", function(data) {
				client.emit("channel_remove_nick", data);
			});

			ircClient.addListener("change_nick", function(data) {
				client.emit("change_nick", data);
			});

			// part channel listener
			ircClient.addListener("successfullyPartedChannel", function(channel) {
				client.emit("successfullyPartedChannel", {
					channel: channel
				});
			});

			// real nick listener
			ircClient.addListener("realNick", function(nick) {
				client.emit("realNick", {
					nick: nick
				});
			});

			// client wanting to send irc command
			client.on("command", function(data) {
				var command = data.substr(1).split(' ');

				// take the common command 'msg` and turn it into a valid irc command
				switch (command[0].toLowerCase()) {
					case "msg":
						var message = command.splice(2, command.length - 2).join(' ');
						command[0] = "privmsg";
						command.push(message);
						ircClient.send.apply(ircClient, command);

						break;
					case "quit":
						ircClient.disconnect(function() {
							client.emit("disconnected");
						});

						break;
					default:
						ircClient.send.apply(ircClient, command);

						break;
				}
			});

			client.on("disconnect", function(data) {
				ircClient.disconnect();
			});

		});

	});

}

function parse(message, url, res, client) {
	var toggle = {
		type: "",
		length: "",
		head: "",
		body: "",
		thumb: "",
		link: url
	};

	switch (res.type) {
		case "text/html":
			var $ = cheerio.load(res.text);
			toggle.type = "link";
			toggle.head = $('meta[name="og:title"]').attr("content")
				|| $('meta[property="twitter:title"]').attr("content")
				|| $("title").text()
				|| "(no title)";
			toggle.body = $('meta[name="og:description"]').attr("content")
				|| $('meta[property="twitter:description"]').attr("content")
				|| $('meta[property="description"]').attr("content")
				|| "(no description)";
			toggle.thumb = $('meta[property="og:image"]').attr("content")
				|| $('meta[name="twitter:image:src"]').attr("content")
				|| "";
			break;

		case "image/png":
		case "image/gif":
		case "image/jpg":
		case "image/jpeg":
			toggle.type = "image";
			toggle.length = bytesToSize(res.length);
			break;

		default:
			return;
	}

	message.embed = toggle;
	client.emit("message", message);
}

function fetch(url, cb) {
	try {
		var req = request.get(url);
	} catch ( e ) {
		return;
	}
	var length = 0;
	var limit = 1024 * 25;
	req
		.on("response", function(res) {
			if (!(/(text\/html|application\/json)/.test(res.headers['content-type']))) {
				res.req.abort();
			}
		})
		.on("error", function() {})
		.pipe(es.map(function(data, next) {
			length += data.length;
			if (length > limit) {
				req.response.req.abort();
			}
			next(null, data);
		}))
		.pipe(es.wait(function(err, data) {
			if (err) return;
			var body;
			var type;
			var length;
			try {
				body = JSON.parse(data);
			} catch ( e ) {
				body = {};
			}
			try {
				type = req.response.headers['content-type'].split(/ *; */).shift();
			} catch ( e ) {
				type = {};
			}
			try {
				length = req.response.headers['content-length'];
			} catch ( e ) {
				length = 0;
			}
			data = {
				text: data,
				body: body,
				type: type,
				length: length
			};
			cb(data);
		}));
}

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return '0 Byte';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}
