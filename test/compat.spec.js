const Tracer = require('../src/tracer')
const apiCompatibilityChecks = require('opentracing/lib/test/api_compatibility').default

apiCompatibilityChecks(function () {
    return new Tracer({ agentOptions: { serviceName: 'test' } })
})
