var express = require('express');
var apicache = require('../lib/apicache');
var cache = apicache.middleware;

var app = module.exports = function(expiration) {
  var app = express();

  var movies = [{
    title: 'The Prestige',
    director: 'Christopher Nolan',
  },{
    title: 'Schindler\'s List',
    director: 'Steven Spielberg'
  }];

  app.use(cache(expiration));

  app.get('/api/movies', function(req, res) {
    app.requestsProcessed++;

    res.json(movies);
  });

  app.get('/api/movies/:index', function(req, res) {
    app.requestsProcessed++;

    res.json(movies[index]);
  });

  app.apicache = apicache;
  app.requestsProcessed = 0;

  return app;
};