var has_focus = true;
var is_connected = false;

window.onblur = function() {
	has_focus = false;
}
window.onfocus = function() {
	has_focus = true;
	changeFavicon("/images/favicon.png");
}

document.head || (document.head = document.getElementsByTagName('head')[0]);

function changeFavicon(src) {
	var link = document.createElement('link');
	var oldLink = document.getElementById('favicon');
	link.id = 'favicon';
	link.rel = 'shortcut icon';
	link.href = src;
	if (oldLink) {
		document.head.removeChild(oldLink);
	}
	document.head.appendChild(link);
}

if (!Array.prototype.last) {
	Array.prototype.last = function() {
		return this[this.length - 1];
	};
}

angular.module('dnirc', ['ngSanitize'])
	.config(function($locationProvider) {
		$locationProvider.html5Mode(true);
	})
	.controller('RootCtrl', function($scope, $location) {})

	.controller('MainCtrl', function($scope, Client, Mousetrap, Notification, Config) {
		$scope.client = Client;
		$scope.config = Config;
		$scope.userList = true;

		$scope.connect = function() {
			$scope.config.save();
			$scope.client.connect($scope.config);
		};

		Mousetrap.bind('command+left', function(e) {
			e.preventDefault();
			Client.previousChannel();
		});

		Mousetrap.bind('command+right', function(e) {
			e.preventDefault();
			Client.nextChannel();
		});

		$scope.$on('mention', function(ev, mention) {
			if (has_focus == false) {
				changeFavicon("/images/favicon.gif");
			}
		});

		var colours = [
			'#e51c23',
			'#e91e63',
			'#9c27b0',
			'#673ab7',
			'#3f51b5',
			'#5677fc',
			'#03a9f4',
			'#00bcd4',
			'#009688',
			'#259b24',
			'#8bc34a',
			'#afb42b',
			'#ff9800',
			'#ff5722',
			'#795548',
			'#607d8b'
		];

		$scope.set_color = function(string) {
			var sum = 0;
			for (var i = 0; i < string.length; i++) {
				char = string.charCodeAt(i);
				sum = ((sum << 5) - sum) + char;
				sum = sum & sum;
			}
			sum = ((sum % 16) + 16) % 16;

			return "user-" + sum;
		}

	})

	.controller('TabCtrl', function($scope) {
		$scope.iconFor = function(ch) {
			return ch.activity && !$scope.isActive(ch) ? 'activity' : '';
		};

		$scope.isActive = function(ch) {
			return $scope.client.activeChannel === ch;
		};

		$scope.setActive = function(ch) {
			return $scope.client.setActive(ch);
		};

		$scope.closeTab = function(ch) {
			if (ch.name.charAt(0) == '#') {
				$scope.client.part(ch);
			} else {
				$scope.client.removeChannel(ch.name);
			}
		};

	})

	.controller('UserCtrl', function($scope, Channel) {
		$scope.messageTo = function(user) {
			var ch;

			if ( (ch = $scope.client.channel(user.nick)) ) {
				$scope.client.activeChannel = ch;
			} else {
				ch = new Channel(user.nick);
				$scope.client.channels.push(ch);
				$scope.client.activeChannel = ch;
			}
		};
	});

angular.module('dnirc')
	.factory('Channel', function() {

		var Channel = function(name, opts) {
			opts = opts || {};

			this.name = name;
			this.mode = opts.mode;
			this.topic = opts.topic;
			this.history = [];
			this.users = [];

			this.activity = false;
		};

		Channel.MAX_HISTORY = 500;

		Channel.prototype.addEvent = function(event) {
			if (typeof this.history.last() !== 'undefined'
				&& event.from.nick === this.history.last().from.nick
				&& event.to.nick === this.history.last().to.nick) {
				event.supplemental = true;
			}
			this.history.push(event);
			this.activity = true;

			while (this.history.length > Channel.MAX_HISTORY) {
				this.history.shift();
			}
		};

		Channel.prototype.addUser = function(user) {
			this.users.push(user);
		};

		return Channel;
	});

