//functions to query sharepoint for msnPlan files
var rootDomain //website URL to append relative file location to (should not end in '/')
var selectedPath //directory in which the selected file was located - this will be used for retrieving the binder document in the same location

//queries the given SharePoint Site address (ending in '/') for the List named listName for the filetype given (expecting .msnPlan)
//RETURN: array of [filename,address] pairs
//        to retrieve values, use result[0][1] to get the address of the first entry  
function retrieveAllFilesOfType(siteAddress, listName, fileType) { //= "msnPlan"
    var xhttp = new XMLHttpRequest();
    //generate strings for the request type we want to make (the envelope is fixed, but needs to be wrapped around the dynamic input)
    var payloadQuery = '<GetListItems xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
        '<listName>' + listName + '</listName>' +
        '<query><Query xmlns=""><Where><Includes><FieldRef Name="File_x0020_Type" /><Value Type="Text">' + fileType + '</Value></Includes></Where></Query></query>' +
        '<queryOptions><QueryOptions xmlns=""><IncludeMandatoryColumns>False</IncludeMandatoryColumns><ViewAttributes Scope="RecursiveAll" /></QueryOptions></queryOptions>' +
        '<viewFields><ViewFields xmlns=""><FieldRef Name="Title" /><FieldRef Name="URL" /></ViewFields></viewFields>' +
        '<rowLimit>500</rowLimit>' +
        '<viewName></viewName>' +
        '<webID></webID>' +
        '</GetListItems>';
    var xmlEnvelope = '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
        '<soap:Body>' + payloadQuery + '</soap:Body></soap:Envelope>';

    var targetAddress = siteAddress + (siteAddress.slice(-1) == '/' ? '' : '/') + '_vti_bin/Lists.asmx';

    xhttp.onreadystatechange = function () {
        if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
            console.log(this.responseText);
            //on a good return, process the text
            var resultArray = new Array();

            //build an xml parser to handle the returned data DOM
            var xmlParse = new DOMParser();
            var xmlData = xmlParse.parseFromString(this.responseText, "text/xml");

            //TODO: when you have results to work with
            //pop good results (that are not archived) onto the array

            //loop through xmlData by the row tag (maybe z?)

            return resultArray;
        } else if (this.readyState == 4) {
            //some sort of error, return null so that caller can move onto the next input 
            //(hopefully I can figure out how to do this asyncronously so that I don't get stuck on bad queries or slow results)
            //(or if the responses are quick enough this extra work won't be necesary)
            return null;
        }
    };

    xhttp.open("POST", targetAddress, true);
    //xhttp.setRequestHeader("Host", "mysites.eim.acc.hedc.af.mil");//change for different networks(SIPR/NIPR) - doesnt appear to be necessary
    xhttp.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
    //xhttp.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/sharepoint/soap/GetListItems");//doesnt seem to be needed

    xhttp.send(xmlEnvelope);
}


//generates list for a dropdown and adds it as data becomes available from server
//uses addresses and list names from queryAddresses.js, which is assumed to be available
function buildSelectOptions(selectID) {
    //get the option list for modification
    var elementSelect = document.getElementById(selectID);

    for (var i = 0; i < queryAddresses.length; i++) {
        var listResult = retrieveAllFilesOfType(queryAddresses[i].siteAddress, queryAddresses[i].listName, "msnPlan")
        if (listResult != null) { //something was actually found
            for (var iOption = 0; iOption < listResult.length; iOption++){
                var option = document.createElement("option");
                option.text = listResult[iOption][0];
                option.value = listResult[iOption][1];
                elementSelect.add(option);
            }
        }
    }
}