// npm install twit request
// run dumpcam.sh first

var Twit = require('twit')
var request = require('request');
var fs = require('fs');
var path = require('path');
var config = require('./config');

var T = new Twit({
    consumer_key:         config.twitter.consumer_key
  , consumer_secret:      config.twitter.consumer_secret
  , access_token:         config.twitter.access_token
  , access_token_secret:  config.twitter.access_token_secret
})

// longitude comes first for twitter
// southwest, northeast corner
var stream = T.stream('statuses/filter', { locations: config.boundingbox})
stream.on('tweet', function (tweet) {
    if (!tweet.coordinates) {
        return;
    }
    var p = tweet.coordinates.coordinates;
   // console.log(p);

    // filter again, twitters filter is crap
    if (p[0] < config.boundingbox[0] || p[0] > config.boundingbox[2] || 
        p[1] < config.boundingbox[1] || p[1] > config.boundingbox[3]) {
        return;
    }
    // find picture by timestamp, ez
    // we need some time to for the frame to appear, so delay
    setTimeout(function() {
        var time = new Date(tweet.created_at).getTime() / 1000;
        var fname = config.framepathprefix + time + config.framepathpostfix;
        // also try seconds before, there might be a gap
        if (!fs.existsSync(fname)) {
            fname = config.framepathprefix + (time-1) + config.framepathpostfix;
        }
        if (!fs.existsSync(fname)) {
            fname = config.framepathprefix + (time-2) + config.framepathpostfix;
        }
        var update =  '.@' + tweet.user.screen_name + ' ' + config.tweet;
        console.log(update);
        console.log(fname);
        var r = request.post({
            url: "https://api.twitter.com/1.1/statuses/update_with_media.json",
            oauth: {
                consumer_key:    T.config.consumer_key,
                consumer_secret: T.config.consumer_secret,
                token:           T.config.access_token,
                token_secret:    T.config.access_token_secret
            }
            }, function(err, response, body) {
                if (err) {
                    console.log(err);
                    return;
                }
                console.log('sent');
            });
        var form = r.form();
        form.append('status', update);
        form.append('in_reply_to_status_id', tweet.id_str);
        form.append('media[]', fs.createReadStream(fname));
    }, config.tweetdelay, tweet);
});

// background process that deletes old pics
setInterval(function() {
    var oldts = (new Date().getTime() / 1000) - config.picdelsecs;
    // everything with a smaller ts than oldts will have to go
    var fpath = path.dirname(config.framepathprefix);
    fs.readdir(fpath, function(err, files) {
        if (err) {
            console.log(err);
            return;
        }
        files.forEach(function(file) {
            // assume that a timestamp is in the filename
            var ts = parseInt(file.replace( /^\D+/g, ''));
            if (ts < oldts) {
                //console.log('deleting ' + file)
                fs.unlinkSync(path.join(fpath, file));
            }
        });
    });
}, config.picdelsecs * 1000);
