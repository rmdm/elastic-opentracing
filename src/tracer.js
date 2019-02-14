const opentracing = require('opentracing')
const ElasticApmHttpClient = require('elastic-apm-http-client')
const { EventEmitter } = require('events')

const Span = require('./span')
const FairRateSampler = require('./samplers/rate_fair')
const textMap = require('./util/serdes/text_map')

const { version, name } = require('../package')

const agentConstants = {
    agentName: 'nodejs',
    agentVersion: version,
    userAgent: `${name}/${version}`,
}

class Tracer extends opentracing.Tracer {

    constructor ({
        agentOptions,
        contextIdKey,
        baggageKey,
        sampler,
    } = {}) {
        super()

        EventEmitter.call(this)

        this._client = new ElasticApmHttpClient(
            Object.assign({}, agentOptions, agentConstants))

        this._client.on('request-error', (error) => {
            try {
                this.emit('error', error)
            } catch (err) {}
        })

        this._contextIdKey = contextIdKey
        this._baggageKey = baggageKey
        this._sampler = sampler || new FairRateSampler({ rate: 0.1 })
    }

    _startSpan (name, options) {
        options = Object.assign({ sampler: this._sampler }, options)
        return new Span(this, name, options)
    }

    _inject (spanContext, format, carrier) {

        switch (format) {

        case opentracing.FORMAT_HTTP_HEADERS:
        case opentracing.FORMAT_TEXT_MAP:
            textMap.inject(spanContext, carrier, {
                contextIdKey: this._contextIdKey,
                baggageKey: this._baggageKey,
            })
            return

        case opentracing.FORMAT_BINARY:
            return

        default:
            throw new Error(`Unknown carrier format (${format}).`)
        }
    }

    _extract (format, carrier) {

        switch (format) {

        case opentracing.FORMAT_HTTP_HEADERS:
        case opentracing.FORMAT_TEXT_MAP:
            return textMap.extract(carrier, {
                contextIdKey: this._contextIdKey,
                baggageKey: this._baggageKey,
            })

        case opentracing.FORMAT_BINARY:
            return null

        default:
            throw new Error(`Unknown carrier format (${format}).`)
        }
    }

    sendTransaction (transaction) {
        return new Promise((resolve, reject) => {
            this._client.sendTransaction(transaction, function (err) {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }

    sendSpan (span) {
        return new Promise((resolve, reject) => {
            this._client.sendSpan(span, function (err) {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }

    sendError (error) {
        return new Promise((resolve, reject) => {
            this._client.sendError(error, function (err) {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }

    end () {
        return new Promise((resolve) => {
            this._client.end(function () {
                resolve()
            })
        })
    }
}

Object.assign(Tracer.prototype, EventEmitter.prototype)

module.exports = Tracer
