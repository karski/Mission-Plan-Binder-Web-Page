//Provides functions for manipulating and providing input from a properly formatted route JSON
//JSON must be loaded to msnPlan variable

//global var to hold mission json data
var msnPlan;

//index enumeration for calculation arrays
var calcCol = Object.freeze({
    "TAS": 0,
    "TASChanged": 1,    //default = false, propogated = false, or changed by user = true
    "windDirection": 2,
    "windVelocity": 3,
    "windChanged": 4,   //0, propogated, or change by user = true
    "GS": 5,            //TAS - headwind component (determined using orig courseT)
    "legTime": 6,       //(orig TAS/GS) * orig legTime
    "ETA": 7,           //leg times +/- from tgtTime
    "TTG": 8,           //leg times - from landTime
    "PPH": 9,
    "PPHChanged": 10,   //default, propogated, or changed by user = true
    "legFuel": 11,      //PPH * legTime
    "fuel": 12          //leg fuel +/- from tgtFuel
});

//Calc Tables and variables for defining actively displayed routes ************
//**Note: route index value -1 indicates that route is not displayed (inactive)

var activeRoutes = [
    { "calcTable": [], "routeIndex": -1, "tgtTimeIndex": -1, "tgtFuelIndex": -1 },  //main values
    { "calcTable": [], "routeIndex": -1, "tgtTimeIndex": -1, "tgtFuelIndex": -1 },  //c1 values
    { "calcTable": [], "routeIndex": -1, "tgtTimeIndex": -1, "tgtFuelIndex": -1 },  //c2 values
    { "calcTable": [], "routeIndex": -1, "tgtTimeIndex": -1, "tgtFuelIndex": -1 },  //c3 values
    { "calcTable": [], "routeIndex": -1, "tgtTimeIndex": -1, "tgtFuelIndex": -1 }   //c4 values
];



//*****************************************************************************


//takes a JSON object as input
//checks for basic route values
//returns 1 if load is accepted
function loadMsnPlan(iPlan) {
    //check for necessary msn components
    if (iPlan.msnNumber != 'undefined' && iPlan.routes.length > 0 &&
        iPlan.routes[0].dtd != 'undefined' && iPlan.routes[0].lat != 'undefined' &&
        iPlan.routes[0].lon != 'undefined') {
        //Right now this is a very rudimentary check to see if basic components exist in one route
        //TODO: suggest iterating through every waypoint to check for values required for future calculations before accepting
        // required fields should be: DTD, Lat, Lon, courseT/M, altCom, tas, distLeg, timeLeg, fuelLeg

        //checks passed - save to variable
        msnPlan = iPlan;
        return 1;
    } else {
        return -1;
    }
}

