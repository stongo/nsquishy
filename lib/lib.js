var nsq = require('nsqjs');
var Wreck = require('wreck');
var Utils = require('hoek');
var Schema = require('./schema');
var Bpromise = require('bluebird');

// Declare internals

var internals = {};

// Defaults

internals.defaults = {
    topic: null,
    channel: null,
    nsqlookupd: null,
    nsqlookupdHttpProtocol: 'http://',
    etcd: null,
    etcdNsqlookupdKey: null,
    nsqdHost: null,
    nsqdPort: null,
    readerOptions: {},
    writerOptions: {}
};

 // Helpers to start and log nsq reader and writers
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

    if (settings.nsqlookupd) {
        return cb(null, settings.nsqlookupd);
    }

    // If nsqlookupd registered in etcd
    else if (!settings.nsqlookupd && settings.etcd && settings.etcdNsqlookupdKey) {

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

            if (!body.node) {
                return cb('etcd key not set');
            }

            cb(null, body.node.value);
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

    return Wreck.get(url, function (err, res, payload) {

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

    var self = this;

    // Init reader and writer

    internals.initNsqlookupd = function(address, settings, cb) {

        var nsqOptions = {};

        if (settings.topic && settings.channel) {
            delete settings.readerOptions.nsqdTCPAddresses;
            settings.readerOptions.lookupdHTTPAddresses = address;
            nsqOptions.reader = [settings.topic, settings.channel, settings.readerOptions];
        }
        else {
            console.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
        }

        return internals.getNsqd(address, settings, function (err, producer) {

            if (err) {
                cb(err);
            }

            if (!producer) {
                cb(new Error('no nsqd instance found'));
            }

            nsqOptions.writer = [producer.broadcast_address, producer.tcp_port, settings.writerOptions];

            cb(null, nsqOptions);
        });
    };

    return Schema.validate(options, function (err) {

        if (err) {
            throw err;
        }

        var settings = Utils.applyToDefaults(internals.defaults, options);

        // Use nsqd host if specified
        if (settings.nsqdHost && settings.nsqdPort) {

            if (settings.topic && settings.channel) {
                delete settings.readerOptions.lookupdHTTPAddresses;
                settings.readerOptions.nsqdTCPAddresses = [settings.nsqdHost, settings.nsqdPort].join(':');
                return self.nsqReader = new nsq.Reader(settings.topic, settings.channel, settings.readerOptions);
            }
            else {
                console.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
            }
            self.nsqWriter = new nsq.Writer(settings.nsqdHost, settings.nsqdPort, settings.writerOptions);

            return self;
        }

        else if (settings.nsqlookupd) {
            internals.initNsqlookupd(settings.nsqlookupd, settings, function (err, nsqOptions) {
                if (err) {
                    throw err;
                }
            });
        }

        //Fetch nsqlookupd host
        else {
            internals.getNsqlookupd(settings, function (err, address) {

                if (err) {
                    throw err;
                }

                internals.initNsqlookupd(address, settings, function (err, nsqOptions) {
                    if (err) {
                        throw err;
                    }
                });
            });
        }
    });
};

module.exports.squish = function (options) {
    return new Nsquishy(options);
};