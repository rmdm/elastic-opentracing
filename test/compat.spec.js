const Tracer = require('../lib/tracer')
const apiCompatibilityChecks = require('opentracing/lib/test/api_compatibility').default

apiCompatibilityChecks(function () {
    return new Tracer({ agentOptions: { serviceName: 'test' } })
})
