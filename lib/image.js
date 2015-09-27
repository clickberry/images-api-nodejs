// env
if (!process.env.REDIS_ADDRESS) {
  console.log("REDIS_ADDRESS environment variable required.");
  process.exit(1);
}

var uuid = require('node-uuid');
var redis = require('redis');
var db = redis.createClient(parseInt(process.env.REDIS_PORT, 10) || 6379, 
  process.env.REDIS_ADDRESS);

function Image(obj) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      this[key] = obj[key];
    }
  }
}

Image.get = function (id, fn) {
  db.hgetall('image:' + id, function (err, data) {
    if (err) { return fn(err); }
    if (!data) { return fn(); }
    fn(null, new Metadata(data));
  });
};

Image.prototype.save = function (fn) {
  if (!this.id) {
    this.id = uuid.v4();
  }

  this.update(fn);
};

Image.prototype.update = function (fn) {
  var image = this;
  var id = image.id;
  if (!id) {
    return fn(new Error('Image id required!'));
  }

  // update image
  db.hmset('image:' + id, image, function (err) {
    fn(err);
  });
};

Image.del = function (id, fn) {
  Image.get(id, function (err, data) {
    if (err) { return fn(err); }

    // delete image
    db.del('image:' + id, function (err) {
      if (err) { return fn(err); }
      fn(null, data);
    });
  });
};

module.exports = Image;