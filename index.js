var mkdirp  = require('mkdirp')
var through = require('through')
var crypto  = require('crypto')
var path    = require('path')
var fs      = require('fs')

function shastream (enc) {
  var hash = crypto.createHash('sha1')
  return through(function (data) {
    hash.update(data, enc)
    this.push(data)
  }, function () {
    this.hash = hash.digest('hex')
    this.push(null)
  }, {autoDestroy: false})
}

function shasum (data, enc) {
  return crypto.createHash('sha1').update(data, enc).digest('hex')
}

module.exports = function (dir) {
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

  return db = {
    get: function (hash, opts, cb) {
      if(!cb) cb = opts, opts = null
      fs.readFile(toPath(hash), opts && opts.encoding, cb)
    },
    add: function (data, opts, cb) {
      if(!cb) cb = opts, opts = null
      var encoding = opts && opts.encoding
      var hash = shasum(data, encoding)
      var tmpfile = randomPath(), target = toPath(hash)
      db.has(hash, function (err) {
        //this is already in the database
        if(!err) return cb(null, hash)
        fs.writeFile(tmpfile, data, encoding, function (err) {
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
      var stream = shastream(enc)

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
    has: function (hash, cb) {
      fs.stat(toPath(hash), cb)
    }
  }
}
