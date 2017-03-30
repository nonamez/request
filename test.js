let request = require('./request.js')

// request.useProxy('proxy.txt') // add proxy support if needed

request.get('http://nonamez.name').then(result => {
	console.log(result.response)
	console.log(result.body)
}).catch(error => {
	console.log(error)
})

request.download('http://nonamez.name/storage/images/email.png', 'email.png').then(result => {
	console.log(result.response)
}).catch(error => {
	console.log(error)
})