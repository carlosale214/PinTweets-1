// find where these tweets are from based on where the authors say they are.
// tweets: this should be an array of tweet objects.
// success: this is a function to be called if each tweet's location can be found.
// the function success should do something with the location of each tweet and the tweets themselves.

geocodeTweet(tweets, function(geo, item) {console.log(geo); console.log(item);}, function(oneReturnedBool) { if(oneReturnedBool){console.log('we got one!')}});
function geocodeTweet(tweets, success, finish) {
	// first, create a Google geocoder
	var geocoder = new google.maps.Geocoder();
	// Find the user's location from twitter API
	var userNames = new String();
	//This function will extract user names from the array of tweets and put them into a string.
	function getUserNames(tweets){
		$.each(tweets, function(ind, tweet){
			userNames += tweet.from_user + ',';
		});
	}
	//Number of calls that have not come back
	var outstanding = 0;
	var isSuccess = true;
	getUserNames(tweets);
	$.ajax('https://api.twitter.com/1/users/lookup.json?screen_name=' + userNames + '&include_entities=false', {
		crossDomain : true,
		dataType : 'jsonp',
		success : function(users) {
			$.each(users, function(ind, user) {
				// lets create the object with address
				outstanding++;
				var address = {
					'address' : user.location
				};
				function callback(results, status) {
					if (status == google.maps.GeocoderStatus.OK) {
						success(results, tweets[ind]);
					}
					else{
						isSuccess == false;
					}
					outstanding--;
					if (outstanding == 0) {
						finish(isSuccess);
					}
				}
				// lets get the geocode information
				geocoder.geocode(address, callback);
			});
		},
		
	});
}

// These are some demos.
// var dummy = [{
	// from_user : "jack"
// 
// },
// {
	// from_user : "BarackObama"
// }
// ]
// function foobar(geo, tweet) {
	// console.log(geo);
	// console.log(tweet);
// }
// 
// geocodeTweet(dummy, foobar);
