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

function mapToMap(v, keyData, arg) {
    var ret = [],
        indexes = v.values[0].metadata.index,
        match = true;

    for (var i = 0; i < arg.length; i++) {
        var ind = arg[i][0],
            val = arg[i][1];
        if (!indexes.hasOwnProperty(ind)) {
            match = false;
        } else {
            if (typeof val === 'object') {
                if (indexes[ind] < val.start || indexes[ind] > val.end) match = false;
            } else {
                if (indexes[ind] !== val) match = false;
            }
        }
    }
    if (match) ret.push([v.bucket, v.key]);
    return ret;
}

function mapIndexes(v, keyData, arg) {
    var ret = [],
        indexes = v.values[0].metadata.index,
        match = true;

    for (var i = 0; i < arg.length; i++) {
        var ind = arg[i][0],
            val = arg[i][1];
        if (!indexes.hasOwnProperty(ind)) {
            match = false;
        } else {
            if (typeof val === 'object') {
                if (indexes[ind] < val.start || indexes[ind] > val.end) match = false;
            } else {
                if (indexes[ind] !== val) match = false;
            }
        }
    }
    if (match) ret.push(v);
    return ret;
}

SimpleRiak.prototype.buildIndexMap = function (bucket, index) {
    var req = {};
    if ((!Array.isArray(index) || index.length === 1)) {
        if (Array.isArray(index)) index = index[0];
        var ind = Object.keys(index)[0],
            val = index[ind];
        ind = buildIndex(ind, val);
        if (typeof val === 'object') {
            req.uri = this.buildURL('buckets', bucket, 'index', ind, val.start, val.end);
        } else {
            req.uri = this.buildURL('buckets', bucket, 'index', ind, val);
        }
    } else {
        var first = index.shift();
        req.bucket = bucket;
        req.index = first;
        req.map = { source: mapIndexes };

        index = index.map(function (index) {
            var key = Object.keys(index)[0],
                val = index[key],
                temp;

            key = buildIndex(key, val);
            temp = [key, val];
            return temp;
        });
        req.map.arg = index;
    }
    return req;
};

function buildIndex(index, value) {
    var suffix;
    if (typeof value === 'object') {
        suffix = (typeof value.start === 'number' && typeof value.end === 'number') ? '_int' : '_bin';
    } else {
        suffix = typeof value === 'number' ? '_int' : '_bin';
    }
    return index + suffix;
}

SimpleRiak.prototype.buildURL = function () {
    return ([this.base_url].concat(Array.prototype.slice.call(arguments, 0))).join('/');
};

function respond(callback) {
    return function (err, res, body) {
        var response;
        if (isJSON(body)) body = toJSON(body);
        if (res) {
            response = { data: body, headers: res.headers, statusCode: res.statusCode };
        } else {
            response = { data: err.message, headers: null, statusCode: 500 };
        }
        if (err) return callback(err, response);
        if (res.statusCode >= 400) {
            return callback(new Error(http.STATUS_CODES[res.statusCode]), response);
        }
        if (res.headers.location) {
            response.key = res.headers.location.slice(res.headers.location.lastIndexOf('/') + 1);
        }
        if (typeof callback === 'function') callback(null, response);
    };
}

exports.createClient = function (options) {
    options = options || {};
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

    function map(v) {
        if (v.values[0].metadata['X-Riak-Deleted']) return [];
        return [v.key];
    }

    function reduce(v) {
        return { keys: v };
    }

    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    if (options.index) {
        var req = this.buildIndexMap(bucket, options.index);
        if (!Array.isArray(options.index)) {
            request.get(req, respond(callback));
        } else {
            req.reduce = { source: reduce };
            this.mapred(req, callback);
        }
    } else if (options.search) {
        var req = { bucket: bucket, search: options.search, map: map, reduce: [ 'Riak.filterNotFound', reduce ] };
        if (options.filter) req.filter = options.filter;
        this.mapred(req, callback);
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
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    request.get({ uri: this.buildURL('buckets', bucket, 'props') }, respond(callback));
};

SimpleRiak.prototype.setBucket = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    delete options.bucket;

    request.put({ uri: this.buildURL('buckets', bucket, 'props'), json: { props: options } }, respond(callback));
};

SimpleRiak.prototype.get = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    function map(v) {
        return [{key: v.key, data: v.values[0].data}];
    }
    function reduce(v) {
        v = v.map(function (item) {
            return {key: item.key, data: item.values[0].data};
        });
        return v;
    }
    var req = {};
    if (options.index && Array.isArray(options.index) && options.index.length > 1) {
        req = this.buildIndexMap(bucket, options.index, true);
        req.reduce = reduce;
        this.mapred(req, callback);
    } else if (options.index && (!Array.isArray(options.index) || options.index.length === 1)) {
        if (Array.isArray(options.index)) options.index = options.index[0];
        req.bucket = bucket;
        req.index = options.index;
        req.map = map;
        this.mapred(req, callback);
    } else if (options.search) {
        req.bucket = bucket;
        req.search = options.search;
        if (options.filter) req.filter = options.filter;
        req.map = map;
        this.mapred(req, callback);
    } else {
        req.uri = this.buildURL('buckets', bucket, 'keys', options.key);
        request.get(req, function (err, res, body) {
            //this is ugly and should be handled better
            if (res.statusCode === 300) {
                body = body.split('\n');
                var new_req = { uri: req.uri + '?vtag=' + body[2] };
                request.get(new_req, respond(callback));
            } else {
                respond(callback)(err, res, body);
            }
        });
    }
};

