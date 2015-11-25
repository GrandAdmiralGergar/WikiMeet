// functions.js/

var sqlite3 = require('sqlite3').verbose(),
    Q = require('q'),
    crypto = require('crypto');
    request = require('request')

exports.hashPassword = function(password, salt) {
  var hash = crypto.createHash('sha256');
  hash.update(password);
  hash.update(salt);
  return hash.digest('hex');
};

exports.localAuthorization = function (username, password) {
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   db.get('SELECT salt FROM users WHERE username = ?', username, function(err, row) 
   {
     if (!row) { 
        deferred.reject(new Error("Could not find username"));
     }
     else {
        console.log("FOUND USER");
        var id = -1;
        var hash = exports.hashPassword(password, row.salt);
        db.get('SELECT username, id FROM users WHERE username = ? AND password = ?', username, hash, function(err, row) {
          if (!row) 
          {
             console.log("PASSWORD MISMATCH");
             deferred.resolve(false);
          }
          else 
          {
             var user = {
                "username" : row.username,
                "id" : row.id
             }
             console.log("PASSWORD MATCH");
             deferred.resolve(user);        
          }
        });
     }
   });
   db.close();
   return deferred.promise;
 }

exports.localRegistration = function(username, password) {
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   var salt = crypto.randomBytes(16);
   var hash = exports.hashPassword(password, salt);
   var user = {
      "username": username,
      "id" : 0
   };
   db.get('SELECT username FROM users WHERE username=?', username, function(err, row) {
      if(!row)
      {
         console.log("USER DOES NOT EXIST YET");
         db.run("INSERT INTO users(username,password,salt) VALUES(?,?,?)", username, hash, salt)
         db.get('SELECT username, id FROM users WHERE username=?', username, function(err, row) {
            user.id = row.id;
         });
         console.log("ID = " + user.id);
         deferred.resolve(user);
      }
      else
      {
         console.log("USER EXISTS ALREADY");
         deferred.resolve(false);      
      }
   })
   db.close();
   return deferred.promise;
   
}

exports.getRandomWikiPage = function(callback) {
   var result = "";
   request({
      uri: "http://en.wikipedia.org/wiki/Special:Random",
      }, function(error, response, body) {
      
      var array = body.match(/<a href="\/wiki\/[^:><]*?" title="([\s\S])*?">[\s\S]*?<\/a>/gm);
//      body = body.replace(/[\s\S]*?<div id="mw-content-text" lang="en" dir="ltr" class="mw-content-ltr">/gm, '<div id="mw-content-text" lang="en" dir="ltr" class="mw-content-ltr">');
//      body = body.replace(/\/wiki\//ig, "http://en.wikipedia.org/wiki");
//      body = body.replace(/\/\/upload.wikimedia.org/ig, "http://upload.wikimedia.org");
//      body = body.replace(/<sup[\s\S]*?<\/sup>/gm, "");
//      body = body.replace(/<div class="reflist[\s\S]*?<\/div>/gm, "");
//      body = body.replace(/<h2><span class="mw-headline" id="References">[\s\S]*/gm, "</div>");
      //body = body.replace(/<noscript>[\s\S]*/gm, "</div>");
      result = array.join("<br>\n");      
      callback(result);
    });
}