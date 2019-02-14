const opentracing = require('opentracing')
const { EventEmitter } = require('events')

const SpanContext = require('./span_context')

const randomId = require('./util/random_id')
const getStackTrace = require('./util/get_stack_trace')

const activeTransactions = {}

class Span extends opentracing.Span {

    constructor (tracer, name, options = {}) {
        super()

        let spanContext

        const parentContext = getParentContext(options.references)

        const isNonEmptyParentSpan = parentContext instanceof SpanContext
            && parentContext.getId() && parentContext.getTraceId()

        if (isNonEmptyParentSpan) {

            const parentBaggage = parentContext.getBaggage()

            spanContext = new SpanContext({ baggage: parentBaggage })

            // parent is not necessary a transaction
            const transactionId =
                parentContext.getTransactionId() || parentContext.getId()

            const relatedTransaction = this._getActiveTransaction(transactionId)

            if (relatedTransaction) {

                if (!relatedTransaction.context().isSampled()) {
                    relatedTransaction._childSpanDropped()
                    return new opentracing.Span()
                }

                relatedTransaction._childSpanStarted()

                this._transactionStartTime = relatedTransaction._startTime
                this._transactionData = relatedTransaction._transactionData

                spanContext.setSampled(true)
                spanContext.setTransactionId(transactionId)
            }

            this._isTransaction = !relatedTransaction

            spanContext.setParentId(parentContext.getId())
            spanContext.setTraceId(parentContext.getTraceId())

        } else {

            spanContext = new SpanContext()

            this._isTransaction = true

            spanContext.setTraceId(randomId(16))
        }

        EventEmitter.call(this)

        this._startTime = isNumber(options.startTime)
            ? options.startTime
            : Date.now()

        this._spanTracer = tracer
        this._spanContext = spanContext
        this._data = {
            name: isString(name) ? name: 'default',
            context: {
                tags: isObject(options.tags) ? options.tags : {},
            },
        }

        spanContext.setId(randomId(8))

        if (this._isTransaction) {

            this._registerTransaction()

            const meta = pickTransactionMetaFields(options.meta)

            Object.assign(this._data, { type: 'transaction' }, meta, {
                context: Object.assign(meta.context, this._data.context),
                marks: {},
                span_count: { started: 0, dropped: 0 },
            })

            if (options.sampler && isFunction(options.sampler.sample)) {
                const hint = isNonEmptyParentSpan
                    ? parentContext.isSampled()
                    : false
                spanContext.setSampled(options.sampler.sample(this, hint))
            } else {
                spanContext.setSampled(true)
            }

            this._transactionData = {
                type: this._data.type,
                sampled: spanContext.isSampled(),
            }

        } else {

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

    _getOperationName () {
        return this._data.name
    }

    _setBaggageItem (key, value) {
        this._spanContext.setBaggageItem(key, JSON.stringify(value))
    }

    _getBaggageItem (key) {

        const value = this._spanContext.getBaggageItem(key)

        if (isString(value)) {
            return JSON.parse(value)
        }
    }

    _addTags (keyValuePairs) {

        const tags = this._data.context.tags

        for (const key in keyValuePairs) {
            tags[key] = keyValuePairs[key]
        }
    }

    _log (keyValuePairs, timestamp) {

        timestamp = isNumber(timestamp) ? timestamp : Date.now()

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

        const timestamp = isNumber(finishTime) ? finishTime : Date.now()
        const duration = timestamp - this._startTime

        if (this._isTransaction) {
            this._finishTransaction(meta, timestamp, duration)
        } else {
            this._finishSpan(meta, timestamp, duration)
        }
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

    _logErrorIfPresent (keyValuePairs, timestamp) {

        if (keyValuePairs.event === 'error') {

            const error = keyValuePairs['error.object']

            if (error) {

                this._logError(error, keyValuePairs['error.meta'], timestamp)

                delete keyValuePairs['error.object']
                delete keyValuePairs['error.meta']
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

        return
    }

    _logPlainValues (keyValuePairs, timestamp) {

        const key = Object.keys(keyValuePairs)
            .map(function (key) {

                const value = keyValuePairs[key]

                if (isObject(value)) {
                    return `${key}:${JSON.stringify(value)}`
                } else {
                    return `${key}:${value}`
                }
            })
            .join(',')

        this._data.marks[key] = timestamp
    }

    _logError (error, meta, timestamp) {

        const spanContext = this._spanContext

        meta = pickErrorMetaFields(meta)

        getStackTrace(error)
            .then(stacktrace => {

                const err = this._getError(error, stacktrace, meta, timestamp)

                return this._spanTracer.sendError(err)
            })
            .then(null, (err) => {
                this._emitError(err)
            })
    }

    _finishTransaction (meta, timestamp, duration) {

        this._dropTransaction()

        meta = pickTransactionMetaFields(meta)

        const transaction = this._getTransaction(meta, timestamp, duration)

        if (isFunction(this._spanTracer.sendTransaction)) {
            Promise.resolve(this._spanTracer.sendTransaction(transaction))
                .then(null, (err) => {
                    this._emitError(err)
                })
        }
    }

    _finishSpan (meta, timestamp, duration) {

        const start = this._startTime - this._transactionStartTime

        meta = pickSpanMetaFields(meta)

        const span = this._getSpan(meta, timestamp, duration, start)

        if (isFunction(this._spanTracer.sendSpan)) {
            if (this._captureStackTrace) {
                getStackTrace(this._stackObj)
                    .then((stacktrace) => {
                        span.stacktrace = stacktrace
                        return this._spanTracer.sendSpan(span)
                    })
                    .then(null, (err) => {
                        this._emitError(err)
                    })
            } else {
                Promise.resolve(this._spanTracer.sendSpan(span))
                    .then(null, (err) => {
                        this._emitError(err)
                    })
            }
        }
    }

    _getTransaction (meta, timestamp, duration) {

        const context = this._spanContext.toObject()

        const baggage = context.baggage

        delete context.baggage

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
                timestamp,
                duration,
            },
        )
    }

    _getSpan (meta, timestamp, duration, start) {

        const context = this._spanContext.toObject()

        const baggage = context.baggage

        delete context.baggage
        delete context.sampled

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
                timestamp,
                duration,
                start,
            }
        )
    }

    _getError (error, stacktrace, meta, timestamp) {

        const context = this._spanContext

        return Object.assign({
                timestamp,
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

        // do not throw when there is no user-defined handlers
        try {
            this.emit('error', error)
        } catch (e) {}

        if (isFunction(this._spanTracer.emit)) {
            try {
                this._spanTracer.emit('error', error)
            } catch (e) {}
        }
    }
}

Object.assign(Span.prototype, EventEmitter.prototype)

function getParentContext (references) {

    if (isArray(references)) {
        if (!references.length) {
            return null
        } else if (references.length === 1) {
            return references[0].referencedContext()
        } else {
            throw new Error('Multiple references not supported.')
        }
    }

    return null
}

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

        if (!isObject(meta)) {
            meta = {}
        }

        const context = getMetaContext(meta.context)

        const fields = { context }

        for (const field of allowedFields) {
            if (hasOwn(meta, field)) {
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

function getCulprit (stacktrace) {

    if (!isArray(stacktrace) || !stacktrace.length) {
        return null
    }

    const topFrame = stacktrace[0]

    if (topFrame.function) {
        if (topFrame.abs_path) {
            return `${topFrame.function} (${topFrame.abs_path})`
        } else {
            return topFrame.function
        }
    } else {
        if (topFrame.abs_path) {
            return topFrame.abs_path
        } else {
            return ''
        }
    }
}

function isObject (obj) {
    return typeof obj === 'object' && obj !== null
}

function hasOwn (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}

function isNumber (num) {
    return typeof num === 'number'
}

function isString (srt) {
    return typeof srt === 'string'
}

function isArray (arr) {
    return Array.isArray(arr)
}

function isFunction (fun) {
    return typeof fun === 'function'
}

module.exports = Span
