# content-addressable-store

A content addressable store, that can be streamed to.

## example

``` js
var db = require('content-addressable-store')('/tmp/my-store', 'sha256')

//add a document, and get the hash
db.add('CONTENT', function (err, hash) {
  if(err) throw err //handle error
  console.log(hash) //the "key" of the document.
})

// or as a stream:

inputStream
  .pipe(db.addStream())
  .on('error', function (err) {
    throw err //handle error
  })
  .on('close', function () {
    console.log(this.hash)
  })
```

## API

### ContentAddressableStore(path, alg)

``` js
var ContentAddressableStore = require('content-addressable-store')
var CAS = ContentAddressableStore(path, alg)
```

`path` is the director where the content should be stored.
`alg` is the hashing algorithm, or a `createHash` function
that does not require a algorithm.

This function returns an instance of the content addressable store.

### add(content, opts, cb(err, hash, cached))

Add `content` to the database.
specify encoding via `opts={encoding: 'utf8'}`.
you must specify an encoding to get the correct hash,
unless the content is a buffer.

`cached=truthy` means that the objects was already in the store, and was not added.

### addStream (opts)

Add a stream to the database. A file will be written to a temporary
location, and then copied, to ensure durability.

### get (hash, opts, cb(err, content))

get the content for `hash`. specify encoding as above.

### getStream (hash, opts)

get the content for `hash` as a stream. 
specify encoding as above.

### has (hash, cb(err, stat))

Returns an error if that hash is not already in the database.
stats on the file are returned as the second callback argument.
since it this module will be rewritten to use leveldb (etc)
the only property of the `stat` that should be relied upon is
`{size: sizeOfFile}`

### all (cb(err, ary))

get an array of all hashes in the store.

### isHash(string)

returns true if this string is a valid hash for this content addressable store.
(checks whether it is the correct length of hex characters)

### del (hash, cb)

*NOT SUPPORTED*.
This would complexify content-addressable-store greatly
beyond the current ~100 lines, because of the need for locking.



## License

MIT
