#SimpleRiak

##Usage

###Initialize a client

```js
var simpleriak = require('simpleriak');
var client = simpleriak.createClient({
    backend: 'http', // backend protocol to use, options are 'http' or 'pbc'
    host: '127.0.0.1', // server's host name, defaults to 127.0.0.1
    port: 8098 // server port, defaults to 8098 for http or 8087 for pbc
});
```

###Get buckets

```js
client.getBuckets(function (err, buckets) {
    /*
    err will be populated if an error occurred
    if no error occurred, buckets will be an array of strings
    */
});
```
