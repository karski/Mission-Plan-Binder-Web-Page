// Runs the mission binder page
// Written by Peter Karski
//Assumes that routes.js is in local scope - required to handle route operations

//index enumeration for logic array
var logicCol = Object.freeze({
    "branch": 0,
    "cRouteIndex": 1,
    "cWptIndex": 2
});

//Global state variables
var courseMT = "T";
var autoProgressTimer;
var cLogic = []; //table to hold the current branches to prevent uneccesary recalcs and help with drawing links
//index = c1/2/3/4  empty branch = undefined
//[branchIndex, contingencyRouteIndex, contingencyWaypointIndex]


//set drawing canvas size to screen size
var canvas = document.getElementById("linkDrawSpace");
canvas.height = screen.height;
canvas.width = screen.width;
var linkLineWidth = 3;



//check URL for a route address that can be opened
checkInitialURLParams();



//assign listener to file input button (hidden behind formatted button)
document.getElementById('selectFile').addEventListener('change', openMsnPlanFile, false);
document.getElementById('btnOpenMsnPlan').addEventListener('click', function (evt) {
    evt.preventDefault;
    document.getElementById('selectFile').click();
});

//assign default destination to binder link - sharepoint mission planning page
document.getElementById("linkBinder").setAttribute("href", "");//TODO: place destination

//attempt to load entries into the msnplan options list
buildSelectOptions("selectDropdown");

//collects input file from user and saves to msnPlan variable
function openMsnPlanFile(evt) {
    var iFiles = evt.target.files;
    if (iFiles.length > 0) {
        var planFile = iFiles[0];
        var fReader = new FileReader();
        fReader.onload = function (evt) {
            try {
                if (loadMsnPlan(JSON.parse(evt.target.result)) == 1) {
                    displayNewPlan(0); //new plan - set route to primary
                } else {
                    //import failed
                    alert("Route file not recognized")
                }
            } catch (err) {
                console.log(err);
                if (err instanceof SyntaxError) {
                    //import failed - only catches syntax errors encountered in file processing
                    alert("Route file not recognized");
                }
            }
        }
        fReader.readAsText(planFile);
    }
}

//collects selections from the msnplan dropdown options
function selectMsnPlan(evt) {
    getMsnPlanFile(evt.value);
}

function checkInitialURLParams() {
    var planLoc = getParameterByName("planLoc");
    if (/^http*/.test(planLoc)) {
        //online location - attempt to retrieve (we can't use this to open files on hard drive or network storage)
        //OK to pass empty parameters since next function will fix broken values
        getMsnPlanFile(planLoc, getParameterByName("route"), getParameterByName("wpt"));
    }
}

//gets input file via html query to a server
//---expecting this to be the proper way to collect files from sharepoint
function getMsnPlanFile(urlPlan, initialRoute, initialWpt) {
    //ensure initial conditions are safe if parameters are missing
    if (initialRoute == undefined || initialRoute == null || initialRoute == '') {
        initialRoute = 0;
    }
    if (initialWpt == undefined || initialWpt == null || initialWpt == '') {
        initialWpt = 0;
    } 
    var xmlReq = new XMLHttpRequest();
    //xmlReq.overrideMimeType("application/text"); //not sure if this is necessary or if it will figure out the context on its own
    xmlReq.open('GET', urlPlan, true);
    //function to handle returned data
    xmlReq.onreadystatechange = function () {
        console.log(xmlReq);
        if (xmlReq.readyState == XMLHttpRequest.DONE && xmlReq.status == 200) {
            try {
                //just for testing, print the entire response object
                //console.log(xmlReq.responseText);
                //attempt to process http request response text
                if (loadMsnPlan(JSON.parse(xmlReq.responseText)) == 1) {
                    var filePath = urlPlan.substring(0, urlPlan.substr(0,urlPlan.indexOf('?')).lastIndexOf('/') + 1);//split to retain trailing /
                    //update URL parameter with successfully loaded plan location
                    addParamter("planLoc", urlPlan);//do this before display so that the links in the route list have the address info?
                    displayNewPlan(initialRoute, filePath, initialWpt); //new plan - set route to primary - add file path to directory for binder link
                } else {
                    //import failed
                    alert("Route file not recognized")
                }
            } catch (err) {
                console.log(err);
                if (err instanceof SyntaxError) {
                    //import failed - only catches syntax errors encountered in file processing
                    alert("Route file not recognized");
                }
            }
        } else if (xmlReq.readyState == XMLHttpRequest.DONE) {
            alert("Error loading route file");
        }
    };

    xmlReq.send();
}

