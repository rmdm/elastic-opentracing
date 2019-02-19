const assert = require('assert')
const opentracing = require('opentracing')

const Span = require('../lib/span')
const NeverSampler = require('../lib/samplers/never')
const RateSampler = require('../lib/samplers/rate')

describe('Span', function () {

    let span, tracer

    beforeEach(function () {
        tracer = {}
        span = new Span(tracer, 'test')
    })

    afterEach(function () {
        span.finish()
    })

    describe('constructor', function () {

        it('marks new span as transaction when no parent spans specified', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(span._isTransaction, true)
        })

        it('sets id on the new span', function () {

            const span = new Span({}, 'test_span')

            assert(idOfLength(span.context().getId(), 16))
        })

        it('sets name to "default" when no name is specified', function () {

            const span = new Span({})

            assert.strictEqual(span._data.name, 'default')
        })

        it('sets new trace id on the new transaction span', function () {

            const span = new Span({}, 'test_span')

            assert(idOfLength(span.context().getTraceId(), 32))
        })

        it('sets span count for transaction', function () {

            const span = new Span({}, 'test_span')

            assert.deepStrictEqual(span._data.span_count, {
                started: 0,
                dropped: 0,
            })
        })

        it('does not set transaction_id on transaction', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(span.context().getTransactionId(), void 0)
        })

        it('does not set parent_id on new transaction witout parents', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(span.context().getParentId(), void 0)
        })

        it('does not set _transactionStartTime on transaction', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(span._transactionStartTime, void 0)
        })

        it('sets _startTime on the transaction', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(typeof span._startTime, 'number')
        })

        it('sets sampled on the transaction depending on sampler', function () {

            const sampler = new NeverSampler()

            const span = new Span({}, 'test_span', { sampler })

            assert.strictEqual(span.context().isSampled(), false)
        })

        it('marks new span as not transaction when active parent span passed', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2._isTransaction, false)
        })

        it('does not set span_count on non-transaction span', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2._data.span_count, void 0)
        })

        it('sets same trace id as the parent one on a non-transaction', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert(idOfLength(span2.context().getTraceId(), 32))
            assert.strictEqual(span2.context().getTraceId(), span1.context().getTraceId())
        })

        it('sets transaction id to the parent transaction id', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert(idOfLength(span2.context().getId(), 16))
            assert.strictEqual(span2.context().getTransactionId(), span1.context().getId())
        })

        it('sets transaction id to the most recent parent transaction id', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })
            const span3 = new Span({}, 'test_span_3', {
                references: [
                    opentracing.childOf(span2),
                ]
            })

            assert(idOfLength(span1.context().getId(), 16))
            assert.strictEqual(span3.context().getTransactionId(), span1.context().getId())
        })

        it('sets passed span as parent on the new one', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2.context().getParentId(), span1.context().getId())
        })

        it('increments started span count on the parent transaction', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.deepStrictEqual(span1._data.span_count, {
                started: 1,
                dropped: 0,
            })
        })

        it('sets _startTime on the child span', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert(typeof span2._startTime === 'number')

            assert(span2._startTime >= span1._startTime)
        })

        it('sets _transactionStartTime on the child span', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2._transactionStartTime, span1._startTime)
        })

        it('marks new span as transaction when parent transaction is dummy', function () {

            const span1 = new opentracing.Span()

            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2._isTransaction, true)
            assert(!('parent_id' in span2.context()))
            assert(idOfLength(span2.context().getTraceId(), 32))
        })

        it('marks new span as transaction when parent transaction is finished', function () {

            const span1 = new Span({}, 'test_span_1')

            span1.finish()

            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2._isTransaction, true)
            assert(idOfLength(span2.context().getParentId(), 16))
            assert(idOfLength(span2.context().getTraceId(), 32))
        })

        it('sets trace id equal to the parent trace id even when parent span is finished', function () {

            const span1 = new Span({}, 'test_span_1')

            span1.finish()

            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert(idOfLength(span2.context().getTraceId(), 32))
            assert.strictEqual(span2.context().getTraceId(), span1.context().getTraceId())
        })

        it('sets parent id equal to the parent id even when parent span is finished', function () {

            const span1 = new Span({}, 'test_span_1')

            span1.finish()

            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert(idOfLength(span2.context().getParentId(), 16))
            assert.strictEqual(span2.context().getParentId(), span1.context().getId())
        })

        it('does not set transaction_id on child transaction of the finished one', function () {

            const span1 = new Span({}, 'test_span_1')

            span1.finish()

            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ]
            })

            assert.strictEqual(span2.context().getTransactionId(), void 0)
        })

        it('throws when multiple references specified', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2')

            assert.throws(function () {

                const span3 = new Span({}, 'test_span_3', {
                    references: [
                        opentracing.childOf(span1),
                        opentracing.childOf(span2),
                    ],
                })
            }, /Multiple references not supported\./)
        })

        it('extends span data with elastic-specific transaction meta if passed', function () {

            const span = new Span({}, 'test_span', {
                meta: {
                    type: 'request',
                    subtype: 'http',
                    non_transaction_meta: 'value',
                    context: {
                        arbitrary: 'data',
                    }
                },
            })

            assert(!('non_transaction_meta' in span._data))
            assert(!('subtype' in span._data))
            assert.strictEqual(span._data.type, 'request')
            assert.strictEqual(span._data.context.arbitrary, 'data')
        })

        it('extends span data with elastic-specific span meta if passed', function () {

            const span1 = new Span({}, 'test_span_1')
            const span2 = new Span({}, 'test_span_2', {
                references: [
                    opentracing.childOf(span1),
                ],
                meta: {
                    type: 'request',
                    subtype: 'http',
                    non_transaction_meta: 'value',
                    context: {
                        arbitrary: 'data',
                    }
                },
            })

            assert(!('non_transaction_meta' in span2._data))
            assert.strictEqual(span2._data.subtype, 'http')
            assert.strictEqual(span2._data.type, 'request')
            assert.strictEqual(span2._data.context.arbitrary, 'data')
        })

        it('sets inital tags from options', function () {

            const tags = {
                'key1': 'value1',
                'key2': 'value2',
            }

            const span = new Span({}, 'test_span', {
                tags: tags,
            })

            assert.deepStrictEqual(span._data.context.tags, {
                'key1': 'value1',
                'key2': 'value2',
            })

            assert.notEqual(span._data.context.tags, tags)
        })

        it('sets start time to the passed one from options', function () {

            const span = new Span({}, 'test_span', {
                startTime: 12345,
            })

            assert.strictEqual(span._getStartTime(), 12345)
        })

        it('sets sampled to false when sampler returns false', function () {

            const sampler = new NeverSampler()

            const span = new Span({}, 'test_span', { sampler })

            assert.strictEqual(span.context().isSampled(), false)
        })

        it('sets sampled to true by default', function () {

            const span = new Span({}, 'test_span')

            assert.strictEqual(span.context().isSampled(), true)
        })

        it('creates generic opentracing span when parent transaction is not sampled', function () {

            const sampler = new NeverSampler()

            const transaction = new Span({}, 'test_transaction', { sampler })

            const span = new Span({}, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ]
            })

            assert(!(span instanceof Span))
            assert(span instanceof opentracing.Span)

            const spanContext = span.context()

            assert.deepEqual(spanContext, {})
        })

        it('increases counter of dropped spans on the related transaction', function () {

            const sampler = new NeverSampler()

            const transaction = new Span({}, 'test_transaction', { sampler })

            const span = new Span({}, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ]
            })

            assert.deepStrictEqual(transaction._data.span_count, {
                started: 0,
                dropped: 1,
            })
        })

        it('samples child transaction when parent is sampled even if it is not active', function () {

            const sampler = new RateSampler({ rate: 0.1 })

            const transaction = new Span({}, 'test_transaction', { sampler })

            transaction.finish()

            const child_transaction = new Span({}, 'test_child_transaction', {
                references: [
                    opentracing.childOf(transaction),
                ],
                sampler,
            })

            assert.strictEqual(transaction._isTransaction, true)
            assert.strictEqual(transaction.context().isSampled(), true)
            assert.strictEqual(child_transaction._isTransaction, true)
            assert.strictEqual(child_transaction.context().isSampled(), true)
        })

        it('samples grand child transaction when parent is sampled even if it is not active', function () {

            const sampler = new RateSampler({ rate: 0.1 })

            const transaction = new Span({}, 'test_transaction', { sampler })

            const child_span = new Span({}, 'test_child_span', {
                references: [
                    opentracing.childOf(transaction),
                ],
                sampler,
            })

            transaction.finish()
            child_span.finish()

            const grand_child_transaction = new Span({}, 'test_grand_child_transaction', {
                references: [
                    opentracing.childOf(child_span),
                ],
                sampler,
            })

            assert.strictEqual(transaction._isTransaction, true)
            assert.strictEqual(transaction.context().isSampled(), true)
            assert.strictEqual(child_span._isTransaction, false)
            assert.strictEqual(child_span.context().isSampled(), true)
            assert.strictEqual(grand_child_transaction._isTransaction, true)
            assert.strictEqual(grand_child_transaction.context().isSampled(), true)
        })

        it('is still possible for child transaction to be sampled even if parent transaction is not sampled', function () {

            const never = new NeverSampler()
            const rate = new RateSampler({ rate: 0.1 })

            const transaction = new Span({}, 'test_transaction', { sampler: never })

            transaction.finish()

            const child_transaction = new Span({}, 'test_child_transaction', {
                references: [
                    opentracing.childOf(transaction),
                ],
                sampler: rate,
            })

            assert.strictEqual(transaction._isTransaction, true)
            assert.strictEqual(transaction.context().isSampled(), false)
            assert.strictEqual(child_transaction._isTransaction, true)
            assert.strictEqual(child_transaction.context().isSampled(), true)
        })

        it('samples deep child transaction when parent is sampled even if it is not active', function () {

            const never = new NeverSampler()
            const rate = new RateSampler({ rate: 0.1 })

            const transaction = new Span({}, 'test_transaction', { sampler: never })

            const child_span = new Span({}, 'test_child_span', {
                references: [
                    opentracing.childOf(transaction),
                ],
                sampler: never,
            })

            transaction.finish()
            child_span.finish()

            const grand_child_transaction = new Span({}, 'test_grand_child_transaction', {
                references: [
                    opentracing.childOf(child_span),
                ],
                sampler: rate,
            })

            assert.strictEqual(transaction._isTransaction, true)
            assert.strictEqual(transaction.context().isSampled(), false)
            assert.strictEqual(child_span._isTransaction, void 0)
            assert.deepEqual(child_span.context(), {})
            assert.strictEqual(grand_child_transaction._isTransaction, true)
            assert.strictEqual(grand_child_transaction.context().isSampled(), true)
        })

        it('inherits baggage items from its parent', function () {

            const transaction = new Span(tracer, 'test_transaction')

            transaction.setBaggageItem('parent', 'item')

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ],
            })

            span.setBaggageItem('child', 'item')

            assert.deepStrictEqual(span.getBaggageItem('parent'), 'item')
            assert.deepStrictEqual(span.getBaggageItem('child'), 'item')
            assert.notEqual(span.context().getBaggage(), transaction.context().getBaggage())
        })
    })

    describe('_context internal method', function () {

        it('returns the span context', function () {

            const context = span._context()

            assert.strictEqual(context, span._spanContext)
        })
    })

    describe('_tracer internal method', function () {

        it('returns the span tracer', function () {

            const tracer = span._tracer()

            assert.strictEqual(tracer, span._spanTracer)
        })
    })

    describe('_setOperationName internal method', function () {

        it('sets span name', function () {

            span._setOperationName('new_test_span_name')

            assert.strictEqual(span._data.name, 'new_test_span_name')
        })
    })

    describe('_getOperationName internal method', function () {

        it('returns the span name', function () {

            const name = span._getOperationName()

            assert.strictEqual(name, 'test')
        })
    })

    describe('_setBaggageItem internal method', function () {

        it('adds baggage item', function () {

            span._setBaggageItem('key', 'value')

            assert.strictEqual(span.context().getBaggageItem('key'), '"value"')
        })
    })

    describe('_getBaggageItem internal method', function () {

        it('returns previously stored baggage item', function () {

            span._setBaggageItem('key', 'value')

            const value = span._getBaggageItem('key')

            assert.strictEqual(value, 'value')
        })

        it('returns stored object', function () {

            span._setBaggageItem('key', { some: 'object' })

            const value = span._getBaggageItem('key')

            assert.deepStrictEqual(value, { some: 'object' })
        })

        it('returns undefined when no baggage stored with specified key', function () {

            const value = span._getBaggageItem('key')

            assert.strictEqual(value, void 0)
        })
    })

    describe('_addTags internal method', function () {

        it('adds tags', function () {

            const tags = {
                'key1': 'value1',
                'key2': 'value2',
            }

            span._addTags(tags)

            assert.deepStrictEqual(span._data.context.tags, {
                'key1': 'value1',
                'key2': 'value2',
            })

            assert.notEqual(span._data.context.tags, tags)
        })
    })

    describe('_log internal method', function () {

        it('sets each log as a mark', function () {

            span._log({
                size: 6,
                payload: 'Hello!',
                headers: { 'content-length': 6 },
            })

            const key = 'size:6,payload:Hello!,headers:{"content-length":6}'

            assert.deepStrictEqual(Object.keys(span._data.marks), [key])

            assert.strictEqual(typeof span._data.marks[key], 'number')
        })

        it('accepts custom timestamp for a transaction', function () {

            span._log({
                size: 6,
                payload: 'Hello!',
                headers: { 'content-length': 6 },
            }, 12345)

            const key = 'size:6,payload:Hello!,headers:{"content-length":6}'

            assert.deepStrictEqual(Object.keys(span._data.marks), [key])

            assert.strictEqual(span._data.marks[key], 12345)
        })

        it('sets each log as a mark on the thransaction span', function () {

            const transaction = new Span({}, 'test_span_1')
            const span = new Span({}, 'test_span_1', {
                references: [
                    opentracing.childOf(transaction),
                ],
            })

            span._log({
                size: 6,
                payload: 'Hello!',
                headers: { 'content-length': 6 },
            })

            const key = 'size:6,payload:Hello!,headers:{"content-length":6}'

            assert.deepStrictEqual(Object.keys(transaction._data.marks), [key])
            assert.strictEqual(typeof transaction._data.marks[key], 'number')

            assert.strictEqual(span._data.marks, void 0)
        })

        it('accepts custom timestamp for a span', function () {

            const transaction = new Span({}, 'test_span_1')
            const span = new Span({}, 'test_span_1', {
                references: [
                    opentracing.childOf(transaction),
                ],
            })

            span._log({
                size: 6,
                payload: 'Hello!',
                headers: { 'content-length': 6 },
            }, 12345)

            const key = 'size:6,payload:Hello!,headers:{"content-length":6}'

            assert.deepStrictEqual(Object.keys(transaction._data.marks), [key])
            assert.strictEqual(transaction._data.marks[key], 12345)

            assert.strictEqual(span._data.marks, void 0)
        })

        it('logs transaction-related error', function testErrorLog () {

            const tracer = { sendError: stub() }

            const span = new Span(tracer, 'test_span', {
                meta: {
                    type: 'request',
                }
            })

            const err = new TypeError('test error.')

            span._log({
                event: 'error',
                'error.object': err,
                'error.meta': {
                    context: {
                        request: { some: 'request' },
                    },
                },
            }, 12345)

            return timeout(50)
            .then(function () {

                const key = 'event:error,error.object.message:test error.'

                assert.deepStrictEqual(Object.keys(span._data.marks), [key])

                assert.strictEqual(span._data.marks[key], 12345)

                assert.strictEqual(tracer.sendError.calls.length, 1)
                assert.strictEqual(tracer.sendError.calls[0].length, 2)

                assert.strictEqual(typeof tracer.sendError.calls[0][1], 'function')

                const error = tracer.sendError.calls[0][0]

                assert.strictEqual(Object.keys(error).length, 9)

                assert(idOfLength(error.id, 16))
                assert(idOfLength(error.trace_id, 32))
                assert(idOfLength(error.transaction_id, 16))
                assert(idOfLength(error.parent_id, 16))

                assert.deepStrictEqual(error.transaction, {
                    sampled: true,
                    type: 'request',
                })

                assert.deepStrictEqual(error.context, {
                    request: { some: 'request' },
                })

                assert.strictEqual(error.culprit, `testErrorLog (${__filename})`)

                assert.strictEqual(error.exception.message, 'test error.')
                assert.strictEqual(error.exception.type, 'TypeError')

                assert.strictEqual(error.timestamp, 12345000)

                assert(Array.isArray(error.exception.stacktrace))

                const topFrame = error.exception.stacktrace[0]

                assert.strictEqual(topFrame.abs_path, __filename)

                assert.notEqual(error.id, span.context().getId())
                assert.strictEqual(error.trace_id, span.context().getTraceId())
                assert.strictEqual(error.transaction_id, span.context().getId())
                assert.strictEqual(error.parent_id, span.context().getId())
            })
        })

        it('logs span-related error', function testErrorLog2 () {

            const tracer = { sendError: stub() }

            const transaction = new Span(tracer, 'test_transaction', {
                meta: {
                    type: 'transaction',
                }
            })

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ],
                meta: {
                    type: 'request',
                }
            })

            const err = new TypeError('test error.')

            span._log({
                event: 'error',
                'error.object': err,
                'error.meta': {
                    context: {
                        request: { some: 'request' },
                    },
                },
            }, 12345)

            return timeout(50)
                .then(function () {

                const key = 'event:error,error.object.message:test error.'

                assert.deepStrictEqual(Object.keys(transaction._data.marks), [key])

                assert.strictEqual(transaction._data.marks[key], 12345)

                assert.strictEqual(tracer.sendError.calls.length, 1)
                assert.strictEqual(tracer.sendError.calls[0].length, 2)

                assert.strictEqual(typeof tracer.sendError.calls[0][1], 'function')

                const error = tracer.sendError.calls[0][0]

                assert.strictEqual(Object.keys(error).length, 9)

                assert(idOfLength(error.id, 16))
                assert(idOfLength(error.trace_id, 32))
                assert(idOfLength(error.transaction_id, 16))
                assert(idOfLength(error.parent_id, 16))

                assert.deepStrictEqual(error.transaction, {
                    sampled: true,
                    type: 'transaction',
                })

                assert.deepStrictEqual(error.context, {
                    request: { some: 'request' },
                })

                assert.strictEqual(error.culprit, `testErrorLog2 (${__filename})`)

                assert.strictEqual(error.exception.message, 'test error.')
                assert.strictEqual(error.exception.type, 'TypeError')

                assert.strictEqual(error.timestamp, 12345000)

                assert(Array.isArray(error.exception.stacktrace))

                const topFrame = error.exception.stacktrace[0]

                assert.strictEqual(topFrame.abs_path, __filename)

                assert.notEqual(error.id, span.context().getId())
                assert.strictEqual(error.trace_id, span.context().getTraceId())
                assert.strictEqual(error.transaction_id, span.context().getTransactionId())
                assert.strictEqual(error.parent_id, span.context().getId())
            })
        })

        it('emits errors on sendError', function () {

            let emittedError = null, errorToEmit = new Error()

            const span = new Span({
                sendError: (e, cb) => {
                    cb(errorToEmit)
                }
            }, 'test_span')

            span.on('error', function (error) {
                emittedError = error
            })

            span._log({
                event: 'error',
                'error.object': errorToEmit,
            })

            return timeout(10)
            .then(function () {

                assert.strictEqual(emittedError, errorToEmit)
            })
        })

        it('emits errors on sendError on related tracer', function () {

            let errorToEmit = new Error(), tracerEmitArgs = null

            const tracer = {
                sendError: (err, cb) => {
                    cb(errorToEmit)
                },
                emit: function (...args) {
                    tracerEmitArgs = args
                },
            }

            const span = new Span(tracer, 'test_span')

            span._log({
                event: 'error',
                'error.object': errorToEmit,
            }, 12345)

            return timeout(10)
            .then(function () {

                assert.deepStrictEqual(tracerEmitArgs, [ 'error', errorToEmit ])
                assert.strictEqual(tracerEmitArgs[1], errorToEmit)
            })
        })
    })

    describe('_finish internal method', function () {

        let tracer

        beforeEach(function () {
            tracer = {
                sendTransaction: stub(),
                sendSpan: stub(),
            }
        })

        it('calls tracer sendTransaction method for a transaction', function () {

            const span = new Span(tracer, 'test_span')

            span._finish()

            assert.strictEqual(tracer.sendTransaction.calls.length, 1)
            assert.strictEqual(tracer.sendTransaction.calls[0].length, 2)

            assert.strictEqual(typeof tracer.sendTransaction.calls[0][1], 'function')

            assert(!tracer.sendSpan.calls)

            const ctx = tracer.sendTransaction.calls[0][0]

            assert.strictEqual(Object.keys(ctx).length, 10)

            assert(idOfLength(ctx.id, 16))
            assert(idOfLength(ctx.trace_id, 32))
            assert.strictEqual(ctx.name, 'test_span')
            assert.strictEqual(ctx.type, 'transaction')
            assert.strictEqual(typeof ctx.sampled, 'boolean')
            assert.strictEqual(typeof ctx.timestamp, 'number')
            assert.strictEqual(typeof ctx.duration, 'number')
            assert.deepStrictEqual(ctx.context, { baggage: {}, tags: {} })
            assert.deepStrictEqual(ctx.marks, {})
            assert.deepStrictEqual(ctx.span_count, { started: 0, dropped: 0 })
        })

        it('accepts finish time for transaction', function () {

            const span = new Span(tracer, 'test_span', { startTime: 12345 })

            span._finish(45678)

            const ctx = tracer.sendTransaction.calls[0][0]

            assert.strictEqual(ctx.timestamp, 45678000)
            assert.strictEqual(ctx.duration, 33333)
        })

        it('accepts meta for transaction', function () {

            const span = new Span(tracer, 'test_span')

            span._finish(null, {
                type: 'request',
                subtype: 'http',
                result: 200,
                non_transaction_meta: 'value',
                context: {
                    arbitrary: 'data',
                },
            })

            assert.strictEqual(tracer.sendTransaction.calls.length, 1)
            assert.strictEqual(tracer.sendTransaction.calls[0].length, 2)

            assert.strictEqual(typeof tracer.sendTransaction.calls[0][1], 'function')

            assert(!tracer.sendSpan.calls)

            const ctx = tracer.sendTransaction.calls[0][0]

            assert.strictEqual(Object.keys(ctx).length, 11)

            assert(idOfLength(ctx.id, 16))
            assert(idOfLength(ctx.trace_id, 32))
            assert.strictEqual(ctx.name, 'test_span')
            assert.strictEqual(ctx.type, 'request')
            assert.strictEqual(ctx.result, 200)
            assert.strictEqual(typeof ctx.sampled, 'boolean')
            assert.strictEqual(typeof ctx.timestamp, 'number')
            assert.strictEqual(typeof ctx.duration, 'number')
            assert.deepStrictEqual(ctx.context, {
                baggage: {},
                tags: {},
                arbitrary: 'data',
            })
            assert.deepStrictEqual(ctx.marks, {})
            assert.deepStrictEqual(ctx.span_count, { started: 0, dropped: 0 })
        })

        it('calls tracer sendSpan method for a transaction', function () {

            const parentSpan = new Span(tracer, 'parent_span')

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(parentSpan),
                ]
            })

            span._finish()

            return timeout(50)
            .then(function () {

                assert.strictEqual(tracer.sendSpan.calls.length, 1)
                assert.strictEqual(tracer.sendSpan.calls[0].length, 2)

                assert.strictEqual(typeof tracer.sendSpan.calls[0][1], 'function')

                assert(!tracer.sendTransaction.calls)

                const ctx = tracer.sendSpan.calls[0][0]

                assert.strictEqual(Object.keys(ctx).length, 10)

                assert(idOfLength(ctx.id, 16))
                assert(idOfLength(ctx.trace_id, 32))
                assert(idOfLength(ctx.transaction_id, 16))
                assert(idOfLength(ctx.parent_id, 16))
                assert.strictEqual(ctx.name, 'test_span')
                assert.strictEqual(ctx.type, 'span')
                assert.strictEqual(typeof ctx.start, 'number')
                assert.strictEqual(typeof ctx.timestamp, 'number')
                assert.strictEqual(typeof ctx.duration, 'number')
                assert.deepStrictEqual(ctx.context, { baggage: {}, tags: {} })

                assert.strictEqual(ctx.parent_id, parentSpan.context().getId())
                assert.strictEqual(ctx.transaction_id, parentSpan.context().getId())
                assert.strictEqual(ctx.trace_id, parentSpan.context().getTraceId())
            })
        })

        it('accepts custom finish time for span', function () {

            const parentSpan = new Span(tracer, 'parent_span', {
                startTime: 11111,
            })

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(parentSpan),
                ],
                startTime: 12345,
            })

            span._finish(23456)

            return timeout(50)
            .then(function () {

                const ctx = tracer.sendSpan.calls[0][0]

                assert.strictEqual(ctx.start, 1234)
                assert.strictEqual(ctx.timestamp, 23456000)
                assert.strictEqual(ctx.duration, 11111)
            })
        })

        it('captures stack trace when the option specified', function () {

            const parentSpan = new Span(tracer, 'parent_span')

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(parentSpan),
                ],
                captureStackTrace: true,
            })

            span._finish()

            return timeout(50)
            .then(function () {

                const ctx = tracer.sendSpan.calls[0][0]

                assert(Array.isArray(ctx.stacktrace))

                const topFrame = ctx.stacktrace[0]

                assert.strictEqual(topFrame.abs_path, __filename)
            })
        })

        it('accepts meta for a span', function () {

            const parentSpan = new Span(tracer, 'parent_span')

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(parentSpan),
                ]
            })

            span._finish(null, {
                type: 'request',
                subtype: 'http',
                action: 'parse',
                sync: false,
                non_transaction_meta: 'value',
                context: {
                    arbitrary: 'data',
                }
            })

            return timeout(50)
            .then(function () {

                assert.strictEqual(tracer.sendSpan.calls.length, 1)
                assert.strictEqual(tracer.sendSpan.calls[0].length, 2)

                assert.strictEqual(typeof tracer.sendSpan.calls[0][1], 'function')

                assert(!tracer.sendTransaction.calls)

                const ctx = tracer.sendSpan.calls[0][0]

                assert.strictEqual(Object.keys(ctx).length, 13)

                assert(idOfLength(ctx.id, 16))
                assert(idOfLength(ctx.trace_id, 32))
                assert(idOfLength(ctx.transaction_id, 16))
                assert(idOfLength(ctx.parent_id, 16))
                assert.strictEqual(ctx.name, 'test_span')
                assert.strictEqual(ctx.type, 'request')
                assert.strictEqual(ctx.subtype, 'http')
                assert.strictEqual(ctx.action, 'parse')
                assert.strictEqual(ctx.sync, false)
                assert.strictEqual(typeof ctx.start, 'number')
                assert.strictEqual(typeof ctx.timestamp, 'number')
                assert.strictEqual(typeof ctx.duration, 'number')
                assert.deepStrictEqual(ctx.context, {
                    baggage: {},
                    tags: {},
                    arbitrary: 'data',
                })

                assert.strictEqual(ctx.parent_id, parentSpan.context().getId())
                assert.strictEqual(ctx.transaction_id, parentSpan.context().getId())
                assert.strictEqual(ctx.trace_id, parentSpan.context().getTraceId())
            })
        })

        it('does nothing on the consequent calls', function () {

            const span = new Span(tracer, 'test_span')

            span._finish()
            span._finish()
            span._finish()
            span._finish()
            span._finish()

            assert.strictEqual(tracer.sendTransaction.calls.length, 1)
            assert.strictEqual(tracer.sendTransaction.calls[0].length, 2)

            assert.strictEqual(typeof tracer.sendTransaction.calls[0][1], 'function')

            assert(!tracer.sendSpan.calls)
        })

        it('emits errors on sendTransaction', function () {

            let emittedError = null, errorToEmit = new Error()

            const span = new Span({
                sendTransaction: (t, cb) => {
                    cb(errorToEmit)
                }
            }, 'test_span')

            span.on('error', function (error) {
                emittedError = error
            })

            span._finish()

            return timeout(10)
            .then(function () {

                assert.strictEqual(emittedError, errorToEmit)
            })
        })

        it('emits tracer errors on sendTransaction', function () {

            let errorToEmit = new Error(), tracerEmitArgs = null

            const tracer = {
                sendTransaction: (t, cb) => {
                    cb(errorToEmit)
                },
                emit: function (...args) {
                    tracerEmitArgs = args
                },
            }

            const span = new Span(tracer, 'test_span')

            span._finish()

            return timeout(10)
            .then(function () {

                assert.deepStrictEqual(tracerEmitArgs, [ 'error', errorToEmit ])
                assert.strictEqual(tracerEmitArgs[1], errorToEmit)
            })
        })

        it('calls error listener bound to the span', function () {

            let emittedThis = null

            const span = new Span({
                sendTransaction: (t, cb) => {
                    cb(new Error())
                }
            }, 'test_span')

            span.on('error', function () {
                emittedThis = this
            })

            span._finish()

            return timeout(10)
            .then(function () {

                assert.strictEqual(emittedThis, span)
            })
        })

        it('emits errors on sendSpan', function () {

            const transaction = new Span({}, 'test_transaction')

            let emittedError = null, errorToEmit = new Error()

            const span = new Span({
                sendSpan: (s, cb) => {
                    cb(errorToEmit)
                }
            }, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ]
            })

            span.on('error', function (error) {
                emittedError = error
            })

            span._finish()

            return timeout(10)
            .then(function () {

                assert.strictEqual(emittedError, errorToEmit)
            })
        })

        it('emits tracer errors on sendSpan', function () {

            let errorToEmit = new Error(), tracerEmitArgs = null

            const transaction = new Span({}, 'test_transaction')

            const tracer = {
                sendSpan: (span, cb) => {
                    cb(errorToEmit)
                },
                emit: function (...args) {
                    tracerEmitArgs = args
                },
            }

            const span = new Span(tracer, 'test_span', {
                references: [
                    opentracing.childOf(transaction),
                ]
            })

            span._finish()

            return timeout(10)
            .then(function () {

                assert.deepStrictEqual(tracerEmitArgs, [ 'error', errorToEmit ])
                assert.strictEqual(tracerEmitArgs[1], errorToEmit)
            })
        })
    })

    describe('_childSpanStarted internal method', function () {

        it('increments started spans counter', function () {

            span._childSpanStarted()

            assert.deepStrictEqual(span._data.span_count, {
                started: 1,
                dropped: 0,
            })
        })
    })

    describe('_childSpanDropped internal method', function () {

        it('increments dropped spans counter', function () {

            span._childSpanDropped()

            assert.deepStrictEqual(span._data.span_count, {
                started: 0,
                dropped: 1,
            })
        })
    })
})

function idOfLength (id, strLen) {
    return /^[0-9a-f]+$/.test(id) && id.length === strLen
}

function timeout (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms)
    })
}

function stub () {
    return function stub (...args) {
        stub.calls = (stub.args || []).concat([ args ])
    }
}