//Generates a properly tagged HTML table for the route
//**this request should only happen once for each time the route is displayed,
//      future changes can be made incrementally to components based on ID and Class names
//INPUTS:   routeIndex - index of route in msnPlan.routes
//          currentWptIndex - index of current waypoint in route
//          courseMT - "T"=use true courses, "M"=use magnetic courses
//          tableIndex - determines where route values are loaded for calc tables (main=0/c1/2/3/4)
//          tgtTime - sets tgtTime value in currentWpt for calculations
//                      UNDEFINED = use defaults
//          tgtFuel - sets tgtFuel value in currentWpt for calculations
//                      UNDEFINED = use defaults
//          transferTableIndex - optional - use the calc table of a table that is already displayed
//                      **only when xfering from contingency table to main route table**
//                      this should transfer all the edits the user made
//                      UNDEFINED - load default route values from msnPlan and use tgtTime and tgtFuel values
function generateRouteTable(routeIndex, currentWptIndex, courseMT, tableIndex, tgtTime, tgtFuel, transferTableIndex) {
    console.log('Generate Table: route ' + routeIndex + ', wpt ' + currentWptIndex + ', course ' + courseMT + ', table' + tableIndex + ', tgtTime ' + tgtTime + ', tgtFuel ' + tgtFuel + ', xfer table ' + transferTableIndex);
    //protect against undefined initial values
    if (routeIndex == undefined) { routeIndex = 0; }
    else { routeIndex = Number(routeIndex); }
    if (currentWptIndex == undefined) { currentWptIndex = 0; }
    else { currentWptIndex = Number(currentWptIndex); }
    if (courseMT == undefined) { courseMT = "T"; }
    var timeSet = false;
    var fuelSet = false;
    var iMax = msnPlan.routes[routeIndex].waypoints.length;

    //initialize active route variables - either from existing table or from msnPlan and calculations
    if (tableIndex == 0 && transferTableIndex > 0) {
        console.log("using transfer table values: table " + transferTableIndex);
        //transfer an existing table into the main route table position - this will transfer all user edits
        activeRoutes[tableIndex].routeIndex = activeRoutes[transferTableIndex].routeIndex;
        //routeIndex = activeRoutes[transferTableIndex].routeIndex; - already screwed if this is wrong...
        activeRoutes[tableIndex].tgtTimeIndex = activeRoutes[transferTableIndex].tgtTimeIndex;
        activeRoutes[tableIndex].tgtFuelIndex = activeRoutes[transferTableIndex].tgtFuelIndex;
        //should be a safe copy operation to prevent linking to the same object
        activeRoutes[tableIndex].calcTable - [];
        for (var a = 0; a < activeRoutes[transferTableIndex].calcTable.length; a++) {
            activeRoutes[tableIndex].calcTable[a] = activeRoutes[transferTableIndex].calcTable[a].slice();
        }
        timeSet = true;
        fuelSet = true;
    } else {
        //load initial route values for calculations
        activeRoutes[tableIndex].routeIndex = routeIndex;

        if (tgtTime >= 0) { //setup timing values
            activeRoutes[tableIndex].tgtTimeIndex = currentWptIndex;
            timeSet = true;
        } else {
            activeRoutes[tableIndex].tgtTimeIndex = 0;
            tgtTime = 0;
        }
        if (tgtFuel >= 0) { //setup fuel source
            activeRoutes[tableIndex].tgtFuelIndex = currentWptIndex;
            fuelSet = true;
        } else {
            activeRoutes[tableIndex].tgtFuelIndex = 0;
            tgtFuel = Number(msnPlan.routes[routeIndex].fuelInitial);
        }

        //load table values from stored msnPlan
        activeRoutes[tableIndex].calcTable = []; //reset calc table
        for (var i = 0; i < iMax; i++) {
            var msnPlanWpt = msnPlan.routes[routeIndex].waypoints[i]; //alias for easier referencing
            activeRoutes[tableIndex].calcTable[i] = [];//setup waypoint as a new array
            //fill in array using indexes from calcCol for consistency when accessing values
            activeRoutes[tableIndex].calcTable[i][calcCol.TAS] = Number(msnPlanWpt.tas);
            activeRoutes[tableIndex].calcTable[i][calcCol.TASChanged] = false;
            activeRoutes[tableIndex].calcTable[i][calcCol.windDirection] = 0;
            activeRoutes[tableIndex].calcTable[i][calcCol.windVelocity] = 0;
            activeRoutes[tableIndex].calcTable[i][calcCol.windChanged] = false;
            activeRoutes[tableIndex].calcTable[i][calcCol.GS] = Number(msnPlanWpt.tas); //since initial wind is always 0, GS=TAS
            activeRoutes[tableIndex].calcTable[i][calcCol.legTime] = Number(msnPlanWpt.timeLeg);
            activeRoutes[tableIndex].calcTable[i][calcCol.PPH] = Number(msnPlanWpt.pph);
            activeRoutes[tableIndex].calcTable[i][calcCol.PPHChanged] = false;
            activeRoutes[tableIndex].calcTable[i][calcCol.legFuel] = Number(msnPlanWpt.fuelLeg);

            //set intial values for target fields (time and fuel)
            //--only fill in waypoints with target values, the rest will be calculated in the next step
            if (i == activeRoutes[tableIndex].tgtTimeIndex) {
                activeRoutes[tableIndex].calcTable[i][calcCol.ETA] = tgtTime;
            }
            if (i == activeRoutes[tableIndex].tgtFuelIndex) {
                activeRoutes[tableIndex].calcTable[i][calcCol.fuel] = tgtFuel;
            }
        }
    }
    //calculate tables based on target values
    calcETAs(tableIndex);
    calcTTGs(tableIndex);
    calcFuels(tableIndex); //consider using a fixed initial value for each waypoint fuel for initial fuel load to match preplanned route calcs


    //store takeoff and landing index for easy reference
    var takeoff = getTakeoffWptIndex(tableIndex);
    var touchdown = getTouchdownWptIndex(tableIndex);

    //generate table HTML text using values in calc table
    // (I really hope building this huge string is faster than creating document element objects and manipulating thier attributes
    var htmlTable = "<table>\n";
    //loop through all waypoints
    for (var i = 0; i < iMax; i++) {
        var calcWpt = activeRoutes[tableIndex].calcTable[i]; //alias for easier referencing
        var planWpt = msnPlan.routes[routeIndex].waypoints[i]; //alias for easier referencing
        htmlTable += '<tr class="tableRow' + (i == currentWptIndex ? ' currentWpt' : '') + '" id="' + planWpt.dtd + '"' + (tableIndex == 0 ? ' onclick="selectWpt(' + tableIndex + ',' + routeIndex + ',' + i + ')"' : '') + '>';
        htmlTable += '<td class="colArrow"></td>';
        htmlTable += '<td class="colDTD">';
        if (planWpt.ap != undefined) {
            htmlTable += (planWpt.FAF ? '<span class="FAF">✠</span>' : (planWpt.IAF ? '◇' : '')) + '<a class="ap">' + planWpt.dtd + '<div>' + planWpt.ap + '</div></a>'; //✠ &#5869; - runic cross with a little less serif
        } else {
            htmlTable += '<p>' + (planWpt.FAF ? '<span class="FAF">✠</span>' : (planWpt.IAF ? '◇' : '')) + planWpt.dtd + '</p>';
        }
        htmlTable += '<p>' + (planWpt.remarks != undefined ? planWpt.remarks : '') + '</p></td>';
        htmlTable += '<td class="colLL"><p>' + (planWpt.fix != undefined ? planWpt.fix : '') + '</p>';
        htmlTable += '<p>' + planWpt.lat + '</p><p>' + planWpt.lon + '</p></td>';
        htmlTable += '<td class="colAlt"><p>' + planWpt.altCom + '</p><p>' + planWpt.altExp + '</p>';
        htmlTable += '<p class="courseDisp">' + (courseMT == 'T' ? planWpt.courseT + '&deg;T' : planWpt.courseM + '&deg;M') + '</p></td>';
        if (i >= takeoff && i <= touchdown) { //draw winds on airborne waypoints
            htmlTable += '<td class="colDist"><p class="changeWind' + (activeRoutes[tableIndex].calcTable[i][calcCol.windChanged] ? ' userChanged' : '') + '" onclick="inputSelect(' + tableIndex + ',' + i + ')">' + getWindString(tableIndex, i) + '</p>';
        } else {
            htmlTable += '<td class="colDist"><p>-</p>';
        }
        htmlTable += '<p>' + planWpt.distLeg + '</p><p>' + planWpt.distAC + '</p></td>';
        htmlTable += '<td class="colSpeed"><p' + (i >= takeoff && i <= touchdown ? ' class="changeTAS' + (activeRoutes[tableIndex].calcTable[i][calcCol.TASChanged] ? ' userChanged' : '') + '" onclick="inputSelect(' + tableIndex + ',' + i + ')"' : '') + '>' + calcWpt[calcCol.TAS] + '</p>';
        htmlTable += '<p>' + planWpt.cas + '[' + planWpt.mach + ']</p><p class="gsDisp">' + calcWpt[calcCol.GS] + '</p></td>';
        htmlTable += '<td class="colTime"><p class="changeTime' + (timeSet && activeRoutes[tableIndex].tgtTimeIndex == i ? ' userChanged' : '') + '" onclick="inputSelect(' + tableIndex + ',' + i + ')">' + timeToString(calcWpt[calcCol.ETA]) + '</p>';
        htmlTable += '<p class="legTimeDisp">' + timeDurationToString(calcWpt[calcCol.legTime]) + '</p><p class="ttgDisp">' + timeDurationToString(calcWpt[calcCol.TTG]) + '</p></td>';
        htmlTable += '<td class="colFuel"><p class="changePPH' + (activeRoutes[tableIndex].calcTable[i][calcCol.PPHChanged] ? ' userChanged' : '') + '" onclick="inputSelect(' + tableIndex + ',' + i + ')">' + calcWpt[calcCol.PPH] + '</p>';
        htmlTable += '<p class="legFuelDisp">' + calcWpt[calcCol.legFuel] + '</p>';
        htmlTable += '<p class="changeFuel' + (timeSet && activeRoutes[tableIndex].tgtFuelIndex == i ? ' userChanged' : '') + '" onclick="inputSelect(' + tableIndex + ',' + i + ')">' + calcWpt[calcCol.fuel] + '</p></td>';
        htmlTable += '<td class="colContingency">';
        if (planWpt.c1DTD != undefined) { htmlTable += '<p><a class="c1Link" href="#' + planWpt.c1DTD + '">C1: ' + planWpt.c1DTD + '-' + planWpt.c1Route + '</a></p>'; }
        if (planWpt.c2DTD != undefined) { htmlTable += '<p><a class="c2Link" href="#' + planWpt.c2DTD + '">C2: ' + planWpt.c2DTD + '-' + planWpt.c2Route + '</a></p>'; }
        if (planWpt.c3DTD != undefined) { htmlTable += '<p><a class="c3Link" href="#' + planWpt.c3DTD + '">C3: ' + planWpt.c3DTD + '-' + planWpt.c3Route + '</a></p>'; }
        if (planWpt.c4DTD != undefined) { htmlTable += '<p><a class="c4Link" href="#' + planWpt.c4DTD + '">C4: ' + planWpt.c4DTD + '-' + planWpt.c4Route + '</a></p>'; }
        htmlTable += '</td></tr>\n';
    }
    htmlTable += "</table>"

    return htmlTable;
}

