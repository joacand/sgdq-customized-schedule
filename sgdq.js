
var request = require("request");
var tabletojson = require('tabletojson');

exports.generateHTML = generateHTML;

/*
// For debugging without webserver
generateHTML(undefined, function(fullSrc, custSrc) {
  console.log(fullSrc);
});
*/

var lastBody = "";
var cachedGameList = [];
var timeOfLastUpdate = 0;
var oldSource = "";
var gameList = [];

function generateHTML(cookie, callback) {
  var timeSinceLastUpdate = Date.now() - timeOfLastUpdate;

  if (timeSinceLastUpdate > (1000*60*5)) {
    console.log("Updating HTML source");
    updateSourceAndCallback(cookie, callback);
  } else {
    console.log("Using old HTML source");
    useOldSourceAndCallback(cookie, callback);
  }
}

function updateSourceAndCallback(cookie, callback) {
  var fullSchedule = "";
  var customSchedule = "";
  
  request("https://gamesdonequick.com/schedule", function(error, response, body) {
    if (!error) {
      oldSource = body;
      timeOfLastUpdate = Date.now();

      fullSchedule = genGameObjectList(body, undefined, true);
      if (typeof cookie !== 'undefined') {
        customSchedule = genGameObjectList(body, cookie, false);
      }

      callback(fullSchedule, customSchedule);
    } else {
      console.log(error);
      useOldSourceAndCallback(cookie, callback);
    }
  });
}

function useOldSourceAndCallback(cookie, callback) {
  var fullSchedule = genGameObjectList(oldSource, undefined, false);
  var customSchedule = "";

  if (typeof cookie !== 'undefined') {
    customSchedule = genGameObjectList(oldSource, cookie, false);
  }

  callback(fullSchedule, customSchedule);
}

function genGameObjectList(htmlSource, gamesToShow, sourceIsNew) {
  if (typeof gamesToShow !== 'undefined')
    genGameList(htmlSource, gamesToShow.split("|"), sourceIsNew);
  else
    genGameList(htmlSource, "", sourceIsNew);

  var gameObjects = [];
  for (var i = 0; i < gameList.length; i++) {
    gameObjects.push(gameList[i].getJadeObject());
  }
  return gameObjects;
}

function genGameList(htmlSource, gamesToShowList, sourceIsNew) {
  if (cachedGameList.length === 0 || sourceIsNew) {
    if (sourceIsNew)
      console.log("New source, updating cache");
    else
      console.log("Cache empty, updating cache");
    var jsonData = tabletojson.convert(htmlSource);
    var games = jsonData[0];
    fillGameList(games);
  } else {
    console.log("Reusing old cache");
    gameList = cachedGameList;
  }

  removeOldGameEntries();
  removeUnwantedGames(gamesToShowList);
}

function fillGameList(games) {
  for (var i = 1; i < games.length; i++) {
    var date = games[i][0];
    var title = games[i][1];
    var runner = games[i][2];
    var setupTime = games[i][3];
    var completionTime = "";
    var runType = "";
    i++;
    if (typeof games[i] !== 'undefined') {
      completionTime = games[i][0];
      runType = games[i][1];
    }
    var game = new Game(title, date, runner, setupTime, completionTime, runType);
    cachedGameList.push(game);
  }

  gameList = cachedGameList;
}

function removeOldGameEntries() {
  var i = 0;
  while (cachedGameList[i].getHoursToGo() <= 0 || i >= cachedGameList.length) {
    i++;
  }
  cachedGameList.splice(0,i-1); // Remove one less since we want the current game displayed as well

  gameList = cachedGameList;
}

function removeUnwantedGames(gamesToShowList) {
  var newGameList = [];
  if (gamesToShowList !== "") {
    for (var i = 0; i < gameList.length; i++) {
      if (gamesToShowList.indexOf(gameList[i].getTitle()) > -1)
        newGameList.push(gameList[i]);
    }

    gameList = newGameList;
  }
}

function Game (title, date, runner, setupTime, completionTime, runType) {
  this.title = title;
  this.date = new Date(Date.parse(date));
  this.runner = runner;
  this.setupTime = setupTime;
  this.completionTime = completionTime;
  this.runType = runType;

  this.getTitle = function() {
    return this.title;
  };
  this.getHoursToGo = function() {
    var currentTime = Date.now();
    var timeDiffms = this.date.getTime() - currentTime;
    var timeDiffHours = timeDiffms/(1000*60*60);
    return timeDiffHours;
  };
  this.getPrettyHours = function() {
    var hoursDecimal = this.getHoursToGo();
    if (hoursDecimal < 0) 
      return "Live";
    var hours = parseInt(hoursDecimal);
    var minutesDecimal = (hoursDecimal - hours) * 60;
    var minutes = parseInt(minutesDecimal);
    return hours+"h "+minutes+"min";
  };
  this.getFullDate = function() {
    var day = this.date.getDate();
    var month = this.date.getMonth()+1;
    var time = this.date.toLocaleTimeString('sv-SE');
    return day+"/"+month+" "+time;
  };
  this.getJadeObject = function() {
    var jadeObject = {
      title : this.title,
      runType : this.runType,
      runner : this.runner,
      compTime : this.completionTime,
      prettyHours : this.getPrettyHours(),
      fullDate : this.getFullDate()
    };
    return jadeObject;
  };
}