angular.module('dnirc')
	.factory('ChatEvent', function() {
		var ChatEvent = function(from, to, action, text, embed) {
			this.from = from;
			this.to = to;
			this.action = action;
			this.message = text;
			this.embed = embed || false;
			this.timestamp = new Date();
		};

		return ChatEvent;
	});

angular.module('dnirc')
	.factory('Client', function($rootScope, Channel, User, ChatEvent, Socket) {
		var socket = new Socket(null);

		var Client = {
			connected: false, /* are we currently connected? */
			channels: [], /* list of channels we're in. */
			statusChannel: new Channel('status'), /* psuedo-channel for displaying
												 * content that doesn't belong in a
												 * regular channel */
			activeChannel: null, /* the currently selected channel */
			me: new User(''), /* our user information. */

			/* -- public interface below -- */

			say: function(text) {
				var ch = this.activeChannel;

				if (!text || !text.length) {
					return;
				}

				if (text.charAt(0) != '/') {
					/* add our own text to the channel. */
					ch.addEvent(new ChatEvent(this.me, new User(ch.name), false, text));
					text = '/msg ' + ch.name + ' ' + text;
				}

				if (text.substr(0, 3) == '/me') {
					text = text.substr(3);
					ch.addEvent(new ChatEvent(this.me, new User(ch.name), true, text));
					text = "\u0001ACTION " + text + "\u0001";
					text = '/msg ' + ch.name + ' ' + text;
				}

				socket.emit('command', text);
			},

			connect: function(options) {
				opts = angular.copy(options);

				socket.emit('connectToIRC', {
					options: opts
				});
				this.connected = true;
				is_connected = true;
			},

			disconnect: function() {
				this.connected = false;
				this.channels = [];
				this.activeChannel = this.statusChannel;
			},

			/* set the active channel to the provided channel object. */
			setActive: function(channel) {
				this.activeChannel.activity = false;
				this.activeChannel = channel;
				this.activeChannel.activity = false;
			},

			/* move back one channel */
			previousChannel: function() {
				if (!this.channels.length) {
					return;
				}
				var index = _.indexOf(this.channels, this.activeChannel);
				switch (index) {
					case -1:
						this.setActive(_.last(this.channels));
						break;
					case 0:
						this.setActive(this.statusChannel);
						break;
					default:
						this.setActive(this.channels[index - 1]);
						break;
				}
			},

			/* move forward one channel */
			nextChannel: function() {
				if (!this.channels.length) {
					return;
				}
				var index = _.indexOf(this.channels, this.activeChannel);
				switch (index) {
					case -1:
						this.setActive(this.channels[0]);
						break;
					case this.channels.length - 1:
						this.setActive(this.statusChannel);
						break;
					default:
						this.setActive(this.channels[index + 1]);
						break;
				}
			},

			/* leave a channel */
			part: function(channel) {
				this.say("/part " + channel.name);
			},

			/* remove channel from Client.channels */
			removeChannel: function(channelName) {
				if (channelName == this.activeChannel.name) {
					this.previousChannel();
				}

				this.channels = _.reject(this.channels, function(ch) {
					return ch.name == channelName;
				});
			},

			/* find a channel, given a name. returns undefined if not found. */
			channel: function(name) {
				if (name == 'status') {
					return this.statusChannel;
				}
				return _.find(this.channels, function(ch) {
					return ch.name == name;
				});
			},

			addEvent: function(event) {
				var ch;

				if (event.to.nick == this.me.nick) {
					ch = this.statusChannel;
				} else if (!(ch = this.channel(event.to.nick))) {
					ch = new Channel(event.to.nick);
					this.channels.push(ch);
				}

				ch.addEvent(event);

				if (event.from.nick == "") {
					event.status_message = true;
				}

				if (ch !== this.statusChannel && this.me.mentionedIn(event.message)) {
					event.mention = true;
					$rootScope.$broadcast('mention', {
						channel: ch,
						event: event,
						user: this.me
					});
				}

			}
		};

		/* Initially our active channel is the status pane. */
		Client.activeChannel = Client.statusChannel;

		/* handle private events from the socket.io connector */
		socket.on('message', function(d) {
			var event = new ChatEvent(
				new User(d.from || ''),
				new User(d.receiver),
				d.action,
				d.message,
				d.embed
			);
			Client.addEvent(event);
		});

		socket.on('successfullyJoinedChannel', function(d) {
			Client.channels.push(new Channel(d.channel));
			Client.activeChannel = Client.channel(d.channel);
		});

		socket.on('successfullyPartedChannel', function(d) {
			Client.removeChannel(d.channel);
		});

		socket.on('realNick', function(d) {
			Client.me = new User(d.nick);
		});

		socket.on('change_nick', function(d) {
			var ch;
			var this_guy;
			if( (ch = Client.channel(d.channel)) ) {
				this_guy = _.find(ch.users, {
					'nick': d.oldnick
				});
				this_guy.nick = d.newnick;
				ch.users = _.sortBy(ch.users, 'nick');
			}
		});

		socket.on('channel_add_nicks', function(d) {
			var ch;
			if ( (ch = Client.channel(d.channel)) ) {
				_.each(d.nicks, function(u) {
					ch.addUser(new User(u));
				});
				ch.users = _.sortBy(ch.users, 'nick');
			}
		});

		socket.on('channel_remove_nick', function(d) {
			var ch;
			if ( (ch = Client.channel(d.channel)) ) {
				ch.users = _.reject(ch.users, function(u) {
					return u.nick == d.nick;
				});
			}
		});

		socket.on('rpl_topic', function(d) {
			var ch;
			if ( (ch = Client.channel(d.channel)) ) {
				ch.topic = d.topic;
			}
		});

		socket.on('disconnect', function() {
			var event = new ChatEvent(
				new User(""),
				new User("#DN"),
				"You have been disconnect from the server."
			);
			is_connected = false;
			Client.addEvent(event);
		});

		return Client;
	});

