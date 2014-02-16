#SimpleRiak

##Usage

###Initialize a client

```js
var simpleriak = require('simpleriak');
var client = simpleriak.createClient({
    backend: 'http', // backend protocol to use, options are 'http' or 'pbc'
    host: '127.0.0.1', // server's host name, defaults to 127.0.0.1
    port: 8098, // server port, defaults to 8098 for http or 8087 for pbc
    bucket: 'test' // default bucket to apply future actions to, this can be overridden
});
```

###Get buckets

```js
client.getBuckets(function (err, buckets) {
    if (err) {
        throw err; // only unknown errors occur on this method
    }

    console.log(buckets); // ['bucket1', 'bucket2']
});
```

###Get bucket properties

```js
// get properties of the default bucket
client.getBucket(function (err, props) {
    if (err) {
        throw err; // only unknown errors occur on this method
    }

    console.log(props); // an object containing bucket properties such as n_val, r, and w
});

// get properties of a specific bucket, overriding the default
client.getBucket({ bucket: 'test2' }, function (err, props) {
});
```

###Set bucket properties

```js
// set properties of the default bucket
client.setBucket({ w: 3 }, function (err, props) {
    if (err) {
        throw err; // this is either due to bad properties, or unknown
    }

    console.log(props); // the modified bucket properties
});

// set properties of a specific bucket, overriding the default
client.setBucket({ bucket: 'test2', n_val: 2 }, function (err, props) {
});
```

###Get all keys in a bucket

```js
// get keys in the default bucket
client.getKeys(function (err, keys) {
    if (err) {
        throw err; // this method only returns unknown errors
    }

    console.log(keys); // ['key1', 'key2']
});

// get keys in a specific bucket, overriding the default
client.getKeys({ bucket: 'test2' }, function (err, keys) {
});
```

###Get an object by key

```js
client.get({ key: 'test' }, function (err, data) {
    if (err) {
        throw err; // can be 'Not found' or 'Unknown error'
    }

    console.log(data);
    // the object returned has two keys, 'content' and 'vclock'
    // the vclock must be stored by you for future put requests
    // if you wish to not create siblings. the content key is an
    // array of objects describing each value stored under that
    // key. if siblings exist, the array length will be greater
    // than 1. each object in the array contains the properties
    // 'value', 'type', and 'vtag'. value is the actual data, type
    // is the mime-type of the value, and vtag is the tag representing
    // that specific version of the object
});
```

###Delete an object by key

```js
client.delete({ key: 'test' }, function (err, reply) {
    if (err) {
        throw err; // this method will only return an unknown error
    }

    console.log(reply); // { key: 'test', status: 'deleted' }
    // NOTE: this method will return a 'deleted' status for any key
    // it is called on, whether it exists or not.
});
```

###Ping

```js
client.ping(function (err, reply) {
    if (err) {
        throw err; // server was unreachable or returned an error
    }

    console.log(reply); // { response: 'ok' }
});
```

###Server resources

```js
client.resources(function (err, resources) {
    if (err) {
        throw err;
        // this will always be a 'Not implemented' error using the pbc backend
        // as it does not support the get resources call. for the http backend
        // this will only be populated if a non-200 status code is received
    }

    console.log(resources); // object describing server resources
});
```

###Server status

```js
client.status(function (err, status) {
    if (err) {
        throw err; // this method will only return unknown errors
    }

    console.log(status); // object describing server status
    // NOTE: this method is not well supported in the pbc backend, so it will
    // only include the node's name and riak version
});
```