//displays new plan on the page using routes.js interfaces 
//input: initial route index for loading (0 unless bookmarked to another)
function displayNewPlan(initialRoute, filePath, initialWpt) {
    //display header
    document.getElementById('pageMsnHeader').innerHTML = getMsnNumber();
    //fill in readable binder location info
    //assign destination to binder link - get from route
    var binderLoc = getBinderLoc();
    if (binderLoc != undefined) {
        document.getElementById("linkBinder").setAttribute("href", filePath + binderLoc);
    } else {   //take a guess
        document.getElementById("linkBinder").setAttribute("href", filePath + getMsnNumber() + " Binder.pdf");
    }

    //fill in route list
    for (i = 0; i <= 4; i++) {
        document.getElementById('c' + i + 'List').innerHTML = generateRouteList('C' + i);
    }

    //display route
    displayActiveRoute(initialRoute, initialWpt);
}

//displays a selected route in the main route table
//Input: route index number, (optional) table for initial values
//         input options: use intial time and initial fuel () OR transfer table values (move active table to main)
function displayActiveRoute(routeIndex, currentWptIndex, transferTableIndex) {
    //collect active mission plan name and type
    document.getElementById('mainHeader').innerHTML = getRouteName(routeIndex);
    document.getElementById('mainContainer').className = document.getElementById('mainContainer').className.replace(/c0|c1|c2|c3|c4/gi, getRouteType(routeIndex));

    //insert active mission plan table
    if (currentWptIndex == undefined) { currentWptIndex = 0; } //make sure we don't break things by accident
    document.getElementById('mainRouteTable').innerHTML = generateRouteTable(routeIndex, currentWptIndex, courseMT, 0, undefined, undefined, transferTableIndex);
    //if auto progression selected, use timing to determine active row
    if (document.getElementById("inputUpdateActive").checked) {
        var autoCurrentWptIndex = getCurrentTimeWptIndex();
        if (autoCurrentWptIndex >= 0 && autoCurrentWptIndex != currentWptIndex) {
            currentWptIndex = autoCurrentWptIndex;
            selectWpt(0, routeIndex, currentWptIndex);
        }
    }

    //scroll to current waypoint
    scrollTableRow('mainRouteTable', currentWptIndex);

    //display contingencies
    updateContingencies(currentWptIndex);

    //set the window title to inform the user which route is being displayed
    document.title = getRouteName(routeIndex) + "  -  " + getMsnNumber();

    //update URL params
    addParamter("route", routeIndex);
    addParamter("wpt", currentWptIndex);
}

//function for selecting the current waypoint as active
function selectWpt(tableIndex, routeIndex, wptIndex) {
    //should only be for the active route (tableIndex 0) - double check in case we want to change this later
    if (tableIndex == 0) {
        //update the display of the current waypoint
        clearCurrentWpt(tableIndex, wptIndex);

        //display contingencies
        updateContingencies(wptIndex);

        //update url parameters
        addParamter("route", routeIndex);
        addParamter("wpt", wptIndex);
    }
}

