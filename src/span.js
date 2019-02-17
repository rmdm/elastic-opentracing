const opentracing = require('opentracing')
const { EventEmitter } = require('events')

const SpanContext = require('./span_context')

const randomId = require('./util/random_id')
const { getStackTrace, getCulprit } = require('./util/stacktrace')
const is = require('./util/is')

const activeTransactions = {}

class Span extends opentracing.Span {

    constructor (tracer, name, options = {}) {
        super()

        const parentContext = this._getParentContext(options.references)

        if (parentContext) {

            const relatedTransaction =
                this._getRelatedTransaction(parentContext)

            if (relatedTransaction) {

                if (!relatedTransaction.context().isSampled()) {

                    return this._dummySpan(relatedTransaction)

                } else {

                    this._initCommon(tracer, name, options)
                    this._initSpan(relatedTransaction, options)
                    this._initChildSpan(parentContext)
                }

            } else {

                this._initCommon(tracer, name, options)
                this._initTransaction(parentContext, options)
                this._initChildSpan(parentContext)
            }

        } else {

            this._initCommon(tracer, name, options)
            this._initTransaction(parentContext, options)
        }
    }

    _context () {
        return this._spanContext
    }

    _tracer () {
        return this._spanTracer
    }

    _setOperationName (name) {
        this._data.name = name
    }

    _setBaggageItem (key, value) {
        this._spanContext.setBaggageItem(key, JSON.stringify(value))
    }

    _getBaggageItem (key) {

        const value = this._spanContext.getBaggageItem(key)

        if (is.string(value)) {
            return JSON.parse(value)
        }
    }

    _addTags (keyValuePairs) {

        const tags = this._data.context.tags

        for (const key in keyValuePairs) {
            if (is.own(keyValuePairs, key)) {
                tags[key] = keyValuePairs[key]
            }
        }
    }

    _log (keyValuePairs, timestamp) {

        timestamp = is.number(timestamp) ? timestamp : Date.now()

        this._logErrorIfPresent(keyValuePairs, timestamp)

        if (!this._isTransaction) {
            this._logOnBehalfOfTransaction(keyValuePairs, timestamp)
            return
        }

        this._logPlainValues(keyValuePairs, timestamp)
    }

    _finish (finishTime, meta) {

        if (this._finished) {
            return
        }

        this._finished = true

        let timestamp = is.number(finishTime) ? finishTime : Date.now()
        const duration = timestamp - this._startTime

        if (this._isTransaction) {
            this._finishTransaction(meta, timestamp, duration)
        } else {
            this._finishSpan(meta, timestamp, duration)
        }
    }

    _dummySpan (relatedTransaction) {
        relatedTransaction._childSpanDropped()
        return new opentracing.Span()
    }

    _initCommon (tracer, name, options) {

        EventEmitter.call(this)

        this._startTime = is.number(options.startTime)
            ? options.startTime
            : Date.now()

        this._spanContext = new SpanContext()
        this._spanContext.setId(randomId(8))

        this._spanTracer = tracer
        this._data = {
            name: is.string(name) ? name: 'default',
            context: {
                tags: Object.assign({}, options.tags),
            },
        }
    }

    _initSpan (relatedTransaction, options) {

        relatedTransaction._childSpanStarted()

        this._isTransaction = false

        this._transactionStartTime = relatedTransaction._getStartTime()
        this._transactionData = relatedTransaction._getTransactionData()

        this._spanContext.setTransactionId(relatedTransaction.context().getId())
        this._spanContext.setSampled(true)

        const meta = pickSpanMetaFields(options.meta)

        Object.assign(this._data, { type: 'span' }, meta, {
            context: Object.assign(meta.context, this._data.context),
        })

        this._captureStackTrace = Boolean(options.captureStackTrace)

        if (this._captureStackTrace) {
            this._stackObj = {}
            Error.captureStackTrace(this._stackObj, this.constructor)
        }
    }

