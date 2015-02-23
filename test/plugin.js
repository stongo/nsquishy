var Hapi = require('hapi');
var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('nsquishy', function () {

    it('registers as a plugin, but fails with no plugin options', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register(require('../'), function (err) {

            expect(err).to.exist();
            done();
        });
    });

    it('registers as a plugin, and works with nsqd host specified', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqdHost: '127.0.0.1',
            nsqdPort: 4050,
            topic: 'test',
            channel: 'test'
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('registers as a plugin, and works with nsqlookupd host specified', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqlookupd: '127.0.0.1:4161'
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('registers as a plugin, and works with etcd info specified', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            etcd: 'http://localhost:4001',
            etcdNsqlookupdKey: '/nsqlookupd-http'
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('adds a nsqReader and nsqWriter object to server.app when a topic and channel option are set', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqlookupd: '127.0.0.1:4161',
            topic: 'test',
            channel: 'test'
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            expect(server.app.nsqWriter).to.exist();
            expect(server.app.nsqReader).to.exist();
            done();
        });
    });

    it('adds a nsqWriter object to server.app when a topic and channel option are not set', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqlookupd: '127.0.0.1:4161',
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            expect(server.app.nsqWriter).to.exist();
            expect(server.app.nsqReader).to.not.exist();
            done();
        });
    });

    it('fails to load if etcd and nsqlookupd options both specified', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqlookupd: '127.0.0.1:4161',
            etcd: '127.0.0.1:4001'
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.exist();
            done();
        });
    });

    it('accepts nsqReader and nsqWriter options', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var options = {
            nsqlookupd: '127.0.0.1:4161',
            topic: 'test',
            channel: 'test',
            readerOptions: {
                maxInFlight: 2
            },
            writerOptions: {
                clientId: '123'
            }
        };
        server.register({register: require('../'), options: options }, function (err) {

            expect(err).to.not.exist();
            expect(server.app.nsqWriter).to.exist();
            expect(server.app.nsqReader).to.exist();
            done();
        });
    });
});