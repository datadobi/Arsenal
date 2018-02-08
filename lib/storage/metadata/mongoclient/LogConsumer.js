'use strict'; // eslint-disable-line

const async = require('async');
const stream = require('stream');
const MongoClient = require('mongodb').MongoClient;

const ops = {
    i: 'insert',
    u: 'update',
    d: 'delete',
};

class ListRecordStream extends stream.Transform {
    constructor(logger) {
        super({ objectMode: true });
        this.logger = logger;
    }

    _transform(itemObj, encoding, callback) {
        // eslint-disable-next-line no-param-reassign
        itemObj.o.type = ops[itemObj.op];
        // eslint-disable-next-line no-param-reassign
        itemObj.o.key = itemObj.o._id;
        // eslint-disable-next-line no-param-reassign
        delete itemObj.o._id;
        this.push(itemObj.o);
        callback();
    }
}

/**
 * @class
 * @classdesc Class to consume mongo oplog
 */
class LogConsumer {

    /**
     * @constructor
     *
     * @param {string} host - string that is MongoDB host
     * @param {number} port - port at host name for MongoDB instance
     * @param {string} database - name of database to get replica set oplogs
     */
    constructor(mongoConfig, logger) {
        const { host, port, database, writeConcern, replicaSet, readPreference } = mongoConfig;
        // need a way to connect to master
        // might have to use all replica set members in uri? http://mongodb.github.io/node-mongodb-native/3.0/tutorials/connect/

        // can have second argument {ts: timestamp} to call only entries from some number
        // this ts gets translated to find({ts: {$gt: ts }}) in mongo language
        // but if have it here on instantiation, won't work.  we are sending the sequence on
        // each read call.
        // so might be better to do query like this directly (without module)
// https://github.com/cayasso/mongo-oplog/blob/master/src/stream.js#L28

        // and then use the stream method in the same way to get just the number
        // of entries needed -- http://mongodb.github.io/node-mongodb-native/3.0/api/Cursor.html#stream

        this.database = database;
        // this.mongoUrl = format(
        //     'mongodb://%s:%s/local',
        //     host,
        //     port);
        this.mongoUrl = 'mongodb://localhost:27018,localhost:27017,localhost:27019/local';
        this.logger = logger;
    }

    /**
     * Connect to MongoClient using Mongo node module to access database and
     * database oplogs (operation logs)
     *
     * @param {function} done - callback function, called with an error object
     * or null and an object as 2nd parameter
     * @return {undefined}
    */
    connectMongo(done) {
        MongoClient.connect(this.mongoUrl, { replicaSet: 'rs0' },
        (err, client) => {
            if (err) {
                this.logger.error('Unable to connect to MongoDB', err);
                return done(err);
            }
            this.logger.info('connected to mongodb');
            this.client = client;
            this.db = client.db(this.database, {
                ignoreUndefined: true,
            });
            return done();
        });
    }
    /**
     * Read a series of log records from mongo
     *
     * @param {Object} [params] - params object
     * @param {Number} [params.startSeq] - fetch starting from this
     *   sequence number
     * @param {Number} [params.limit] - maximum number of log records
     *   to return
     * @param {function} cb - callback function, called with an error
     *   object or null and an object as 2nd parameter
     * // CONTINUE HERE!!!
     *   object.info contains ...
     *   object.log contains ... (see recordstream below) and _processPrepareEntries function
     * in backbeat. batchState.logRes is object.log from here.
     *
     * @return {undefined}
     */
    readRecords(params, cb) {
        const recordStream = new ListRecordStream(this.logger);
        const limit = params.limit || 10000;
        // need to somehow limit entries to limit and then stop the stream

        return async.waterfall([
            next => {
                this.coll = this.db.collection('oplog.rs');
                return next();
            },
            next => {
                return this.coll.find({
                    ns: /^(?!.*metadata.*(?:__)).*metadata\.\w+.*/,
                }, {
                    limit,
                    tailable: false,
                    awaitData: false,
                    noCursorTimeout: true,
                    OplogReplay: true,
                    numberOfRetries: Number.MAX_VALUE,
                }, (err, res) => {
                    console.log('LOG RESPONSE', res);
                    const stream = res.stream();
                    stream.on('data', data => {
                        recordStream.write(data);
                    });
                    stream.on('error', data => {
                        this.logger.error(data);
                    });
                    stream.on('end', () => {
                        recordStream.end();
                        return next(null, { info: res, log: recordStream });
                    });
                });
            },
        ], cb);
    }
}
//
// const tester = new LogConsumer({ host: '127.0.0.1', port: ['27017'],
//     database: 'local', writeConcern: 'majority', replicaSet: 'rs0',
//     readPreference: 'primary' }, console);
//
// tester.connectMongo(() => {
//     return async.waterfall([
//         next => {
//             return tester.readRecords({}, (err, res) => {
//                 console.log('cb called for read records');
//                 res.log.on('data', data => {
//                    console.log('Streamed formatted data', data);
//                 });
//                 res.log.on('end', () => {
//                     console.log('ENDED');
//                     return next();
//                 });
//             });
//         },
//     ], () => {});
// });