/* jshint browser:true */
angular.module('dnirc')
	.factory('Config', function($location) {
		var search = $location.search();
		var randomnick = 'DN' + Math.floor((Math.random() * 1000) + 1);

		var config = {
			nickname: search.nick || randomnick,
			userName: search.nick || randomnick,
			load: function() {}, /* nop */
			save: function() {} /* nop */
		};

		if ('localStorage' in window) {
			config.save = function() {
				localStorage.setItem('dnirc:config', JSON.stringify(
					{
						nickname: this.nickname,
						userName: this.nickname
					}
				));
			};
			config.load = function() {
				var saved = JSON.parse(localStorage.getItem('dnirc:config') || '{}');
				angular.extend(this, saved);
			};
		}

		/* only load if no options were passed in as search */
		var anySet = _.any(['nick'], function(k) {
			return (k in search);
		});

		if (!anySet) {
			config.load();
		}

		return config;
	});

angular.module('dnirc')
	.directive('readLine', function() {
		return {
			restrict: 'A',
			scope: {
				readLine: '&',
				completeFrom: '=?'
			},
			link: function(scope, element, attrs) {
				var history = [];
				var index = history.length;
				var complete;

				function addHistory(text) {
					history.push(text);
					index = history.length;
				}

				function suggestHistory(d) {
					index += d;
					if (index < 0) {
						index = 0;
					} else if (index > history.length) {
						// we use history[history.length] (which would be undefined) as
						// a blank line. 
						index = history.length;
					}
					return history[index] || '';
				}

				function suggestComplete(content) {
					if (!scope.completeFrom || !content || !content.length) {
						return null;
					}

					content = content.toLowerCase().split(" ").last();

					var guess = _.find(scope.completeFrom, function(item) {
						return item.toString().toLowerCase().indexOf(content) === 0;
					});

					return guess ? guess.toString() : null;
				}


				element.bind("keydown keypress", function(event) {
					switch (event.which) {
						case 9:
							// tab
							var orig = element.val();
							if ( (complete = suggestComplete(orig)) ) {
								var update = orig.split(" ");
								update[update.length - 1] = complete;
								update = update.join(" ");
								element.val(update);
								element[0].setSelectionRange(orig.length, update.length);
							}
							event.preventDefault();
							break;
						case 13:
							// enter
							scope.$apply(function() {
								var text = element.val();
								element.val('');
								scope.readLine({
									text: text
								});
								addHistory(text);
								event.preventDefault();

							});
							break;
						case 38:
							// up
							element.val(suggestHistory(-1));
							event.preventDefault();
							break;
						case 40:
							// down
							element.val(suggestHistory(1));
							event.preventDefault();
							break;
					}
				});
			}
		};
	});

