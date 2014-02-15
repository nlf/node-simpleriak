var client = require('./client');
var utils = require('../utils');
var querystring = require('querystring');

function HTTP(options) {
    this.host = options.host;
    this.port = options.port || 8098;
    this.url = 'http://' + this.host + ':' + this.port;
}

HTTP.prototype._getUrl = function () {
    var qs, path;
    var args = Array.prototype.slice.call(arguments);

    if (typeof args[args.length - 1] === 'object') {
        qs = querystring.stringify(args.pop());
    }

    path = ([this.url].concat(args)).join('/');
    if (qs) {
        path += '?' + qs;
    }

    return path;
};

HTTP.prototype.getBuckets = function (callback) {
    var result;

    client.get({ uri: this._getUrl('buckets', { buckets: true }) }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        if (!body) {
            return callback(null, []);
        }

        result = utils.parseJson(body);

        if (result instanceof Error) {
            return callback(result);
        } else {
            callback(null, result.buckets);
        }
    });
};

HTTP.prototype.getBucket = function (bucket, callback) {
    var result;

    client.get({ uri: this._getUrl('buckets', bucket, 'props') }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        result = utils.parseJson(body);

        if (result instanceof Error) {
            callback(result);
        } else {
            callback(null, result.props);
        }
    });
};

HTTP.prototype.getKeys = function (bucket, callback) {
    var result;

    client.get({ uri: this._getUrl('buckets', bucket, 'keys', { keys: true }) }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        result = utils.parseJson(body);

        if (result instanceof Error) {
            callback(result);
        } else {
            callback(null, result.keys);
        }
    });
};

HTTP.prototype.ping = function (callback) {
    client.get({ uri: this._getUrl('ping') }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        callback(null, { response: 'ok' });
    });
};

HTTP.prototype.status = function (callback) {
    var result;

    client.get({ uri: this._getUrl('stats') }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        result = utils.parseJson(body);

        if (result instanceof Error) {
            callback(result);
        } else {
            callback(null, result);
        }
    });
};

HTTP.prototype.resources = function (callback) {
    var result;

    client.get({ uri: this._getUrl(), headers: { Accept: 'application/json' } }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200) {
            return callback(new Error('Unknown error'));
        }

        result = utils.parseJson(body);

        if (result instanceof Error) {
            callback(result);
        } else {
            callback(null, result);
        }
    });
};

module.exports = HTTP;
