SimpleRiak is a very simple riak HTTP client. It wraps request and simplifies the calls made to riak as much as possible.

Usage
=====

WARNING
-------

There is a breaking change in SimpleRiak 0.1.0. When doing getKeys, get, or mapred with multiple indexes, they are no longer specified in an array. Use an object with multiple keys instead.

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

List keys (matching a search)
-----------------------------

```javascript
riak.getKeys({ search: 'creator:me' }, function (err, reply) {
    console.log(reply.data);
});

riak.getKeys({ search: { query: 'creator:me AND type:article', rows: 5, sort: 'timestamp' } }, function (err, reply) {
    console.log(reply.data);
});
```

Searching supports all query parameters supported by the Riak Solr interface.


List indexes (matching a key)
-----------------------------

```javascript
riak.getIndexes({ key: 'test' }, function (err, reply) {
    console.log(reply.data);
});
```

This is a utility function to retrieve and parse the indexes associated with a key. It can be useful, for
instance if you store permissions in an index and need to check it before acting on the key.

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
function (described later) that fetches the keys and uses the Riak.mapValuesJson map phase to return data. Note that you can
specify multiple indexes.

```javascript
riak.get({ index: { creator: 'me', published: true } }, function (err, reply) {
    console.log(reply.data);
});
```

Get data (by search)
--------------------

```javascript
riak.get({ search: 'creator:me' }, function (err, reply) {
    console.log(reply.data);
});
```


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

Modify a key's contents
-----------------------

SimpleRiak includes a simple modify function that performs a GET request, alters the response, then saves it
back to the correct key.

```javascript
function transform(data) {
    return data + ' is now changed!';
}

riak.modify({ key: 'test', transform: transform }, function (err, reply) {
    console.log(err);
});
```

Note that this function only works by key. The index property here is used to modify the indexes stored for the
specific key. To remove an index completely, set its value to undefined.

```javascript
riak.modify({ key: 'test', index: { new_index: 'this is new', old_index: undefined } }, function (err, reply) {
    console.log(err); //the key test will now have the index "old_index" removed, and the index "new_index" added with a value of "this is new"
});
```

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

You may specify a bucket, a bucket and key, an array of keys, or a bucket and an index using an exact match or range.
Indexes and search inputs are run through getKeys and the resulting array passed to mapreduce, so this input also
supports matching on multiple indexes and full search query parameters.

```javascript
riak.mapred({ bucket: 'test2', map: 'Riak.mapValuesJson' }, callback);
riak.mapred({ key: 'test', map: 'Riak.mapValuesJson' }, callback); // default bucket is used
riak.mapred({ key: ['test', 'test2'], map: 'Riak.mapValuesJson' }, callback);
riak.mapred({ index: { creator: 'me' }, map: 'Riak.mapValuesJson' }, callback);
riak.mapred({ search: 'creator:me' }, callback);
```

Search
------

```javascript
riak.search({ query: 'creator:me', rows: 10 }, function (err, reply) {
    console.log(reply.data);
});
```

All parameters allowed by the Solr interface are allowed here and are passed directly through. The response
will come back in the same format as MapReduce. The numFound, start, and params data normally returned by Solr
can be found in the headers property of the reply.

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