//updates all contingency tables with current waypoint info
//INPUT: wptIndex of current waypoint in active route (main table)
function updateContingencies(wptIndex) {
    //update contingency tables
    var newLogic = getContingencyLogic(wptIndex);
    //display contingencies
    for (i = 1; i <= 4; i++) {
        //display route info - if not valid, make route container inactive
        if (newLogic[i] == undefined) {
            //contingency mode is invalid - hide the table
            document.getElementById('c' + i + 'Container').className = document.getElementById('c' + i + 'Container').className.replace(/collapsed|normal|expanded/gi, 'inactive');
            document.getElementById('c' + i + 'Header').innerHTML = '';
        } else if (cLogic[i] == undefined || cLogic[i][logicCol.cRouteIndex] != newLogic[i][logicCol.cRouteIndex]) {
            //the contingency route has changed, generate and display new table
            document.getElementById('c' + i + 'Container').className = document.getElementById('c' + i + 'Container').className.replace('inactive', 'normal');
            document.getElementById('c' + i + 'Header').innerHTML = getRouteName(newLogic[i][logicCol.cRouteIndex]);
            document.getElementById('c' + i + 'RouteTable').innerHTML = generateRouteTable(newLogic[i][logicCol.cRouteIndex], newLogic[i][logicCol.cWptIndex], courseMT, i, getWptETA(0, newLogic[i][logicCol.branch]), getWptFuel(0, newLogic[i][logicCol.branch]));
        } else {
            //table is valid and contingency route didn't change, so make sure timing and formatting are correct
            setContingencyTableCalcs(i, newLogic[i][logicCol.branch], newLogic[i][logicCol.cWptIndex]);
        }
        //if the table exists, scroll the current linked row into view
        if (newLogic[i] != undefined) {
            scrollTableRow('c' + i + 'RouteTable', newLogic[i][logicCol.cWptIndex]);
        }
    }

    //update current logic table
    cLogic = newLogic;

    //draw logic link lines
    drawContingencyLinks();
}

//Collects input from user selecting a route from the route list
function routeSelect(routeIndex) {
    event.stopPropagation();
    event.preventDefault();
    displayActiveRoute(routeIndex);
}

//collects user click on "move to active" button
//transfers all user edits as well
function moveMain(tableIndex) {
    var routeIndex = getTableRouteIndex(tableIndex);
    var currentWpt = cLogic[tableIndex][logicCol.cWptIndex];
    if (routeIndex >= 0 && currentWpt >= 0) {
        displayActiveRoute(routeIndex, currentWpt, tableIndex);
    }
}

//collects input from "Course" header - toggles course display between mag and True
function toggleCourse() {
    courseMT = (courseMT == "T" ? "M" : "T");
    var courseArray = getActiveCourses(courseMT);
    for (var i = 0; i <= 4; i++) {
        if (courseArray[i] != undefined && courseArray[i].length > 0) {
            //there are course values
            changeTableValues(getTableID(i), ["courseDisp"], courseArray[i], 0, false);
        }
    }
}

//handles selection of auto waypoint progression
//enables automatic progression of the main route current waypoinit
function autoUpdateWaypointClick() {
    console.log("auto update status: " + event.target.checked);
    if (event.target.checked) {
        //update the timing now
        autoUpdateWaypoint(true);
        //set up timer interval - 2 seconds
        autoProgressTimer = setInterval(autoUpdateWaypoint, 2000);
    } else {
        //clear out any existing timers
        clearInterval(autoProgressTimer);
    }
}

//updates current waypoint with current time
//optional - scroll to selected waypoint
function autoUpdateWaypoint(doScroll) {
    console.log("Timer! Ding!");
    var autoWpt = getCurrentTimeWptIndex();
    var currentRowElements = document.getElementById(getTableID(0)).getElementsByClassName("currentWpt");
    if (currentRowElements != undefined && currentRowElements[0] != undefined) {
        if (currentRowElements[0].rowIndex != autoWpt) {
            selectWpt(0, 0, autoWpt);
            if (doScroll) {
                scrollTableRow(getTableID(0), autoWpt);
            }
        }
    }
}

