var Joi = require('joi');

module.exports = Joi.object().keys({
    topic: Joi.string().optional().allow(null),
    channel: Joi.string().optional().allow(null),
    nsqlookupd: Joi.string().optional().allow(null),
    nsqlookupdHttpProtocol: Joi.string().optional().allow(null),
    etcd: Joi.string().optional().allow(null),
    etcdNsqlookupdKey: Joi.string().optional().allow(null),
    nsqdHost: Joi.string().optional().allow(null),
    nsqdPort: Joi.number().optional().allow(null),
    readerOptions: Joi.object().keys({
        nsqdTCPAddresses: Joi.any().forbidden(),
        lookupdHTTPAddresses: Joi.any().forbidden(),
        maxInFlight: Joi.number().optional(),
        heartbeatInterval: Joi.number().optional(),
        maxBackoffDuration: Joi.number().optional(),
        maxAttempts: Joi.number().optional(),
        requeueDelay: Joi.number().optional(),
        lookupdPollInterval: Joi.number().optional(),
        lookupdPollJitter: Joi.number().optional(),
        tls: Joi.boolean().optional(),
        tlsVerification: Joi.boolean().optional(),
        deflate: Joi.boolean().optional(),
        deflateLevel: Joi.number().optional(),
        snappy: Joi.boolean().optional(),
        authSecret: Joi.string().optional(),
        ouputBufferSize: Joi.boolean().optional(),
        outputBufferTimeout: Joi.boolean().optional(),
        messageTimeout: Joi.boolean().optional(),
        sampleRate: Joi.boolean().optional(),
        clientId: Joi.string().optional()
    }),
    writerOptions: Joi.object()
})
    .nand('etcd', 'nsqlookupd')
    .nand('etcdNsqlookupdKey', 'nsqlookupd')
    .with('etcd', ['etcdNsqlookupdKey']);