var request = require('request'),
    querystring = require('querystring'),
    http = require('http'),
    builtins = require('./lib/builtins'),
    async = require('async');

function SimpleRiak(options) {
    this.base_url = 'http://' + options.host + ':' + options.port;
    if (options.bucket) this.bucket = options.bucket;
}

function isJSON(data) {
    if (Buffer.isBuffer(data)) return false;
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

SimpleRiak.prototype.buildIndexMap = function (bucket, index, match) {
    var req = { json: true },
        ind = buildIndex(index, match);
    if (typeof match === 'object') {
        req.uri = this.buildURL('buckets', bucket, 'index', ind, encodeURIComponent(match.start), encodeURIComponent(match.end));
    } else {
        req.uri = this.buildURL('buckets', bucket, 'index', ind, encodeURIComponent(match));
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

function _intersection(arr1, arr2) {
    return arr1.filter(function (item) {
        return ~arr2.indexOf(item);
    });
}

SimpleRiak.prototype.getBuckets = function (callback) {
    request.get({ uri: this.buildURL('buckets'), qs: { buckets: true } }, respond(callback));
};

SimpleRiak.prototype.getKeys = function (options, callback) {
    var buffer = '';
    if (typeof callback === 'undefined') {
        callback = options;
        options = {};
    }

    function parseData(data) {
        try {
            data = JSON.parse(data.toString());
        } catch (e) {
            buffer += data.toString();
            data = parseData(buffer);
        } finally {
            return data;
        }
    }

    var bucket = options.bucket || this.bucket,
        req,
        keys,
        self = this;
    if (!bucket) return callback(new Error('No bucket specified'), { statusCode: 400 });
    if (options.index) {
        async.forEach(Object.getOwnPropertyNames(options.index), function (index, cb) {
            request.get(self.buildIndexMap(bucket, index, options.index[index]), function (err, res, body) {
                if (!Array.isArray(keys)) {
                    keys = body.keys;
                } else {
                    keys = _intersection(keys, body.keys);
                }
                cb();
            });
        }, function (err) {
            callback(null, { data: { keys: keys }, statusCode: 200 });
        });
    } else if (options.search) {
        if (typeof options.search === 'string') {
            req = { query: options.search };
        } else if (typeof options.search === 'object') {
            req = options.search;
        }
        this.search(req, function (err, reply) {
            if (err) return callback(err);
            callback(null, { keys: reply.data.response.docs.map(function (doc) { return doc.id; }), statusCode: 200 });
        });
    } else {
        var response = {},
            failed = false,
            tries = 0,
            stream = request.get({ uri: this.buildURL('buckets', bucket, 'keys'), qs: { keys: 'stream' } });
        stream.on('response', function (res) {
            if (res.statusCode !== 200) failed = true;
            response.headers = res.headers;
            response.statusCode = res.statusCode;
        });
        stream.on('data', function (body) {
            if (!failed) {
                body = parseData(body);
                if (!Array.isArray(keys)) {
                    keys = body.keys;
                } else {
                    keys = keys.concat(body.keys);
                }
            }
        });
        stream.on('end', function () {
            if (failed) {
                callback(new Error(http.STATUS_CODES[response.statusCode]), response);
            } else {
                response.data = { keys: keys };
                callback(null, response);
            }
        });
    }
};

SimpleRiak.prototype.search = function (options, callback) {
    var req = this.buildURL('solr');
    if (!options.index) options.index = options.bucket || this.bucket;
    if (!options.index || !options.query) return callback(new Error('Must specify index and query'), { statusCode: 400 });
    req += '/' + options.index + '/select?wt=json&q=' + options.query;
    if (options.df) req += '&df=' + options.df;
    if (options.q_op) req += '&q.op=' + options.q_op;
    if (options.start) req += '&start=' + options.start;
    if (options.rows) req += '&rows=' + options.rows;
    if (options.sort) req += '&sort=' + options.sort;
    if (options.filter) req += '&filter=' + options.filter;

    function filter(err, reply) {
        if (err) return callback(err);
        var response = { statusCode: reply.statusCode, headers: reply.headers, data: [] };
        response.headers.numFound = reply.data.response.numFound;
        response.headers.start = reply.data.response.start;
        response.headers.params = reply.data.responseHeader.params;
        response.data = reply.data.response.docs.map(function (doc) {
            return { key: doc.id, data: JSON.stringify(doc.fields) };
        });
        callback(null, response);
    }

    request.get({ uri: encodeURI(req) }, respond(filter));
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
    var bucket = options.bucket || this.bucket,
        self = this;
    if (!options.bucket) options.bucket = bucket;
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
    if (options.index) {
        this.getKeys(options, function (err, reply) {
            if (!reply.data.keys.length) return callback(null, { data: {}, statusCode: 404 });
            req.bucket = bucket;
            req.key = reply.data.keys;
            req.map = map;
            self.mapred(req, callback);
        });
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
            if (res && res.statusCode === 300) {
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
    if (options.meta) {
        for (var midx in options.meta) {
            req.headers['x-riak-meta-' + midx] = options.meta[midx];
        }
    }
    if (options.link) {
        var tags = [];
        var link;
        for (var lidx in options.link) {
            link = options.link[lidx];
            tags.push('</buckets/' + bucket + '/keys/' + link.key + '>; riaktag="' + link.tag + '"');
        }
        req.headers.link = tags.join(', ');
    }
    if (options.key) {
        req.method = 'put';
        req.uri = this.buildURL('buckets', bucket, 'keys', options.key);
        if (options.vclock) {
            req.headers['x-riak-vclock'] = options.vclock;
            if (callback) {
                return request(req, respond(callback));
            } else {
                return request(req);
            }
        } else {
            request.head({ uri: req.uri }, function (err, res, body) {
                if (res.headers['x-riak-vclock']) {
                    req.headers['x-riak-vclock'] = res.headers['x-riak-vclock'];
                }
            });
            if (callback) {
                return request(req, respond(callback));
            } else {
                return request(req);
            }
        }
    } else {
        req.method = 'post';
        req.uri = this.buildURL('buckets', bucket, 'keys');
        if (callback) {
            return request(req, respond(callback));
        } else {
            return request(req);
        }
    }
};

function parseLink(link) {
    if (!link) {
        return {};
    }
    var links = [];
    var link_strings = link.split(',');
    var link_parts;
    var key, tag;
    for (var lsidx in link_strings) {
        link_parts = link_strings[lsidx].split(';');
        key = link_parts[0].trim();
        tag = link_parts[1].trim();
        var tagp = tag.split('=');
        if (tagp[0].trim() == 'riaktag') {
            key = key.split('/');
            key = key[key.length - 1];
            key = key.substring(0, key.length - 1);
            key = decodeURIComponent(key);
            tag = tagp[1].substring(1, tagp[1].length - 1);
            links.push({ key: key, tag: tag });
        }
    }
    return links;
}


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
        for (var key in newIndex) {
            if (newIndex[key] === undefined) {
                delete ret[key];
            } else {
                ret[key] = newIndex[key];
            }
        }
        return ret;
    }

    var self = this;
    self.get({ bucket: bucket, key: options.key }, function (err, reply) {
        if (err) return callback(err, reply);
        var transform = { bucket: bucket, key: options.key, vclock: reply.headers['x-riak-vclock'], returnbody: true };
        if (options.link) {
            var oldlinks = reply.headers.link || '';
            oldlinks = parseLink(oldlinks);
            for (var lidx in options.link) {
                var l = options.link[lidx];
                if (l.remove) {
                    for (var olidx in oldlinks) {
                        var ol = oldlinks[olidx];
                        if (ol.key == l.key && ol.tag == l.tag) {
                            oldlinks.splice(olidx, 1);
                        }
                    }
                    options.link.splice(lidx, 1);
                }
            }
            var newlinks = oldlinks.concat(options.link);
            transform.link = newlinks;
        } else {
            transform.link = parseLink(reply.headers.link || '');
        }
        transform.meta = {};
        for (var hidx in reply.headers) {
            if (hidx.substring(0, 12) == 'x-riak-meta-') {
                transform.meta[hidx.substring(12, hidx.length)] = reply.headers[hidx];
            }
        }
        if (options.meta) {
            for (var midx in options.meta) {
                transform.meta[midx] = options.meta[midx];
            }
        }

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
        this.getKeys({ bucket: bucket, index: options.index }, function (err, reply) {
            if (!reply.data.keys.length) return callback(null, { data: [], statusCode: 200 });
            req.json.inputs = reply.data.keys.map(function (key) {
                return [bucket, key];
            });
            makeRequest(req);
        });
    } else if (options.search) {
        req.json.inputs.query = options.search;
        if (options.filter) req.json.inputs.filter = options.filter;
        makeRequest(req);
    } else if (options.key) {
        if (!Array.isArray(options.key)) {
            req.json.inputs = [[bucket, options.key]];
        } else {
            req.json.inputs = options.key.map(function (key) {
                return [bucket, key];
            });
        }
        makeRequest(req);
    } else if (options.link) {
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
        makeRequest(req);
    } else {
        req.json.inputs = bucket;
        makeRequest(req);
    }

    function addPhase(type, phases) {
        var phaselist = [];
        if (!Array.isArray(phases)) phases = [phases];
        phases.forEach(function (phase) { 
            var this_phase = {};
            this_phase[type] = {};
            this_phase[type].language = phase.language || 'javascript';
            if (typeof phase === 'string') {
                this_phase[type].name = phase;
            } else if (typeof phase === 'function') {
                this_phase[type].source = phase.toString();
            } else if (typeof phase === 'object') {
                if (phase.name) {
                    this_phase[type].name = phase.name;
                } else if (phase.source) {
                    this_phase[type].source = phase.source.toString();
                } else if (phase.bucket && phase.key) {
                    this_phase[type].bucket = phase.bucket;
                    this_phase[type].key = phase.key;
                } else if (phase.module && phase.function) {
                    this_phase[type].module = phase.module;
                    this_phase[type].function = phase.function;
                }
                if (phase.arg) this_phase[type].arg = phase.arg;
            }
            phaselist.push(this_phase);
        });
        return phaselist;
    }

    function makeRequest(req) {
        if (options.map) req.json.query = req.json.query.concat(addPhase('map', options.map));
        if (options.reduce) req.json.query = req.json.query.concat(addPhase('reduce', options.reduce));
        request.post(req, respond(callback));
    }
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
