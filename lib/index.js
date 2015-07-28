var nsq = require('nsqjs');
var Wreck = require('wreck');
var Utils = require('hoek');
var Schema = require('./schema');

// Declare internals

var internals = {};

// Defaults

internals.defaults = {
    topic: null,
    channel: null,
    nsqlookupd: [],
    nsqlookupdHttpProtocol: 'http://',
    etcd: null,
    etcdNsqlookupdKey: null,
    nsqdHost: null,
    nsqdPort: null,
    readerOptions: {},
    writerOptions: {}
};

 // Helpers to start and log nsq reader and writer

nsq.Reader.prototype.init = function (callback) {

    this.connect();

    this.on('nsqd_connected', function _nsqConect () {
        console.log(['nsq', 'startup'], 'nsq reader connection established');
        callback(null);
    });

    this.on('error', function _nsqError (err) {
        throw err;
    });

    this.on('nsqd_closed', function _nsqClosed () {
        throw new Error('nsqd closed connection');
    });
};

nsq.Reader.prototype.toucher = function (msg, duration, cycles) {

    var self = this;

    if (!msg) {
        throw new Error('you must include a valid nsqjs msg object');
    }

    this.duration = duration || 30000;
    this.cycles = cycles || 10;
    this.timer = {};

    var i = 0;

    this.timer[msg.id] = setInterval(function () {
        if (i < self.cycles) {
            msg.touch();
            i++;
        }
        else {
            clearInterval(self.timer[msg.id]);
        }
    }, self.duration);
};

nsq.Reader.prototype.stopTouching = function (msg) {

    var self = this;
    clearInterval(self.timer[msg.id]);
};

nsq.Writer.prototype.init = function (callback) {

    this.connect();

    this.on('ready', function _nsqReady () {
        console.log(['nsq', 'startup'], 'nsq writer connection established');
        callback(null);
    });

    this.on('error', function _nsqWriterError (err) {
        throw err;
    });

    this.on('closed', function _nsqWriterClosed () {
        throw new Error('nsqd closed connection');
    });
};

internals.getNsqlookupd = function (settings, cb) {

    // If nsqlookupd registered in etcd
    if (settings.nsqlookupd && settings.nsqlookupd.length === 0 && settings.etcd && settings.etcdNsqlookupdKey) {

        this._url = [settings.etcd, '/v2/keys', settings.etcdNsqlookupdKey].join('');

        Wreck.get(this._url, function (err, res, payload) {

            if (err) {
                return cb(err);
            }

            var body;
            try {
                body = JSON.parse(payload);
            }
            catch (e) {
                return cb('error parsing etcd payload: ' + e);
            }

            if (!body.node.nodes || body.node.nodes.length === 0) {
                return cb('etcd key not set');
            }

            var addresses = body.node.nodes.map(function _mapCallback (node) {
                return node.value;
            });

            cb(null, addresses);
        });
    }
    else {

        return cb('cannot determine nsqlookupd location');
    }
};

internals.getNsqd = function (nsqlookupd, settings, cb) {

    // Fetch random nsqd if not specified in setings

    if (!nsqlookupd) {
        throw new Error('nsqlookupd needed to lookup nsqd');
    }

    var url = internals._urlNsqloolkupdAll = [settings.nsqlookupdHttpProtocol, nsqlookupd, '/nodes'].join('');

    if (settings.topic) {
        url = [settings.nsqlookupdHttpProtocol, nsqlookupd, '/lookup?topic=', settings.topic].join('');
    }

    Wreck.get(url, function (err, res, payload) {

        if (err) {
            return cb(err);
        }

        var body;
        try {
            body = JSON.parse(payload);
        }
        catch (e) {
            return cb('error parsing nsqlookupd payload: ' + e);
        }

        // If topic specific nsqd search fails, get a list of all nsqd producers
        if (settings.topic && !body.data || body.data.producers.length === 0) {
            Wreck.get(internals._urlNsqloolkupdAll, function (err, res, payload) {

                if (err) {
                    return cb(err);
                }
                var body;
                try {
                    body = JSON.parse(payload);
                }
                catch (e) {
                    return cb('error parsing nsqlookupd payload: ' + e);
                }

                return cb(null, body.data.producers[Math.floor(Math.random()*body.data.producers.length)]);
            });
        }
        else {
            // return a random nsqd
            return cb(null, body.data.producers[Math.floor(Math.random()*body.data.producers.length)]);
        }
    });
};

function Nsquishy (options) {

    if (!options) {
        throw new Error('Nsquishy must be instantiated with a valid "options" object');
    }

    var self = this;

    // Init reader and writer

    return Schema.validate(options, function (err) {

        if (err) {
            throw err;
        }

        self.settings = Utils.applyToDefaults(internals.defaults, options);
    });
}

Nsquishy.prototype.squish = function (next) {

    var settings = this.settings;
    var self = this;

    internals.initNsqlookupd = function(addresses, settings, cb) {

        var nsqOptions = {};

        if (settings.topic && settings.channel) {
            delete settings.readerOptions.nsqdTCPAddresses;
            settings.readerOptions.lookupdHTTPAddresses = addresses;
            self.nsqReader = new nsq.Writer(settings.topic, settings.channel, settings.readerOptions);
        }
        else {
            console.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
        }

        var address = addresses[Math.floor(Math.random() * addresses.length)];

        return internals.getNsqd(address, settings, function (err, producer) {

            console.log(['nsq', 'writer'], 'creating writer for: ', producer);

            if (err) {
                return cb(err);
            }

            if (!producer) {
                return cb(new Error('no nsqd instance found'));
            }

            self.nsqWriter = new nsq.Writer(producer.broadcast_address, producer.tcp_port, settings.writerOptions);

            return cb(null);
        });
    };

    // if setings.nsqlookups specified as string, convert to array
    if (settings.nsqlookupd && !Array.isArray(settings.nsqlookupd) && settings.nsqlookupd.length !== 0) {
        settings.nsqlookupd = [settings.nsqlookupd];
    }

    // Use nsqd host if specified
    if (settings.nsqdHost && settings.nsqdPort) {

        if (settings.topic && settings.channel) {
            delete settings.readerOptions.lookupdHTTPAddresses;
            settings.readerOptions.nsqdTCPAddresses = [settings.nsqdHost, settings.nsqdPort].join(':');
            self.nsqReader = new nsq.Reader(settings.topic, settings.channel, settings.readerOptions);
        }
        else {
            console.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
        }
        self.nsqWriter = new nsq.Writer(settings.nsqdHost, settings.nsqdPort, settings.writerOptions);

        next();
    }

    // Use provided nsqdlookupd setting
    else if (settings.nsqlookupd && settings.nsqlookupd.length !== 0) {
        internals.initNsqlookupd(settings.nsqlookupd, settings, function (err) {

            if (err) {
                return next(err);
            }
            next();
        });
    }

    //Fetch nsqlookupd host from etcd
    else {
        internals.getNsqlookupd(settings, function (err, address) {

            if (err) {
                return next(err);
            }

            internals.initNsqlookupd(address, settings, function (err) {

                if (err) {
                    next(err);
                }
                next();
            });
        });
    }
};

module.exports = Nsquishy;