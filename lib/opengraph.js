var cheerio = require("cheerio");
var request = require("request");
var es = require('event-stream');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // God damn I love self-signed certs 

var exports = module.exports = {};

exports.getInfo = function(data) {
	var deferred = Promise.defer();
	var toggle = {
		link: data.link
	};

	switch (data.type) {
		case "text/html":
			var $ = cheerio.load(data.text);
			toggle.type = "link";
			toggle.head = $('meta[property="og:title"]').attr("content")
				|| $('meta[name="twitter:title"]').attr("content")
				|| $("title").text()
				|| "";
			toggle.body = $('meta[property="og:description"]').attr("content")
				|| $('meta[name="twitter:description"]').attr("content")
				|| $('meta[name="description"]').attr("content")
				|| "";
			toggle.thumb = $('meta[name="twitter:image:src"]').attr("content")
				|| $('meta[property="og:image"]').attr("content")
				|| "";
			break;

		case "image/png":
		case "image/gif":
		case "image/jpg":
		case "image/jpeg":
			toggle.type = "image";
			toggle.length = bytesToSize(data.length);
			break;

		case "video/webm":
		case "video/mp4":
			toggle.type = "video"
			toggle.length = bytesToSize(data.length);
			break;

		default:
	}

	if (toggle.hasOwnProperty("head")) toggle.head = toggle.head.substring(0, 140);
	if (toggle.hasOwnProperty("body")) toggle.body = toggle.body.substring(0, 140);

	if (toggle.type === "link" && toggle.head === "") {
		deferred.reject(false);
		return deferred.promise;
	} else {
		deferred.resolve(toggle);
		return deferred.promise;
	}
}

exports.getPage = function(url) {
	var deferred = Promise.defer();
	var length = 0;
	var limit = 1024 * 10;
	var info = {};
	var req = request.get({
		url: url,
		timeout: 1000,
		maxRedirects: 6
	});

	req.on("response", function(res) {
		if (!(/(text\/html|application\/json)/.test(res.headers['content-type']))) {
			res.req.abort();
		}
	})
	.on("error", function(err) {
		deferred.reject(err);
	})
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
		} catch (error) {
			body = {};
		}
		try {
			type = req.response.headers['content-type'].split(/ *; */).shift();
		} catch (error) {
			type = {};
		}
		try {
			length = req.response.headers['content-length'];
		} catch (error) {
			length = 0;
		}
		info = {
			text: data,
			body: body,
			type: type,
			length: length,
			link: url
		};
		deferred.resolve(exports.getInfo(info));
	}));
	return deferred.promise;
}

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return '0 Byte';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}