//Generates html li tags for route lists
//INPUT: cType - type of contingency route C0,C1,C2,C3,C4 - case independent
function generateRouteList(cType) {
    var htmlList = '';
    var planLoc = getParameterByName("planLoc");
    var href = "#"; //by default, put a blank link
    if (/^http*/.test(planLoc)) { //should only be HTTP stored here, but just be safe
        //build a destination address containing current page location with planLoc and route parameters
        var url = window.location.href;
        href = url.substr(0, url.indexOf("?")) + "?planLoc=" + planLoc+"&route="
    }
    //loop through all routes and add routes with that fall into requested contingency category
    for (var i = 0; i < msnPlan.routes.length; i++) {
        if (msnPlan.routes[i].type.toUpperCase() == cType.toUpperCase()) {
            htmlList += '<li class="tableRow" onclick="routeSelect(' + i + ')"><a onclick="routeSelect(' + i + ')" href="'+href +i+ '">' + msnPlan.routes[i].name + '</a> ' + (msnPlan.routes[i].description != undefined ? msnPlan.routes[i].description : '') + '</li>';
        }
    }
    return htmlList;
}


//****CALC FUNCTIONS********************
//calculate table for various input values changed

//recalculates all table ETAs based on target time
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
function calcETAs(tableIndex) {
    //start at target and work forward using leg times
    //*note: +/- index references should be safe becuase tgtIndex serves as a buffer from overruns
    for (var i = activeRoutes[tableIndex].tgtTimeIndex + 1; i < activeRoutes[tableIndex].calcTable.length; i++) {
        activeRoutes[tableIndex].calcTable[i][calcCol.ETA] = activeRoutes[tableIndex].calcTable[i - 1][calcCol.ETA] + activeRoutes[tableIndex].calcTable[i][calcCol.legTime];
    }
    //start at target and work backward using previous (i+1) leg times
    for (var i = activeRoutes[tableIndex].tgtTimeIndex - 1; i >= 0; i--) {
        activeRoutes[tableIndex].calcTable[i][calcCol.ETA] = activeRoutes[tableIndex].calcTable[i + 1][calcCol.ETA] - activeRoutes[tableIndex].calcTable[i + 1][calcCol.legTime];
    }
}

