# Mission-Plan-Binder-Web-Page
## Overview
This project was the developed to provide an interactive visualization of RPA flight plans that takes into account the contingency logic that is active along the route of flight.  
The page takes flight plan data in as a JSON formatted file.  This file is generated by a separate script that collects routing data from a standardized flight plan form generated when the plan is created.    
## Features
- Initial values based on vetted simulation results
- Ability to provide timing and fuel calculations by modifying preset values
    - Calculations are extended to contingency logic routes as well, providing immediate estimates for logic transitioins
- Wind calculations from manual input or from a weather service API (implemented in production)
- Loads misison plan files (in JSON format) from import or by searching SharePoint sites (implemented in production), allowing easy distribution
- Display current route and logic based on current waypoint
## Calculations
When a user makes an input into one of the editable fields in the table (or alters wind data by fetching it from the weather service), the calculations are forwarded to all affected fields.  The flow diagram below shows how a single input leads to several fields being recalculated.  
<pre>
[WIND INPUT] --> GS --> LEG TIME --> ETA --> Contingency ETA  
                                 --> TTG  
                                 --> LEG FUEL --> FUEL --> Contingency FUEL  

[TAS INPUT]  --> GS --> LEG TIME --> ETA --> Contingency ETA  
                                 --> TTG  
                                 --> LEG FUEL --> FUEL --> Contingency FUEL  

[ETA INPUT]  --> ETA --> Contingency ETA  

[PPH INPUT]  --> LEG FUEL --> FUEL --> Contingency FUEL  

[FUEL INPUT] --> FUEL --> Contingency FUEL 
</pre>