angular.module('dnirc')
	.directive('scrollGlue', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var elem = element[0];
				var glued = true;

				element.bind('scroll', function() {
					/* we should stick to the bottom if the scroll is currently at the
					 * bottom of the element. */
					glued = (elem.scrollTop + elem.clientHeight + 1 >= elem.scrollHeight);
				});

				scope.$watch(function() {
					if (glued) {
						/* stick to the bottom */
						elem.scrollTop = elem.scrollHeight;
					}
				});
			}
		};
	});

angular.module('dnirc')
	.factory('Mousetrap', function($rootScope) {
		return {
			bind: function(expression, callback) {
				Mousetrap.bind(expression, function(e) {
					var r = callback(e);
					$rootScope.$apply();
					return r;
				});
			}
		};
	});

angular.module('dnirc')
	.factory('Notification', function($q, $rootScope) {
		var supported = ('Notification' in window);
		var nativeNote = window.Notification;
		var Notification = {};

		Notification.notify = function(title, opts) {
			var d = $q.defer();
			if (!supported) {
				d.reject();
				return d.promise;
			}

			opts = opts || {};

			var n = new nativeNote(title, opts);

			n.onclick = function() {
				$rootScope.$apply(d.resolve.bind(d));
			};

			/* if timeout provided, auto-close the notification */
			if (opts.timeout) {
				n.onshow = function() {
					window.setTimeout(function() {
						n.close();

						d.reject(); /* user didn't click. */
						$rootScope.$apply();
					}, opts.timeout);
				};
			}

			return d.promise;
		};

		Notification.request = function() {
			var d = $q.defer();

			if (!supported) {
				d.reject();
				return d.promise;
			}

			nativeNote.requestPermission(function(result) {
				if (result === 'granted') {
					d.resolve(result);
				} else {
					d.reject(result);
				}
				$rootScope.$apply();
			});

			return d.promise;
		};

		return Notification;
	});

angular.module('dnirc')
	.factory('Socket', function($rootScope) {
		var Socket = function(addr) {
			this._socket = io.connect(addr);
		};

		Socket.prototype.emit = function(channel, data) {
			return this._socket.emit(channel, data);
		};

		Socket.prototype.on = function(channel, callback) {
			return this._socket.on(channel, function(data) {
				callback(data);
				$rootScope.$apply();
			});
		};

		return Socket;
	});

angular.module('dnirc')
	.factory('User', function() {
		var User = function(nick) {
			this.rename(nick);
		};

		/* nick!user@host */
		User.NICK_REGEX = /^([^!]+)!([^@]+)@(.+)$/;

		User.prototype.rename = function(nick) {
			var parts;
			this.whole = nick;
			/* is it in the format user!~login@host? */
			if ( (parts = nick.match(User.NICK_REGEX)) ) {
				this.nick = parts[1];
				this.login = parts[2];
				this.hostname = parts[3];
			} else {
				/* probably just a plain nick */
				this.nick = nick;
				this.login = null;
				this.hostname = null;
			}
		};

		User.prototype.toString = function() {
			return this.nick;
		};

		User.prototype.mentionedIn = function(text) {
			if (!this._mentionRegex) {
				this._mentionRegex = new RegExp("\\b" + this.nick + "\\b", "i");
			}

			return !!text.match(this._mentionRegex);
		};

		return User;
	});

window.onbeforeunload = function(e) {
	e = e || window.event;

	if (is_connected) {
		if (e) {
			e.returnValue = 'Closing this window will disconnect you from the chat';
		}
		return 'Closing this window will disconnect you from the chat';
	}
};