//draws lines from contingency branch to the row for the contingency waypoint
//requires cLogic array to be populated first
function drawContingencyLinks() {
    if (cLogic != undefined) {
        //set up linkDrawSpace Canvas to draw
        var draw = canvas.getContext("2d");
        var canvasRect = canvas.getBoundingClientRect();
        var mainRouteRect = document.getElementById("mainRouteTable").getBoundingClientRect();
        //clear out canvas drawings
        draw.clearRect(0, 0, canvas.width, canvas.height);
        draw.lineWidth = linkLineWidth;
        //iterate through each contingency
        for (var i = 1; i <= 4; i++) {
            if (cLogic[i] != undefined) {
                draw.beginPath();
                //set color based on contingency
                switch (i) {
                    case 1: draw.strokeStyle = "gold"; break;
                    case 2: draw.strokeStyle = "darkorange"; break;
                    case 3: draw.strokeStyle = "red"; break;
                    case 4: draw.strokeStyle = "rebeccapurple"; break;
                    default: draw.strokeStyle = "black";
                }
                var branchRowRect = document.getElementById("mainRouteTable").getElementsByTagName("tr")[cLogic[i][logicCol.branch]].getBoundingClientRect();
                var cRowRect = document.getElementById(getTableID(i)).getElementsByTagName("tr")[cLogic[i][logicCol.cWptIndex]].getBoundingClientRect();
                var cRouteRect = document.getElementById("c" + i + "RouteTable").getBoundingClientRect();

                //use these variables to determine vertical drawing location
                var branchY = branchRowRect.top + (branchRowRect.height / 5 * i);
                if (mainRouteRect.height < 10) {
                    branchY = mainRouteRect.top - 80 + (linkLineWidth * i);
                } else if (branchY < mainRouteRect.top) {
                    branchY = mainRouteRect.top - 15 + (linkLineWidth * i);
                } else if (branchY > mainRouteRect.bottom) {
                    branchY = mainRouteRect.bottom + (linkLineWidth * (i - 1));
                }
                var contingencyY = cRowRect.top + (cRowRect.height / 2);
                if (cRouteRect.height < 10) {
                    contingencyY = cRouteRect.top - 75;
                } else if (contingencyY < cRouteRect.top) {
                    contingencyY = cRouteRect.top - 10;
                } else if (contingencyY > cRouteRect.bottom) {
                    contingencyY = cRouteRect.bottom + 5;
                }
                //do the drawing!
                draw.moveTo(branchRowRect.right - canvasRect.left, branchY - canvasRect.top);
                draw.lineTo((branchRowRect.right - canvasRect.left) + 30 + (5 * i), branchY - canvasRect.top);
                draw.lineTo((branchRowRect.right - canvasRect.left) + 30 + (5 * i), contingencyY - canvasRect.top);
                draw.lineTo(cRowRect.left - canvasRect.left, contingencyY - canvasRect.top);
                draw.stroke();
            }
        }
    }
}

//****INPUT Selections*******************************
//***TODO These could be consolidated into a single function with a conditional to determine callback keydown function
//Triggered by user clicking a field that can accept input
//Transforms the field into a user-editable text box and stores the original value for comparison
function inputSelect(tableIndex, wptIndex) {
    event.stopPropagation(); //prevent waypoint from capturing input--all inputs except ETA should do this
    var tbox = document.createElement("input");
    tbox.setAttribute("type", "text");
    tbox.setAttribute("value", event.target.innerHTML);
    tbox.setAttribute("data-oldVal", event.target.innerHTML);
    tbox.setAttribute("style", "width:100%; text-align:center");
    tbox.setAttribute("ID", event.target.className.split(" ")[0] + "Input");
    event.target.innerHTML = ""; //clears current field
    event.target.appendChild(tbox); //replace with input box

    //add parameters to the event target so they get passed
    tbox.tableIndex = tableIndex;
    tbox.wptIndex = wptIndex;

    //add event listeners
    tbox.addEventListener("keydown", inputKeyCatcher);
    tbox.addEventListener("focusout", inputCancel);
    //select text for user
    tbox.select();
}

