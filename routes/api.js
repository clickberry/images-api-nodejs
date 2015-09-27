// env
if (!process.env.S3_BUCKET) {
  console.log("S3_BUCKET environment variable required.");
  process.exit(1);
}

var bucket = process.env.S3_BUCKET;
var maxFileSize = process.env.MAX_FILE_SIZE ?
      parseInt(process.env.MAX_FILE_SIZE, 10) : 1024 * 1024 * 10; // 10MB by default

var url = require("url");
var path = require("path");
var express = require('express');
var router = express.Router();
var debug = require('debug')('clickberry:images:api');
var multiparty = require('multiparty');
var uuid = require('node-uuid');

var passport = require('passport');
require('../config/jwt')(passport);

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var Image = require('../lib/image');
var ImageModel = require('../lib/image-model');

function isFormData(req) {
  var type = req.headers['content-type'] || '';
  return 0 === type.indexOf('multipart/form-data');
}

function getBlobUrl(bucket_name, key_name) {
  return 'https://' + bucket_name + '.s3.amazonaws.com/' + key_name;
}

function checkFileSize(res, bytesCount) {
  return maxFileSize >= bytesCount;
}

function checkIsImageFile(res, mimetype) {
  return 0 === mimetype.indexOf('image/');
}

router.get('/heartbeat', function (req, res) {
  res.send();
});

router.post('/',
  passport.authenticate('access-token', { session: false, assignProperty: 'payload' }),
  function (req, res, next) {
    if (!isFormData(req)) {
      return res.status(400).send({ message: 'Bad Request: expecting multipart/form-data' });
    }

    var image = new Image({
      id: uuid.v4(),
      userId: req.payload.userId
    });

    // upload blob
    var key = uuid.v4();
    var form = new multiparty.Form();

    form.on('part', function (part) {
      if (!checkFileSize(res, part.byteCount)) {
        return res.status(400).send({ message: 'File is too large.' });
      }
      if (!checkIsImageFile(res, part.headers['content-type'])) {
        return res.status(400).send({ message: 'Bad Request: expecting image/* file' });
      }

      debug("Uploading file of size: " + part.byteCount);

      s3.putObject({
        Bucket: bucket,
        Key: key,
        ACL: 'public-read',
        Body: part,
        ContentLength: part.byteCount,
        ContentType: part.headers['content-type']
      }, function (err) {
        if (err) { return next(err); }

        var url = getBlobUrl(bucket, key);
        debug("Image " + image.id + " file uploaded to " + url);

        // validate model
        image.url = url;
        var imageModel = ImageModel.create();
        imageModel.update(image, '*');

        imageModel.validate().then(function () {
          if (imageModel.isValid) {
            image.save(function (err) {
              if (err) { return next(err); }

              var json = imageModel.toJSON();
              debug("Image created: " + JSON.stringify(json));
              res.status(201).send(json);
            });
          } else {
            res.status(400).send({ errors: imageModel.errors });
          }
        });
      });
    });
    form.on('error', function (err) {
      return next(err);
    });

    form.parse(req);
  });

router.get('/:id',
  function (req, res, next) {
    Image.get(req.params.id, function (err, data) {
      if (err) { return next(err); }
      if (!data) {
        return res.status(404).send({ message: 'Resource not found' });
      }

      var imageModel = ImageModel.create();
      imageModel.update(data);

      var json = imageModel.toJSON();
      res.json(json);
    });
  });

router.put('/:id',
  passport.authenticate('access-token', { session: false, assignProperty: 'payload' }),
  function (req, res, next) {
    if (!isFormData(req)) {
      return res.status(400).send({ message: 'Bad Request: expecting multipart/form-data' });
    }

    Image.get(req.params.id, function (err, data) {
      if (err) { return next(err); }
      if (!data) {
        return res.status(404).send({ message: 'Resource not found' });
      }

      var originalUrl = data.url;

      var image = new Image({
        id: req.params.id,
        userId: data.userId // preserve original userId
      });
        
      // replace file
      var form = new multiparty.Form();

      form.on('part', function (part) {
        if (!checkFileSize(res, part.byteCount)) {
          return res.status(400).send({ message: 'File is too large.' });
        }
        if (!checkIsImageFile(res, part.headers['content-type'])) {
          return res.status(400).send({ message: 'Bad Request: expecting image/* file' });
        }

        debug("Uploading file of size: " + part.byteCount);

        var key = uuid.v4();
        s3.putObject({
          Bucket: bucket,
          Key: key,
          ACL: 'public-read',
          Body: part,
          ContentLength: part.byteCount,
          ContentType: part.headers['content-type']
        }, function (err) {
          if (err) { return next(err); }

          var url = getBlobUrl(bucket, key);
          debug("Image " + image.id + " file uploaded to " + url);

          // validate model
          image.url = url;
          var imageModel = ImageModel.create();
          imageModel.update(image, '*');

          imageModel.validate().then(function () {
            if (imageModel.isValid) {
              image.update(function (err) {
                if (err) { return next(err); }

                // delete original file
                var parsedUrl = url.parse(originalUrl);
                var originalKey = path.basename(parsedUrl.pathname);
                s3.deleteObject({
                  Bucket: bucket,
                  Key: originalKey,
                }, function (err) {
                  if (err) { return next(err); }

                  debug("Image " + image.id + " original file deleted at " + originalUrl);

                  var json = imageModel.toJSON();
                  debug("Image updated: " + JSON.stringify(json));
                  res.status(200).send(json);
                });
              });
            } else {
              res.status(400).send({ errors: imageModel.errors });
            }
          });
        });
      });
      form.on('error', function (err) {
        return next(err);
      });

      form.parse(req);
    });
  });

router.delete('/:id', function (req, res, next) {
  Image.get(req.params.id, function (err, data) {
    if (err) { return next(err); }
    if (!data) {
      return res.status(404).send({ message: 'Resource not found' });
    }

    Image.del(req.params.id, function (err) {
      if (err) { return next(err); }

      var image = data;

      // delete file
      var parsedUrl = url.parse(image.url);
      var key = path.basename(parsedUrl.pathname);
      s3.deleteObject({
        Bucket: bucket,
        Key: key,
      }, function (err) {
        if (err) { return next(err); }

        var imageModel = ImageModel.create();
        imageModel.update(image, '*');
        var json = imageModel.toJSON();

        debug("Image deleted: " + JSON.stringify(json));
        res.send();
      });
    });
  });
});

module.exports = router;
