### On vacation 19-23
API data fetch/display data
Figure out unscheduled rebalance points
Float mid for entry
Float mid for exit (w. timed market order override)
Ensemble of strategies in different subaccounts?
Smarter entries/sizing
    - Only trade with trend (Short-term moving average crossover-based?)
    - Set stops based on volatility, scale position size according to vol-based stop * max $ loss
    - Only trade when chances are good (high % moves, and with the trend)
    - More risk with better setups
Refactor
Improve frontend, different page/Vue component for each thing (need to get CLI Vue if doing this)
Python running on parallel server?
    - probably should set Docker up if going this route

### Unscheduled rebalances
Make this automatic, poll every 1m to refresh basket/NAV. 
Figure out rebalance price.
For tokens that are close to rebalance price, refetch every 1s while close. Buy when very close to rebalance price, with take profits and tight stop-loss.
Send SMS after.

