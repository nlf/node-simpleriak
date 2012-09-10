SimpleRiak is a very simple riak HTTP client. It wraps request and simplifies the calls made to riak as much as possible.

Usage
=====

Installation
------------

```
npm install simpleriak
```

Object creation
---------------

Host, port, and bucket are all optional. Host defaults to localhost and port to 8098.
If bucket is present, it sets the default bucket to be used in future calls. If you don't set the
bucket here, you must specify it in each call you make. Specifying a bucket in a call always takes
precedence over the default.

```javascript
var riak = require('simpleriak').createClient({ host: 'localhost', port: 8098, bucket: 'test' });
```

Callbacks
---------

Every function returns the same callback pattern (err, reply).

err will be an Error object if any error is present
reply is an object containing the following keys
* "statusCode" will be the HTTP status code returned from riak
* "data" will be the body of the HTTP response from riak
* "headers" is the complete HTTP headers returned from riak
* "key" when a location header is present, this property will contain the key in the header

List buckets
------------

```javascript
riak.getBuckets(function (err, reply) {
    console.log(reply.data);
});
```

List keys
---------

```javascript
riak.getKeys({ bucket: 'test2' }, function (err, reply) {
    console.log(reply.data);
});
```

List keys (matching an index)
-----------------------------

```javascript
riak.getKeys({ index: { count: { start: 5, end: 10 } } }, function (err, reply) {
    console.log(reply.data);
});
```

When using an index, you may either specify a start and end to be used with riak's range finding, or
a key which will search for an exact match.

Get bucket properties
---------------------

```javascript
riak.getBucket(function (err, reply) {
    console.log(reply.data); // gets default bucket properties
});
```

Set bucket properties
---------------------

```javascript
riak.setBucket({ allow_mult: false }, function (err, reply) {
    console.log(err); // reply.data should be empty for this call
});
```

You can specify any editable property for a bucket.

Get data (by key)
-----------------

```javascript
riak.get({ key: 'test' }, function (err, reply) {
    console.log(reply.data); // returns { example: 'object' }
});
```

Get data (by index)
-------------------

```javascript
riak.get({ index: { creator: 'me' } }, function (err, reply) {
    console.log(reply.data); // returns ['i put this here']
});
```

When fetching data by index, the reply data will always be an array. This usage is actually an interface to the MapReduce
function (described later) that fetches the keys and uses the Riak.mapValuesJson map phase to return data

Store data (Riak created key)
-----------------------------

```javascript
riak.put({ data: 'wee, a string!' }, function (err, reply) {
    console.log(reply.key); // the key riak created
});
```


Store data (User specified key)
-------------------------------

```javascript
riak.put({ key: 'test', data: { example: 'object' } }, function (err, reply) {
    console.log(err);
});
```

Store data (with an index)
--------------------------

```javascript
riak.put({ index: { creator: 'me' }, data: 'i put this here' }, function (err, reply) {
    console.log(reply.key);
});
```

You can specify as many indexes as you like, the property name will be the index and its value the key.

Delete a key
------------

```javascript
riak.del({ key: 'creator' }, function (err, reply) {
    console.log(err);
});
```

Note that this function does not work with an index, this is by design. If you need to delete all keys
that match an index, use getKeys and iterate the results.

MapReduce
---------

```javascript
function map(v, keyData, arg) {
    var ret = [],
        index = v.values[0].metadata.index;

    if (index.creator_bin === arg) ret.push(JSON.parse(v.values[0].data));
    return ret;
};

riak.mapred({ map: { source: map, arg: 'me' } }, function (err, reply) {
    console.log(reply.data); // ['i put this here']
});
```

The MapReduce function can take map and reduce phases as either an object (shown above), a string

```javascript
riak.mapred({ map: 'Riak.mapValuesJson' }, callback);
```

or a function directly

```javascript
riak.mapred({ map: map }, callback);
```

You may specify a bucket, a bucket and key, or a bucket and an index using an exact match or range.

```javascript
riak.mapred({ bucket: 'test2', map: 'Riak.mapValuesJson' }, callback);
riak.mapred({ key: 'test', map: 'Riak.mapValuesJson' }, callback); // default bucket is used
riak.mapred({ index: { creator: 'me' }, map: 'Riak.mapValuesJson' }, callback);
```

Ping
----

```javascript
riak.ping(function (err, reply) {
    console.log(reply.data); // 'OK'
});
```

Stats
-----

```javascript
riak.stats(function (err, reply) {
    console.log(reply.data); // full stats object returned from riak
});
```

Resources
---------

```javascript
riak.resources(function (err, reply) {
    console.log(reply.data); // full resources information from riak
});
```