//recalculates all table TTGs based on legTimes
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
function calcTTGs(tableIndex) {
    var touchdownIndex = getTouchdownWptIndex(tableIndex);
    activeRoutes[tableIndex].calcTable[touchdownIndex][calcCol.TTG] = 0;
    for (var i = touchdownIndex - 1; i >= 0; i--) {
        activeRoutes[tableIndex].calcTable[i][calcCol.TTG] = activeRoutes[tableIndex].calcTable[i + 1][calcCol.TTG] - activeRoutes[tableIndex].calcTable[i + 1][calcCol.legTime];
    }
}

//recalculate fuels based on target fuel
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
function calcFuels(tableIndex) {
    //start at target and work forward using leg fuels
    //*note: +/- index references should be safe becuase tgtIndex serves as a buffer from overruns
    for (var i = activeRoutes[tableIndex].tgtFuelIndex + 1; i < activeRoutes[tableIndex].calcTable.length; i++) {
        activeRoutes[tableIndex].calcTable[i][calcCol.fuel] = activeRoutes[tableIndex].calcTable[i - 1][calcCol.fuel] - activeRoutes[tableIndex].calcTable[i][calcCol.legFuel];
    }
    //start at target and work backward using previous (i+1) leg fuels
    for (var i = activeRoutes[tableIndex].tgtFuelIndex - 1; i >= 0; i--) {
        activeRoutes[tableIndex].calcTable[i][calcCol.fuel] = activeRoutes[tableIndex].calcTable[i + 1][calcCol.fuel] + activeRoutes[tableIndex].calcTable[i + 1][calcCol.legFuel];
    }
}

//recalculates GS/legTime within index range to save time from recalcing whole table
//Use after new TAS or Winds are entered
//**will trigger recalcing all table ETAs and TTGs to adjust for new leg times
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      start/endIndex - first through last wpts that will change
function calcSpeedChange(tableIndex, firstIndex, lastIndex) {
    //iterate through all changed wpts
    for (var i = firstIndex; i <= lastIndex; i++) {
        //Calc new GS - using TAS and wind = TAS - headwindComponent(cos((windAngle-CourseTrue) / 180*pi) * wind speed)
        activeRoutes[tableIndex].calcTable[i][calcCol.GS] = parseInt(activeRoutes[tableIndex].calcTable[i][calcCol.TAS] - (Math.cos(
            (activeRoutes[tableIndex].calcTable[i][calcCol.windDirection] - Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints[i].courseT)) / 180 * Math.PI) *
            activeRoutes[tableIndex].calcTable[i][calcCol.windVelocity]));
        //use new GS (compared to original TAS) to determine new legTime (factor of original legTime)
        //speed factor = orig TAS / GS
        //leg time = orig LegTime * speed factor
        activeRoutes[tableIndex].calcTable[i][calcCol.legTime] = parseInt(Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints[i].timeLeg) *
            (Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints[i].tas) / activeRoutes[tableIndex].calcTable[i][calcCol.GS]));

        //fix bad timing values
        if (activeRoutes[tableIndex].calcTable[i][calcCol.legTime] < 0 || isNaN(activeRoutes[tableIndex].calcTable[i][calcCol.legTime])) {
            activeRoutes[tableIndex].calcTable[i][calcCol.legTime] = 0;
        }
    }
    //recalc route times based on changed leg times
    calcETAs(tableIndex);//recalc ETAs
    calcTTGs(tableIndex);//recalc TTGs
    //recalc legFuels --> triggers route fuel recalc
    calcLegFuels(tableIndex, firstIndex, lastIndex);
}

//recalculates legFuels within index range to save time from recalcing whole table
//**will trigger recalcing all table fuels
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      start/endIndex - first through last wpts that will change
function calcLegFuels(tableIndex, firstIndex, lastIndex) {
    //iterate through all changed wpts
    for (var i = firstIndex; i <= lastIndex; i++) {
        //use PPH and legTime to recalc legFuel
        activeRoutes[tableIndex].calcTable[i][calcCol.legFuel] = parseInt((activeRoutes[tableIndex].calcTable[i][calcCol.PPH] / 3600) * activeRoutes[tableIndex].calcTable[i][calcCol.legTime]);
    }
    //recalc route fuels
    calcFuels(tableIndex);
}


//****SET VALUES FUNCTIONS********************
//set various values in Calc tables with appropriate propogations
//each will return a reference to the table changed for updating values in the page

//set a target time to a user defined value
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      tgtTime, tgtTimeIndex - self explanatory
// "" will reset to defaults
//invalid input returns null
function setTgtTime(tableIndex, tgtTime, tgtTimeIndex) {
    //check input
    if (tgtTime == "") {
        //reset to default (0 at wpt 0)
        tgtTime = 0;
        tgtTimeIndex = 0;
    } else {
        //process input
        tgtTime = inputToSeconds(tgtTime);
        if (tgtTime == undefined) {
            return null;
        }
    }

    //set values
    activeRoutes[tableIndex].calcTable[tgtTimeIndex][calcCol.ETA] = tgtTime;
    activeRoutes[tableIndex].tgtTimeIndex = tgtTimeIndex;
    //recalculate ETAs
    calcETAs(tableIndex);

    return getTableETAs(tableIndex);
}

