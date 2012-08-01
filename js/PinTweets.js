//JS for PinTweets
//Copyright Daniel Vizzini, under MIT liscense (see source)

//IE REDIRECT
if (navigator.appName == 'Microsoft Internet Explorer' && window.location == 'index.html') {
	window.location = 'PinTweets_ie.html';
	//URL to redirect to
}

//ONE GLOBAL OBJECT
var global = new Global();

//ON LOAD
$(document).ready(function() {

	//chrome frames
	CFInstall.check({
		mode : 'overlay',
		destination : "http://www.waikiki.com"
	});

	//shot ajax loader
	$('#loader').show();

	//initialize jQuery event handlers
	$('#refreshMap').click(function() {

		if (global.pin && !($('#radius').val() > 0)) {
			$().toastmessage('showToast', {
				text : "You must enter a radius in miles if a pin is on the map.",
				type : 'warning',
				stayTime : 4500,
				sticky : false,
				position : 'middle-center'
			});
		} else {

			if (global) {
				global.removeMarkers();
			}

			loadSearch(getSearchHash());

		}
	});

	$('.date').datepicker({
		dateFormat : 'yy-mm-dd'
	});
	//initializes date inputs

	$('#pinButton').click(function() {
		global.pinBoolean = !global.pinBoolean
		if (!global.pinBoolean) {
			removePin();
		} else {
			dropPin();
		}
	});

	$(window).bind('keypress', function(e) {
		if ((e.keyCode || e.which) == 13) {
			loadSearch(getSearchHash());
		}
	});

	//initial formatting
	$('.canvas').width($('#wrapper').width() - $('#sidebar').outerWidth(true) - global.horizontalMargin * 2);
	$('.canvasText').css('padding-left', global.horizontalMargin + 'px')
	    .css('padding-right', global.horizontalMargin + 'px');
	$('#Map').css('left', global.horizontalMargin + 'px');

	//formatting on resize
	$(window).resize(function() {
		$('.canvas').width($('#wrapper').width() - $('#sidebar').outerWidth(true) - global.horizontalMargin * 2);
		$('.captionContent').width($('.captionDiv').width() - $('.captionLetter').outerWidth(true) - $('.captionPic').outerWidth(true) - 5);
	});

	//jQuery format
	$($('.topnav').children()).each(function() {
		var text = $(this).text().replace(/\s/g, '').replace(/'/g, '');
		$('#' + text + 'Label').click(function() {
			changeCanvas(text);
		});
	});

	$($('.middle').children()).each(function() {
		$(this).width($('#sidebar').width() / 2);
	});

	//declare map
	var myOptions = {
		zoom : 15,
		center : google.maps.LatLng(13.4125, 103.8667), //angkor wat
		mapTypeId : google.maps.MapTypeId.SATELLITE
	};

	var map = new google.maps.Map(document.getElementById('Map'), myOptions);
	global.setMap(map);

	google.maps.event.addListener(map, 'dblclick', function() {
		console.log('making new rezoomBool false')
		global.rezoomBool = false;
	});

	populateForm();

	//start her up
	$.ajax('area_codes.json', {
		dataType : "json",
		success : function(data) {
			global.area_codes = data.area_codes;
			window.location.hash = getSearchHash();
			loadMap();
		},
		timeout : 15000,
		error : onTimeout//nearly impossible
	});

});

/**
 * container for global variables
 */
function Global() {

	this.horizontalMargin = 15;
	this.pinBoolean = false;
	this.markerKey = 0
	this.firstSearch = true;

	//search parameters
	this.searchesPerRound = 2;
	this.requestedLocations = 50;
	this.maxMarkers = 26;
	this.searchInterval = 3000;
	//milliseconds
	this.rezoomInterval = 1;
	//searchIntervals
	this.rezoomBool = true;

	//zoom message parameters
	this.worldwideMessageShown = false;
	this.localMessageShown = false;

	this.area_codes = new Object();
	this.content = new Array();

	this.nextKey = function() {
		return this.markerKey++;
	}

	this.getKey = function() {
		return this.markerKey;
	}

	this.getKeyAsChar = function() {
		return String.fromCharCode(parseInt(this.markerKey) + 65);
	}

	this.pushContent = function(con) {
		this.content.push(con);
	}

	this.resetItems = function() {
		this.content = new Array();
		this.removeMarkers();
		this.markerKey = 0;
	}

	this.setMap = function(mapInstance) {
		this.map = mapInstance;
	}

	this.setPin = function(pinInstance) {
		this.pin = pinInstance;
	}

	this.setPinListener = function(listener) {
		this.pinListener = listener;
	}

	this.removeMarkers = function() {
		if (this.content) {
			for ( i = 0; i < this.content.length; i++) {
				this.content[i].marker.setMap(null);
				//removes from map
			}
		}
	}
};

//PROTOTYPE EXTENTIONS

/**
 * Recuresively parses links hashtags, and mentions in tweets
 */
String.prototype.tweetEncode = function() {

	var forReturn = this;
	//var URLArrMatch = forReturn.match(/(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/g);//links
	var encodeLink = function(str, ptrn, hrefPrefix, startingIndex, encodeBool) {
		var index = str.search(ptrn);

		if (index != -1) {
			var tagged = str.match(ptrn)[0];
			return (str.substring(0, index) + '<a href="' + hrefPrefix + ( encodeBool ? encodeURIComponent(tagged.toString().substring(startingIndex, tagged.length)) : tagged.toString().substring(startingIndex, tagged.length)) + '" target="_blank">' + tagged + '</a>' + encodeLink(str.substring(index + tagged.length, str.length), ptrn, hrefPrefix, startingIndex));
		} else {
			return str;
		}
	};

	forReturn = encodeLink(forReturn, /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/, '', 0, false);
	forReturn = encodeLink(forReturn, /#\w+/, 'http://twitter.com/#!/search/', 0, true);
	forReturn = encodeLink(forReturn, /@\w+/, 'http://twitter.com/#!/', 1, true);

	return forReturn;
};

// Converts numeric degrees to radians
if ( typeof (Number.prototype.toRad) === "undefined") {

	/**
	 * Converts numeric degrees to radians
	 */
	Number.prototype.toRad = function() {
		return this * Math.PI / 180;
	}
}

//SYNCHRONOUS FUNCTIONS

/**
 * displays appropriate message and hides ajax loader for timeout
 */
function onTimeout() {

	if (global.firstSearch) {

		changeMapCanvas('timeout');

	} else {

		$().toastmessage('showToast', {
			text : "The search has timed out. This may be an issue with your Internet connection, you may have breached Twitter's hourly search limit, or Twitter's API may be down. Please try again later. If problems persist, you may want to clear the data in your browser.",
			type : 'error',
			sticky : true,
			position : 'middle-center'
		});

	}

	$('#loader').hide();

}

function loadSearch(hashString) {
	window.location.hash = hashString;
	window.location.reload(true);
}

/**
 * changes Map canvas by setting new click listener
 */
function changeMapCanvas(label) {
	changeCanvas(label);
	$('#MapLabel').click(function() {
		changeCanvas(label);
	});
}

/**
 * populates form from uri
 */
function populateForm() {//IF ANYONE FEELS GANGSTER MAKE A FULL-ON GRAMMER http://ajaxian.com/archives/jison-build-parsers-in-javascript
	if (window.location.hash) {

		var parameters = new Array();
		var parameterString = window.location.hash.replace(/#/, '');
		var continueFlag = true;
		var elem = document.getElementById('searchForm');

		for ( i = 1; i < elem.length; i++) {//clear default values
			elem[i].value = '';
		}

		var recursive = function(str) {
			if (str.indexOf('&') == -1) {
				parameters.push(str);
			} else {
				recursive(str.substring(str.indexOf('&') + 1, str.length));
			}
		};

		while (continueFlag) {
			recursive(parameterString);
			//finds last criteria
			if (parameterString.indexOf('&') != -1) {
				parameterString = parameterString.match(/(.)+&/g)[0];
				parameterString = parameterString.substring(0, parameterString.length - 1);
			} else {
				continueFlag = false;
			}
		}

		for ( i = 0; i < parameters.length; i++) {
			var parameterID = parameters[i].match(/.+=/)[0].replace(/=/, '');
			var parameterVal = parameters[i].match(/=.+/)[0].replace(/=/, '')

			if (parameterID != 'geocode') {
				$('#' + parameterID).val(decodeURIComponent(parameterVal));
			} else {
				$('#radius').val(Number(parameterVal.replace(/(.+),(.+),(.+)/, '$3').replace('mi', '')));
				$('#pinButton').css('background-color', '#C67101');
				global.pinBoolean = true;
				global.setPin(new google.maps.Marker({
					'position' : new google.maps.LatLng(Number(parameterVal.replace(/(.+),(.+),(.+)/, '$1')), Number(parameterVal.replace(/(.+),(.+),(.+)/, '$2'))),
					'map' : global.map,
					'icon' : 'images/location-marker-th.png',
					'draggable' : true
				}));
			}
		}
	}
}

/**
 * Populates list of Tweets below map
 */
function populateCaption() {

	//Sort, God bless Stackoverflow: http://stackoverflow.com/questions/979256/how-to-sort-an-array-of-javascript-objects
	var sort_by = function(field, reverse, primer) {

		var key = function(x) {
			return primer ? primer(x[field]) : x[field]
		};

		return function(a, b) {
			var A = key(a), B = key(b);
			return (A < B ? -1 : (A > B ? 1 : 0)) * [1,-1][+!!reverse];
		}
	}

	global.content.sort(sort_by('key', false, function(a) {
		return a.toUpperCase()
	}));

	//Clear captions for reformatting
	$('#caption div').remove();

	//Reformat because there are results
	$('.below').css('margin-bottom', '10px');
	$('.wrapper').css('border-bottom', 1);

	//populate caption
	$.each(global.content, function(i) {
		$('#caption').append('<div class="captionDiv caption' + this.key + '"><div class="captionLetter">' + this.key + '</div><a class="captionPic" href="http://twitter.com/#!/' + this.user + '" target="_blank"><img width="48" height="48" src="' + this.img + '"/></a><div class="captionContent">' + this.text.tweetEncode() + ' <em>' + TwitterDateConverter(this.time) + '</em></div></div>');
	});

	//set click listeners
	$('.captionLetter').click(function() {

		var new_position = $('#MapLabel').offset();
		var markerChosen = binarySearch(global.content, 'key', $(this).text().trim()).marker;

		global.map.setCenter(markerChosen.position);
		highlight(markerChosen);

		window.scrollTo(new_position.left, new_position.top);

	});

	$('.captionContent').width($('.captionDiv').width() - $('.captionLetter').outerWidth(true) - $('.captionPic').outerWidth(true) - 5);

};

/**
 * Sets zoom
 * @param Tweets found and geocoded
 * @param Map Google Maps object
 * @param expansionFunction function used to set latlngbounds
 */
function zoom(content, map) {

	var markers = new Array();

	for ( i = 0; i < content.length; i++) {
		if (markers.indexOf(content[i].marker) == -1) {
			markers.push(content[i].marker);
		}
	}

	if (global.pin) {
		map.fitBounds(zoomFromPin(markers));
	} else {
		map.fitBounds(zoomExtents(markers));
	}

	if (markers.length > 0) {
		new google.maps.MaxZoomService().getMaxZoomAtLatLng(map.getCenter(), function(MaxZoomResult) {

			//asynchronous callback
			map.setZoom(Math.min(map.getZoom(), Math.min(18, MaxZoomResult.zoom)));

		});
	}

	/**
	 * Zooms to show all markers,
	 * @param markers markers to be shown
	 * @return latlngbounds for Google Maps API
	 */
	function zoomExtents(markers) {

		var bounds = new google.maps.LatLngBounds();

		for ( i = 0; i < markers.length; i++) {
			bounds.extend(markers[i].position);
		}

		return bounds;

	}

	/**
	 * Zooms to show markers within 3x radius of pin, and displays toast to mention markers outside this radius
	 * @param markers markers to be shown
	 * @return latlngbounds for Google Maps API
	 */
	function zoomFromPin(markers) {

		/**
		 * Good old copy-and-pasted 3d trig
		 */

		var bounds = new google.maps.LatLngBounds();
		var allOutOfBounds = true;
		var oneOutOfBounds = false;

		bounds.extend(global.pin.getPosition());
		for ( i = 0; i < markers.length; i++) {

			if (!withinPin(markers[i].lat, markers[i].lng)) {
				oneOutOfBounds = true;
			} else {
				allOutOfBounds = false;
			}
			bounds.extend(markers[i].getPosition());
		}

		if (allOutOfBounds) {

			if (!global.worldwideMessageShown) {

				$().toastmessage('showToast', {
					text : 'Cannot find results within the distance specified. Zooming to show Tweets worldwide.',
					stayTime : 4500,
					sticky : false,
					position : 'middle-center',
					type : 'notice'
				});

				global.worldwideMessageShown = true;

			}

			//zoom extents if none within radius
			return zoomExtents(markers);

		} else if (oneOutOfBounds) {

			if (!global.localMessageShown) {

				$().toastmessage('showToast', {
					text : 'Zooming to show only results within distance specified. Zoom out to see worldwide results.',
					stayTime : 4500,
					sticky : false,
					position : 'middle-center',
					type : 'notice'
				});

				global.localMessageShown = true;

			}

		}

		return bounds;

	}

}//ZOOM

/**
 * changes canvas and canvas labels
 */
function changeCanvas(canvasID) {
	$('.' + $('#' + canvasID).attr('class').match(/\w+/)).hide();
	$('#' + canvasID).show();

	$($('#' + canvasID + 'Label').parent().children()).each(function() {
		$(this).css('font-weight', 'normal');
	});
	$('#' + canvasID + 'Label').css('font-weight', 'bold');
};

/**
 * displays date of Tweet relative to present
 */
function TwitterDateConverter(time) {//big up http://www.phpmind.com/blog/2011/02/how-to-change-date-formate-of-twitter-field-created_at%E2%80%99/
	var date = new Date(time), diff = (((new Date()).getTime() - date.getTime()) / 1000), day_diff = Math.floor(diff / 86400);

	if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31)
		return;

	return day_diff == 0 && (diff < 60 && "just now" || diff < 120 && "1 minute ago" || diff < 3600 && Math.floor(diff / 60) + " minutes ago" || diff < 7200 && "1 hour ago" || diff < 86400 && Math.floor(diff / 3600) + " hours ago") || day_diff == 1 && "Yesterday" || day_diff < 7 && day_diff + " days ago" || day_diff < 31 && Math.ceil(day_diff / 7) + " weeks ago";
};

/**
 * highlights marker and caption
 */
function highlight(marker) {

	var maxZIndex = -999999;

	changeCanvas('Result');

	$.each(global.content, function() {
		this.marker.setIcon('images/blue_Marker' + this.marker.key + '.png');
		maxZIndex = Math.max(maxZIndex, this.marker.ZIndex);
	})
	$('#caption').children().each(function() {
		$(this).css('font-weight', 'normal')
	});
	marker.setIcon('images/orange_Marker' + marker.key + '.png');
	marker.setZIndex(maxZIndex + 1);
	$('.caption' + marker.key).css('font-weight', 'bold');
	$('#Result').html("");
	$.each(global.content, function() {
		if (this.marker.key == marker.key) {
			$('#Result').append('<div class="search"><div class="sidebarContentTitle"><a href="http://twitter.com/#!/' + this.user + '"  target="_blank">@' + this.user + '</a> tweeted,</div><div class="sidebarContent">' + this.text.tweetEncode() + '</div><div class="sidebarContentTime">' + TwitterDateConverter(this.time) + '</div></div>');
		}
	});
};

/**
 * unhighlights marker and caption
 */
function unhighlight() {
	$.each(global.content, function() {
		this.marker.setIcon('images/blue_Marker' + String.fromCharCode(parseInt(this.key) + 65) + '.png');
	})
	$('#caption').children().css('font-weight', 'normal');
	$('#resultText').html('<div class="sidebarContentTitle">Select a marker on the map to see the content of its Tweet.</div>');
};

/**
 * drops pin and sets listener for click on pin
 */
function dropPin() {
	global.map.setOptions({
		draggableCursor : 'crosshair'
	})
	$('#pinButton').css('background-color', '#C67101');

	global.setPinListener(google.maps.event.addListenerOnce(global.map, 'click', function(event) {
		var selectedLatLng = event.latLng;
		global.setPin(new google.maps.Marker({
			'position' : selectedLatLng,
			'map' : global.map,
			'icon' : 'images/location-marker-th.png',
			'draggable' : true,
		}));
		global.map.setOptions({
			draggableCursor : null
		});
	}));
};

/**
 * removes pin and its listener
 */
function removePin() {
	if (global.pin) {
		global.pin.setMap(null);
		global.pin = null;
	}

	if (global.pinListener) {
		google.maps.event.removeListener(global.pinListener);
	}

	global.pinBoolean = false;
	global.map.setOptions({
		draggableCursor : null
	})
	$('#pinButton').css('background-color', '#FFC400');

};

/**
 * Binary search of area_codes json, modified from http://www.nczonline.net/blog/2009/09/01/computer-science-in-javascript-binary-search/
 */
function binarySearch(array, keySet, key) {

	var startIndex = 0, stopIndex = array.length - 1, middle = Math.floor((stopIndex + startIndex) / 2);

	while (array[middle][keySet] != key && startIndex < stopIndex) {

		//adjust search area
		if (key < array[middle][keySet]) {
			stopIndex = middle - 1;
		} else if (key > array[middle][keySet]) {
			startIndex = middle + 1;
		}

		//recalculate middle
		middle = Math.floor((stopIndex + startIndex) / 2);
	}

	//make sure it's the right key
	return (array[middle][keySet] != key) ? null : array[middle];
}

/**
 * makes populates hash with search parameters
 */
function getSearchHash() {

	var searchUrl = '#'
	var elem = document.getElementById('searchForm');
	var first = true;

	for ( i = 1; i < elem.length; i++) {//index 0 is fieldset
		if (elem[i].value != '' && elem[i].id != 'radius') {
			searchUrl += ( first ? '' : '&') + elem[i].id + '=' + encodeURIComponent((elem[i].id == 'from' || elem[i].id == 'to') ? elem[i].value.replace('@', '') : elem[i].value);
			first = false;
		}
	}

	if (global.pin) {
		searchUrl += ( first ? 'geocode=' : '&geocode=') + global.pin.getPosition().lat() + ',' + global.pin.getPosition().lng() + ',' + $('#radius').val() + 'mi';
	}

	return searchUrl;

};

// todo: MAKE SURE LOADMAP.JS GETS EVALUATED HERE!

function withinPin(lat, lng) {
	if (global.pin) {
		function haversine(latFirst, lngFirst, latSecond, lngSecond) {

			var lat1 = latFirst
			var lon1 = lngFirst
			var lat2 = latSecond
			var lon2 = lngSecond

			var R = 3958.7558657440545;
			// miles
			var dLat = (lat2 - lat1).toRad();
			var dLon = (lon2 - lon1).toRad();
			var lat1 = lat1 * Math.PI / 180;
			var lat2 = lat2 * Math.PI / 180;

			var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

			return R * c;

		}

		var radius = $('#radius').val();
		var relaxation = 1;

		//be more relaxed about smaller radii
		if (radius <= 100) {
			relaxation = 3;
		} else if (radius <= 500) {
			relaxation = 2;
		} else if (radius <= 1000) {
			relaxation = 1.5;
		} else {
			relaxation = 1;
		}

		if (haversine(global.pin.getPosition().lat(), global.pin.getPosition().lng(), lat, lng) < radius * relaxation) {
			return true;
		} else {
			return false;
		}

	} else {
		return true;
	}
}

function generateKey() {
	var valArray = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
	var outString = '';
	var randomCharID = 0;
	for ( i = 0; i < 42; i++) {
		randomCharID = Math.floor(Math.random() * 62);
		outString = outString + valArray[randomCharID];
	}
	return outString;
}
