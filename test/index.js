var tape   = require('tape')
var CAS    = require('../')
var osenv  = require('osenv')
var path   = require('path')
var fs     = require('fs')
var shasum = require('shasum')

var db = CAS(path.join(osenv.tmpdir(), 'test-cas'))

tape('add a value', function (t) {
  t.plan(2)
  db.add('hello', {encoding: 'utf8'}, function (err, hash) {
    if(err) throw err
    t.equal(hash, 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')
    db.get(hash, function (err, data) {
      if(err) throw err
      t.equal(shasum(data), hash)
      t.end()
    })
  })
})

tape('add the empty string', function (t) {
  db.add('', {encoding: 'utf8'}, function (err, hash) {
    if(err) throw err
    t.equal(hash, 'da39a3ee5e6b4b0d3255bfef95601890afd80709')
    db.get(hash, function (err, data) {
      if(err) throw err
      t.equal(shasum(data), hash)
      t.end()
    })
  })
})

tape('add a stream', function (t) {
  t.plan(2)
  fs.createReadStream(path.join(__dirname,'..', 'README.md'))
  .pipe(db.addStream())
  .on('close', function () {
    var stream = this
    console.log(stream.hash)
    t.ok(stream.hash)
    db.get(stream.hash, function (err, content) {
      console.log('readme:', content.toString().split('\n').shift() + '...')
      t.equal(stream.hash, shasum(content))
      t.end()
    })
  })
})

