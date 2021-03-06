'use strict'
const topology = require('fully-connected-topology');
const hashToPort = require('hash-to-port');
const scuttleup = require('scuttleup');
const level = require('level');
const request = require('request');
const address = require('network-address');
const crypto = require('crypto');

const endpoint = `https://p2pdiscoverserver-yuzuolyemd.now.sh`;
// const endpoint = `http://localhost:8000`;

const addUser = (username, cb) => {
  console.log('adding user...');
  const hash = crypto.createHash('sha1');
  const objectId = hash.update(username).digest('hex');
  let joinUrl = `${endpoint}/join?placeholder=&ip=${address()}:${hashToPort(username)}&id=${objectId}`;
  request.post(joinUrl, (err, res, body) => {
    if (err) console.log(err);
    cb(body);
  });
};

const findUser = (peer, cb) => {
  console.log('finding user...');
  const hash = crypto.createHash('sha1');
  const objectId = hash.update(peer).digest('hex');
  let joinUrl = `${endpoint}/join?placeholder=&id=${objectId}`;
  request(joinUrl, (err, res, body) => {
    if (err) console.log(err);
    console.log(body);
    cb(JSON.parse(body));
  });
}

const toAddress = (username) => {
  return address() + ':' + hashToPort(username);
};

const me = process.argv[2];
const peer = process.argv[3];

let seq = 0;
let id = Math.random();

// start the connection
addUser(me, () => {
  findUser(peer, initialize);
});

let initialize = (peer) => {
  console.log(peer);
  let t = topology(toAddress(me), peer);
  let db = level(me + '.db');
  let logs = scuttleup(db) // use a database per user

  t.on('connection', (socket, id) => {
    t.add(id);
    console.log('info> new connection from', id);
    socket.pipe(logs.createReplicationStream({live: true})).pipe(socket);

    logs.createReadStream({live: true})
      .on('data', (data) => {
        let messageObject = JSON.parse(data.entry.toString());
        if (messageObject.seq > seq) {
          process.stdout.write(messageObject.username + ': ' + messageObject.message);
          seq = messageObject.seq;
        }
      });
  })

  process.stdin.on('data', (data) => {
    seq++;
      let messageObject = {'username': me, 'message': data.toString(), 'seq': seq, 'id': id};
      logs.append(JSON.stringify(messageObject));
  });
}

