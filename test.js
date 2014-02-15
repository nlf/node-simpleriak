var backend = process.argv[2];
var client = require('./').createClient({ backend: backend });

client.resources(function () {
    console.log(arguments);
    process.exit(0);
});
