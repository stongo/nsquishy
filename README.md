# nsquishy

A wrapper of **[nsqjs](https://github.com/dudleycarr/nsqjs)** to simplify microservice workers using NSQ

## Example

```
var Nsquishy = require('nsquishy');

// specify nsqlookupd host yourself
var options = {
    nsqlookupd: '127.0.0.1:4161',
    topic: 'test',
    channel: 'test'
}

// if nsqlookupd is stored in etcd - like in a distributed system like CoreOS
var optionsEtcd = {
    etcd: 'http://127.0.0.1:4001',
    etcdNsqlookupKey: '/nsqlookupd-http',
    topic: 'test',
    channel: 'test'
}

// just using an nsqd instance
var optionsNsqd = {
    nsqdHost: '127.0.0.1',
    nsqdPort: '4150'
    topic: 'test',
    channel: 'test'
}

// if you don't specify a channel, only writer is available
var optionsNoTopic = {
    nsqdHost: '127.0.0.1',
    nsqdPort: '4150'
}

var nsquishy = new Nsquishy(options)
nsquishy.squish(function (err) {
    if (err) {
      throw err;
    }
    nsquishy.nsqReader.init(function (err, callback) {
        if (err) {
            throw err;
        }
        nsquishy.nsqReader.on('message', function(msg) {
            console.log('received message: %j', msg);
        });
    });

    nsquishy.nsqWriter.init(function (err, callback) {
        if (err) {
            throw err;
        }
        setInterval(function () {
            nsquishy.nsqWriter.publish('test', 'hello world');
        }, 30000);
    });
});

```

## Options

The following options are available when instantiating Nsquishy

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

On calling `nsquishy.squish()`, `nsquishy.nsqWriter` is assigned an initialized instance of a **[nsqjs writer](https://github.com/dudleycarr/nsqjs)**

### Methods:

* `init` - initializes connection to nsq. Callback fires on `ready` event. Automatically handles `err` and `ready` events

See nsqjs for full writer documentation

## Reader

On calling `nsquishy.squish()`, `nsquishy.nsqReader` is assigned an initialized instance of a **[nsqjs reader](https://github.com/dudleycarr/nsqjs)**

### Methods:

* `init` - initializes connection to nsq. Callback fires on `nsqd_connected` event. Automatically handles `err` and `nsqd_connected` events

See nsqjs for full reader documentation
