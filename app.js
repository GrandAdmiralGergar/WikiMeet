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
var fbConfig = require('./fb.js');
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

///Set up the passport Facebook strategy
passport.use('facebook', new FacebookStrategy({
      clientID        : fbConfig.appID,
      clientSecret    : fbConfig.appSecret,
      callbackURL     : fbConfig.callbackUrl
   }, function(access_token, refresh_token, profile, done) 
      {
      // facebook will send back the tokens and profile
         console.log("Facebook info: ");
         console.log("profile: id:" + profile.id );
         console.log("profile: name:" + profile.displayName );
         console.log("profile: last:" + profile.last_name);
         // asynchronous
         process.nextTick(function() 
            {
            
               // find the user in the database based on their facebook id
               functions.userExistsById(profile.id)
               .then(function(result)
                  {
                     // if the user is found, then log them in
                     if (result) 
                     {
                        activeUsername = result.username;
                        return done(null, result); // user found, return that user
                     } 
                     else 
                     {
                        // if there is no user found with that facebook id, create them
                        var username = profile.displayName;
                        functions.addUser(username, profile.id, access_token, "")
                        .then(function(user)
                           {
                              activeUsername = user.username;
                              // if successful, return the new user
                              return done(null, user);
                           }
                        );
                     }
                  }
               );
            }
         );
      }
   )
);

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
       success = req.session.success,
       value = req.session.value;

   delete req.session.error;
   delete req.session.success;
   delete req.session.notice;
   delete req.session.value;
   
   if (err) res.locals.error = err;
   if (msg) res.locals.notice = msg;
   if (success) res.locals.success = success;
   if (value) res.locals.value = value;
   
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

//route for facebook authentication and login
//different scopes while logging in
app.get('/auth/facebook', 
passport.authenticate('facebook', { scope : 'public_profile' }
));

//handle the callback after facebook has authenticated the user
app.get('/auth/facebook/callback',
passport.authenticate('facebook', {
 successRedirect : '/dashboard',
 failureRedirect : '/'
})
);


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

//displays our continue
app.get('/continue',
 function(req, res){
   functions.unfinishedGames(req.user.username)
   .then(function(results) {
      console.log(results);
      res.render('continuegame', {user: req.user.username, games:results});      
   })
   .fail(function() {
      res.render('continuegame', {user: req.user.username});    
   });
 }
);

//Routes a new easy game for the user
app.get('/neweasy', 
function(req, res){
  functions.getRandomWikiPage(function(title){
     functions.newGame(req.user.username, title, "Philosophy")
     .then(function(id){
        req.session.value = {id: id};
        res.redirect("/gamescreen");
     })
     .fail(function (err){
        console.log("ERROR" + err.body);
        req.session.notice = "Error processing new game";
        res.redirect("/dashboard");
     });
  })
}
);
//Routes a new easy game for the user
app.get('/newhard', 
 function(req, res){
   functions.getRandomWikiPage(function(source){
      functions.getRandomWikiPage(function(target){
       functions.newGame(req.user.username, source, target)
       .then(function(id){
          req.session.value = {id: id};
          res.redirect("/gamescreen");
       })
       .fail(function (err){
          console.log("ERROR" + err.body);
          req.session.notice = "Error processing new game";
          res.redirect("/dashboard");
       });
    })
   })
});
//Routes a free play game
app.get('/freeplay', 
 function(req, res){
    functions.getRandomWikiPage(function(title){
       functions.newGame(req.user.username, title, "???")
       .then(function(id){
         req.session.value = {id: id};
         res.redirect("/gamescreen");
       })
       .fail(function (err){
          console.log("ERROR" + err.body);
          req.session.notice = "Error processing game";
          res.redirect("/dashboard");
       });
    })
 }
);

//Routes to an 'improve route' game
app.get('/improveroute', 
   function(req, res){
      functions.getFinishedRoutes(10, function(results)
      {
         var jsonResult = JSON.parse(results);
         console.log(jsonResult);
         var param = {user: req.user.username,routes: jsonResult};
         console.log(param);
         res.render('improveroute', param);
      });
   }
);


//Routes a new easy game for the user
app.get('/newimprove', 
function(req, res){
 functions.newGame(req.user.username, req.query.source, req.query.target)
   .then(function(id){
      req.session.value = {id: id};
      res.redirect("/gamescreen");
   })
   .fail(function (err){
      console.log("ERROR" + err.body);
      req.session.notice = "Error processing new game";
      res.redirect("/dashboard");
   });
}
);

//displays our dashboard page
app.get('/gameredirect',
   function(req, res) 
   {
      console.log("GAME REDIRECT");
      newData = functions.updateGameStatus(req.query.id, req.query.current)
      .then(function(newData)
      {
         if(newData)
         {
            var string = newData[0];
            if(newData.length == 2)
            {
               string += "<br>" + newData[1];
            }
            if(string.length > 0)
            {
               req.session.notice = string;         
            }
         }
         req.session.value = {id: req.query.id};
         res.redirect("/gamescreen"); 
      });
   }
);

//displays our dashboard page
app.get('/gamescreen',
   function(req, res) 
   {
      console.log("GOT HERE");
      functions.requestGameStatus(res.locals.value.id)
      .then(function (status) {
         if (status) 
         {
            var current = status.current;
            functions.transformWikiPage(current, status, function(html) 
               {
                  var parameter = {user: req.user.username, transformedWiki: html, game: status, parameter: false};
                  console.log("CURRENT: " + status.current + " TARGET: " + status.target);
                  if(current == status.target)
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
         if (!status) {
            console.log("GAME DOES NOT EXIST");
         }
      })
      .fail(function (err){
         console.log(err.body);
      });
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

