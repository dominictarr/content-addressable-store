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

  function toPath (hash) {
    return path.join(dir, hash.substring(0, 2), hash.substring(2))
  }

  function randomPath () {
    return path.join(dir, 'tmp', Date.now() + '-' + Math.random().toString().substring(2))
  }

  var init = false

  //make sure the /tmp directory exists (first write only)
  function prepare (stream, ready) {
    if(init) return ready()
    stream.pause()
    mkdirp(path.join(dir, 'tmp'), function (err) {
      if(err) return stream.emit('error', err)
      init = true
      console.log('resume')
      ready()
      stream.resume()
    })
  }

  var db
  return db = {
    get: function (hash, opts, cb) {
      if(!cb) cb = opts, opts = null
      fs.readFile(toPath(hash), opts && opts.encoding, cb)
    },
    add: function (content, opts, cb) {
      if(!cb) cb = opts, opts = null
      var encoding = opts && opts.encoding
      var hash = shasum(content, encoding)
      db.has(hash, function (err) {
        //this is already in the database
        if(!err) return cb(null, hash)
        var tmpfile = randomPath(), target = toPath(hash)
        fs.writeFile(tmpfile, content, encoding, function (err) {
          if(err) return cb(err)
          mkdirp(target, function (err) {
            if(err) return cb(err)
            fs.rename(tmpfile, toPath(hash), function (err) {
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
        console.log('prepare', tmpfile)
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