//the cancellation of any input should be the same action - replace the textbox with the old content
function inputCancel() {
    event.stopPropagation();
    //remove event listeners
    event.target.removeEventListener("keydown", inputKeyCatcher);
    event.target.removeEventListener("focusout", inputCancel);
    console.log("input cancelled");
    event.target.parentNode.innerHTML = event.target.getAttribute("data-oldVal");
}

//old params - now passed inside the event tableIndex, wptIndex
function inputKeyCatcher() {
    event.stopPropagation();
    //determine what key was pressed
    if (event.key == "Enter") {
        console.log("Enter key pressed");
        //remove input listeners
        event.target.removeEventListener("keydown", inputKeyCatcher);
        event.target.removeEventListener("focusout", inputCancel);
        //send the input to the correct receiver
        try {
            switch (event.target.id) {
                case "changeWindInput": inputEnteredWind(event.target.tableIndex, event.target.wptIndex); break;
                case "changeTASInput": inputEnteredTAS(event.target.tableIndex, event.target.wptIndex); break;
                case "changeTimeInput": inputEnteredETA(event.target.tableIndex, event.target.wptIndex); break;
                case "changePPHInput": inputEnteredPPH(event.target.tableIndex, event.target.wptIndex); break;
                case "changeFuelInput": inputEnteredFuel(event.target.tableIndex, event.target.wptIndex); break;
                default: console.log("input source not recognized: " + event.target.id); inputCancel();
            }
        } catch (err) { //inputs have potential for a lot of unexpected errors, catch them all and cancel to clean up
            console.log("Error processing input:");
            console.log(err);
            inputCancel();
        }
    } else if (event.key == "Escape" || event.key == "Esc") {
        console.log("Escape key pressed");
        inputCancel();
    }
}

//**INPUT COLLECTIONS********************************
//**TODO: the keydown collection could be consolidated into a single function with processing called based on parent Class
//Collect keypresses looking for Enter or Escape key
//take action based on keypress and redraw recalculated data in tables if accepted

function inputEnteredWind(tableIndex, wptIndex) {
    //pass the input value to the route
    var windArray = setUserWind(tableIndex, event.target.value, wptIndex);
    //check if the input was accepted
    if (windArray == null) {
        inputCancel();
    } else {
        //redraw winds/GS/legTimes/legFuels for changed segment
        if (event.target.value == "") {//resetting to default - clear out user input tag
            changeTableValues(getTableID(tableIndex), ["changeWind", "gsDisp", "legTimeDisp", "legFuelDisp"], windArray, wptIndex, -1);
        } else { //mark as user changed
            changeTableValues(getTableID(tableIndex), ["changeWind", "gsDisp", "legTimeDisp", "legFuelDisp"], windArray, wptIndex, 1);
        }
        //redraw ETA + TTG
        changeTableValues(getTableID(tableIndex), ["changeTime", "ttgDisp"], getTableETATTGs(tableIndex), 0, 0);
        //redraw fuels
        changeTableValues(getTableID(tableIndex), ["changeFuel"], getTableFuels(tableIndex), 0, 0);

        //use cLogic to propogate timing and fuel value if active table (0)
        if (tableIndex == 0 && cLogic != undefined) {
            setContingencyLinkedCalcs();

        }
    }
}

function inputEnteredTAS(tableIndex, wptIndex) {
    //pass the input value to the route
    var tasArray = setUserTAS(tableIndex, event.target.value, wptIndex);
    //check if input was accepted
    if (tasArray == null) {
        inputCancel();
    } else {
        //redraw the TAS/GS/legTimes/legFuels for changed segment
        if (event.target.value == "" || event.target.value == 0) {//resetting to default - clear out user input tag
            changeTableValues(getTableID(tableIndex), ["changeTAS", "gsDisp", "legTimeDisp", "legFuelDisp"], tasArray, wptIndex, -1);
        } else { //mark as user changed
            changeTableValues(getTableID(tableIndex), ["changeTAS", "gsDisp", "legTimeDisp", "legFuelDisp"], tasArray, wptIndex, 1);
        }
        //redraw ETA + TTG
        changeTableValues(getTableID(tableIndex), ["changeTime", "ttgDisp"], getTableETATTGs(tableIndex), 0, 0);
        //redraw fuels
        changeTableValues(getTableID(tableIndex), ["changeFuel"], getTableFuels(tableIndex), 0, 0);

        //use cLogic to propogate timing and fuel value if active table (0)
        if (tableIndex == 0 && cLogic != undefined) {
            setContingencyLinkedCalcs();
        }
    }
}

