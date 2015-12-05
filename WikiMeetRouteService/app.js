var express = require('express'),
   logger = require('morgan'),
   bodyParser = require('body-parser'),
   methodOverride = require('method-override'),
   session = require('express-session'),
   sqlite3 = require('sqlite3').verbose();
var functions = require('./functions.js'); //funct file contains our helper functions for our Passport and database work
var app = express();

//===============EXPRESS================
//Configure Express
app.use(logger('combined'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));

//===============ROUTES===============

//Used to publish a link to the database
app.get('/addlink', function(req, res){
   var source = req.query.source;
   var target = req.query.target;
   functions.addLink(source, target, function(linkResult)
      {
         res.writeHead(200, {"Content-Type": "text/plain"});
         if(linkResult == "NEW")
         {
            res.end("New link from " + source + " to " + target + " discovered!");
         }
         else
         {
            res.end("");
         }
      }
   );
});

//Used to publish a route to the database
//A route is a starting point to any destination, but does not include subgraphs
app.get('/addroute', function(req, res){
   var source = req.query.source;
   var target = req.query.target;
   var user = req.query.user;
   var steps = req.query.steps;
   functions.addRoute(source, target, user, steps, function(routeResult)
      {  
         res.writeHead(200, {"Content-Type": "text/plain"});
         if(routeResult == "NEW")
         {
            res.end("New route from " + source + " to " + target + " discovered!");
         }
         else if(routeResult == "IMPROVED")
         {
            res.end("Route from " + source + " to " + target + " improved to " + steps + " steps!");
         }
         else
         {
            res.end("");
         }
      }
   );
});

app.get('/showroutes', function(req, res){
   console.log("Showing routes");
   var maxResults = req.query.max;
   functions.getRoutes(maxResults, function(routeResults)
      {
         var jsonRet = [];
         for(i = 0; i < routeResults.length; i++)
         {
            var obj = {
                  user: routeResults[i].user,
                  source: routeResults[i].source,
                  target: routeResults[i].target,
                  steps: routeResults[i].steps
            }
            jsonRet.push(obj);
         }
         res.json(jsonRet);
      }
   );
});

//===============PORT=================
var port = process.env.PORT || 5001; //select your port or let it pull from your .env file
app.listen(port);
console.log("listening on " + port + "!");
