Trader.ts is used for running the maker bot and is the meat of the bot.
Watcher.ts is used to Watch your account for trades and let you know when trades happen.
Listen.py is used for dumping all the stream into a mongodb. this is useful if you would like to use market data to set your buy down and profit intervels



to run you need to set env vars like so

#Gdax settings
export GDAX_KEY="";
export GDAX_SECRET="";
export GDAX_PASSPHRASE="";

#noice email settings
export Email_User="";
export Email_Password="";
export Email_From="";
export Email_To="";

#profit email settings
export Email_Profit_User="";
export Email_Profit_Password="";
export Email_Profit_From="";
export Email_Profit_To="";

#the max sell orders that it can have open
export MAX_SELL_ORDERS=3;
#this was for an experiment where the more open sells it had the bigger the buy down would get
export EXP_BUYDOWN_SLOWDOWN=1;