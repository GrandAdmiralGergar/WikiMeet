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
   request({
      uri: "http://en.wikipedia.org/wiki/Special:Random",
      }, function(error, response, body) {
         
      var title = body.match(/<title>.*? - Wikipedia, the free encyclopedia<\/title>/m);
      var first = 7;
      var last = title[0].search(" - Wikipedia");
      var title_string = title[0].substr(first, last-first);
      callback(title_string);
    });
}
exports.transformWikiPage = function(articleTitle, gameInfo, callback) 
{
   var result = "";
   request({
         uri: "http://en.wikipedia.org/wiki/" + articleTitle,
      }, function(error, response, body) 
      {
         body = body.replace(/<h2><span class="mw-headline" id="References">[\s\S]*/gm, "");
         var title = body.match(/<title>.*? - Wikipedia, the free encyclopedia<\/title>/m);
         var title_string = "";
         if(title == null)
         {
            title = body.match(/<h1 id="firstHeading"[\s\S]*><\/h1>/m);
            var most = title[0].match(/>[\s\S]</m);
            title_string = most.substr(1, most[0].length-2);
         }
         else
         {
            var first = 7; //length of <title>
            var last = title[0].search(" - Wikipedia");
            title_string = title[0].substr(first, last-first);
         }
         
         var array = body.match(/<a href="\/wiki\/[^:><]*?" title="([^\[\]])*?">[\s\S]*?<\/a>/gm);
         for (i = 0; i < array.length; i++)
         {
            var start = array[i].search("title=\"");
            var link = array[i].substr(start+7);
            var end = link.search("\"");
            link = link.substr(0, end);
            var temp_game = gameInfo;
            temp_game.current = link;
            array[i] = exports.buildLinkFromGameInfo(temp_game);
         }
         
         result = array.join("<br>\n");
         result = "<h2>" + title_string + "</h2><br>\n" + result;
         callback(result);
      }
   );
}
exports.buildLinkFromGameInfo = function(gameInfo)
{
   return '<a href="'+ exports.buildURLFromGameInfo(gameInfo) +'">'+gameInfo.current+'</a>';
}
exports.buildURLFromGameInfo = function(gameInfo)
{
   return '/gamescreen?id='+ gameInfo.id +
   '&start='+gameInfo.start +
   '&target='+gameInfo.target +
   '&count='+ (parseInt(gameInfo.stepCount)+1) + 
   '&current=' + gameInfo.current;
}