//set a target time to a seconds value
//this should be used when transferring times across tables
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      tgtTime, tgtTimeIndex - self explanatory
// "" will reset to defaults
//invalid input returns null
function setTgtTimeSeconds(tableIndex, tgtTime, tgtTimeIndex) {
    //check input
    if (tgtTime == "") {
        //reset to default (0 at wpt 0)
        activeRoutes[tableIndex].calcTable[0][calcCol.ETA] = 0;
        activeRoutes[tableIndex].tgtTimeIndex = 0;
    } else if (!isNaN(tgtTime)) {
        //process input
        activeRoutes[tableIndex].calcTable[tgtTimeIndex][calcCol.ETA] = parseInt(tgtTime);
        activeRoutes[tableIndex].tgtTimeIndex = tgtTimeIndex;
    } else {
        return null;
    }

    //recalculate ETAs
    calcETAs(tableIndex);

    return getTableETAs(tableIndex);
}

//set a target fuel to a user defined value
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      tgtFuel, tgtFuelIndex - self explanatory
// "" will reset to defaults
//RETURN: null for bad input, table with new values
function setTgtFuel(tableIndex, tgtFuel, tgtFuelIndex) {
    //check input and set values
    if (tgtFuel == "") {
        activeRoutes[tableIndex].calcTable[0][calcCol.fuel] = Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].fuelInitial);
        activeRoutes[tableIndex].tgtFuelIndex = 0;
    } else if (!isNaN(tgtFuel)) {
        activeRoutes[tableIndex].calcTable[tgtFuelIndex][calcCol.fuel] = parseInt(tgtFuel);
        activeRoutes[tableIndex].tgtFuelIndex = tgtFuelIndex;
    } else {
        return null;
    }

    //recalculate fuels
    calcFuels(tableIndex);

    return getTableFuels(tableIndex);
}

//set a wind to user defined value
//accepted user input: AAA/VV, AAAV, 0
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      others - self explanatory
// "" will reset to 0 and clear out change marker
//RETURN: null for bad input, table with new values
function setUserWind(tableIndex, windValue, wptIndex) {
    //interpret value - reject if necessary
    var windAngle;
    var windVelocity;
    if (windValue == "" || windValue == 0) {
        //blank or 0 - use to clear out winds until next value
        windAngle = 0;
        windVelocity = 0;
    } else if (String(windValue).indexOf("/") > -1) {
        //normal format
        windValue = windValue.split("/");
        if (windValue.length < 2) {
            return null; //not enough values
        } else {
            windAngle = parseInt(windValue[0]) % 360;
            windVelocity = Math.abs(parseInt(windValue[1]));
        }
    } else {
        //remove potentially confusing characters
        windValue = windValue.replace(/\D/g, '');
        if (String(windValue).length >= 4 && String(windValue.length) <= 6 && parseInt(windValue) > 0) {
            //right number of digits and positive numeric
            windAngle = parseInt(windValue.substring(0, 3)) % 360;
            windVelocity = parseInt(windValue.substring(3));
        } else {
            //reject input
            return null;
        }
    }


    //mark as changed unless user cleared out input change marker
    if (windValue == "") {
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windChanged] = false;
    } else {
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windChanged] = true;
    }

    //set current wpt values
    activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windDirection] = windAngle;
    activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windVelocity] = windVelocity;
    //propogate to next user- defined wind (or landing)
    var changeRow;
    for (changeRow = wptIndex + 1; changeRow <= getTouchdownWptIndex(tableIndex) && !activeRoutes[tableIndex].calcTable[changeRow][calcCol.windChanged]; changeRow++) {
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.windDirection] = windAngle;
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.windVelocity] = windVelocity;
    }
    changeRow -= 1; //step back change row so that future calcs are inclusive (this is the last changed row now - NOT the one after it)

    //recalculate Speed to get new GS and Leg Times --> this will trigger ETA and TTG recalc
    //                                              --> new leg times will also trigger Leg Fuel and Fuel recalc
    calcSpeedChange(tableIndex, wptIndex, changeRow);

    //return array with modified wind values
    //note - this should be the only place winds have to be interpreted - if this changes, move to a new function for wind string output
    var windStr = getWindString(tableIndex, wptIndex);// (windAngle < 100 ? "0" : "") + (windAngle < 10 ? "0" : "") + windAngle + "/" + windVelocity;
    var resultArray = [];
    //build the output array - [windDisplay,GS,LegTime,LegFuel]
    for (var i = wptIndex; i <= changeRow; i++) {
        resultArray.push([windStr,
            activeRoutes[tableIndex].calcTable[i][calcCol.GS],
            timeDurationToString(activeRoutes[tableIndex].calcTable[i][calcCol.legTime]),
            activeRoutes[tableIndex].calcTable[i][calcCol.legFuel]]);
    }
    return resultArray;
}

//set a TAS to user defined value
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      others - self explanatory
// "",0 will reset to defaults
//RETURN: null for bad input, table with new values
function setUserTAS(tableIndex, newTAS, wptIndex) {
    //interpret value - reject if necessary
    if (newTAS == "" || newTAS == 0) {
        //blank or 0 - clear out speed value and set to default
        newTAS = Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints[wptIndex].tas);
        //clear user input marking
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.TASChanged] = false;
    } else if (parseInt(newTAS) > 0) {
        newTAS = parseInt(newTAS); //remove any decimals
        //set user input mark
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.TASChanged] = true;
    } else { //bad input, reject
        return null;
    }
    //save previous value for propogation
    var oldTAS = activeRoutes[tableIndex].calcTable[wptIndex][calcCol.TAS];
    //set value at waypoint
    activeRoutes[tableIndex].calcTable[wptIndex][calcCol.TAS] = newTAS;

    //propogate to next user-defined TAS or different TAS (indicating climb/descent, where same speed doesn't make sense)
    //(or landing)
    var changeRow;
    for (changeRow = wptIndex + 1; changeRow <= getTouchdownWptIndex(tableIndex) &&
        !activeRoutes[tableIndex].calcTable[changeRow][calcCol.TASChanged] &&
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.TAS] == oldTAS; changeRow++) {
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.TAS] = newTAS;
    }
    changeRow -= 1; //step back change row so that future calcs are inclusive (this is the last changed row now - NOT the one after it)

    //recalculate Speed to get new GS and Leg Times --> this will trigger ETA and TTG recalc
    //                                              --> new leg times will also trigger Leg Fuel and Fuel recalc
    calcSpeedChange(tableIndex, wptIndex, changeRow);

    //return array with changed speed values
    var resultArray = [];
    //build output array - [TAS, GS, LegTime, LegFuel]
    for (var i = wptIndex; i <= changeRow; i++) {
        resultArray.push([newTAS,
            activeRoutes[tableIndex].calcTable[i][calcCol.GS],
            timeDurationToString(activeRoutes[tableIndex].calcTable[i][calcCol.legTime]),
            activeRoutes[tableIndex].calcTable[i][calcCol.legFuel]]);
    }
    return resultArray;
}

