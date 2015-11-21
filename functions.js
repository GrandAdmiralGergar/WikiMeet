// functions.js/

var sqlite3 = require('sqlite3').verbose(),
    Q = require('q'),
    crypto = require('crypto');

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
                "username" : username,
                "id" : id
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
      "id" : 0,
      "password": hash,
      "avatar": "http://placepuppy.it/images/homepage/Beagle_puppy_6_weeks.JPG"
   }
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

////used in local-signup strategy
//exports.localReg = function (username, password) {
//  var deferred = Q.defer();
//  var hash = bcrypt.hashSync(password, 8);
//  var user = {
//    "username": username,
//    "password": hash,
//    "avatar": "http://placepuppy.it/images/homepage/Beagle_puppy_6_weeks.JPG"
//  }
//  //check if username is already assigned in our database
//  db.get('local-users', username)
//  .then(function (result){ //case in which user already exists in db
//    console.log('username already exists');
//    deferred.resolve(false); //username already exists
//  })
//  .fail(function (result) {//case in which user does not already exist in db
//      console.log(result.body);
//      if (result.body.message == 'The requested items could not be found.'){
//        console.log('Username is free for use');
//        db.put('local-users', username, user)
//        .then(function () {
//          console.log("USER: " + user);
//          deferred.resolve(user);
//        })
//        .fail(function (err) {
//          console.log("PUT FAIL:" + err.body);
//          deferred.reject(new Error(err.body));
//        });
//      } else {
//        deferred.reject(new Error(result.body));
//      }
//  });
//
//  return deferred.promise;
//};

//check if user exists
    //if user exists check if passwords match (use bcrypt.compareSync(password, hash); // true where 'hash' is password in DB)
      //if password matches take into website
  //if user doesn't exist or password doesn't match tell them it failed
//exports.localAuth = function (username, password) {
//  var deferred = Q.defer();
//
//  db.get('local-users', username)
//  .then(function (result){
//    console.log("FOUND USER");
//    var hash = result.body.password;
//    console.log(hash);
//    console.log(bcrypt.compareSync(password, hash));
//    if (bcrypt.compareSync(password, hash)) {
//      deferred.resolve(result.body);
//    } else {
//      console.log("PASSWORDS NOT MATCH");
//      deferred.resolve(false);
//    }
//  }).fail(function (err){
//    if (err.body.message == 'The requested items could not be found.'){
//          console.log("COULD NOT FIND USER IN DB FOR SIGNIN");
//          deferred.resolve(false);
//    } else {
//      deferred.reject(new Error(err));
//    }
//  });
//
//  return deferred.promise;
//}




