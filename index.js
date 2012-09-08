var request = require('request'),
    querystring = require('querystring'),
    http = require('http');

function SimpleRiak(options) {
    this.base_url = 'http://' + options.host + ':' + options.port;
    if (options.bucket) this.bucket = options.bucket;
}

function isJSON(data) {
    if (typeof data === 'object') return true;
    try {
        data = JSON.parse(data);
        return true;
    } catch (e) {
        return false;
    }
}

function toJSON(data) {
    if (typeof data === 'object') return data;
    try {
        data = JSON.parse(data);
        return data;
    } catch (e) {
        return data;
    }
}

SimpleRiak.prototype.buildURL = function () {
    return ([this.base_url].concat(Array.prototype.slice.call(arguments, 0))).join('/');
};

function respond(callback) {
    return function (err, res, body) {
        if (err) return callback(err);
        if (res.statusCode >= 400) return callback(new Error(http.STATUS_CODES[res.statusCode]));
        body = toJSON(body);
        var response = { data: body, headers: res.headers, statusCode: res.statusCode };
        if (res.headers.location) {
            response.key = res.headers.location.slice(res.headers.location.lastIndexOf('/') + 1);
        }
        callback(null, response);
    };
}

exports.createClient = function (options) {
    options.host = options.host || 'localhost';
    options.port = options.port || 8098;
    return new SimpleRiak(options);
};

SimpleRiak.prototype.getBuckets = function (callback) {
    request.get({ uri: this.buildURL('buckets'), qs: { buckets: true } }, respond(callback));
};

SimpleRiak.prototype.getKeys = function (options, callback) {
    if (typeof callback === 'undefined') {
        callback = options;
        options = {};
    }
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    if (options.index) {
        var index,
            req = {};
        if (options.key) {
            if (typeof options.key === 'number') {
                index = options.index + '_int';
            } else {
                index = options.index + '_bin';
            }
            req.uri = this.buildURL('buckets', bucket, 'index', index, options.key);
        } else if (options.start && options.end) {
            if (typeof options.start === 'number' && typeof options.end === 'number') {
                index = options.index + '_int';
            } else {
                index = options.index + '_bin';
            }
            req.uri = this.buildURL('buckets', bucket, 'index', index, options.start, options.end);
        }
        request.get(req, respond(callback));
    } else {
        request.get({ uri: this.buildURL('buckets', bucket, 'keys'), qs: { keys: true } }, respond(callback));
    }
};

SimpleRiak.prototype.getBucket = function (options, callback) {
    if (typeof callback === 'undefined') {
        callback = options;
        options = {};
    }
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    request.get({ uri: this.buildURL('buckets', bucket, 'props') }, respond(callback));
};

SimpleRiak.prototype.setBucket = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    delete options.bucket;

    request.put({ uri: this.buildURL('buckets', bucket, 'props'), json: options }, respond(callback));
};

SimpleRiak.prototype.get = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    var req = {};
    if (options.index) {
        var opts = {};
        opts = { bucket: bucket, index: options.index, map: 'Riak.mapValuesJson' };
        if (options.start && options.end) {
            opts.start = options.start;
            opts.end = options.end;
        } else {
            opts.key = options.key;
        }
        this.mapred(opts, callback);
    } else {
        req.uri = this.buildURL('buckets', bucket, 'keys', options.key);
        request.get(req, respond(callback));
    }
};

SimpleRiak.prototype.put = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    var req = { headers: {} };
    if (options.key) {
        req.method = 'put';
        req.uri = this.buildURL('buckets', bucket, 'keys', options.key);
    } else {
        req.method = 'post';
        req.uri = this.buildURL('buckets', bucket, 'keys');
    }
    if (isJSON(options.data)) {
        req.json = toJSON(options.data);
    } else {
        req.body = options.data;
        if (options.contentType) {
            req.headers['content-type'] = options.contentType;
        } else {
            req.headers['content-type'] = 'text/plain';
        }
    }
    if (options.index) {
        Object.keys(options.index).forEach(function (ind) {
            var index;
            if (typeof ind === 'number') {
                index = ind + '_int';
            } else {
                index = ind + '_bin';
            }
            req.headers['x-riak-index-' + index] = options.index[ind];
        });
    }
    request(req, respond(callback));
};

SimpleRiak.prototype.del = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    request.del({ uri: this.buildURL('buckets', bucket, 'keys', options.key) }, respond(callback));
};

SimpleRiak.prototype.mapred = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'));
    var req = {};
    req.uri = this.buildURL('mapred');
    req.json = { inputs: { bucket: bucket } };
    if (options.index) {
        if (options.key) {
            if (typeof options.key === 'number') {
                req.json.inputs.index = options.index + '_int';
            } else {
                req.json.inputs.index = options.index + '_bin';
            }
            req.json.inputs.key = options.key;
        } else if (options.start && options.end) {
            if (typeof options.start === 'number' && typeof options.end === 'number') {
                req.json.inputs.index = options.index + '_int';
            } else {
                req.json.inputs.index = options.index + '_bin';
            }
            req.json.inputs.start = options.start;
            req.json.inputs.end = options.end;
        }
    } else if (options.key) {
        req.json.inputs.key = options.key;
    } else {
        req.json.inputs = bucket;
    }

    function addPhase(type, phase) {
        var this_phase = {};
        this_phase[type] = { language: 'javascript' };
        if (typeof phase === 'string') {
            this_phase[type].name = phase;
        } else if (typeof phase === 'function') {
            this_phase[type].source = phase.toString();
        } else if (typeof phase === 'object') {
            if (phase.name) {
                this_phase[type].name = phase.name;
            } else if (phase.source) {
                this_phase[type].source = phase.source.toString();
            }
            if (phase.arg) this_phase[type].arg = phase.arg;
        }
        return this_phase;
    }

    req.json.query = [];
    if (options.map) req.json.query.push(addPhase('map', options.map));
    if (options.reduce) req.json.query.push(addPhase('reduce', options.reduce));
    if (options.link) {
        var phase = { link: { } };
        phase.link.bucket = options.link.bucket || this.bucket;
        phase.link.tag = options.link.tag || '_';
        phase.link.keep = options.link.keep || false;
        req.json.query.push(phase);
    }
    request.post(req, respond(callback));
};

SimpleRiak.prototype.ping = function (callback) {
    request.get(this.buildURL('ping'), respond(callback));
};

SimpleRiak.prototype.stats = function (callback) {
    request.get({ uri: this.buildURL('stats'), headers: { accept: 'application/json' } }, respond(callback));
};

SimpleRiak.prototype.resources = function (callback) {
    request.get({ uri: this.buildURL(), headers: { accept: 'application/json' } }, respond(callback));
};
