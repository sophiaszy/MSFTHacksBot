var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var moment = require('moment');
moment().format('YYYY-MM-DDTHH:mm:SS-07:00');

var summary;
var location;
var startDTime;
var endDTime;
var description;
var length;
var count;
var globalAuth;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';
console.log(TOKEN_PATH);
function callGCal() {
	// Load client secrets from a local file.
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	if (err) {
	  console.log('Error loading client secret file: ' + err);
	  return;
	}
	// Authorize a client with the loaded credentials, then call the
	// Google Calendar API.
	authorize(JSON.parse(content), listEvents);
	});
}
callGCal();


/**
* Create an OAuth2 client with the given credentials, and then execute the
* given callback function.
*
* @param {Object} credentials The authorization client credentials.
* @param {function} callback The callback to call with the authorized client.
*/
function authorize(credentials, callback) {
var clientSecret = credentials.installed.client_secret;
var clientId = credentials.installed.client_id;
var redirectUrl = credentials.installed.redirect_uris[0];
var auth = new googleAuth();
var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

// Check if we have previously stored a token.
fs.readFile(TOKEN_PATH, function(err, token) {
  if (err) {
    getNewToken(oauth2Client, callback);
  } else {
    oauth2Client.credentials = JSON.parse(token);
    globalAuth = oauth2Client;
    callback(oauth2Client);
  }
});
}

/**
* Get and store new token after prompting for user authorization, and then
* execute the given callback with the authorized OAuth2 client.
*
* @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
* @param {getEventsCallback} callback The callback to call with the authorized
*     client.
*/
function getNewToken(oauth2Client, callback) {
var authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES
});
console.log('Authorize this app by visiting this url: ', authUrl);
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.question('Enter the code from that page here: ', function(code) {
  rl.close();
  oauth2Client.getToken(code, function(err, token) {
    if (err) {
      console.log('Error while trying to retrieve access token', err);
      return;
    }
    oauth2Client.credentials = token;
    storeToken(token);
    globalAuth = oauth2Client;
    callback(oauth2Client);
  });
});
}

/**
* Store token to disk be used in later program executions.
*
* @param {Object} token The token to store to disk.
*/
function storeToken(token) {
try {
  fs.mkdirSync(TOKEN_DIR);
} catch (err) {
  if (err.code != 'EEXIST') {
    throw err;
  }
}
fs.writeFile(TOKEN_PATH, JSON.stringify(token));
console.log('Token stored to ' + TOKEN_PATH);
}


/**
* Lists the next 10 events on the user's primary calendar.
*
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
*/
function listEvents(auth) {

var calendar = google.calendar('v3');
calendar.events.list({
  auth: auth,
  calendarId: 'primary',
  timeMin: (new Date()).toISOString(),
  maxResults: 100,
  singleEvents: true,
  orderBy: 'startTime'
}, function(err, response) {
  if (err) {
    console.log('The API returned an error: ' + err);
    return;
  }
  var events = response.items;
  if (events.length == 0) {
    console.log('No upcoming events found.');
  } else {
    console.log('Upcoming 10 events:');
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var start = event.start.dateTime || event.start.date;
      console.log('%s - %s', start, event.summary);
    }
  }
});
}

function createEvent(auth, summary, loc, startTime, endTime) {
    var calendar = google.calendar('v3');
    var event = {
        'summary': summary,
        'location': loc,
        'description': 'descrip',
        'start': {
            'dateTime': startTime,
            'timeZone': 'America/Vancouver',
        },
        'end': {
            'dateTime': endTime,
            'timeZone': 'America/Vancouver',
        }
    }
    
    calendar.events.insert({
                           auth: auth,
                           calendarId: 'primary',
                           resource: event,
                           }, function(err, event) {
                           if (err) {
                           console.log('There was an error contacting the Calendar service: ' + err);
                           return;
                           }
                           console.log('Event created: %s', event.htmlLink);
                           });
}




//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);

var luisAppId = process.env.LuisAppId || 'b80cb378-370b-41f9-a8a0-16e9c2827699';
var luisAPIKey = process.env.LuisAPIKey || '1942c522d7504febb12d7c282fcaeae6';
const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/b80cb378-370b-41f9-a8a0-16e9c2827699?subscription-key=ffd7bd18a5d847c4b088a7c65a5a29c7&timezoneOffset=0.0&verbose=true' || `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAPIKey}&verbose=true`;
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.recognizer(new builder.LuisRecognizer(LuisModelUrl));

server.post('/api/messages', connector.listen());
server.get('/api/messages', function(req, res) {
	res.send('hello world');
});

//=========================================================
// Bots Dialogs
//=========================================================
var time;
var date;
var givenTime;
var eventName;
var estimatedTime;
var listofTimes;


bot.dialog('/', dialog);

dialog.matches('Hello', [
    function (session, args, next) {
    session.send("Hi, I am the calender bot, want can I help you");}
]);
dialog.matches('None', [
    function (session, args, next) {
    session.send("Sorry, I don't understand, can you repeat it");}
]);
dialog.matches('Exercise', [
    function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'How many minutes do you want to exercise for?'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }

    
]);
dialog.matches('Meeting', [

	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'Good, What is the estimated time for the meeting(in minutes)?'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }

]);
dialog.matches('chores', [

	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'Good, What is the estimated time for the housekeeping(in minutes)'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }
]);
dialog.matches('haveHaircut', [
	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'Well, What is the estimated time for the haircut(in minutes)?'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }
]);
dialog.matches('haveMeal', [

	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'Good, What is the estimated time for the meal(in minutes)?'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }
]);
dialog.matches('nap', [
	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'How long do you want your nap be(in minutes)?'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }
]);
dialog.matches('shopping', [
	function (session, args, next) {

    date=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.date');
    time=builder.EntityRecognizer.findEntity(args.entities,'builtin.datetime.time');
    eventName = builder.EntityRecognizer.findEntity(args.entities,'Subject');
    builder.Prompts.text(session, 'Sure, What is the estimated time for the shopping(in minutes)'); 
   }, 
     function (session, results) {
      var duration = results.response;
      console.log(date);
      console.log(time);
      console.log(eventName);

      // session.send(duration);
      if(time&&date) {
      	if(date.entity.toLowerCase() =="tomorrow"){
      		var extraday =1;
      	}
      	else {
      		var extraday = 0;
      	}
    	createEvent(globalAuth, eventName.entity,"",moment(time).add(extraday,'days').format('YYYY-MM-DDTHH:mm:SS-07:00'), moment(time).add(extraday,'days').add(duration, 'minutes').format('YYYY-MM-DDTHH:mm:SS-07:00'));
        session.send("The event has been successfully created!");
     }
     else if(date){
     		//TODO:SEARCH
     		var now = moment().format('YYYY-MM-DDTHH:mm:SS-07:00');
     		var calendar = google.calendar('v3');
     		var nextAvailTime = calendar.freebusy.query({
     			auth: globalAuth,
     			resource: {
     				items: [{'id':0}],
     			timeMin: moment().format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			timeMax: moment().add(5).format('YYYY-MM-DDTHH:mm:SS-07:00'),
     			}}, function (err, res) {
     				if (err) console.log(err);
     				var events = res.calendars[0].busy;
     				if (events.length == 0) {
     					console.log('no upcoming events found');
     				} else {
     					console.log('busy here');
     				}
     			});


     }else{

     }
    }
]);



bot.dialog('/calender', [
	function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');

    },
    function (session, results) {
    	session.send("ok,get it");
        session.endDialogWithResult(results);
    }]
);