function inputEnteredETA(tableIndex, wptIndex) {
    //pass the input value to the route
    var timeArray = setTgtTime(tableIndex, event.target.value, wptIndex);
    //check if the input was accepted
    if (timeArray == null) {
        inputCancel();
    } else {
        //clear out all previous ETA userinput tags - mark current row as changed if not clearing out times altogether
        if (event.target.value == "") { //don't mark any user input
            clearUserChanged(tableIndex, "changeTime");
        } else {//mark current input
            clearUserChanged(tableIndex, "changeTime", wptIndex);
        }

        //redraw the ETAs
        changeTableValues(getTableID(tableIndex), ["changeTime"], timeArray, 0, 0);

        //update current waypoint with time if autoProgress selected
        if (document.getElementById("inputUpdateActive").checked) {
            autoUpdateWaypoint();
        }

        //propogate timing value if active table (0)
        if (tableIndex == 0 && cLogic != undefined) {
            setContingencyLinkedCalcs();
        } else if (tableIndex != 0) {
            //if not active table, clear out current waypoint indication, since timing is decoupled
            clearCurrentWpt(tableIndex);
        }
    }
}

function inputEnteredPPH(tableIndex, wptIndex) {
    //pass the input value to the route
    var pphArray = setUserPPH(tableIndex, event.target.value, wptIndex);
    //check if input was accepted
    if (pphArray == null) {
        inputCancel();
    } else {
        //redraw PPH and leg fuels - mark as changed if not reset
        if (event.target.value == "") {
            changeTableValues(getTableID(tableIndex), ["changePPH", "legFuelDisp"], pphArray, wptIndex, -1);
        } else {
            changeTableValues(getTableID(tableIndex), ["changePPH", "legFuelDisp"], pphArray, wptIndex, 1);
        }
    }
    //redraw fuels
    changeTableValues(getTableID(tableIndex), ["changeFuel"], getTableFuels(tableIndex), 0, 0);

    //propogate fuel value if active table (0)
    if (tableIndex == 0 && cLogic != undefined) {
        setContingencyLinkedCalcs();
    }
}

function inputEnteredFuel(tableIndex, wptIndex) {
    //pass the input value to the route
    var fuelArray = setTgtFuel(tableIndex, event.target.value, wptIndex);
    //check if input was accepted
    if (fuelArray == null) {
        inputCancel();
    } else {
        //clear out user changed mark - mark current as changed unless resetting to default
        if (event.target.value == "") {//don't mark user input
            clearUserChanged(tableIndex, "changeFuel");
        } else {//mark current input value as userchanged
            clearUserChanged(tableIndex, "changeFuel", wptIndex);
        }
        //redraw fuels
        changeTableValues(getTableID(tableIndex), ["changeFuel"], getTableFuels(tableIndex), 0, 0);
        //propogate fuels if active table (0)
        if (tableIndex == 0 && cLogic != undefined) {
            setContingencyLinkedCalcs();
        } else if (tableIndex != 0) {
            //if not active table, clear out current waypoint indication, since fuels are decoupled
            clearCurrentWpt(tableIndex);
        }
    }

}

//***UTILS***********************
//utility functions for manipulating table display

//gets the string table id for a given table index
function getTableID(tableIndex) {
    return (tableIndex == 0 ? 'main' : 'c' + tableIndex) + 'RouteTable';
}

//scrolls a row into view
//INPUT: tableID - id tag of table to search
//       rowIndex - wpt index of the desired row
function scrollTableRow(tableID, rowIndex) {
    var rowTop = document.getElementById(tableID).getElementsByTagName("tr")[rowIndex].offsetTop;
    document.getElementById(tableID).scrollTop = rowTop;
}