//set a PPH to user defined value
//INPUT: tableIndex - table to update (main=0/c1/2/3/4)
//      others - self explanatory
// "" will reset to defaults
//RETURN: null for bad input, table with new values
function setUserPPH(tableIndex, newPPH, wptIndex) {
    //interpret value - reject if necessary
    if (newPPH == "") {
        //blank value sets to default
        newPPH = Number(msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints[wptIndex].pph);
        //clear user input marking
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.PPHChanged] = false;
    } else if (parseInt(newPPH) >= 0) {
        newPPH = parseInt(newPPH);//remove any decimals
        //set user input marking
        activeRoutes[tableIndex].calcTable[wptIndex][calcCol.PPHChanged] = true;
    } else {//bad value
        return null;
    }
    //save prev value for propogation
    var oldPPH = activeRoutes[tableIndex].calcTable[wptIndex][calcCol.PPH];
    //set value at waypoint
    activeRoutes[tableIndex].calcTable[wptIndex][calcCol.PPH] = newPPH;

    //propogate to next user-defined PPH or different PPH (indicating change in phase of flt - climb or descent)
    //(or landing)
    var changeRow;
    for (changeRow = wptIndex + 1; changeRow <= getTouchdownWptIndex(tableIndex) &&
        !activeRoutes[tableIndex].calcTable[changeRow][calcCol.PPHChanged] &&
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.PPH] == oldPPH; changeRow++) {
        activeRoutes[tableIndex].calcTable[changeRow][calcCol.PPH] = newPPH;
    }
    changeRow -= 1; //step back change row so that future calcs are inclusive (this is the last changed row now - NOT the one after it)

    //recalc leg fuels --> triggers wptFuel recalcs
    calcLegFuels(tableIndex, wptIndex, changeRow);

    //return array with changed pph values
    var resultArray = [];
    //build output array - [PPH, legFuel]
    for (var i = wptIndex; i <= changeRow; i++) {
        resultArray.push([newPPH,
            activeRoutes[tableIndex].calcTable[i][calcCol.legFuel]]);
    }
    return resultArray;
}


//****GET FUNCTIONS**********************
//for various parameters that may need to be accessed individually

//returns mission number as text string
function getMsnNumber() {
    return msnPlan.msnNumber;
}

//returns binder location
function getBinderLoc() {
    return msnPlan.binderAddr;
}

//returns route name as text string
function getRouteName(routeIndex) {
    return msnPlan.routes[routeIndex].name;
}

//returns the type of route
function getRouteType(routeIndex) {
    return msnPlan.routes[routeIndex].type;
}

//returns the currently stored route index for a given display table
function getTableRouteIndex(tableIndex) {
    return activeRoutes[tableIndex].routeIndex;
}

//returns formatted wind value for given waypoint
function getWindString(tableIndex, wptIndex) {
    var windStr = (activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windDirection] < 100 ? "0" : "") + (activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windDirection] < 10 ? "0" : "") + activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windDirection] + "/" + activeRoutes[tableIndex].calcTable[wptIndex][calcCol.windVelocity];
    return windStr;
}

//returns the ETAs of the requested active route as an array of formatted time strings
function getTableETAs(tableIndex) {
    var resultArray = [];
    for (var i = 0; i < activeRoutes[tableIndex].calcTable.length; i++) {
        resultArray.push(timeToString(activeRoutes[tableIndex].calcTable[i][calcCol.ETA]));
    }
    return resultArray;
}


//returns ETA in seconds for a specified table and waypoint
//undefined if not valid
function getWptETA(tableIndex, wptIndex) {
    return activeRoutes[tableIndex].calcTable[wptIndex][calcCol.ETA];
}

//returns the ETAs and TTGs of the requested active route as an array of formatted time strings
//[ETA,TTG]
function getTableETATTGs(tableIndex) {
    var resultArray = [];
    for (var i = 0; i < activeRoutes[tableIndex].calcTable.length; i++) {
        resultArray.push([timeToString(activeRoutes[tableIndex].calcTable[i][calcCol.ETA]),
        timeDurationToString(activeRoutes[tableIndex].calcTable[i][calcCol.TTG])]);
    }
    return resultArray;
}

//returns the wptFuels of the requested active route as an array 
function getTableFuels(tableIndex) {
    var resultArray = [];
    for (var i = 0; i < activeRoutes[tableIndex].calcTable.length; i++) {
        resultArray.push(activeRoutes[tableIndex].calcTable[i][calcCol.fuel]);
    }
    return resultArray;
}


