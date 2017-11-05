# import PyMongo and connect to a local, running Mongo instance
from pymongo import MongoClient
import gdax
mongo_client = MongoClient('mongodb://localhost:27017/')

# specify the database and collection
db = mongo_client.cryptocurrency_database
BTC_collection = db.BTC_collection

# instantiate a WebsocketClient instance, with a Mongo collection as a parameter
wsClient = gdax.WebsocketClient(url="wss://ws-feed.gdax.com", products="LTC-USD", mongo_collection=BTC_collection, should_print=False)
wsClient.start()