const opentracing = require('opentracing')

class SpanContext extends opentracing.SpanContext {

    constructor ({ baggage } = {}) {
        super()
        this.baggage = isObject(baggage) ? baggage : {}
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

    setBaggage (baggage) {
        Object.assign(this.baggage, baggage)
    }

    setBaggageItem (key, value) {
        this.baggage[key] = value
    }

    getTraceId (trace_id) {
        return this.trace_id
    }

    getTransactionId (transaction_id) {
        return this.transaction_id
    }

    getParentId (parent_id) {
        return this.parent_id
    }

    getId (id) {
        return this.id
    }

    isSampled (sampled) {
        return this.sampled
    }

    getBaggageItem (key, value) {
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

function isObject (obj) {
    return typeof obj === 'object' && obj !== null
}
