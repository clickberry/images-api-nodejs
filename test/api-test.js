// env
if (!process.env.TOKEN_ACCESSSECRET) {
  console.log("TOKEN_ACCESSSECRET environment variable required.");
  process.exit(1);
}
if (!process.env.REDIS_ADDRESS) {
  console.log("REDIS_ADDRESS environment variable required.");
  process.exit(1);
}
if (!process.env.S3_BUCKET) {
  console.log("S3_BUCKET environment variable required.");
  process.exit(1);
}

var app = require('..');
var request = require('supertest');
var assert = require('assert');
var uuid = require('node-uuid');
var jwt = require('jsonwebtoken');
var imageFilePath = 'test/files/test.png';
var nonImageFilePath = 'test/files/test.json';

function getAuthToken(userId) {
  return jwt.sign({ userId: userId }, process.env.TOKEN_ACCESSSECRET);
}

function createItem(fn) {
  var userId = uuid.v4();
  var auth_token = getAuthToken(userId);

  request(app)
    .post('/?auth_token=' + auth_token)
    .attach('image', imageFilePath)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(201)
    .end(function (err, res) {
      fn(err, { body: res.body, auth_token: auth_token });
    });
}

describe('GET /', function () {
  var id = uuid.v4();
  it('get unexisting image', function (done) {
    request(app)
      .get('/' + id)
      .expect(404, done);
  });
});

describe('POST /', function () {
  this.timeout(30000);

  var image = {};
  var image_auth_token;

  after(function (done) {
    request(app)
      .del('/' + image.id + '?auth_token=' + image_auth_token)
      .expect(200)
      .end(done);
  });

  it('create image without authorization', function (done) {
    request(app)
      .post('/')
      .attach('avatar', imageFilePath)
      .expect(401, done);
  });

  it('create image with non-image file', function (done) {
    var userId = uuid.v4();
    var auth_token = getAuthToken(userId);

    request(app)
      .post('/?auth_token=' + auth_token)
      .attach('image', nonImageFilePath)
      .expect(400, done);
  });

  it('create image', function (done) {
    createItem(function (err, data) {
      if (err) { return done(err); }
      image = data.body;
      image_auth_token = data.auth_token;
      done();
    });
  });

  it('get file by url', function (done) {
    request(app)
      .head(image.url)
      .expect(200)
      .end(done);
  });

  it('query by id', function (done) {
    request(app)
      .get('/' + image.id)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(image, done);
  });
});

describe('DELETE /', function () {
  var image = {};
  var image_auth_token;

  it('create image', function (done) {
    createItem(function (err, data) {
      if (err) { return done(err); }
      image = data.body;
      image_auth_token = data.auth_token;
      done();
    });
  });

  it('delete image without authorization', function (done) {
    request(app)
      .del('/' + image.id)
      .expect(401, done);
  });

  it('delete by id', function (done) {
    request(app)
      .del('/' + image.id + '?auth_token=' + image_auth_token)
      .expect(200, done);
  });
});
