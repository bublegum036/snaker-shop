import os
from database import make_engine
from api import make_app

app = make_app(make_engine(), os.environ['JWT_SECRET'])
