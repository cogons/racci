var cutter = require("../cutter");
var _ = require('underscore')
var db = require('../db')

function Parser(prefix, docs, identifier, token_field, field_weight) {
    this.docs = docs,
        this.total = docs.length
    this.idnetifier = identifier || "doc_id"
    this.token_field = token_field || ""
    this.field_weight = field_weight || undefined
    this.prefix = prefix || ""
}

Parser.prototype.convert_doc = function() {
    var doc_id = this.idnetifier
    var obj = {}
    this.docs.map((d) => {
        obj[d[doc_id]] = d
    })
    db.set("_docs", obj)
}

Parser.prototype.tokenize = function() {
    var prefix = this.prefix
    var p = this
    var fields = []
    var weight = {}
    var doc_id = p.idnetifier
    docs = db.get(prefix + "_docs")
    fields.push(p.token_field)
    fields = _.flatten(fields)
    var weight_ = this.field_weight
    var tokenSet = _.mapObject(docs, (doc, key) => {
        var terms_ = _.flatten(fields.map(function(f) {
            var term_for_f = cutter.cut(doc[f])
            term_for_f.forEach((tff) => {
                if (weight_[0] > 1 && tff.length > 1) {
                    if (!weight[doc[doc_id]]) weight[doc[doc_id]] = {}
                    if (!weight[doc[doc_id]][tff]) weight[doc[doc_id]][tff] = weight_[0]
                    else weight[doc[doc_id]][tff] *= weight_[0]
                }
            })
            weight_.push(weight_.shift())
            return term_for_f
        }))
        return terms_
    })
    db.set(prefix + "_weight", weight)
    db.set(prefix + "_tokenSet", tokenSet)
}

Parser.prototype.cal_tf = function() {
    var prefix = this.prefix
    var doc_id = this.idnetifier
    var tokenSet = db.get(prefix + '_tokenSet')
    var tf = _.mapObject(tokenSet, (ts, key) => {
        var tf_ = {}
        var id_ = ts[doc_id]
        var factor = 1 / ts.length
        ts.forEach(function(t) {
            if (tf_[t]) tf_[t] += factor
            else {
                tf_[t] = factor
            }
        })
        return tf_
    })
    db.set(prefix + "_tf", tf)
}

Parser.prototype.invertedIndex = function() {
    var prefix = this.prefix
    var doc_id = this.idnetifier
    var tokenSet = db.get(prefix + '_tokenSet')
    var index = {}
    var index_arr = []
    console.log(tokenSet)
    _.mapObject(tokenSet, (doc, key) => {
        doc.forEach(function(term) {
            if (index[term]) index[term].push(key)
            else {
                index[term] = []
                index[term].push(key)
            }
        })
    })
    for (t in index) {
        index[t] = _.uniq(index[t])
    }

    db.set(prefix + "_idx", index)

    // for(i in index){
    //     index_arr.push({term:i,postings:index[i]})
    // }
    // return index_arr
}

Parser.prototype.cal_idf = function() {
    var prefix = this.prefix
    var docs = db.get(prefix + "_docs")
    var idx = db.get(prefix + "_idx")
    var idf = {}
    var total = this.total
    for (v in idx) {
        idf[v] = Math.log2(total / idx[v].length)
    }
    db.set(prefix + "_idf", idf)
}

Parser.prototype.cal_tfidf = function() {
    var prefix = this.prefix
    var doc_id = this.idnetifier
    var tfidf = {}
    var tf = db.get(prefix + "_tf")
    var idf = db.get(prefix + "_idf")
    var weight = db.get(prefix + "_weight")
    _.mapObject(tf, (item, key) => {

        var obj = {}

        for (i in item) {
            var w = weight[key] ?
                (weight[key][i] ? weight[key][i] : 1) : 1
            obj[i] = item[i] * idf[i] * w
        }

        tfidf[key] = obj
            // return {
            //     doc_id:item.doc_id,
            //     tfidf:
            // }
    })

    db.set(prefix + "_tfidf", tfidf)
}


Parser.init = function(docs, identifier, fields, field_weight) {
    var parser = new Parser("", docs, identifier, fields, field_weight)
    parser.convert_doc()
    console.log("docs saved")
    parser.tokenize()
    console.log("tokenset saved")
    parser.invertedIndex()
    console.log("iverted index saved")
    parser.cal_idf()
    console.log("idf saved")
    parser.cal_tf()
    console.log("tf saved")
    parser.cal_tfidf()
    console.log("tfidf saved")
}

Parser.simple = function(prefix, identifier, fields) {
    var docs = db.get("_docs")
    var parser = new Parser(prefix, docs, identifier, fields, [1])
    parser.field_tokenize()
    parser.invertedIndex()
    var idx = db.get(prefix + "_idx")
    db.set(prefix + "_idx", idx)
}


Parser.prototype.field_tokenize = function() {
    var p = this
    var fields = []
    var weight = {}
    var doc_id = this.idnetifier
    var docs = db.get("_docs")
    console.log(docs)
    fields.push(p.token_field)
    fields = _.flatten(fields)
    var weight_ = this.field_weight
    var tokenSet = _.mapObject(docs, (doc, key) => {
        var terms_ = _.flatten(fields.map(function(f) {
            var term_for_f = cutter.cut(doc[f])
            return term_for_f
        }))
        return terms_
    })
    db.set(p.prefix + "_tokenSet", tokenSet)
}


module.exports = Parser