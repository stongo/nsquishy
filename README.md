# nsquishy

A wrapper of [nsqjs](https://github.com/dudleycarr/nsqjs) to simplify microservice workers using NSQ

## Plugin Options

The following options are available when registering the plugin

### nsqlookupd

* 'nsqlookupd' - string: nsqlookupd http api hostname in format `127.0.0.1:4161`.  Cannot be specified with `etcd` and `etcdNsqlookupKey`
* 'nsqlookupdHttpProtocol' - string: `http://` or `https://`

### nsqlookupd http api info stored in etcd

* 'etcd' - string: etcd http api hostname where nsqlookupd http api hostname is stored in format `http://127.0.0.1:4001`. Cannot be specified with `nsqlookupd`
* 'etcdNsqlookupKey' - string: specify etcd key where value of nsqlookupd http api hostname is stored, eg. `/nsqlookupd`. Cannot be specified with `nsqlookupd`

### nsqd only (if specified, does not attempt to use nsqlookupd)

* 'nsqdHost' - string: nsqd tcp hostname in format `127.0.0.1`
* 'nsqdPort' - number: nsqd tcp port in format `4150`

### other

* 'topic' - string: used to setup reader. Reader will not start without this
* 'channel' - string: used to setup reader. Reader will not start without this
* 'readerOptions' - object: as defined [here](https://github.com/dudleycarr/nsqjs)
* 'writerOptions' - object: as defined [here](https://github.com/dudleycarr/nsqjs)

## Writer

On registration, `server.app.nsqWriter` is assigned an initialized instance of a [nsqjs writer](https://github.com/dudleycarr/nsqjs)

### Methods:

* `init` - initializes connection to nsq. Callback fires on `ready` event. Automatically handles `err` and `ready` events

See nsqjs for full writer documentation

## Reader

On registration, `server.app.nsqReader` is assigned an initialized instance of a [nsqjs reader](https://github.com/dudleycarr/nsqjs)

### Methods:

* `init` - initializes connection to nsq. Callback fires on `nsqd_connected` event. Automatically handles `err` and `nsqd_connected` events

See nsqjs for full reader documentation

## Example

```
var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection();

server.register([
    {
        register: require('nsquishy'),
        options: {
            nsqlookupd: '127.0.0.1:4161'
            topic: 'test',
            channel: 'test'
        }
    }
], function (err) {
    if (err) {
        console.error('Failed to load a plugin:', err);
    }

    server.app.nsqReader.init(function (err, callback) {
        if (err) {
            throw err;
        }
        server.app.nsqReader.on('message', function(msg) {
            console.log('received message: %j', msg);
        });
    });

    server.app.nsqWriter.init(function (err, callback) {
        if (err) {
            throw err;
        }
        setInterval(function () {
            server.app.nsqWriter.publish('test', 'hello world');
        }, 30000);
    });
});

server.start(function () {
    console.log('Server running at:', server.info.uri);
});

```
