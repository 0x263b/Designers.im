# Designers.im

Web IRC client, built with Node.js

Demo → [http://designers.im/](http://designers.im/)

[![Screenshot](https://i.imgur.com/eAn2Bol.png)](https://i.imgur.com/eAn2Bol.png)


### Motivation

Freenode’s #DN is a channel for software designers. Unfortunately, most designers find all the effort in setting up and using IRC off putting. Ideally there would be a client that requires them to simply click **one button** to get chatting. Bonus points if it looks good.


### Roadmap

- [x] Logging
- [x] Link previews
- [x] Mobile friendly
- [ ] Theme support


### Developing

**Before you start** please note that a lot is currently hardcoded for #DN specifically.

* Make sure you have the latest version of [Node.js](https://nodejs.org/en/) and [NPM](https://www.npmjs.com/) installed
*  Clone this repo `git clone https://github.com/killwhitey/Designers.im.git` 
* Install Node dependencies `npm install`
* Run `node server.js`


#### Libraries in use
* [Angular.js + Angular Sanitize](https://angularjs.org/)
* [lodash](https://lodash.com/)
* [IRC.js](https://github.com/gf3/IRC-js)
* [Express.js](http://expressjs.com/)
* [Socket.io](http://socket.io/)
* [Cheerio](https://cheeriojs.github.io/cheerio/)
* [Request](https://github.com/request/request)
* [EventStream](https://github.com/dominictarr/event-stream)
* [Sass](http://sass-lang.com/)

[Icon](public/icon-128.png) by [Marian Mraz](https://dribbble.com/shots/2163351-Textual-replacement-icon)

### License

[MIT](LICENSE.md)