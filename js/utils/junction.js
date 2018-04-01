define([
	'utils/geom',
	'utils/route'
], function(
	geomUtils,
	routeUtils
) {
	counter = 0;

	var junctionUtils = {
		getEndPointKey : function(point) { 
		    return Math.round(point[0] * 2000) + '_' + Math.round(point[1] * 1000);
		},

		getEndPointByKey : function(key) {
		    return [key.split('_')[0] / 2000, key.split('_')[1] / 1000];
		},

		getRoutePassingModes : function(segmentIds, routes) {
			var passingModes = {};

			var routesBySegment = segmentIds.reduce(function(routesBySegment, segmentId) {
				var res = (routes[Math.abs(segmentId)] || []).filter(routeUtils.notPhantom);

					if(segmentId < 0) {
						res = res.map(function(rt, i) {
		                	return rt.replace('>', '%').replace('<', '>').replace('%', '<');
						}).reverse();
					}

					routesBySegment[segmentId] = res; 
					return routesBySegment;
				}, {}),
				findSegmentsHaving = function(rt, except) {
					return segmentIds.filter(function(toId) {
						return toId !== except && routesBySegment[toId].filter(function(r) { return r === rt; }).length == 1;
					});
				};

			segmentIds.forEach(function(fromId) {
				var fromRoutes = routesBySegment[fromId].map(function(rt, i) {
                	return rt.replace('>', '%').replace('<', '>').replace('%', '<');
				}).reverse();

				fromRoutes.forEach(function(route) {
					var rt = routeUtils.strip(route);

					if(passingModes[rt]) { return; }

					if(route.indexOf('<') == 0 || route.indexOf('>') == 0) {
						if(fromRoutes.filter(function(r) { return routeUtils.strip(r) == rt }).length > 1) {
							//console.warn(rt, 'has more than one pass through point, and one of them is one-way:', routesBySegment);
							passingModes[rt] = { type : 'strange' };
						}
						else {
							var matchingOneWaySegments = findSegmentsHaving(route, fromId),
								notMatchingOneWaySegments = findSegmentsHaving((route[0] == '>'? '<' : '>') + rt, fromId),
								matchingTwoWaySegments = findSegmentsHaving(rt, fromId);

							if(notMatchingOneWaySegments.length > 0) {
								//console.warn(rt, 'has conflicting one-way segments at:', routesBySegment);
								passingModes[rt] = { type : 'strange' };
							} else if(matchingOneWaySegments.length == 1 && matchingTwoWaySegments.length == 1) {
								var ways = {};

								ways[matchingTwoWaySegments[0]] = [
									{
										to : fromId,
										as : (route[0] == '>'? '<' : '>') + rt
									},
									{
										to : matchingOneWaySegments[0],
										as : route
									},
								];
								ways[fromId] = [{
									to : matchingTwoWaySegments[0],
									as : rt
								}];
								ways[matchingOneWaySegments[0]] = [{
									to : matchingTwoWaySegments[0],
									as : rt
								}];

								passingModes[rt] = {
									type : 'splitting',
									ways : ways
								};
							} else if(matchingOneWaySegments.length == 1 && matchingTwoWaySegments.length == 0) {
								var ways = {};

								ways[fromId] = [{
									to : matchingOneWaySegments[0],
									as : route
								}],
								ways[matchingOneWaySegments[0]] = [{
									to : fromId,
									as : (route[0] == '>'? '<' : '>') + rt
								}];

								passingModes[rt] = {
									type : 'passing',
									ways : ways
								};
							} else {
								//console.warn(rt, 'has ' + matchingOneWaySegments.length + ' one-way segments ' + matchingTwoWaySegments.length + ':', routesBySegment);
								passingModes[rt] = { type : 'strange' }
							}
						}
					} else {
						if(fromRoutes.filter(function(r) { return r == '>' + rt || r == '<' + rt; }).length > 0) {
							//console.warn(rt, 'has one-way and two-way on single segment:', routesBySegment);
							passingModes[rt] = { type : 'strange' };
						}
						else if(fromRoutes.filter(function(r) { return r == rt }).length == 1) {
							var matchingIncomingSegments = findSegmentsHaving('>' + rt, fromId),
								matchingOutgoingSegments = findSegmentsHaving('<' + rt, fromId),
								matchingTwoWaySegments = findSegmentsHaving(rt, fromId);

							if(matchingIncomingSegments.length == 0 && matchingOutgoingSegments.length == 0 && matchingTwoWaySegments.length == 0) {
								passingModes[rt] = { type : 'ending' };
							} else if(matchingIncomingSegments.length == 0 && matchingOutgoingSegments.length == 0 && matchingTwoWaySegments.length == 1) {
								ways = {};

								ways[fromId] = [{
									to : matchingTwoWaySegments[0],
									as : rt
								}];
								ways[matchingTwoWaySegments[0]] = [{
									to : fromId,
									as : rt
								}];

								passingModes[rt] = {
									type : 'passing',
									ways : ways
								};
							} else if(matchingIncomingSegments.length == 0 && matchingOutgoingSegments.length == 0 && matchingTwoWaySegments.length == 2) {
								var ways = {};


								ways[matchingTwoWaySegments[0]] = [
									{ to : matchingTwoWaySegments[1], as : rt }, // TODO direction
									{ to : fromId, as : rt }
								];
								ways[matchingTwoWaySegments[1]] = [
									{ to : matchingTwoWaySegments[0], as : rt },
									{ to : fromId, as : rt }
								];
								ways[fromId] = [
									{ to : matchingTwoWaySegments[0], as : rt },
									{ to : matchingTwoWaySegments[1], as : rt }
								];

								passingModes[rt] = { 
									type : '3-way',
									ways : ways
								};
							} else if(matchingIncomingSegments.length == 1 && matchingOutgoingSegments.length == 1 && matchingIncomingSegments[0] != matchingOutgoingSegments[0] && matchingTwoWaySegments.length == 0) {
								var ways = {};

								ways[fromId] = [
									{
										to : matchingOutgoingSegments[0],
										as : '<' + rt
									},
									{
										to : matchingIncomingSegments[0],
										as : '>' + rt
									},
								];
								ways[matchingOutgoingSegments[0]] = [{
									to : fromId,
									as : '<' + rt
								}];
								ways[matchingOutgoingSegments[0]] = [{
									to : fromId,
									as : '>' + rt
								}];

								passingModes[rt] = {
									type : 'splitting',
									ways : ways
								};
							} else {
								//console.warn(rt, 'has <' + matchingIncomingSegments.length + ', >' + matchingIncomingSegments.length + ', ' + matchingTwoWaySegments.length + ' at:', routesBySegment);
								passingModes[rt] = { type : 'strange' };
							}
						} else if(fromRoutes.filter(function(r) { return r == rt }).length = 2) {
							if(findSegmentsHaving(rt, fromId).length == 0 && findSegmentsHaving('>' + rt, fromId).length == 0 && findSegmentsHaving('<' + rt, fromId).length == 0) {
								var ways = {};

								ways[fromId] = [{ to : fromId, as : rt }];
								passingModes[rt] = { type : 'u-turn', ways : ways };
							}
							else {
								//console.warn(rt, 'has u-turn and something else', routesBySegment);
								passingModes[rt] = { type : 'strange' };
							}
						}
						else {
							//console.warn(rt, 'got into impossible branch', routesBySegment);
							passingModes[rt] = { type : 'strange' };
						}
					}
				});
			});

			return passingModes;

		},

		extractJunctionRouteGroups : function(segmentIds, routes, widths) {
			var groups = [],
				passingModes = junctionUtils.getRoutePassingModes(segmentIds, routes),
				strangeRoutes = Object.keys(passingModes).filter(function(rt) {
					return passingModes[rt].type == 'ending' || passingModes[rt].type == 'u-turn' || passingModes[rt].type == 'strange';
				});

			function getMatchingRoute(fromId, toId, fromRoute) {
            	var passingModeData = passingModes[routeUtils.strip(fromRoute)];
            	var way = passingModeData && passingModeData.ways && passingModeData.ways[fromId] && passingModeData.ways[fromId].filter(function(way) { return way.to === toId; })[0];
            	return way? way.as : false;
            }

            function getRoutesListWidth(routes) {
            	return routes.reduce(function(width, route) { 
                    return width + (widths[routeUtils.strip(route)] || 0);
                }, 0);
            }		

		    segmentIds.forEach(function(fromSegmentId, fromIndex) {
				var fromRoutes = routeUtils.inverseList(routes[Math.abs(fromSegmentId)] || [], -fromSegmentId),
					fromWidth = getRoutesListWidth(fromRoutes);

		        segmentIds.slice(fromIndex + 1).forEach(function(toSegmentId) {					
					var toRoutes = routeUtils.inverseList(routes[Math.abs(toSegmentId)] || [], toSegmentId),
						toWidth = getRoutesListWidth(toRoutes),
						fromCounter = 0,
						toCounter = 0,
						currentGroup = null,
						currentGroupStartFromWidthShift = 0,
						currentGroupStartToWidthShift = 0;

					while (fromCounter < fromRoutes.length) {
						if (currentGroup) {
							if (routeUtils.notPhantom(fromRoutes[fromCounter]) && toRoutes[toCounter] == getMatchingRoute(fromSegmentId, toSegmentId, fromRoutes[fromCounter])) {
								var resRoute = toRoutes[toCounter].length > fromRoutes[fromCounter].length? toRoutes[toCounter] : fromRoutes[fromCounter];

								currentGroup.push(resRoute);
								fromCounter++;
								toCounter++;
								continue;
							} else {
								var groupWidth = getRoutesListWidth(currentGroup);

								groups.push({
			                        from : fromSegmentId,
			                        to : toSegmentId,
		                        	routes : currentGroup,
		                        	fromShift : currentGroupStartFromWidthShift + groupWidth / 2 - fromWidth / 2,
		                        	toShift : currentGroupStartToWidthShift + groupWidth / 2 - toWidth / 2,
		                        	groupWidth : groupWidth
		                    	});
								currentGroup = null;
							}
						}
						if (!routeUtils.notPhantom(fromRoutes[fromCounter])) {
							fromCounter++;
							continue;
						} else if (getMatchingRoute(fromSegmentId, toSegmentId, fromRoutes[fromCounter])) {
							toCounter = toRoutes.indexOf(getMatchingRoute(fromSegmentId, toSegmentId, fromRoutes[fromCounter]));
							if (toCounter === -1) {
								console.warn('couldn\'t find', getMatchingRoute(fromSegmentId, toSegmentId, fromRoutes[fromCounter]), 'among', JSON.stringify(toRoutes));
								fromCounter++;
								continue;
							}
							currentGroup = [];

							currentGroupStartFromWidthShift = getRoutesListWidth(fromRoutes.slice(0, fromCounter));
		                    currentGroupStartToWidthShift = getRoutesListWidth(toRoutes.slice(0, toCounter));
		                    
							continue;
						} else {
							fromCounter++;
						}
					}

					if (currentGroup) {
						var groupWidth = getRoutesListWidth(currentGroup);

						groups.push({
	                        from : fromSegmentId,
	                        to : toSegmentId,
                        	routes : currentGroup,
                        	fromShift : currentGroupStartFromWidthShift + groupWidth / 2 - fromWidth / 2,
                        	toShift : currentGroupStartToWidthShift + groupWidth / 2 - toWidth / 2,
                        	groupWidth : groupWidth
                    	});
					}
		        });
		    });

			// Extract "strange" route groups (when we don't know which two segments to join we just draw segment ends up to the junction)
			if(strangeRoutes.length) {
			    segmentIds.forEach(function(segmentId) {
			    	var counter = 0,
			    		segRoutes = routes[Math.abs(segmentId)] || [],
			    		segWidth = getRoutesListWidth(segRoutes),
						currentGroup = null,
						currentGroupStartWidthShift = 0;

			    	while (counter < segRoutes.length) {
						if (currentGroup) {
							if (routeUtils.notPhantom(segRoutes[counter]) && strangeRoutes.indexOf(routeUtils.strip(segRoutes[counter])) != -1) {
								currentGroup.push(routeUtils.strip(segRoutes[counter]));
								counter++;
								continue;
							} else {
								var groupWidth = getRoutesListWidth(currentGroup);

								groups.push({
			                        from : segmentId,
		                        	routes : currentGroup,
		                        	fromShift : currentGroupStartWidthShift + groupWidth / 2 - segWidth / 2,
		                        	groupWidth : groupWidth
		                    	});
								currentGroup = null;
							}
						}
						if (!routeUtils.notPhantom(segRoutes[counter])) {
							counter++;
							continue;
						} else if (strangeRoutes.indexOf(routeUtils.strip(segRoutes[counter])) != -1) {
							currentGroup = [];
							currentGroupStartWidthShift = getRoutesListWidth(segRoutes.slice(0, counter));
							continue;
						} else {
							counter++;
						}
					}
			    });
			}

			groups.sort(function(a, b) { 
				return b.groupWidth - a.groupWidth;
			});

		    return groups;
		},

		getJunctionLineGeometry : function(junctionSize, junction, cutFrom, cutTo, fromShift, toShift) {
			var shiftedFrom = geomUtils.deduplicate(geomUtils.offsetLine(cutFrom, fromShift)),
				shiftedTo = geomUtils.deduplicate(geomUtils.offsetLine(cutTo, toShift)),
				lastFromSegment = [shiftedFrom[shiftedFrom.length - 2], shiftedFrom[shiftedFrom.length - 1]],
				lastFromSegmentLength = geomUtils.getLength(lastFromSegment),
				firstToSegment = [shiftedTo[0], shiftedTo[1]],
				firstToSegmentLength = geomUtils.getLength(firstToSegment),
				startPoint = lastFromSegment[1],
				endPoint = firstToSegment[0],
				fromOrtSegment = [
					startPoint,
					[
						startPoint[0] + (lastFromSegment[1][0] - lastFromSegment[0][0]) / lastFromSegmentLength,
						startPoint[1] + (lastFromSegment[1][1] - lastFromSegment[0][1]) / lastFromSegmentLength
					]
				],
				toOrtSegment = [
					endPoint,
					[
						endPoint[0] - (firstToSegment[1][0] - firstToSegment[0][0]) / firstToSegmentLength,
						endPoint[1] - (firstToSegment[1][1] - firstToSegment[0][1]) / firstToSegmentLength
					]
				],
				fromIntersectionPos = geomUtils.findIntersectionPos(fromOrtSegment, toOrtSegment),
				toIntersectionPos = geomUtils.findIntersectionPos(toOrtSegment, fromOrtSegment);

			if(fromIntersectionPos > 0 && toIntersectionPos > 0) {
				var intersectionPoint = [
						startPoint[0] + (fromOrtSegment[1][0] - fromOrtSegment[0][0]) * fromIntersectionPos,
						startPoint[1] + (fromOrtSegment[1][1] - fromOrtSegment[0][1]) * fromIntersectionPos
					];

				return geomUtils.deduplicate(
					geomUtils.roundAngle(
						startPoint,
						intersectionPoint,
						endPoint,
						junctionSize
					));
			}
			else {
				var fromShiftOrt = [
						-(lastFromSegment[1][1] - lastFromSegment[0][1]) / lastFromSegmentLength,
						(lastFromSegment[1][0] - lastFromSegment[0][0]) / lastFromSegmentLength
					],
					toShiftOrt = [
						-(firstToSegment[1][1] - firstToSegment[0][1]) / firstToSegmentLength,
						(firstToSegment[1][0] - firstToSegment[0][0]) / firstToSegmentLength,
					],
					junctionProjectionOntoFromPos = Math.max(geomUtils.findIntersectionPos(fromOrtSegment, [
						junction,
						[ junction[0] + fromShiftOrt[0], junction[1] + fromShiftOrt[1] ]
					]), junctionSize / 10),
					junctionProjectionOntoToPos = Math.max(geomUtils.findIntersectionPos(toOrtSegment, [
						junction,
						[ junction[0] + toShiftOrt[0], junction[1] + toShiftOrt[1] ]
					]), junctionSize / 10),
					point1 = [
						startPoint[0] + (fromOrtSegment[1][0] - fromOrtSegment[0][0]) * junctionProjectionOntoFromPos / 3, 
						startPoint[1] + (fromOrtSegment[1][1] - fromOrtSegment[0][1]) * junctionProjectionOntoFromPos / 3
					],
					point2 = [
						endPoint[0] + (toOrtSegment[1][0] - toOrtSegment[0][0]) * junctionProjectionOntoToPos / 3, 
						endPoint[1] + (toOrtSegment[1][1] - toOrtSegment[0][1]) * junctionProjectionOntoToPos / 3
					],
					middlePoint = [
						(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2
					];

				return geomUtils.deduplicate(
					[]
					.concat(geomUtils.roundAngle(
						startPoint,
						point1,
						middlePoint,
						junctionSize
					))
					.concat(geomUtils.roundAngle(
						middlePoint,
						point2,
						endPoint,
						junctionSize
					))
				);
			}
		}
	};

	return junctionUtils;
});
