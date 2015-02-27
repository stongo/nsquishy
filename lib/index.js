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
    nsqlookupd: null,
    nsqlookupdHttpProtocol: 'http://',
    etcd: null,
    etcdNsqlookupdKey: null,
    nsqdHost: null,
    nsqdPort: null,
    readerOptions: {},
    writerOptions: {}
};

exports.register = function (server, options, next) {

    Schema.validate(options, function (err) {

        if (err) {
            return next(err);
        }

        var settings = Utils.applyToDefaults(internals.defaults, options);

         // Helpers to start and log nsq reader and writers
        nsq.Reader.prototype.init = function (callback) {

            this.connect();

            this.on('nsqd_connected', function _nsqConect () {
                server.log(['nsq', 'startup'], 'nsq reader connection established');
                callback(null);
            });

            this.on('error', function _nsqError (err) {
                return next(err);
            });

            this.on('nsqd_closed', function _nsqClosed () {
                return next('nsqd closed connection');
            });
        };

        nsq.Writer.prototype.init = function (callback) {

            this.connect();

            this.on('ready', function _nsqReady () {
                server.log(['nsq', 'startup'], 'nsq writer connection established');
                callback(null);
            });

            this.on('error', function _nsqWriterError (err) {
                return next(err);
            });

            this.on('closed', function _nsqWriterClosed () {
                return next('nsqd closed connection');
            });
        };

        // Returns location of nsqlookupd
        internals.getNsqlookupd = function (callback) {

            if (settings.nsqlookupd) {
                return callback(null, settings.nsqlookupd);
            }

            // If nsqlookupd registered in etcd
            else if (!settings.nsqlookupd && settings.etcd && settings.etcdNsqlookupdKey) {

                this._url = [settings.etcd, '/v2/keys', settings.etcdNsqlookupdKey].join('');

                Wreck.get(this._url, function (err, res, payload) {

                    if (err) {
                        return callback(err);
                    }

                    var body;
                    try {
                        body = JSON.parse(payload);
                    }
                    catch (e) {
                        return callback('error parsing etcd payload: ' + e);
                    }

                    if (!body.node) {
                        return callback('etcd key not set');
                    }

                    callback(null, body.node.value);
                });
            }
            else {

                return callback('cannot determine nsqlookupd location');
            }
        };

        internals.getNsqd = function (nsqlookupd, callback) {

            // Fetch random nsqd if not specified in setings

            if (!nsqlookupd) {
                return next('nsqlookupd needed to lookup nsqd');
            }

            var url = internals._urlNsqloolkupdAll = [settings.nsqlookupdHttpProtocol, nsqlookupd, '/nodes'].join('');

            if (settings.topic) {
                url = [settings.nsqlookupdHttpProtocol, nsqlookupd, '/lookup?topic=', settings.topic].join('');
            }

            Wreck.get(url, function (err, res, payload) {

                if (err) {
                    return callback(err);
                }

                var body;
                try {
                    body = JSON.parse(payload);
                }
                catch (e) {
                    return callback('error parsing nsqlookupd payload: ' + e);
                }

                // If topic specific nsqd search fails, get a list of all nsqd producers
                if (settings.topic && !body.data) {

                    Wreck.get(internals._urlNsqloolkupdAll, function (err, res, payload) {

                        if (err) {
                            return callback(err);
                        }

                        var body;
                        try {
                            body = JSON.parse(payload);
                        }
                        catch (e) {
                            return callback('error parsing nsqlookupd payload: ' + e);
                        }

                        callback(null, body.data.producers[Math.floor(Math.random()*body.data.producers.length)]);
                    });
                }
                else {
                    // return a random nsqd
                    callback(null, body.data.producers[Math.floor(Math.random()*body.data.producers.length)]);
                }
            });
        };

        // Init reader and writer

        internals.initNsqlookupd = function(address) {

            if (settings.topic && settings.channel) {
                delete settings.readerOptions.nsqdTCPAddresses;
                settings.readerOptions.lookupdHTTPAddresses = address;
                server.app.nsqReader = new nsq.Reader(settings.topic, settings.channel, settings.readerOptions);
            }
            else {
                server.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
            }

            internals.getNsqd(address, function (err, producer) {

                if (err) {
                    return next(err);
                }

                server.app.nsqWriter = new nsq.Writer(producer.broadcast_address, producer.tcp_port, settings.writerOptions);

                next();
            });
        };

        // Use nsqd host if specified
        if (settings.nsqdHost && settings.nsqdPort) {

            if (settings.topic && settings.channel) {
                delete settings.readerOptions.lookupdHTTPAddresses;
                settings.readerOptions.nsqdTCPAddresses = [settings.nsqdHost, settings.nsqdPort].join(':');
                server.app.nsqReader = new nsq.Reader(settings.topic, settings.channel, settings.readerOptions);
            }
            else {
                server.log(['nsq', 'warn'], 'nsq reader not loaded - please set topic and channel to load reader');
            }
            server.app.nsqWriter = new nsq.Writer(settings.nsqdHost, settings.nsqdPort, settings.writerOptions);

            next();
        }

        else if (settings.nsqlookupd) {
            internals.initNsqlookupd(settings.nsqlookupd);
        }

        //Fetch nsqlookupd host
        else {
            internals.getNsqlookupd(function (err, address) {

                if (err) {
                    return next(err);
                }

                internals.initNsqlookupd(address);
            });
        }
    });
};

exports.register.attributes = {
    pkg: require('../package.json')
};
