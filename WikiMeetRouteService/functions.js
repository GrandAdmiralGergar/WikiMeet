// functions.js/

var sqlite3 = require('sqlite3').verbose(),
    request = require('request')
    
    
exports.addLink = function(source, target, callback)
{
   console.log("Adding Link: " + source + " -> " + target);   
   var db = new sqlite3.Database('./database.db');
   db.get('SELECT * FROM links WHERE source=? AND target=?',[source, target], function(err, row)
      {
         if(!row)
         {
            db.run('INSERT INTO links(source, target) VALUES(?,?)', [source, target]);
            callback("NEW");
         }
         else
         {
            callback(null);            
         }
         db.close();  
      }
   );
};
exports.addRoute = function(source, target, user, steps, callback)
{
   console.log("Adding Route: " + source + " -> " + target + " with steps=" + steps);   
   var db = new sqlite3.Database('./database.db');
   db.get('SELECT * FROM routes WHERE source=? AND target=?',[source, target], function(err, row)
      {
         console.log(row);
         if(!row)
         {
            db.run('INSERT INTO routes(user, source, target, steps) VALUES(?,?,?,?)', [user, source, target, steps]);
            callback("NEW");
         }
         else if(row.steps > steps)
         {
            console.log("Updating route...");
            db.run('INSERT INTO obsolete_routes(user, source, target, steps) VALUES(?,?,?,?)', [row.user, row.source, row.target, row.steps]);
            db.run('UPDATE routes SET user=?, steps=? WHERE id=?', [user, steps, row.id]);
            callback("IMPROVED");
         }
         else
         {
            callback(null);
         }
         db.close(); 
      }
   ); 
};
exports.getRoutes = function(count, callback)
{
   console.log("Getting routes:");   
   var db = new sqlite3.Database('./database.db');
   db.all('SELECT * FROM routes WHERE steps > 2', function(err, rows)
      {
         console.log(rows);
         if(!rows)
         {
            console.log("No routes to show...");
            callback([]);
         }
         else
         {
            ret = [];
            for(i = 0; i < count && rows.length > 0; i++)
            {
               var rand = Math.floor(Math.random() * (rows.length));
               console.log(rand);
               ret.push(rows[rand]);
               rows.splice(rand, 1);
            }
            callback(ret);
         }
         db.close(); 
      }
   ); 
};