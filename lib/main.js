module.exports = function(server) {

var io = require('socket.io').listen(server);
var irc = require('./irc');
var opengraph = require('./opengraph.js');

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
			message.action = false;
			message.embed = false;

			var re = /^[\u0001]ACTION\s(.+)[\u0001]$/g;
			if (re.test(message.message) === true) {
				message.message = message.message.replace(re, '$1');
				message.action = true;
			}

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
				client.emit("message", message);
			} else {
				var url = links[0];

				function emitMsg(data) {
					message.embed = data;
					client.emit("message", message);
				}
				function print_err(data) {
					console.log("Error: " + data);
					client.emit("message", message);
				}

				Promise.resolve(opengraph.getPage(url))
					.then(emitMsg)
					.catch(print_err);
			}
		});

		// join channel listener
		ircClient.addListener("successfullyJoinedChannel", function(channel) {
			client.emit("successfullyJoinedChannel", {
				channel: channel
			});
		});

		ircClient.addListener("rpl_topic", function(data) {
			client.emit("rpl_topic", data);
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

			// take the common command 'msg' and turn it into a valid irc command
			switch (command[0].toLowerCase()) {
			case "msg":
				var message = command.splice(2, command.length - 2).join(' ');
				command[0] = "privmsg";
				command.push(message);
				ircClient.send.apply(ircClient, command);
				break;
			case "me":
				var message = command.splice(2, command.length - 2).join(' ');
				message = "\u0001ACTION " + message + "\u0001";
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