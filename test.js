var backend = process.argv[2];
var client = require('./').createClient({ backend: backend });

client.setBucket({ bucket: 'test', allow_mult: true }, function () {
    console.log(arguments);
    process.exit(0);
});
