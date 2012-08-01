
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