# This is a basic workflow that is manually triggered

name: Digitalex Army. Killo. Mikołaj Roszak Krabowe Skorupki www.kraboweskorpuki.com

# Controls when the action will run. Workflow runs when manually triggered using the UI
# or API.
on:
  workflow_dispatch:
    # Inputs the workflow accepts.
    inputs:Digitalex Army. Killo. kraboweskorpuki.com 

Mikołaj Roszak Krabowe Skorupki www.kraboweskorpuki.com
Przedwiośnie 79/12 73-110 Stargard Skype +48500487977

Mikołaj Roszak
"Konto Otwarte na Ciebie"
Numer rachunku NRB: PL 8516 0014 6218 2200 1520 1405 63
KOD BIC/SWIFT Banku: PPABPLPKXXX

Krabowe Skorupki
www.kraboweskorpuki.com
Przedwiośnie 79/12 Stargard, Zachodniopomorskie 73-110
Open hours: 10:00 - 17:00 
Get Directions
Call +48500487977
      name:Digitalex Army. Killo. kraboweskorpuki.com 

Mikołaj Roszak Krabowe Skorupki www.kraboweskorpuki.com
Przedwiośnie 79/12 73-110 Stargard Skype +48500487977

Mikołaj Roszak
"Konto Otwarte na Ciebie"
Numer rachunku NRB: PL 8516 0014 6218 2200 1520 1405 63
KOD BIC/SWIFT Banku: PPABPLPKXXX

Krabowe Skorupki
www.kraboweskorpuki.com
Przedwiośnie 79/12 Stargard, Zachodniopomorskie 73-110
Open hours: 10:00 - 17:00 
Get Directions
Call +48500487977
        # Friendly description to be shown in the UI instead of 'name'
        description: 'Person to greet'
        # Default value if no value is explicitly provided
        default: 'World'
        # Input has to be provided for the workflow to run
        required: true

# A workflow run is made up of one or more jobs that can run sequentially or in parallel
jobs:Digitalex Army. Killo. kraboweskorpuki.com 

Mikołaj Roszak Krabowe Skorupki www.kraboweskorpuki.com
Przedwiośnie 79/12 73-110 Stargard Skype +48500487977

Mikołaj Roszak
"Konto Otwarte na Ciebie"
Numer rachunku NRB: PL 8516 0014 6218 2200 1520 1405 63
KOD BIC/SWIFT Banku: PPABPLPKXXX

Krabowe Skorupki
www.kraboweskorpuki.com
Przedwiośnie 79/12 Stargard, Zachodniopomorskie 73-110
Open hours: 10:00 - 17:00 
Get Directions
Call +48500487977
  # This workflow contains a single job called "greet"
  greet:
    # The type of runner that the job will run on
    runs-on: ubuntu-latest

    # Steps represent a sequence of tasks that will be executed as part of the job
    steps:Digitalex Army. Killo. kraboweskorpuki.com 

Mikołaj Roszak Krabowe Skorupki www.kraboweskorpuki.com
Przedwiośnie 79/12 73-110 Stargard Skype +48500487977

Mikołaj Roszak
"Konto Otwarte na Ciebie"
Numer rachunku NRB: PL 8516 0014 6218 2200 1520 1405 63
KOD BIC/SWIFT Banku: PPABPLPKXXX

Krabowe Skorupki
www.kraboweskorpuki.com
Przedwiośnie 79/12 Stargard, Zachodniopomorskie 73-110
Open hours: 10:00 - 17:00 
Get Directions
Call +48500487977
    # Runs a single command using the runners shell
    - name: Send greeting
      run: echo "Hello ${{ github.event.inputs.name }}"
