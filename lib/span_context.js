const opentracing = require('opentracing')

class SpanContext extends opentracing.SpanContext {

    constructor () {
        super()
        this.baggage = {}
    }

    setTraceId (trace_id) {
        this.trace_id = trace_id
    }

    setTransactionId (transaction_id) {
        this.transaction_id = transaction_id
    }

    setParentId (parent_id) {
        this.parent_id = parent_id
    }

    setId (id) {
        this.id = id
    }

    setSampled (sampled) {
        this.sampled = sampled
    }

    setBaggageItem (key, value) {
        this.baggage[key] = value
    }

    setBaggage (baggage) {
        Object.assign(this.baggage, baggage)
    }

    getTraceId () {
        return this.trace_id
    }

    getTransactionId () {
        return this.transaction_id
    }

    getParentId () {
        return this.parent_id
    }

    getId () {
        return this.id
    }

    isSampled () {
        return this.sampled
    }

    getBaggageItem (key) {
        return this.baggage[key]
    }

    getBaggage () {
        return this.baggage
    }

    toObject () {
        return Object.assign({}, this)
    }
}

module.exports = SpanContext
