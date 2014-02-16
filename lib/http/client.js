var hyperquest = require('hyperquest');

exports.get = function (opts, callback) {
    var body, response;
    var responded = false;
    var chunks = [];
    var length = 0;
    var res = hyperquest.get(opts);

    res.on('data', function (chunk) {
        chunks.push(chunk);
        length += chunk.length;
    });

    res.on('end', function () {
        if (!responded) {
            body = Buffer.concat(chunks, length);
            callback(null, response, body);
            responded = true;
        }
    });

    res.on('error', function (err) {
        if (!responded) {
            callback(err);
            responded = true;
        }
    });

    res.on('response', function (r) {
        response = r;
        response.resume();
    });
};

exports.put = function (opts, payload, callback) {
    var body, response;
    var responded = false;
    var chunks = [];
    var length = 0;
    var res = hyperquest.put(opts);
    res.write(JSON.stringify(payload));
    res.end();

    res.on('data', function (chunk) {
        chunks.push(chunk);
        length += chunk.length;
    });

    res.on('end', function () {
        if (!responded) {
            body = Buffer.concat(chunks, length);
            callback(null, response, body);
            responded = true;
        }
    });

    res.on('error', function (err) {
        if (!responded) {
            callback(err);
            responded = true;
        }
    });

    res.on('response', function (r) {
        response = r;
        response.resume();
    });
};

exports.delete = function (opts, callback) {
    var body, response;
    var responded = false;
    var chunks = [];
    var length = 0;
    var res = hyperquest.delete(opts);

    res.on('data', function (chunk) {
        chunks.push(chunk);
        length += chunk.length;
    });

    res.on('end', function () {
        if (!responded) {
            body = Buffer.concat(chunks, length);
            callback(null, response, body);
            responded = true;
        }
    });

    res.on('error', function (err) {
        if (!responded) {
            callback(err);
            responded = true;
        }
    });

    res.on('response', function (r) {
        response = r;
        response.resume();
    });
};

