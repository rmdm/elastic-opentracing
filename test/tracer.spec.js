const assert = require('assert')
const sinon = require('sinon')
const opentracing = require('opentracing')

const Tracer = require('../lib/tracer')
const Span = require('../lib/span')
const SpanContext = require('../lib/span_context')
const FairRateSampler = require('../lib/samplers/rate_fair')
const NeverSampler = require('../lib/samplers/never')

describe('Tracer', function () {

    let tracer

    beforeEach(function () {
        tracer = new Tracer({ agentOptions: { serviceName: 'test_service' } })
    })

    describe('constructor', function () {

        it('registers "request-error" listener on the internal client and reemits it as error', function () {

            const tracer = new Tracer({ agentOptions: { serviceName: 'test_service' } })

            const listener = sinon.stub()

            tracer.on('error', listener)

            const requestError = new Error()

            tracer._client.emit('request-error', requestError)

            assert.strictEqual(listener.getCall(0).args[0], requestError)
        })
    })

    describe('_startSpan internal method', function () {

        it('creates a span', function () {

            const options = { references: [] }

            const span = tracer._startSpan('span_name', options)

            assert(span instanceof Span)
            assert.strictEqual(span._spanTracer, tracer)
            assert.strictEqual(span._data.name, 'span_name')
        })

        it('passs default FairRateSampler to the span', function () {

            const options = { references: [] }

            const span = tracer._startSpan('span_name', options)

            assert(tracer._sampler instanceof FairRateSampler)
            assert.strictEqual(span.context().sampled, true)
        })

        it('passes custom NeverSampler to the span', function () {

            const tracer = new Tracer({
                agentOptions: { serviceName: 'test_service' },
                sampler: new NeverSampler(),
            })

            const options = { references: [] }

            const span = tracer._startSpan('span_name', options)

            assert(tracer._sampler instanceof NeverSampler)
            assert.strictEqual(span.context().sampled, false)
        })
    })

    describe('_inject internal method', function () {

        it('injects span context into the text map carrier', function () {

            const spanContext = new SpanContext()
            spanContext.setTraceId('00000000000000000000000000000000')
            spanContext.setId('1111111111111111')
            spanContext.setParentId('aaaaaaaaaaaaaaaa')
            spanContext.setTransactionId('ffffffffffffffff')
            spanContext.setSampled(true)

            const textMap = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_TEXT_MAP, textMap)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(textMap, {
                'elastic-ot-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:1',
                'elastic-ot-baggage': 'e30=',
            })
        })

        it('injects span context into the http headers carrier', function () {

            const spanContext = new SpanContext()
            spanContext.setTraceId('00000000000000000000000000000000')
            spanContext.setId('1111111111111111')
            spanContext.setParentId('aaaaaaaaaaaaaaaa')
            spanContext.setTransactionId('ffffffffffffffff')
            spanContext.setSampled(false)

            const headers = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(headers, {
                'elastic-ot-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:0',
                'elastic-ot-baggage': 'e30=',
            })
        })

        it('does nothing when format is binary', function () {

            const spanContext = new SpanContext()
            spanContext.setTraceId('00000000000000000000000000000000')
            spanContext.setId('1111111111111111')
            spanContext.setParentId('aaaaaaaaaaaaaaaa')
            spanContext.setTransactionId('ffffffffffffffff')
            spanContext.setSampled(true)

            const binary = Buffer.from('')

            const result = tracer.inject(spanContext, opentracing.FORMAT_BINARY, binary)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(binary, Buffer.from(''))
        })

        it('sets span context on custom field', function () {

            const tracer = new Tracer({
                agentOptions: { serviceName: 'test_service' },
                contextIdKey: 'custom-span-id',
            })

            const spanContext = new SpanContext()
            spanContext.setTraceId('00000000000000000000000000000000')
            spanContext.setId('1111111111111111')
            spanContext.setParentId('aaaaaaaaaaaaaaaa')
            spanContext.setTransactionId('ffffffffffffffff')
            spanContext.setSampled(false)

            const headers = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(headers, {
                'custom-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:0',
                'elastic-ot-baggage': 'e30=',
            })
        })

        it('injects baggage fields on the text map carrier', function () {

            const spanContext = new SpanContext()

            spanContext.setBaggage({
                boolean: true,
                number: 0,
                string: 'string',
                null: null,
                undefined: void 0,
                object: {
                    field: {
                        subfield: 'value',
                    },
                },
            })

            const textMap = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_TEXT_MAP, textMap)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(textMap, {
                'elastic-ot-span-id': '::::0',
                'elastic-ot-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            })
        })

        it('injects baggage fields on the http carrier', function () {

            const spanContext = new SpanContext()

            spanContext.setBaggage({
                boolean: true,
                number: 0,
                string: 'string',
                null: null,
                undefined: void 0,
                object: {
                    field: {
                        subfield: 'value',
                    },
                },
            })

            const headers = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(headers, {
                'elastic-ot-span-id': '::::0',
                'elastic-ot-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            })
        })

        it('does nothing with baggage on binary carrier', function () {

            const spanContext = new SpanContext({
                baggage: {
                    boolean: true,
                    number: 0,
                    string: 'string',
                    null: null,
                    undefined: void 0,
                    object: {
                        field: {
                            subfield: 'value',
                        },
                    },
                }
            })

            const binary = Buffer.from('')

            const result = tracer.inject(spanContext, opentracing.FORMAT_BINARY, binary)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(binary, Buffer.from(''))
        })

        it('injects baggage fields on the http carrier with custom prefix', function () {

            const tracer = new Tracer({
                agentOptions: { serviceName: 'test_service' },
                baggageKey: 'custom-baggage',
            })

            const spanContext = new SpanContext()

            spanContext.setBaggage({
                boolean: true,
                number: 0,
                string: 'string',
                null: null,
                undefined: void 0,
                object: {
                    field: {
                        subfield: 'value',
                    },
                },
            })

            spanContext.setSampled(true)

            const headers = {}

            const result = tracer.inject(spanContext, opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.strictEqual(result, void 0)

            assert.deepStrictEqual(headers, {
                'elastic-ot-span-id': '::::1',
                'custom-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            })
        })

        it('throws when unknown format passed', function () {

            assert.throws(function () {
                tracer.inject({}, 'unknown_format', {})
            }, /Unknown carrier format \(unknown_format\)\./)
        })
    })

    describe('_extract intarnal method', function () {

        it('extracts span context from the text map carrier', function () {

            const carrier = {
                'elastic-ot-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:0',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_TEXT_MAP, carrier)

            assert.deepStrictEqual(spanContext.toObject(), {
                trace_id: '00000000000000000000000000000000',
                id: '1111111111111111',
                parent_id: 'aaaaaaaaaaaaaaaa',
                transaction_id: 'ffffffffffffffff',
                sampled: false,
                baggage: {},
            })
        })

        it('extracts span context from the http header carrier', function () {

            const headers = {
                'elastic-ot-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:1',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.deepStrictEqual(spanContext.toObject(), {
                trace_id: '00000000000000000000000000000000',
                id: '1111111111111111',
                parent_id: 'aaaaaaaaaaaaaaaa',
                transaction_id: 'ffffffffffffffff',
                sampled: true,
                baggage: {},
            })
        })

        it('returns null when format is binary', function () {

            const binary = Buffer.from('')

            const spanContext = tracer._extract(opentracing.FORMAT_BINARY, binary)

            assert.strictEqual(spanContext, null)
        })

        it('extracts span context from custom http header carrier', function () {

            const tracer = new Tracer({
                agentOptions: { serviceName: 'test_service' },
                contextIdKey: 'custom-span-id',
            })

            const headers = {
                'custom-span-id': '00000000000000000000000000000000:ffffffffffffffff:aaaaaaaaaaaaaaaa:1111111111111111:',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.deepStrictEqual(spanContext.toObject(), {
                trace_id: '00000000000000000000000000000000',
                id: '1111111111111111',
                parent_id: 'aaaaaaaaaaaaaaaa',
                transaction_id: 'ffffffffffffffff',
                baggage: {},
            })
        })

        it('extracts baggage from the text map carrier', function () {

            const carrier = {
                'elastic-ot-span-id': ':::',
                'elastic-ot-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_TEXT_MAP, carrier)

            assert.deepStrictEqual(spanContext.toObject(), {
                baggage: {
                    boolean: true,
                    number: 0,
                    string: 'string',
                    null: null,
                    object: {
                        field: {
                            subfield: 'value',
                        },
                    },
                }
            })
        })

        it('extracts baggage from the headers carrier', function () {

            const carrier = {
                'elastic-ot-span-id': ':::',
                'elastic-ot-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_HTTP_HEADERS, carrier)

            assert.deepStrictEqual(spanContext.toObject(), {
                baggage: {
                    boolean: true,
                    number: 0,
                    string: 'string',
                    null: null,
                    object: {
                        field: {
                            subfield: 'value',
                        },
                    },
                }
            })
        })

        it('extracts baggage from custom key', function () {

            const tracer = new Tracer({
                agentOptions: { serviceName: 'test_service' },
                baggageKey: 'custom-baggage',
            })

            const carrier = {
                'elastic-ot-span-id': ':::',
                'custom-baggage': 'eyJib29sZWFuIjp0cnVlLCJudW1iZXIiOjAsInN0cmluZyI6InN0cmluZyIsIm51bGwiOm51bGwsIm9iamVjdCI6eyJmaWVsZCI6eyJzdWJmaWVsZCI6InZhbHVlIn19fQ==',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_TEXT_MAP, carrier)

            assert.deepStrictEqual(spanContext.toObject(), {
                baggage: {
                    boolean: true,
                    number: 0,
                    string: 'string',
                    null: null,
                    object: {
                        field: {
                            subfield: 'value',
                        },
                    },
                }
            })
        })

        it('does not set absent parts from span context', function () {

            const headers = {
                'elastic-ot-span-id': '00000000000000000000000000000000:::1111111111111111',
            }

            const spanContext = tracer._extract(opentracing.FORMAT_HTTP_HEADERS, headers)

            assert.deepStrictEqual(spanContext.toObject(), {
                trace_id: '00000000000000000000000000000000',
                id: '1111111111111111',
                baggage: {},
            })
        })

        it('throws when unknown format passed', function () {

            assert.throws(function () {
                tracer._extract('unknown_format', {})
            }, /Unknown carrier format \(unknown_format\)\./)
        })
    })

    describe('sendTransaction method', function () {

        it('passes specified transaction to internal client sendTransaction method', function () {

            sinon.stub(tracer._client, 'sendTransaction').callsFake(function (t, cb) {
                cb()
            })

            const transaction = {}, cb = ()=>{}

            tracer.sendTransaction(transaction, cb)

            assert.strictEqual(
                tracer._client.sendTransaction.getCall(0).args[0],
                transaction
            )
            assert.strictEqual(
                tracer._client.sendTransaction.getCall(0).args[1],
                cb
            )
        })
    })

    describe('sendSpan method', function () {

        it('passes specified span to internal client sendSpan method', function () {

            sinon.stub(tracer._client, 'sendSpan')

            const span = {}, cb = ()=>{}

            tracer.sendSpan(span, cb)

            assert.strictEqual(
                tracer._client.sendSpan.getCall(0).args[0],
                span
            )
            assert.strictEqual(
                tracer._client.sendSpan.getCall(0).args[1],
                cb
            )
        })
    })

    describe('sendError method', function () {

        it('passes specified error to internal client sendError method', function () {

            sinon.stub(tracer._client, 'sendError')

            const error = {}, cb = ()=>{}

            tracer.sendError(error, cb)

            assert.strictEqual(
                tracer._client.sendError.getCall(0).args[0],
                error
            )
            assert.strictEqual(
                tracer._client.sendError.getCall(0).args[1],
                cb
            )
        })
    })

    describe('end method', function () {

        it('calls internal client end method', function () {

            const cb = ()=>{}

            sinon.stub(tracer._client, 'end')

            tracer.end(cb)
            assert.strictEqual(
                tracer._client.end.getCall(0).args[0],
                cb
            )
        })
    })
})