//returns fuel for a specified table and waypoint
//undefined if not valid
function getWptFuel(tableIndex, wptIndex) {
    return activeRoutes[tableIndex].calcTable[wptIndex][calcCol.fuel];
}

//finds the touchdown waypoint for a given route
//INPUT: active route table index
//OUTPUT: index of touchdown waypoint
function getTouchdownWptIndex(tableIndex) {
    if (msnPlan.routes[activeRoutes[tableIndex].routeIndex].touchdown != undefined && msnPlan.routes[activeRoutes[tableIndex].routeIndex].touchdown < msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints.length) {
        //valid stored touchdown
        return msnPlan.routes[activeRoutes[tableIndex].routeIndex].touchdown;
    } else {
        //return last waypoint
        return msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints.length - 1;
    }
}

//finds the takeoff (airborne) waypoint for a given route
//INPUT: active route table index
//OUTPUT: index of takeoff waypoint
function getTakeoffWptIndex(tableIndex) {
    if (msnPlan.routes[activeRoutes[tableIndex].routeIndex].takeoff != undefined && msnPlan.routes[activeRoutes[tableIndex].routeIndex].takeoff < msnPlan.routes[activeRoutes[tableIndex].routeIndex].waypoints.length && msnPlan.routes[activeRoutes[tableIndex].routeIndex].takeoff >= 0) {
        //valid stored takeoff
        return msnPlan.routes[activeRoutes[tableIndex].routeIndex].takeoff;
    } else {
        //return first waypoint
        return 0;
    }
}

//returns the index waypoint in the main route that is first one after the current time
function getCurrentTimeWptIndex() {
    var currentIndex = -1;
    //check for table loaded
    if (activeRoutes[0].calcTable != undefined) {
        //take ms from epoch, reduce to seconds, then mod to day length to find current time in seconds
        var currentTime = (Date.now() / 1000 | 0) % 86400;

        //iterate through active route looking for first time that is greater than time
        for (var i = 1; i < activeRoutes[0].calcTable.length; i++) {
            if (activeRoutes[0].calcTable[i][calcCol.ETA] > currentTime && activeRoutes[0].calcTable[i - 1][calcCol.ETA] < currentTime) {
                currentIndex = i;
                break;
            }
        }
        //if no match was found, limit all times to day scope this time to avoid overrun considerations
        if (currentIndex < 0) {
            currentIndex = 0; //put in as catchall in case this version fails to find correct time
            //this will guard against "new day" dilemmas
            for (var i = 1; i < activeRoutes[0].calcTable.length; i++) {
                if (activeRoutes[0].calcTable[i][calcCol.ETA] % 86400 > currentTime && activeRoutes[0].calcTable[i - 1][calcCol.ETA] % 86400 < currentTime) {
                    currentIndex = i;
                    break;
                }
            }
        }
    }
    return currentIndex;
}

//searches for next contingency of each type from given waypoint
//**contingency logic is always based on active mission plan
//INPUT:   Current waypoint index
//OUTPUT:  array with 4 entries in format [branchIndex, contingencyRouteIndex, contingencyWaypointIndex]
//          c1 = index 1, etc (index 0 will always be undefined)
//          contingencies without branches will be 'undefined'
function getContingencyLogic(currentWptIndex) {
    var aLogic = [];
    var touchdownIndex = getTouchdownWptIndex(0);
    if (currentWptIndex == undefined) { currentWptIndex = 0; }
    //find c1 branch - search until touchdown, since there are no branches past this
    for (var i = currentWptIndex; i < msnPlan.routes[activeRoutes[0].routeIndex].waypoints.length && i < touchdownIndex; i++) {
        if (msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c1DTD != undefined) {
            aLogic[1] = [i, Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c1RouteIndex), Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c1DTDIndex)];
            break;
        }
    }
    //find c2 branch - search until touchdown, since there are no branches past this
    for (var i = currentWptIndex; i < msnPlan.routes[activeRoutes[0].routeIndex].waypoints.length && i < touchdownIndex; i++) {
        if (msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c2DTD != undefined) {
            aLogic[2] = [i, Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c2RouteIndex), Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c2DTDIndex)];
            break;
        }
    }
    //find c3 branch - search until touchdown, since there are no branches past this
    for (var i = currentWptIndex; i < msnPlan.routes[activeRoutes[0].routeIndex].waypoints.length && i < touchdownIndex; i++) {
        if (msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c3DTD != undefined) {
            aLogic[3] = [i, Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c3RouteIndex), Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c3DTDIndex)];
            break;
        }
    }
    //find c4 branch - search until equal to touchdown, since this is where the go around routing is stitched
    for (var i = currentWptIndex; i < msnPlan.routes[activeRoutes[0].routeIndex].waypoints.length && i <= touchdownIndex; i++) {
        if (msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c4DTD != undefined) {
            aLogic[4] = [i, Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c4RouteIndex), Number(msnPlan.routes[activeRoutes[0].routeIndex].waypoints[i].c4DTDIndex)];
            break;
        }
    }
    //return the generated table
    return aLogic;
}




