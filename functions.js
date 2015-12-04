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
         db.run("INSERT INTO users(username,password,salt) VALUES(?,?,?)", username, hash, salt);
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
   });
   db.close();
   return deferred.promise;
   
};

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
};

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
            //array[i] = exports.buildLinkFromGameInfo(temp_game);
            array[i] = exports.buildLinkFromGameIdAndCurrentPage(gameInfo.id, link);
         }
         
         result = array.join("<br>\n");
         result = "<h2>" + title_string + "</h2><br>\n" + result;
         callback(result);
      }
   );
};
//exports.buildLinkFromGameInfo = function(gameInfo)
//{
//   return '<a href="'+ exports.buildURLFromGameInfo(gameInfo) +'">'+gameInfo.current+'</a>';
//};
//exports.buildURLFromGameInfo = function(gameInfo)
//{
//   return '/gamescreen?id='+ gameInfo.id +
//   '&start='+gameInfo.start +
//   '&target='+gameInfo.target +
//   '&count='+ (parseInt(gameInfo.stepCount)+1) + 
//   '&current=' + gameInfo.current;
//};
exports.buildLinkFromGameIdAndCurrentPage = function(id, current)
{
   return '<a href="'+ exports.buildURLFromIdAndCurrentPage(id, current) +'">'+current+'</a>';
};
exports.buildURLFromId = function(id)
{
   return '/gamescreen?id='+id;
};
exports.buildURLFromIdAndCurrentPage = function(id, current)
{
   return '/gamescreen?id='+id+'&current='+current;
};

exports.requestGameStatus = function(gameId)
{
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   db.get('SELECT * FROM games WHERE id=?', gameId, function(err, row)
      {
         if(row)
         {
            var gameStatus = 
            {
               id: row.id,
               user : row.user,
               start : row.start,
               target : row.target,
               current : row.current,
               steps : row.steps,
               time : row.time
            };
            deferred.resolve(gameStatus);        
         }
         else
         {
            deferred.reject(new Error("Could not find game with id"));
         }
      }
   );
   db.close();
   return deferred.promise;
};

//Used to say that a game has reached a new wiki page
exports.updateGameStatus = function(id, current)
{
   if(!current || current == null)
   { 
      return;
   }
   console.log("Updating game status. ID:" + id + " Current page: " + current)
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   db.run('UPDATE games SET current=?, time=?, steps=steps+1 WHERE id=?', [current, (new Date).getTime(), id]);
   db.close();
   return;
};

//Used to start a new game
exports.newGame = function(user, start, target)
{
   console.log("Got here!");
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   var time = (new Date).getTime();
   console.log("Time of game creation: " + time);
   db.run('INSERT INTO games(user,start,target,current,steps,time) VALUES(?,?,?,?,?,?)', [user, start, target, start, 0, time]);
   
   db.get('SELECT id FROM games WHERE user=? AND start=? AND target=? AND current=? AND steps=? AND time=?', [user, start, target, start, 0, time], function(err, row)
      {
         if(!row)
         {
            deferred.reject(new Error("Game creation failed!"));
         }
         else
         {
            deferred.resolve(row.id);
         }
      }
   );
   db.close();
   return deferred.promise;
};

exports.unfinishedGames = function(user)
{
   var deferred = Q.defer();
   var db = new sqlite3.Database('./database.db');
   var dataArray = [];
   db.each('SELECT * FROM games WHERE user=? AND current <> target', user, function(err, row)
      {
         if(!row)
         {
            //This is OK! Just means that there are no games to continue
            deferred.resolve(dataArray);
         }
         else
         {
            var gameStatus = 
            {
               id: row.id,
               user : row.user,
               start : row.start,
               target : row.target,
               current : row.current,
               steps : row.steps,
               time : row.time
            };
            dataArray.push(gameStatus);
         }
      }, function()
      {
         //FINALLY COMPLETE CALLBACK
         deferred.resolve(dataArray);
      }
   );
   
   db.close();
   return deferred.promise;
}