var mkdirp  = require('mkdirp')
var through = require('through')
var crypto  = require('crypto')
var path    = require('path')
var fs      = require('graceful-fs')

function createHashers (alg) {
  var createHash
    = 'string' === typeof alg 
    ? crypto.createHash.bind(null, alg) 
    : alg

  return {
    shastream: function (enc) {
      var hash = createHash()
      return through(function (data) {
        hash.update(data, enc)
        this.push(data)
      }, function () {
        this.hash = hash.digest('hex')
        this.push(null)
      }, {autoDestroy: false})
    },

    shasum: function (data, enc) {
      return createHash().update(data, enc).digest('hex')
    }
  }
}

module.exports = function (dir, alg) {
  var h = createHashers(alg || 'sha256')

  //construct a regexp to test hex strings of the correct length.
  var rxHash = new RegExp('^[0-9a-f]{' + h.shasum('', 'utf8').length + '}$')

  if(!dir)
    throw new Error('content-addressable-store needs a directory to work in')
  var init = false, db

  function toPath (hash) {
    return path.join(dir, hash.substring(0, 2), hash.substring(2))
  }

  function randomPath () {
    return path.join(dir, 'tmp', Date.now() + '-' + Math.random().toString().substring(2))
  }

  //make sure the /tmp directory exists (first write only)
  function prepare (stream, ready) {
    if(init) return ready()
    stream.pause()
    mkdirp(path.join(dir, 'tmp'), function (err) {
      if(err) return stream.emit('error', err)
      init = true; ready(); stream.resume()
    })
  }

  function writeFile (filename, data, enc, cb) {
    if(!init)
      mkdirp(path.dirname(filename), function (err) {
        if(err) return cb(err)
        init = true
        fs.writeFile(filename, data, enc, cb)
      })
    else
      fs.writeFile(filename, data, enc, cb)
  }

  return db = {
    get: function (hash, opts, cb) {
      if(!cb) cb = opts, opts = null
      fs.readFile(toPath(hash), opts && opts.encoding, cb)
    },
    add: function (data, opts, cb) {
      if(!cb) cb = opts, opts = null
      var encoding = opts && opts.encoding
      var hash = h.shasum(data, encoding)
      var tmpfile = randomPath(), target = toPath(hash)
      db.has(hash, function (err) {
        //this is already in the database
        if(!err) return cb(null, hash, true)
        writeFile(tmpfile, data, encoding, function (err) {
          if(err) return cb(err)
          mkdirp(path.dirname(target), function (err) {
            if(err) return cb(err)
            fs.rename(tmpfile, target, function (err) {
              cb(err, hash)
            })
          })
        })
      })
    },
    addStream: function (opts) {
      var enc = opts && opts.encoding
      var stream = h.shastream(enc)

      prepare(stream, function () {
        var tmpfile = randomPath()
        var closed = false
        stream
          .pipe(fs.createWriteStream(tmpfile))
          .on('error', function (err) {
            stream.emit('error', err)
          })
          .on('close', onClose)

        function onClose () {
          if(closed) return
          closed = true
          var target = toPath(stream.hash)
          mkdirp(path.dirname(target), function (err) {
            if(err) return stream.emit('error', err)
            fs.rename(tmpfile, target, function (err) {
              if(err) return stream.emit('error', err)
              stream.emit('finish')
              stream.emit('close')
            })
          })
        }
      })
      return stream
    },
    getStream: function (hash) {
      return fs.createReadStream(toPath(hash))
    },
    createStream: function (hash) {
      return this.getStream(hash)
    },
    has: function (hash, cb) {
      fs.stat(toPath(hash), cb)
    },
    all: function (cb) {
      var all = [], n = 0
      fs.readdir(dir, function (err, ls) {
        if(err) return done(err)

        n = ls.length
        ls.forEach(function (d) {
          fs.readdir(path.join(dir, d), function (err, ls) {
            ls.forEach(function (e) {
              all.push(d + e)
            })
            done()
          })
        })
      })

      function done (err) {
        if(err && n >= 0) return n = -1, cb(err)
        if(--n) return
        cb(null, all.sort())
      }
    },
    isHash: function (string) {
      return rxHash.test(string)
    }
  }
}
