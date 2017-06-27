let fs    = require('fs'),
	url   = require('url'),
	util  = require('util'),
	http  = require('http'),
	https = require('https');

let PROXY_LIST      = false,
	PROXY_FILE_PATH = false;

const REQUEST_TIMEOUT   = false,
	  REDIRECTS_MAXIMUM = 5;

const _SELF = this;

const search_agents = [
	'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	'Googlebot/2.1 (+http://www.googlebot.com/bot.html)',
	'Googlebot/2.1 (+http://www.google.com/bot.html)',
	'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
	'Mozilla/5.0 (compatible; bingbot/2.0 +http://www.bing.com/bingbot.htm)',
	'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
	'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
	'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)'
]

const mobile_agents = [
	'Mozilla/5.0 (iPhone; CPU iPhone OS 9_2 like Mac OS X) AppleWebKit/601.1 (KHTML, like Gecko) CriOS/47.0.2526.70 Mobile/13C71 Safari/601.1.46',
	'Mozilla/5.0 (Linux; U; Android 4.4.4; Nexus 5 Build/KTU84P) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
	'Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0; IEMobile/9.0)'
]

const desktop_agents = [
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/602.2.14 (KHTML, like Gecko) Version/10.0.1 Safari/602.2.14'
]

function doRequest (options = {}, data = false, dest = false, REDIRECTS_FOLLOWED = 0) {
	const lib = options.url.startsWith('https') ? https : http

	if ('headers' in options == false) {
		options.headers = {}
	}

	if ('Content-Type' in options.headers == false) {
		options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}

	if (data) {
		options.method  = 'POST'

		if (typeof data != 'string') {
			throw new Error('TypeError: POST data should be string.')
		}

		if ('Content-Length' in options.headers == false) {
			options.headers['Content-Length'] = Buffer.byteLength(data)
		}
	}

	if ('proxy' in options) {
		let proxy = options.proxy

		options.host = proxy.host
		options.port = proxy.port
		options.path = options.url
	} else {
		let parsed_url = url.parse(options.url)

		options.host = parsed_url.host
		options.path = parsed_url.path
	}

	if (REQUEST_TIMEOUT) {
		options.timeout = REQUEST_TIMEOUT
	}

	return new Promise(function(resolve, reject) {
		let request = lib.request(options, function(response) {
			if (response.statusCode >= 500) {
				request.abort()
				
				reject(new Error('Failed to load page, status code: ' + response.statusCode))
			}

			if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
				if (REDIRECTS_FOLLOWED >= REDIRECTS_MAXIMUM) {
					reject(new Error('Exceeded maximum redirects. Probably stuck in a redirect loop ' +  response.headers.location))
					
					return false
				}

				let redirect = response.headers.location

				if (url.parse(redirect).hostname == false) {
					let parsed_url = url.parse(options.url)

					redirect = url.resolve(parsed_url.host, response.headers.location)
				}

				options.url = redirect

				REDIRECTS_FOLLOWED++

				console.log('#%d Redirect To: %s', REDIRECTS_FOLLOWED,  response.headers.location)

				if ('set-cookie' in response.headers) {
					options.headers.Cookie = response.headers['set-cookie'].join(';')
				}

				doRequest(options, data, dest, REDIRECTS_FOLLOWED).then(function(result) {
					resolve(result)
				}).catch(function(err) {
					reject(err)
				})
			} else {
				let body = [];

				if (dest) {
					response.pipe(dest)
				} else {
					response.on('data', function(chunk) {
						body.push(chunk)
					})
				}

				response.on('end', function() {
					if (dest) {
						dest.end()
					}

					resolve({
						headers: response.headers,
						rawHeaders: response.rawHeaders,
						statusCode: response.statusCode,
						statusMessage: response.statusMessage,
						body: body.join('')
					})
				})
			}
		})

		if (REQUEST_TIMEOUT) {
			request.setTimeout(REQUEST_TIMEOUT, function() {
				request.abort()
				
				reject(new Error('Timeout'))
			})
		}

		request.on('error', function(err) {
			reject(err)
		})

		if (data) {
			request.write(data)
		}

		request.end()
	})
}

function parseOptions(options, url = false) {
	if (Object.prototype.toString.call(options) != '[object Object]') {
		options = {}
	}

	if ('proxy' in options) {
		if (options.proxy === false) {
			delete options.proxy
		} else {
			let {'0': host, '1': port} = options.proxy.split(':')

			options.proxy = {host, port}
		}
	} else {
		if (PROXY_LIST && PROXY_LIST.length > 0) {
			options.proxy = _SELF.getProxy()
		}
	}

	if ('headers' in options == false) {
		options.headers = {}
	}

	if ('User-Agent' in options.headers) {
		if (options.headers['User-Agent'] == false) {
			delete options.headers['User-Agent']
		} else {
			let ua_val = options.headers['User-Agent'],
				ua_key = 0

			if (Object.prototype.toString.call(ua_val) == '[object Object]') {
				ua_val = Object.keys(ua_val).shift()
				ua_key = options.headers['User-Agent'][ua_val]

				let ua_index = ['desktop', 'mobile', 'search'].indexOf(ua_val)

				if (ua_index !== -1) {
					if (ua_index == 0) {
						options.headers['User-Agent'] = desktop_agents[ua_key]
					} else if (ua_index == 1) {
						options.headers['User-Agent'] = mobile_agents[ua_key]
					} else if (ua_index == 2) {
						options.headers['User-Agent'] = search_agents[ua_key]
					}

					if (options.headers['User-Agent'] == undefined) {
						throw new Error('Cant find specified User Agent group index')
					}
				} else {
					throw new Error('Cant find specified User Agent group')
				}
			}
		}
	} else {
		options.headers['User-Agent'] = desktop_agents[0]
	}

	if (url) {
		options.url = url
	}

	return options
}

module.exports.get = function(url, options = {}) {
	var options = JSON.parse(JSON.stringify(options));
		options = parseOptions(options, url)

	return doRequest(options)
}

module.exports.post = function(url, data, options = {}) {
	var options = JSON.parse(JSON.stringify(options));
		options = parseOptions(options, url)

	return doRequest(options, data)
}

module.exports.download = function(url, dest, options = {}) {
	var options = JSON.parse(JSON.stringify(options));
		options = parseOptions(options, url)

	dest = fs.createWriteStream(dest)

	return doRequest(options, false, dest)
}

module.exports.useProxy = function(file_path = false) {
	PROXY_FILE_PATH = file_path ? file_path : []

	try {
		fs.accessSync(file_path)

		PROXY_LIST = fs.readFileSync(PROXY_FILE_PATH).toString().split('\n')
		PROXY_LIST = PROXY_LIST.filter(v => v != '')
	} catch (error) {
		throw new Error('Unable to load the proxy')
	}
}

module.exports.getProxy = function() {
	if (PROXY_LIST) {
		if (PROXY_LIST.length == 0) {
			_SELF.useProxy()

			throw new Error('Ran out of proxy')
		}

		let proxy = PROXY_LIST.shift()
		
		let {'0': host, '1': port} = proxy.split(':')
		
		return {host, port}
	}

	return false
}

module.exports.setTimeout = function(timeout) {
	REQUEST_TIMEOUT = timeout
}