SimpleRiak.prototype.put = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    var req = { headers: {} };
    if (options.returnbody) req.qs = { returnbody: true };
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
            var index = buildIndex(ind, options.index[ind]);
            req.headers['x-riak-index-' + index] = options.index[ind];
        });
    }
    if (options.link) {
        var tag = '';
        Object.keys(options.link).forEach(function (link) {
            if (tag) tag += ', ';
            tag += '<' + options.link[link] + '>; riaktag="' + link + '"';
        });
        req.headers['link'] = tag;
    }
    if (options.key) {
        req.method = 'put';
        req.uri = this.buildURL('buckets', bucket, 'keys', options.key);
        if (options.vclock) {
            req.headers['x-riak-vclock'] = options.vclock;
            request(req, respond(callback));
        } else {
            request.head({ uri: req.uri }, function (err, res, body) {
                if (res.headers['x-riak-vclock']) {
                    req.headers['x-riak-vclock'] = res.headers['x-riak-vclock'];
                }
                request(req, respond(callback));
            });
        }
    } else {
        req.method = 'post';
        req.uri = this.buildURL('buckets', bucket, 'keys');
        request(req, respond(callback));
    }
};

function parseIndex(headers) {
    var indexes = {};
    Object.keys(headers).forEach(function (header) {
        var match = header.match(/^x-riak-index-(\w+)/);
        if (match) {
            var type = match[1].match(/_(?!.*_)(\w+)?$/)[1],
                index = match[1].slice(0, match[1].length - type.length - 1),
                val = headers[header];
            indexes[index] = type === 'bin' ? val : parseInt(val, 10);
        }
    });
    return indexes;
}

SimpleRiak.prototype.getIndexes = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    if (!options.key) return callback(new Error('Must specify key'), { statusCode: 400 });

    var req = { uri: this.buildURL('buckets', bucket, 'keys', options.key) };
    request.head(req, function (err, res, body) {
        if (err) return callback(err, { statusCode: res.statusCode });
        if (res.statusCode >= 400) return callback(new Error(http.STATUS_CODES[res.statusCode]), { body: body, headers: res.headers, statusCode: res.statusCode }); 
        var indexes = parseIndex(res.headers);
        callback(null, { headers: res.headers, statusCode: res.statusCode, data: indexes });
    });    
};

SimpleRiak.prototype.modify = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    if (!options.key) return callback(new Error('Must specify key'), { statusCode: 400 });

    function mergeIndexes(oldIndex, newIndex) {
        var ret = oldIndex;
        Object.keys(newIndex).forEach(function (key) {
            if (newIndex[key] === undefined) {
                delete ret[key];
            } else {
                ret[key] = newIndex[key];
            }
        });
        return ret;
    }

    var self = this;
    self.get({ bucket: bucket, key: options.key }, function (err, reply) {
        if (err) return callback(err, reply);
        var transform = { bucket: bucket, key: options.key, vclock: reply.headers['x-riak-vclock'], returnbody: true };
        transform.index = parseIndex(reply.headers);
        if (options.index) transform.index = mergeIndexes(transform.index, options.index);
        if (isJSON(reply.data)) reply.data = toJSON(reply.data);
        if (typeof options.transform === 'function') {
            transform.data = options.transform(reply.data);
        } else {
            transform.data = reply.data;
        }
        self.put(transform, callback);
    });
};

SimpleRiak.prototype.del = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    request.del({ uri: this.buildURL('buckets', bucket, 'keys', options.key) }, respond(callback));
};

SimpleRiak.prototype.mapred = function (options, callback) {
    var bucket = options.bucket || this.bucket;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    var req = {};
    req.uri = this.buildURL('mapred');
    req.json = { inputs: { bucket: bucket }, query: [] };
    if (options.index) {
        if (!Array.isArray(options.index)) options.index = [options.index];
        var first = options.index.shift(),
            key = Object.keys(first)[0],
            val = first[key];

        req.json.inputs.index = buildIndex(key, val);
        if (typeof val === 'object') {
            req.json.inputs.start = val.start;
            req.json.inputs.end = val.end;
        } else {
            req.json.inputs.key = val;
        }
    } else if (options.search) {
        req.json.inputs.query = options.search;
        if (options.filter) req.json.inputs.filter = options.filter;
    } else if (options.key) {
        if (!Array.isArray(options.key)) {
            req.json.inputs = [[bucket, options.key]];
        } else {
            req.json.inputs = options.key.map(function (key) {
                return [bucket, key];
            });
        }
    } else {
        req.json.inputs = bucket;
    }

    function addPhase(type, phases) {
        var phaselist = [];
        if (!Array.isArray(phases)) phases = [phases];
        phases.forEach(function (phase) { 
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
            };
            phaselist.push(this_phase);
        });
        return phaselist;
    }

    if (options.link) {
        if (!Array.isArray(options.link)) options.link = [options.link];
        var links = [],
            phase;
        options.link.forEach(function (link) {
            phase = { link: { } };
            phase.link.bucket = link.bucket || this.bucket;
            phase.link.tag = link.tag || '_';
            phase.link.keep = link.keep || false;
            links.push(phase);
        });
        req.json.query = req.json.query.concat(links);
    }

    if (options.index && options.index.length > 0) {
        var index = options.index.map(function (index) {
            var key = Object.keys(index)[0],
                val = index[key],
                temp;

            key = buildIndex(key, val);
            temp = [key, val];
            return temp;
        });

        req.json.query = req.json.query.concat(addPhase('map', { source: mapToMap, arg: index }));
    }

    if (options.map) req.json.query = req.json.query.concat(addPhase('map', options.map));
    if (options.reduce) req.json.query = req.json.query.concat(addPhase('reduce', options.reduce));
    //console.log(require('util').inspect(req, false, null, true));
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
