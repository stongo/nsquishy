var Nsquishy = require('./lib');

exports.register = function (server, options, next) {

    server.app.nsquishy = Nsquishy.squish(options);
    console.log('server.app.nsquishy: %j', Object.keys(server.app.nsquishy));
    next();
};

exports.register.attributes = {
    pkg: require('../package.json')
};
