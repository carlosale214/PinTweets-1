//LEVEL 0 ASYNC FUNCTION

/**
 * Gets Tweets from Twitter API
 */
function loadMap() {

	var searchURL = getApiUrl();

	//must be on top. API does not work if map is hidden
	changeCanvas('Search');
	changeCanvas('Map');

	$('#loader').show();
	$('#Result').html = '<div class="sidebarContentTitle">Select a marker on the map to see the content of its Tweet.</div>'
	$('.below').css('margin-bottom', '0');
	$('.wrapper').css('border-bottom', 2);
	$('#caption').html('');

	$.ajax(searchURL, {
		crossDomain : true,
		dataType : "jsonp",
		success : function(data) {
			geocodeTweets(global.map, data);
		},
		timeout : 15000,
		error : onTimeout
	});

	/**
	 * makes URL to call initial Twitter API and sets global variable accordingly
	 */
	function getApiUrl() {

		var apiString = 'http://search.twitter.com/search.json?callback=?&rpp=' + global.requestedLocations;
		var elem = document.getElementById('searchForm');
		var first = true;

		for ( i = 1; i < elem.length; i++) {//index 0 is fieldset
			if (elem[i].value != '' && elem[i].id != 'radius') {
				apiString += ( first ? '&q=' : '%20') + encodeURIComponent(((elem[i].id == 'tweetContent') ? '' : elem[i].id + ':') + ((elem[i].id == 'from' || elem[i].id == 'to') ? elem[i].value.replace('@', '') : elem[i].value));
				first = false;
			}
		}

		if (global.pin) {
			apiString += '&geocode=' + global.pin.getPosition().lat() + ',' + global.pin.getPosition().lng() + ',' + $('#radius').val() + 'mi';
		}

		console.log(apiString);

		return apiString;

	};

	/**
	 * Dictates how the geocoding of each Tweet should be handled
	 */
	function geocodeTweets(map, data) {

		var regexp = /\-*\d+[.,]\d+/g;
		//for ubertwitter and the like
		var results = data.results;
		var userNames = new String();
		var geocodeQueue = new Array();
		var askGoogle = false;

		//to avoid repeat messages
		global.localMessageShown = false;
		global.worldwideMessageShown = false;
		global.rezoomBool = true;

		if (!results || results.length == 0) {
			return noResults();
		} else {
			for ( i = 0; i < results.length; i++) {
				results[i].waiting = true;
				results[i].geo_info = {
					'valid' : false,
					'exact' : false,
					'lat' : false,
					'lng' : false
				};
			}
		}

		//reset map
		changeCanvas('Search');
		changeCanvas('Map');
		global.resetItems();

		//fork in road
		$.each(results, function(ind, result) {
			if (result.geo) {
				console.log('geotagging ' + result.from_user + ' directly');
				geotagResult(result);
				return;
			}
			if (checkForDuplicateUN(result)) {
				console.log('duplicate of ' + result.from_user);
				return;
			}
			askGoogle = true;
			userNames += result.from_user + ',';
		});

		//initiate long process
		if (askGoogle) {
			getLocations(userNames);
		}
// 
		// var Result = function(){
			// this.geottag = function(){
// 				
			// };		
		// };
		// //...
		// var myResult = new Result();
		// myResult.geotag();
		
		/**
		 * Assigns lat-lng to result in case where this information is specified directly by Twitter
		 * @param result with lat-lng recieved from Twitter
		 */
		function geotagResult(result) {
			if (result.geo.coordinates[0] == 0 && result.geo.coordinates[1] == 0) {
				console.log('filtering out directly geocoded 0,0 for ' + result.from_user);
				result.waiting = false;
				result.geo_info.exact = true;
				checkIfDone();
			} else {
				result.geo_info = {
					'valid' : true,
					'exact' : true,
					'lat' : result.geo.coordinates[0],
					'lng' : result.geo.coordinates[1],
				};
				addToMap(map, result);
			}
		}

		/**
		 * Checks to see if username is already in the process of being geocoded
		 */
		function checkForDuplicateUN(result) {
			for ( i = 0; i < results.length; i++) {
				comp_result = results[i];
				if (result == comp_result) {
					return false;
				}
				if (result.from_user == comp_result.from_user && !comp_result.geo_info.exact) {
					result.geo_info = comp_result.geo_info;
					//probably meaningless, but could apply to super-fast call on super-slow computer
					return true;
				}
			}
			return false;
		}

		//LEVEL 1 ASYNC FUNCTION

		/**
		 * Checks for the locations of all outstanding usernames at once, then geocodes them
		 */
		function getLocations(userNames) {

			//toast

			$().toastmessage('showToast', {
				text : 'Your map will rezoom as new results come in. Feel free to search again before this search is finished loading.',
				stayTime : 4500,
				sticky : false,
				position : 'middle-center',
				type : 'notice'
			});

			console.log('https://api.twitter.com/1/users/lookup.json?screen_name=' + userNames + '&include_entities=false');
			//TODO: Implement this after app is registered
			// $.ajax('https://api.twitter.com/1/users/lookup.json', {
			// type: "POST",
			// dataType: 'json',
			// data:{
			// 'screen_name': userNames
			// },
			$.ajax('https://api.twitter.com/1/users/lookup.json?screen_name=' + userNames + '&include_entities=false', {
				crossDomain : true,
				dataType : 'jsonp',
				timeout : 15000,
				//TODO: Handle 400's better
				error : onTimeout,
				success : function(users) {

					$.each(users, function(ind, user) {
						geocodeUser(user);
					});

					executeGeocodeTimer();

				}
			});

			function executeGeocodeTimer() {

				console.log('geocodeQueue length: ' + geocodeQueue.length);

				var size = global.searchesPerRound;
				var startOfRound = 0;
				var formatted = false;
				var hasResult = false;

				makeRound();

				function makeRound() {

					var increment = Math.min(size, geocodeQueue.length - startOfRound);

					console.log('startOfRound at beggining of for: ' + startOfRound);

					for (var i = startOfRound; i < startOfRound + increment; i++) {
						useGoogle(geocodeQueue[i]);
					}

					if (!formatted) {

						for ( i = 0; i < results.length; i++) {
							if (results[i].geo_info.valid) {
								hasResult = true;
								break;
							}
						}

						if (hasResult) {
							console.log('intitial formatting');
							populateCaption();
							console.log('global.rezoomBool: ' + global.rezoomBool);
							zoom(global.content, global.map);
							formatted = true;
						}

					}

					startOfRound += increment;
					console.log('startOfRound at end of for: ' + startOfRound);

					//rezoom at interval
					if (((startOfRound / global.searchesPerRound) % global.rezoomInterval) == 0) {
						console.log('periodic reformatting');
						populateCaption();
						if (global.rezoomBool) {
							zoom(global.content, global.map);
						}
					}

					//recursively make another round, waiting b/c of timer limits
					if (startOfRound < geocodeQueue.length) {
						console.log('setting timeout');
						setTimeout(makeRound, global.searchInterval);
					}

				}

			}

			//LEVEL 2 ASYNC FUNCTION

			/**
			 * If necessary, requests lat-lng from Google and handles response
			 */
			function geocodeUser(user) {

				console.log('user location: ' + user.location);

				if (!(user.location == null)) {

					if (!(user.location.replace(/\s/g) == '')) {

						if ((user.location.search(regexp) == -1) ? false : (user.location.match(regexp).length != 2) ? false : (user.location.match(regexp)[0] >= -90 && user.location.match(regexp)[0] <= 90 && user.location.match(regexp)[1] >= -180 && user.location.match(regexp)[1] <= 180)) {

							//ubertwitter and the like
							gotCoords(user.screen_name, user.location.match(regexp)[0], user.location.match(regexp)[1]);

						} else if (/^\d{3}$/i.test(user.location) || /^\d{3}\D/i.test(user.location) || /\D\d{3}$/i.test(user.location) || /\D\d{3}\D/i.test(user.location)) {

							//handle area codes
							var found = binarySearch(global.area_codes, 'area_code', user.location.match(/\d{3}/)[0]);
							if (found != null) {
								gotCoords(user.screen_name, found.lat, found.lng);
							} else {
								geocodeQueue.push(user);
							}

						} else {

							//plain old location
							geocodeQueue.push(user);

						}

					} else {
						didNotGetCoords(user.screen_name);
					}

				} else {
					didNotGetCoords(user.screen_name);
				}

			}

		}

		//SYNCHRONOUS FUNCTIONS CALLED AT LEVEL 2

		/**
		 * Assigns lat-lng to Tweet and any with duplicate user names
		 * @param userName name of user for whom coordinates have been found
		 * @param lat coordinate latitude
		 * @param lng coordinate longitude
		 */
		function gotCoords(userName, lat, lng) {

			//filter out 0,0
			if (!withinPin(lat, lng) || (lat == 0 && lng == 0)) {
				console.log('Filtering out 0,0 for ' + userName);
				didNotGetCoords(userName);
			} else {
				$.each(results, function() {

					if (!this.waiting) {
						return;
					}
					if (this.from_user == userName) {

						this.geo_info.valid = true;
						this.geo_info.lat = lat;
						this.geo_info.lng = lng;
						addToMap(map, this);

					}

				});
			}

		}

		/*
		 * Makes sure that Tweet and those with duplicate user names is no longer waiting
		 */
		function didNotGetCoords(userName) {

			$.each(results, function() {
				if (!this.waiting) {
					return;
				}
				if (this.from_user == userName) {

					this.waiting = false;

				}
			});

			checkIfDone();

		}

		function useGoogle(user) {

			//apply heuristics
			var locationString = user.location.replace(/^[^A-Za-z0-9\-]+/, '').replace(/[^A-Za-z0-9]+$/, '').replace(/\$/ig, 's');

			if (/Cali/i.test(locationString) && !/California/i.test(locationString) && !/Colombia/i.test(locationString)) {
				locationString = locationString.replace(/Cali/ig, "California");
			} else if (/Jersey/i.test(locationString) && !/New\s*Jersey/i.test(locationString) && !/Britain/i.test(locationString) && !/Channel Island/i.test(locationString)) {
				locationString = locationString.replace(/Jersey/ig, "New Jersey");
				//What up, Tyga?
			} else if (/\WRack\s*City/i.test(locationString) || /^Rack\s*City/i.test(locationString)) {
				locationString = locationString.replace(/Rack\s*City/ig, "Las Vegas");
			} else if ((/\s+/i.test(locationString) ? (locationString.match(/\s+/ig).length > 3) : false) && !/[,]/i.test(locationString)) {
				didNotGetCoords(user.screen_name);
				return;
			} else if (/worldwide/i.test(locationString)) {
				didNotGetCoords(user.screen_name);
				return;
			} else if (/Universe/i.test(locationString)) {
				didNotGetCoords(user.screen_name);
				return;
			} else if (/Cloud 9/i.test(locationString) || /Cloud Nine/i.test(locationString)) {
				didNotGetCoords(user.screen_name);
				return;
			} else if (/Earth/i.test(locationString) && !/Texas/i.test(locationString)) {
				didNotGetCoords(user.screen_name);
				return;
			}

			new google.maps.Geocoder().geocode({
				'address' : locationString
			}, function(results, status) {

				if (status == google.maps.GeocoderStatus.OK) {

					console.log('okay');
					console.log(locationString);
					console.log(results);
					console.log('\n')
					if (results.length <= 3 || (/Springfield/i.test(locationString) || /Atl/i.test(locationString))) {
						gotCoords(user.screen_name, results[0].geometry.location.lat(), results[0].geometry.location.lng())
					} else {
						didNotGetCoords(user.screen_name);
					}
				} else {

					console.log('not okay');
					console.log('\n')
					didNotGetCoords(user.screen_name);

				}

			});

		}

		//SYNCHRONOUS FUNCTIONS AT END OF ASYNC THREADS

		/**
		 * Display no results toast
		 */
		function noResults() {

			if (global.firstSearch) {

				changeMapCanvas('no_results');

			} else {

				$().toastmessage('showToast', {
					text : 'No Tweets found. Please modify your search or try again later.',
					type : 'warning',
					stayTime : 4500,
					sticky : false,
					position : 'middle-center'
				});

			}

			$('#loader').hide();

		}

		/**
		 * Checks to see if all waiting status of all results ar done, and changes canvas accordingly
		 */
		function checkIfDone() {
			var done = true;
			var hasResult = false;

			for ( i = 0; i < results.length; i++) {
				if (results[i].waiting) {
					done = false;
					break;
				}
				if (results[i].geo_info.valid) {
					hasResult = true;
				}
			}

			if (done) {

				$('#MapLabel').click(function() {
					changeCanvas('Map');
				});

				if (hasResult) {

					global.firstSearch = false;

					populateCaption();

					zoom(global.content, global.map);

				} else {

					if (global.firstSearch) {

						changeMapCanvas('no_location');

					} else {

						$().toastmessage('showToast', {
							text : 'Tweets found, but none are geocoded. Please modify your search or try again later.',
							type : 'warning',
							stayTime : 4500,
							sticky : false,
							position : 'middle-center'
						});

					}

					$('#loader').hide();

				}

				$('#loader').hide();

			}//if (done)

		}

		/**
		 * Adds result to map
		 */
		function addToMap(map, result) {

			/**
			 * Finds results that have been geocoded to same point
			 */
			function findSameLoc(content) {
				for ( i = 0; i < global.content.length; i++) {
					var contentCur = global.content[i];
					if (contentCur == content) {
						continue;
					}
					if (contentCur.lat == content.lat && contentCur.lng == content.lng) {
						return contentCur;
					}
				}
				return false;
			}

			var content = {
				'text' : result.text,
				'lat' : result.geo_info.lat,
				'lng' : result.geo_info.lng,
				'img' : result.profile_image_url,
				'user' : result.from_user,
				'key' : null,
				'marker' : null,
				'time' : result.created_at
			}

			var repeat = findSameLoc(content);

			if (global.getKey() < global.maxMarkers) {

				if (repeat) {
					repeat.marker.title = "Multiple Tweets";
					content.marker = repeat.marker;
					content.key = repeat.marker.key;
				} else {

					var currKey = global.getKeyAsChar();

					content.key = currKey;
					//for sort
					content.marker = new google.maps.Marker({
						'position' : new google.maps.LatLng(content.lat, content.lng),
						'map' : map,
						'icon' : 'images/blue_Marker' + currKey + '.png',
						'title' : TwitterDateConverter(result.created_at),
						'key' : currKey
					}//marker array
					);

					google.maps.event.addListener(content.marker, 'click', function() {
						highlight(this);
					});

					global.nextKey();

				}

				global.pushContent(content);

			}

			result.waiting = false;
			checkIfDone();

		}

	}

};