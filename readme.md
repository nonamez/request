Promise based dependency free HTTP request client for my own purposes. Feel free to use. 

### Installation

```
npm install --save git+https://github.com/nonamez/request.git
```

### Available methods

```javascript
request.get('http://nonamez.name').then(result => {
	console.log(result.response)
	console.log(result.body)
})

request.post('http://nonamez.name', {username: 'Kiril', password: 'password'}).then(result => {
	console.log(result.response)
	console.log(result.body)
})

request.download('http://nonamez.name/storage/images/email.png', 'email.png').then(result => {
	console.log(result.response)
})
```

#### Options

Each of above described methods as the last parameter accepts `options` object.

```javascript
let options = {
	proxy: 'proxy:8080',
	headers: {
		'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2930.0 Safari/537.36',
	},
	tryToDecode: true // Tries to decode gzip
}
```

#### Proxy

This line will automatically load proxy and use it for each request. If you pass proxy through options it will overwrite it for current request.

```javascript
request.useProxy('proxy.txt')
```

#### Timeout

Set request timeout if necessary

```javascript
request.setTimeout(15000)
```

#### Redirects

Set maximum allowed redirects if necessary

```javascript
request.setMaximumRedirects(5)
```