    _initChildSpan (parentContext) {

        const parentBaggage = parentContext.getBaggage()

        this._spanContext.setBaggage(parentBaggage)
        this._spanContext.setParentId(parentContext.getId())
        this._spanContext.setTraceId(parentContext.getTraceId())
    }

    _initTransaction (parentContext, options) {

        this._registerTransaction()

        this._isTransaction = true

        this._spanContext.setTraceId(randomId(16))

        const meta = pickTransactionMetaFields(options.meta)

        Object.assign(this._data, { type: 'transaction' }, meta, {
            context: Object.assign(meta.context, this._data.context),
            marks: {},
            span_count: { started: 0, dropped: 0 },
        })

        if (options.sampler && is.function(options.sampler.sample)) {
            const hint = parentContext
                ? parentContext.isSampled()
                : false
            this._spanContext.setSampled(options.sampler.sample(this, hint))
        } else {
            this._spanContext.setSampled(true)
        }

        this._transactionData = {
            type: this._data.type,
            sampled: this._spanContext.isSampled(),
        }
    }

    _getParentContext (references) {

        if (is.array(references)) {
            if (!references.length) {
                return null
            } else if (references.length === 1) {
                const parentContext = references[0].referencedContext()
                return ( parentContext instanceof SpanContext
                            && parentContext.getId()
                            && parentContext.getTraceId())
                    ? parentContext
                    : null
            } else {
                throw new Error('Multiple references not supported.')
            }
        }

        return null
    }

    _getRelatedTransaction (parentContext) {

        // parent is not necessary a transaction
        const transactionId =
            parentContext.getTransactionId() || parentContext.getId()

        return this._getActiveTransaction(transactionId)
    }

    _childSpanStarted () {
        this._data.span_count.started++
    }

    _childSpanDropped () {
        this._data.span_count.dropped++
    }

    _registerTransaction () {
        activeTransactions[this._spanContext.getId()] = this
    }

    _dropTransaction () {
        delete activeTransactions[this._spanContext.getId()]
    }

    _getActiveTransaction (id) {
        return activeTransactions[id]
    }

    _getStartTime () {
        return this._startTime
    }

    _getTransactionData () {
        return this._transactionData
    }

    _getOperationName () {
        return this._data.name
    }

    _logErrorIfPresent (keyValuePairs, timestamp) {

        if (keyValuePairs.event === 'error') {

            const error = keyValuePairs['error.object']

            if (error) {

                this._logError(error, keyValuePairs['error.meta'], timestamp)

                delete keyValuePairs['error.object']
                delete keyValuePairs['error.meta']
                delete keyValuePairs['stack']
                keyValuePairs['error.object.message'] = error.message
            }
        }
    }

    _logOnBehalfOfTransaction (keyValuePairs, timestamp) {

        const transaction =
            this._getActiveTransaction(this._spanContext.getTransactionId())

        if (transaction) {
            transaction._log(keyValuePairs, timestamp)
        }
    }

    _logPlainValues (keyValuePairs, timestamp) {

        const key = Object.keys(keyValuePairs)
            .map(function (key) {

                const value = keyValuePairs[key]

                if (is.object(value)) {
                    return `${key}:${JSON.stringify(value)}`
                } else {
                    return `${key}:${value}`
                }
            })
            .join(',')

        this._data.marks[key] = timestamp
    }

    _logError (error, meta, timestamp) {

        getStackTrace(error, (err, stacktrace) => {

            if (err) {
                return this._emitError(err)
            }

            const errorToSend =
                this._getError(error, meta, timestamp, stacktrace)

            return this._spanTracer.sendError(errorToSend, (err) => {
                if (err) {
                    this._emitError(err)
                }
            })
        })
    }

    _finishTransaction (meta, timestamp, duration) {

        this._dropTransaction()

        const transaction = this._getTransaction(meta, timestamp, duration)

        if (is.function(this._spanTracer.sendTransaction)) {
            this._spanTracer.sendTransaction(transaction, (err) => {
                if (err) {
                    this._emitError(err)
                }
            })
        }
    }