module.exports = LogConsumer;

//
// sample put:
//
// insert!!  { ts: Timestamp { _bsontype: 'Timestamp', low_: 1, high_: 1516323641 },
//   t: 1,
//   h: Long { _bsontype: 'Long', low_: -1207597211, high_: -1765392211 },
//   v: 2,
//   op: 'i',
//   ns: 'metadata.hello',
//   ui:
//    Binary {
//      _bsontype: 'Binary',
//      sub_type: 4,
//      position: 16,
//      buffer: <Buffer 66 bd 4e 7d 0b 92 4a 12 b8 cc 77 b1 26 8a 94 cb> },
//   wall: 2018-01-19T01:00:41.798Z,
//   o:
//    { _id: 'stuff4',
//      value:
//       { 'owner-display-name': 'Bart',
//         'owner-id': '79a59df900b949e55d96a1e698fbacedfd6e09d98eacf8f8d5218e7cd47ef2be',
//         'content-length': 508,
//         'content-type': 'binary/octet-stream',
//         'content-md5': '656c3fe292407ccfdc9b125b37cc1930',
//         'x-amz-version-id': 'null',
//         'x-amz-server-version-id': '',
//         'x-amz-storage-class': 'STANDARD',
//         'x-amz-server-side-encryption': '',
//         'x-amz-server-side-encryption-aws-kms-key-id': '',
//         'x-amz-server-side-encryption-customer-algorithm': '',
//         'x-amz-website-redirect-location': '',
//         acl: [Object],
//         key: '',
//         location: [Object],
//         isDeleteMarker: false,
//         tags: {},
//         replicationInfo: [Object],
//         dataStoreName: 'us-east-1',
//         'last-modified': '2018-01-19T01:00:41.797Z',
//         'md-model-version': 3,
//         'x-amz-meta-s3cmd-attrs': 'uid:501/gname:staff/uname:lhs/gid:20/mode:33188/mtime:1508801827/atime:1516323377/md5:656c3fe292407ccfdc9b125b37cc1930/ctime:1508801827' } } }

  //       sample update:
  //
  //       update!!  { ts: Timestamp { _bsontype: 'Timestamp', low_: 1, high_: 1516323702 },
  // t: 1,
  // h: Long { _bsontype: 'Long', low_: -1991728232, high_: -721376083 },
  // v: 2,
  // op: 'u',
  // ns: 'metadata.hello',
  // ui:
  //  Binary {
  //    _bsontype: 'Binary',
  //    sub_type: 4,
  //    position: 16,
  //    buffer: <Buffer 66 bd 4e 7d 0b 92 4a 12 b8 cc 77 b1 26 8a 94 cb> },
  // o2: { _id: 'stuff4' },
  // wall: 2018-01-19T01:01:42.050Z,
  // o:
  //  { _id: 'stuff4',
  //    value:
  //     { 'owner-display-name': 'Bart',
  //       'owner-id': '79a59df900b949e55d96a1e698fbacedfd6e09d98eacf8f8d5218e7cd47ef2be',
  //       'content-length': 508,
  //       'content-type': 'binary/octet-stream',
  //       'content-md5': '656c3fe292407ccfdc9b125b37cc1930',
  //       'x-amz-version-id': 'null',
  //       'x-amz-server-version-id': '',
  //       'x-amz-storage-class': 'STANDARD',
  //       'x-amz-server-side-encryption': '',
  //       'x-amz-server-side-encryption-aws-kms-key-id': '',
  //       'x-amz-server-side-encryption-customer-algorithm': '',
  //       'x-amz-website-redirect-location': '',
  //       acl: [Object],
  //       key: '',
  //       location: [Object],
  //       isDeleteMarker: false,
  //       tags: {},
  //       replicationInfo: [Object],
  //       dataStoreName: 'us-east-1',
  //       'last-modified': '2018-01-19T01:01:42.022Z',
  //       'md-model-version': 3,
  //       'x-amz-meta-s3cmd-attrs': 'uid:501/gname:staff/uname:lhs/gid:20/mode:33188/mtime:1508801827/atime:1516323641/md5:656c3fe292407ccfdc9b125b37cc1930/ctime:1508801827' } } }
  //
  //
  //
  //       sample delete:
  //
  //       delete!!  { ts: Timestamp { _bsontype: 'Timestamp', low_: 1, high_: 1516323746 },
  // t: 1,
  // h: Long { _bsontype: 'Long', low_: 2036516563, high_: 689237179 },
  // v: 2,
  // op: 'd',
  // ns: 'metadata.hello',
  // ui:
  //  Binary {
  //    _bsontype: 'Binary',
  //    sub_type: 4,
  //    position: 16,
  //    buffer: <Buffer 66 bd 4e 7d 0b 92 4a 12 b8 cc 77 b1 26 8a 94 cb> },
  // wall: 2018-01-19T01:02:26.962Z,
  // o: { _id: 'stuff4' } }
  //
