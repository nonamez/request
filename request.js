let fs    = require('fs'),
	url   = require('url'),
	util  = require('util'),
	zlib  = require('zlib'),
	http  = require('http'),
	https = require('https');

let PROXY_LIST      = false,
	PROXY_FILE_PATH = false;

let REQUEST_TIMEOUT   = false,
	REDIRECTS_MAXIMUM = 5;

const _SELF = this;

function doRequest (options = {}, data = false, dest = false, REDIRECTS_FOLLOWED = 0) {
	const lib = options.url.startsWith('https') ? https : http

	if ('headers' in options == false) {
		options.headers = {}
	}

	if ('content-type' in options.headers == false) {
		options.headers['content-type'] = 'application/x-www-form-urlencoded';
	}

	if (data) {
		options.method  = 'POST'

		if (typeof data != 'string') {
			throw new Error('TypeError: POST data should be string.')
		}

		if ('content-length' in options.headers == false) {
			options.headers['content-length'] = Buffer.byteLength(data)
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
			if (options.response_encoding) {
				response.setEncoding(options.response_encoding);
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

				options.url = redirect;
				options.redirected_to = redirect;

				REDIRECTS_FOLLOWED++

				// console.log('#%d Redirect To: %s', REDIRECTS_FOLLOWED,  response.headers.location)

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

					let result = {
						headers:        response.headers,
						raw_headers:    response.rawHeaders,
						status_code:    response.statusCode,
						status_message: response.statusMessage,
						redirected_to:  options.redirected_to || false
					}

					let encoding = 'content-encoding' in response.headers ? response.headers['content-encoding'] : false;

					if (options.tryToDecode && encoding) {
						let buffer = Buffer.concat(body);

						if (encoding == 'gzip') {
							zlib.gunzip(buffer, function(err, decoded) {
								if (err) {
									return reject(err)
								}

								result.body = decoded.toString();

								resolve(result)
							});
						} else if (encoding == 'deflate') {
							zlib.inflate(buffer, function(err, decoded) {
								if (err) {
									return reject(err)
								}

								result.body = decoded.toString();

								resolve(result)
							})
						} else {
							reject(new Error('Cant decode response'))
						}
					} else {
						result.body = body.join('')

						resolve(result)
					}
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

function fixOptions(options, url = false) {
	if (Object.prototype.toString.call(options) != '[object Object]') {
		options = {}
	}

	if ('tryToDecode' in options == false) {
		options.tryToDecode = true;
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
	} else {
		options.headers = Object.keys(options.headers).reduce(function(container, key) {
			container[key.toLowerCase()] = options.headers[key];

			return container;
		}, {});
	}

	if (url) {
		options.url = url
	}

	return options;
}

module.exports.get = function(url, options = {}) {
	let opt = fixOptions(options, url);

	return doRequest(opt);
}

module.exports.post = function(url, data, options = {}) {
	let opt = fixOptions(options, url);

	return doRequest(opt, data);
}

module.exports.download = function(url, dest, options = {}) {
	let opt = fixOptions(options, url);

	dest = fs.createWriteStream(dest);

	return doRequest(opt, false, dest);
}

module.exports.useProxy = function(file_path = false) {
	PROXY_FILE_PATH = file_path ? file_path : []

	try {
		fs.accessSync(file_path);

		PROXY_LIST = fs.readFileSync(PROXY_FILE_PATH).toString().split('\n');
		PROXY_LIST = PROXY_LIST.filter(v => v != '');
	} catch (error) {
		throw new Error('Unable to load the proxy');
	}
}

module.exports.getProxy = function() {
	if (PROXY_LIST) {
		if (PROXY_LIST.length == 0) {
			_SELF.useProxy();

			throw new Error('Ran out of proxy');
		}

		let proxy = PROXY_LIST.shift();
		
		let {'0': host, '1': port} = proxy.split(':');
		
		return {host, port};
	}

	return false;
}

module.exports.setTimeout = function(timeout) {
	REQUEST_TIMEOUT = timeout;
}

module.exports.setMaximumRedirects = function(redirects) {
	REDIRECTS_MAXIMUM = redirects;
}