//clears out any current waypoints in table
//INPUT: table index to clear out current waypoint formatting
//          optional - new current waypoint index
function clearCurrentWpt(tableIndex, newCurrentWpt) {
    //clear out currentWpt formatting
    var tableRows = document.getElementById(getTableID(tableIndex)).getElementsByTagName("TR");
    if (tableRows != undefined) {
        for (var i = 0; i < tableRows.length; i++) {
            tableRows[i].className = tableRows[i].className.replace(/currentWpt/g, "");
        }
        //mark new current waypoint if passed
        console.log("marking new current wpt: " + newCurrentWpt + " table " + tableIndex);
        if (newCurrentWpt != undefined && newCurrentWpt >= 0) {
            tableRows[newCurrentWpt].className += " currentWpt";
        }
    }
}

//clears out user changed formatting in column of specific table
//most useful for ETA and fuels, where only one value can be user changed and others must be cleared before proceeding
//INPUT: table index to clear out
//         element class to search through and clear
//         optional - index of the new element to mark as user changed
function clearUserChanged(tableIndex, elementClass, newChangedIndex) {
    var elementArray = document.getElementById(getTableID(tableIndex)).getElementsByClassName(elementClass);
    if (elementArray != undefined) {
        //clear out current changes to column entries
        for (var i = 0; i < elementArray.length; i++) {
            elementArray[i].className = elementArray[i].className.replace(/userChanged/g, "");
        }
        //mark single entry as changed if included
        if (newChangedIndex != undefined && newChangedIndex >= 0) {
            elementArray[newChangedIndex].className += " userChanged";
        }
    }
}

//sets Time and Fuel from branch waypoint to contingency targets and formats appropriately
//optional - specify one table to update instead of updating all at once - needs branch and target indexes - TODO -  this should be broken out - it doesn't actually share any code and it causes me confusion :(
function setContingencyLinkedCalcs(tableIndex, branchIndex, cWptIndex) {
    for (var i = 0; i <= 4; i++) {
        if (cLogic != undefined && cLogic[i] != undefined) { //TODO - can't assume clogic is available or valid when coming from certain sources
            //clear out previous current waypoints and set new current wpt
            clearCurrentWpt(i, cLogic[i][logicCol.cWptIndex]);
            //recalc and display contingency timing and fuel - format to show controlling value as userChanged
            changeTableValues(getTableID(i), ["changeTime"], setTgtTimeSeconds(i, getWptETA(0, cLogic[i][logicCol.branch]), cLogic[i][logicCol.cWptIndex]), 0, 0);
            clearUserChanged(i, "changeTime", cLogic[i][logicCol.cWptIndex]); //mark as controlling time
            changeTableValues(getTableID(i), ["changeFuel"], setTgtFuel(i, getWptFuel(0, cLogic[i][logicCol.branch]), cLogic[i][logicCol.cWptIndex]), 0, 0);
            clearUserChanged(i, "changeFuel", cLogic[i][logicCol.cWptIndex]); //mark as controlling fuel
        }
    }
}

//sets Time and Fuel in a single contingency table from branch waypoint to contingency target
function setContingencyTableCalcs(tableIndex, branchIndex, cWptIndex) {
    if (tableIndex > 0) {//contingency selected - update it's values from the main route
        //clear out previous current waypoints and set new current wpt
        clearCurrentWpt(tableIndex, cWptIndex);
        //recalc and display contingency timing and fuel - format to show controlling value as userChanged
        changeTableValues(getTableID(tableIndex), ["changeTime"], setTgtTimeSeconds(tableIndex, getWptETA(0, branchIndex), cWptIndex), 0, 0);
        clearUserChanged(tableIndex, "changeTime", cWptIndex); //mark as controlling time
        changeTableValues(getTableID(tableIndex), ["changeFuel"], setTgtFuel(tableIndex, getWptFuel(0, branchIndex), cWptIndex), 0, 0);
        clearUserChanged(tableIndex, "changeFuel", cWptIndex); //mark as controlling fuel
    }
}