    _finishSpan (meta, timestamp, duration) {

        const span = this._getSpan(meta, timestamp, duration)

        if (is.function(this._spanTracer.sendSpan)) {
            if (this._captureStackTrace) {
                return getStackTrace(this._stackObj, (err, stacktrace) => {
                    if (err) {
                        return this._emitError(err)
                    }
                    span.stacktrace = stacktrace
                    this._spanTracer.sendSpan(span, (err) => {
                        if (err) {
                            this._emitError(err)
                        }
                    })
                })
            } else {
                this._spanTracer.sendSpan(span, (err) => {
                    if (err) {
                        this._emitError(err)
                    }
                })
            }
        }
    }

    _getTransaction (meta, timestamp, duration) {

        const context = this._spanContext.toObject()

        const baggage = context.baggage

        delete context.baggage

        meta = pickTransactionMetaFields(meta)

        return Object.assign(
            context,
            this._data,
            meta,
            {
                context: Object.assign(
                    meta.context,
                    this._data.context,
                    { baggage }
                ),
                // apm expects timestamp to be in microseconds
                timestamp: timestamp * 1000,
                duration,
            }
        )
    }

    _getSpan (meta, timestamp, duration) {

        const context = this._spanContext.toObject()

        const baggage = context.baggage

        delete context.baggage
        delete context.sampled

        const start = this._startTime - this._transactionStartTime

        meta = pickSpanMetaFields(meta)

        return Object.assign(
            context,
            this._data,
            meta,
            {
                context: Object.assign(
                    meta.context,
                    this._data.context,
                    { baggage }
                ),
                // apm expects timestamp to be in microseconds
                timestamp: timestamp * 1000,
                duration,
                start,
            }
        )
    }

    _getError (error, meta, timestamp, stacktrace) {

        const context = this._spanContext

        meta = pickErrorMetaFields(meta)

        return Object.assign({
            // apm expects timestamp to be in microseconds
            timestamp: timestamp * 1000,
            id: randomId(8),
            trace_id: context.getTraceId(),
            transaction_id: this._isTransaction
                ? context.getId()
                : context.getTransactionId(),
            parent_id: context.getId(),
            transaction: this._transactionData,
            culprit: getCulprit(stacktrace),
            exception: {
                message: error.message,
                stacktrace: stacktrace,
                type: error.name,
            },
        },
        meta
        )
    }

    _emitError (error) {
        /* eslint-disable no-empty */
        // do not throw when there is no user-defined handlers
        try {
            this.emit('error', error)
        } catch (e) {}

        if (is.function(this._spanTracer.emit)) {
            try {
                this._spanTracer.emit('error', error)
            } catch (e) {}
        }
        /* eslint-enable no-empty */
    }
}

Object.assign(Span.prototype, EventEmitter.prototype)

const transactionMetaFields = [
    'type',
    'result',
]

const spanMetaFields = [
    'type',
    'subtype',
    'action',
    'sync',
]

const errorMetaFields = []

const pickSpanMetaFields = createMetaFieldsGetter(spanMetaFields)
const pickTransactionMetaFields = createMetaFieldsGetter(transactionMetaFields)
const pickErrorMetaFields = createMetaFieldsGetter(errorMetaFields)

function createMetaFieldsGetter (allowedFields) {

    return function (meta) {

        if (!is.object(meta)) {
            meta = {}
        }

        const context = getMetaContext(meta.context)

        const fields = { context }

        for (const field of allowedFields) {
            if (is.own(meta, field)) {
                fields[field] = meta[field]
            }
        }

        return fields
    }
}

function getMetaContext (metaContext) {

    const context = Object.assign({}, metaContext)

    delete context.tags
    delete context.baggage

    return context
}

module.exports = Span
