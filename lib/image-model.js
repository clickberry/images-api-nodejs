var model = require('nodejs-model');

var Image = model("Image").attr('id', {
  validations: {
    presence: {
      message: 'id is required!'
    }
  }
}).attr('url', {
  validations: {
    presence: {
      message: 'url is required!'
    }
  }
}).attr('userId', {
  validations: {
    presence: {
      message: 'userId is required!'
    }
  },
  tags: ['private']
});

module.exports = Image;