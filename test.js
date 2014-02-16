var backend = process.argv[2];
var util = require('util');
var client = require('./').createClient({ backend: backend });

client.get({ bucket: 'test', key: 'bacon', r: 2 }, function (err, reply) {
    console.log(err);
    console.log(util.inspect(reply, false, null, true));
    process.exit(0);
});
