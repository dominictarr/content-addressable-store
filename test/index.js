var tape   = require('tape')
var CAS    = require('../')
var osenv  = require('osenv')
var path   = require('path')
var fs     = require('fs')
var shasum = require('shasum')
var rimraf = require('rimraf')

var dir = path.join(osenv.tmpdir(), 'test-cas')
rimraf.sync(dir)

var db = CAS(dir, 'sha1')

var helloHash = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'
var emptyHash = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
var abcHash   = 'a9993e364706816aba3e25717850c26c9cd0d89d'
var readmeHash

tape('isHash', function (t) {

  t.ok(db.isHash(helloHash))
  t.ok(db.isHash(emptyHash))
  t.ok(db.isHash(abcHash))
  t.notOk(db.isHash(abcHash + 'x'))
  t.end()
})

tape('add a value', function (t) {
  t.plan(2)
  db.add('hello', {encoding: 'utf8'}, function (err, hash) {
    if(err) throw err
    t.equal(hash, helloHash)
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
    t.equal(hash, emptyHash)
    db.get(hash, function (err, data) {
      if(err) throw err
      t.equal(shasum(data), hash)
      t.end()
    })
  })
})

tape('add twice & detect cached', function (t) {
  db.add('abc', {encoding: 'utf8'}, function (err, hash, cached) {
    if(err) throw err
    t.equal(hash, abcHash)
    t.notOk(cached, 'abc was not cached')

    db.add('abc', {encoding: 'utf8'}, function (err, hash, cached) {
      if(err) throw err
      t.equal(hash, abcHash)
      t.ok(cached , 'abc was already cached')
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
    console.log(readmeHash = stream.hash)
    t.ok(stream.hash)
    db.get(stream.hash, function (err, content) {
      console.log('readme:', content.toString().split('\n').shift() + '...')
      t.equal(stream.hash, shasum(content))
      t.end()
    })
  })
})

tape('get all keys', function (t) {
  db.all(function (err, all) {
    if(err) throw err
    console.error(all)
    t.deepEqual(all, [
      helloHash,
      abcHash,
      readmeHash,
      emptyHash
    ].sort())
    t.end()
  })
})
