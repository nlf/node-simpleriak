var async = require('async');
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

    console.log(path);
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

HTTP.prototype.setBucket = function (bucket, props, callback) {
    var result;

    client.put({ uri: this._getUrl('buckets', bucket, 'props'), headers: { 'Content-Type': 'application/json' } }, { props: props }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 204) {
            return callback(new Error('Unknown error'));
        }

        this.getBucket(bucket, callback);
    }.bind(this));
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

HTTP.prototype.get = function (bucket, key, params, callback) {
    var parsed, siblings, siblingParams;
    var result = {
        content: []
    };

    client.get({ uri: this._getUrl('buckets', bucket, 'keys', key, params) }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode === 404) {
            return callback(new Error('Not found'));
        }

        if (res.statusCode === 200) {
            parsed = utils.parseJson(body);

            if (parsed instanceof Error) {
                callback(parsed);
            } else {
                result.vclock = res.headers['x-riak-vclock'];
                result.content.push({
                    value: parsed,
                    type: res.headers['content-type'].replace(/;.*/, ''),
                    vtag: res.headers.etag
                });
                callback(null, result);
            }
        } else if (res.statusCode === 300) {
            // we have siblings
            // we throw away the first and last lines because the first
            // is the literal string 'Siblings:', and the last is an empty string
            siblings = body.toString().split('\n').slice(1, -1);
            result.vclock = res.headers['x-riak-vclock'];
            siblingParams = params;
            async.each(siblings, function (sibling, cb) {
                siblingParams.vtag = sibling;
                client.get({ uri: this._getUrl('buckets', bucket, 'keys', key, siblingParams) }, function (err, res, body) {
                    if (err) {
                        return cb(err);
                    }

                    if (res.statusCode !== 200) {
                        return cb(new Error('Unknown error'));
                    }

                    parsed = utils.parseJson(body);

                    if (parsed instanceof Error) {
                        return cb(parsed);
                    } else {
                        result.content.push({
                            value: parsed,
                            type: res.headers['content-type'].replace(/;.*/, ''),
                            vtag: sibling
                        });
                        cb();
                    }
                });
            }.bind(this), function (err) {
                if (err) {
                    return callback(err);
                }

                callback(null, result);
            });
        }
    }.bind(this));
};

HTTP.prototype.delete = function (bucket, key, params, callback) {
    client.delete({ uri: this._getUrl('buckets', bucket, 'keys', key, params) }, function (err, res, body) {
        if (err) {
            return callback(err);
        }

        if (res.statusCode !== 200 && res.statusCode !== 404) {
            return callback(new Error('Unknown error'));
        }

        callback(null, { key: key, status: 'deleted' });
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