//changes existing entries in a table
//iterates through the first occurence of any entryID in each row from startRow until the number of values in the valueArray
//input: tableID - requires the HTML table ID to search the document for
//          itemClassArray - takes item to change (entry Class - first instance will be selected) as an array of strings
//          valueArray - takes values as an array (an array of arrays if more than one item ID is listed)
//                          undefined entries will be ignored
//          startRow - start of entries so that only a subset of the rows needs to be updated - defaults to 0
//          userChanged: 1 = mark first instance as user changed value (bold)
//                      : 0 = leave unchanged
//                      : -1 = remove user changed tags (resetting to default)
function changeTableValues(tableID, itemClassArray, valueArray, startRow, userChanged) {
    if (startRow == undefined) { startRow = 0; } //default to beginning of table
    if (userChanged == undefined) { userChanged = 0; }//default to leaving tags unchanged
    //check if table is actually in the display and value array has values
    if (document.getElementById(tableID) != null && valueArray != undefined) {
        //create an array of the rows in the table
        var tableRows = document.getElementById(tableID).getElementsByTagName("tr");

        //mark user changed/remove tag if needed
        if (userChanged == 1) {
            tableRows[startRow].getElementsByClassName(itemClassArray[0])[0].className += ' userChanged';
        } else if (userChanged == -1) {
            tableRows[startRow].getElementsByClassName(itemClassArray[0])[0].className = tableRows[startRow].getElementsByClassName(itemClassArray[0])[0].className.replace(/ userChanged/g, '');
        }

        //iterate through all the changed rows
        for (var i = 0; i < valueArray.length; i++) {
            if (itemClassArray.length == 1) {
                //single id to change - no looping within the row
                tableRows[i + startRow].getElementsByClassName(itemClassArray[0])[0].innerHTML = valueArray[i];
            } else {
                //iterate through each changed value in the row
                for (var item = 0; item < itemClassArray.length; item++) {
                    tableRows[i + startRow].getElementsByClassName(itemClassArray[item])[0].innerHTML = valueArray[i][item];
                }
            }
        }
    }

}

//uses regular expression to get parameter from URL
//if parameter is not found, returns NULL
//Source: Jolly.exe's answer on https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/21152762#21152762
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

//adds parameter to location or updates the existing value
//modified regexp from Jolly.exe's answer on https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/21152762#21152762
function addParamter(name, value) {
    //just get the terminal part of the url so that it matches the history value
    //need to get the last '/' before the '?' if it exists, becasue the parameters have a lot of '/' in them
    var url = window.location.href.substr(window.location.href.subtr(0, window.location.href.indexOf('?')).lastIndexOf("/") + 1); //window.location.href;

    //if this is the first parameter, add #param modifier so that the page doesn't reload (if option selected)
    //this is only necessary if history replacement isn't being used
    //if (addParamHeader) {
    //    if (!(/#/.test(url))) {
    //        //internal link not set, put a dummy placemark in the url to prevent reloads when modifying parameters
    //        if (/\?/.test(url)) {
    //            //already has some params, add the param header in front of them
    //            url.substr(0, url.indexOf("?")) + "#param" + url.substr(a.indexOf("?"))
    //        } else {
    //            //simply place at end
    //            url = url + "#param";
    //        }

    //    }
    //}

    //check if already in location
    var regex = new RegExp("([?&]" + name + "=)(([^&#]*)|&|#|$)");
    if (regex.test(url)) {
        //replace the existing value
        //window.location.href = url.replace(regex, '$1' + value);
        history.replaceState(null, "", url.replace(regex, '$1' + value));
    } else {
        //append to the end of the url
        //window.location.href = url + (/\?/.test(url) ? "&" : "?") + name + "=" + value;
        history.replaceState(null, "", url + (/\?/.test(url) ? "&" : "?") + name + "=" + value);
    }
}