//gets an array containing arrays for each table with the waypoint courses in the requested format
//INPUT: "M" = magnetic, "T" = true
//OUTPUT: array containing 4 arrays for the tables each containing waypoint courses
//      [[0,1,2,3...],[0,1,2,3...],undefined,[0,1,2,360...],[0,1,2,3..]]
//      unpopulated tables are undefined
function getActiveCourses(courseMT) {
    var resultArray = [];
    //go through each active route
    for (var route = 0; route <= 4; route++) {
        //check that there is a route loaded in the slot
        if (activeRoutes[route].routeIndex >= 0) {
            var courseArray = [];
            //get each waypoint's course in the correct format
            for (var i = 0; i < msnPlan.routes[activeRoutes[route].routeIndex].waypoints.length; i++) {
                if (courseMT == "T") {
                    courseArray[i] = (msnPlan.routes[activeRoutes[route].routeIndex].waypoints[i].courseT + '&deg;T');
                } else {
                    courseArray[i] = (msnPlan.routes[activeRoutes[route].routeIndex].waypoints[i].courseM + '&deg;M');
                }
            }

            resultArray[route] = courseArray;
        }
    }
    return resultArray;
}

//****CONVERSION FUNCTIONS****************
//used primarily for time values (stored as seconds)

//Converts user input to seconds
//accepts format: H, HH, Hmm, HHmm, H:mm, HH:mm, HH:mm:ss
//returns undefined for input in bad format
function inputToSeconds(inTime) {
    //check for : to split on
    if (String(inTime).indexOf(':') >= 0) {
        //semicolons exist, use to split
        var aTime = inTime.split(':');
        return Number((aTime[0] == undefined ? 0 : aTime[0]) * 3600) + Number((aTime[1] == undefined ? 0 : aTime[1]) * 60) + Number((aTime[2] == undefined ? 0 : aTime[2]));
    } else if (!isNaN(inTime) && inTime >= 0) {
        //remove decimals
        inTime = String(inTime).replace(/\D/g, '');
        //no semicolon, use length to determine hours/minutes
        if (inTime.length <= 2) { //H,HH - just hours
            return parseInt(inTime) * 3600;
        } else if (inTime.length <= 4) { //Hmm, HHmm - count from right to get hours and minutes (since minutes should always be 2 digits)
            return parseInt(inTime.slice(0, -2) * 3600) + parseInt(inTime.slice(-2) * 60)
        } else if (inTime.length <= 7) { //Hmmss, HHmmss, HHHmmss - count from right to get hours, minutes, seconds (since mm/ss should always be 2 digits)
            return parseInt(inTime.slice(0, -4) * 3600) + parseInt(inTime.slice(-4, -2) * 60) + parseInt(inTime.slice(-2))
        }
    } else {
        return undefined;
    }
}

//converts seconds into a time string for display
//used for ETA
function timeToString(inSeconds) {
    if (inSeconds == 'undefined' || inSeconds == undefined) {
        inSeconds = 0;
    }
    //fix negative number
    while (inSeconds < 0) {
        inSeconds += 86400; //add 24 hours in seconds
    }
    var hours = Math.floor(inSeconds / 3600);
    var minutes = Math.floor((inSeconds - (hours * 3600)) / 60);
    var seconds = Math.round(inSeconds - (hours * 3600) - (minutes * 60));
    hours = hours % 24; //limit hours to 24
    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    return hours + ":" + minutes + ":" + seconds;
}

//converts seconds to a time duration string for display
//used for leg times and TTG
//accepts negative values and hours > 24
function timeDurationToString(inSeconds) {
    if (inSeconds == 'undefined' || inSeconds == undefined) {
        inSeconds = 0;
    }
    var hours = Math.floor(Math.abs(inSeconds) / 3600);
    var minutes = Math.floor((Math.abs(inSeconds) - (hours * 3600)) / 60);
    var seconds = Math.round(Math.abs(inSeconds) - (hours * 3600) - (minutes * 60));

    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    return (inSeconds < 0 ? '-' : (inSeconds > 0 ? '+' : '')) + hours + ":" + minutes + ":" + seconds;
}




//--------------WINDER Functions--------------
// functions that retrieve required info for winder


//sets winds from winder to route
//INPUT: wind values in array format: ["direction,velocity"]
// winds must be in order of displayed active routes (main,c1,2,3,4)
function setActiveWinds(windValues) {

}


//returns active routes values as an array of strings ["lat,lon,alt"]
function getActiveWptLocAlts() {
    var resultArray = [];
    //go through each active route
    for (var tableIndex = 0; tableIndex <= 4; tableIndex++) {
        //check that there is a route loaded in the slot
        if (activeRoutes[tableIndex].routeIndex >= 0) {
            var routeIndex = activeRoutes[tableIndex].routeIndex;
            var iStart = parseInt(getTakeoffWptIndex(tableIndex));
            var iEnd = parseInt(getTouchdownWptIndex(tableIndex));
            for (var i = iStart; i <= iEnd; i++) {
                resultArray.push(locAltToString(routeIndex, i));
            }
        }
    }

    return resultArray;
}



//returns a waypoint lat,lon,alt as a comma separated string
function locAltToString(routeIndex, wptIndex) {
    return locationToDecimal(msnPlan.routes[routeIndex].waypoints[wptIndex].lat) + ',' +
        locationToDecimal(msnPlan.routes[routeIndex].waypoints[wptIndex].lon) + ',' +
        msnPlan.routes[routeIndex].waypoints[wptIndex].altExp;
}

//converts lat or lon string values to a decimal degree format for winding purposes
//dependant on format using &deg; to draw degree symbol
//does not check for location being within bounds
function locationToDecimal(loc) {
    var signHolder = 1;
    var locArray;
    var degrees = 0;
    var minutes = 0;

    if (loc.charAt(0) == 'S' || loc.charAt(0) == 'W') { signHolder = -1; }
    locArray = loc.split("&deg;");
    degrees = parseInt(locArray[0].substring(1)) * signHolder;
    minutes = parseFloat(locArray[1]) / 60 * signHolder;

    return degrees + minutes;
}