var express = require('express'),
   exphbs = require('express-handlebars'),
   logger = require('morgan'),
   cookieParser = require('cookie-parser'),
   bodyParser = require('body-parser'),
   methodOverride = require('method-override'),
   session = require('express-session'),
   passport = require('passport'),
   LocalStrategy = require('passport-local'),
   TwitterStrategy = require('passport-twitter'),
   GoogleStrategy = require('passport-google'),
   FacebookStrategy = require('passport-facebook'),
   sqlite3 = require('sqlite3').verbose(),
   crypto = require('crypto');
var functions = require('./functions.js'); //funct file contains our helper functions for our Passport and database work
var app = express();
var activeUsername = "";
// ...
//Use the LocalStrategy within Passport to login/”signin” users.
passport.use('local-signin', new LocalStrategy(
   {
      passReqToCallback : true
   }, //allows us to pass back the request to the callback
   function(req, username, password, done) {
      functions.localAuthorization(username, password)
      .then(function (user) {
         if (user) {
            console.log("LOGGED IN AS: " + user.username);
            req.session.success = 'You are successfully logged in ' + user.username + '!';
            activeUsername = user.username;
            done(null, user);
         }
         if (!user) {
            console.log("COULD NOT LOG IN");
            req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
            done(null, false);
         }
      })
      .fail(function (err){
         console.log(err.body);
         done(null, false)
      });
   }
));
//Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy({
   passReqToCallback : true
   }, //allows us to pass back the request to the callback
   function(req, username, password, done) {
      functions.localRegistration(username, password)
         .then(function (user) {
            if (user) {
               console.log("REGISTERED: " + user.username);
               req.session.success = 'You are successfully registered and logged in ' + user.username + '!';
               req.user = user.username;
               activeUsername = user.username;
               done(null, user);
            }
            if (!user) {
               console.log("COULD NOT REGISTER");
               req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
               done(null, false);
            }
         })
         .fail(function (err) {
            console.log(err.body);
            done(null, false)
         });
      }
   )
);

passport.serializeUser(function(user, done) {
   console.log("SERIAZIZEUSER: " + user.id);
   
   return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
   console.log("DESERIALIZE USER, ID:" + id);
   var db = new sqlite3.Database('./database.db');

   db.get('SELECT id, username FROM users WHERE id = ?',id, function(err, row) {
      console.log(err)
      if (!row) { 
         console.log("Bad row");
         done(null, false);
      }
      else
      {
         var user = {
               "username" : row.username,
               "id" : row.id
         };
         console.log("DESERIAZIZEUSER: " + user.username);

         done(null, user);
      }
   });
   db.close();
});

//===============EXPRESS================
//Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//Session-persisted message middleware
app.use(function(req, res, next){
   var err = req.session.error,
       msg = req.session.notice,
       success = req.session.success;
   
   delete req.session.error;
   delete req.session.success;
   delete req.session.notice;
   
   if (err) res.locals.error = err;
   if (msg) res.locals.notice = msg;
   if (success) res.locals.success = success;
   
   next();
});

//Configure express to use handlebars templates
var hbs = exphbs.create({defaultLayout: 'main',});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

//===============ROUTES===============

//displays our homepage
app.get('/', function(req, res){
   res.render('home', {user: req.user});
});

//displays our signup page
app.get('/signin', function(req, res){
 res.render('signin');
});

//displays our dashboard page
app.get('/dashboard',
 function(req, res){
    res.render('dashboard', {user: req.user.username});
 }
);

//displays our dashboard page
app.get('/newgame',
function(req, res){
  res.render('newgame', {user: req.user.username});
}
);

//Routes a new easy game for the user
app.get('/neweasy', 
   function(req, res){
      functions.getRandomWikiPage(function(title){
         //title = title.replace(/ /g, "_");
         var game = {
               id       : 1,
               start  : title,
               target   : "Philosophy",
               stepCount : -1,
               current : title
         };
         req.url = functions.buildURLFromGameInfo(game);
         console.log(req.url);
         res.redirect(req.url); 
      })
   }
);

//displays our dashboard page
app.get('/gamescreen',
   function(req, res) 
   {
      var game = {
            id          : req.query.id,
            start       : req.query.start,
            target      : req.query.target,
            stepCount   : req.query.count,
            current     : req.query.current
      };
      console.log("GAME: " + req.query.id);
      console.log("GAME: " + req.query.start);
      console.log("GAME: " + req.query.target);
      console.log("GAME: " + req.query.count);
      console.log("GAME: " + req.query.current);
      functions.transformWikiPage(req.query.current, game, function(html) 
         {
            var parameter = {user: req.user.username, transformedWiki: html, game: game, parameter: false};
            if(req.query.current == req.query.target)
            {
               parameter.finished = true;
            }
            else
            {
               parameter.finished = null;
            }
            console.log(parameter.finished);
            res.render('gamescreen', parameter);
         }
      );
   }
);

//sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/local-reg', passport.authenticate('local-signup', {
      successRedirect: '/dashboard',
      failureRedirect: '/signin'
   })
);

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', { 
      successRedirect: '/dashboard',
      failureRedirect: '/signin'
   })
);

//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
   var name = req.user.username;
   console.log("LOGGIN OUT " + req.user.username)
   req.logout();
   res.redirect('/');
   req.session.notice = "You have successfully been logged out " + name + "!";
});


//===============PORT=================
var port = process.env.PORT || 5000; //select your port or let it pull from your .env file
app.listen(port);
console.log("listening on " + port + "!");
