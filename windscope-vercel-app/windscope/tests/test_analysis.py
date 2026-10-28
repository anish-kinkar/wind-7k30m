from datetime import datetime,timezone
from api.index import select_forecasts,calculate,normalize

def test_vintage_no_lookahead():
    t='2026-01-16T00:00:00Z'
    rows=[{'startTime':t,'publishTime':'2026-01-15T10:00:00Z','generation':100},{'startTime':t,'publishTime':'2026-01-15T13:00:00Z','generation':200}]
    result=select_forecasts(rows,datetime(2026,1,15,12,tzinfo=timezone.utc),datetime(2026,1,16,tzinfo=timezone.utc),datetime(2026,1,17,tzinfo=timezone.utc))
    assert result[t]['generation']==100

def test_metrics():
    m=calculate([{'forecast':10,'actual':8},{'forecast':20,'actual':24}])
    assert m['mae']==3 and m['bias']==-1 and m['count']==2 and m['rmse']==3.2

def test_wind_filter():
    rows=[{'fuelType':'WIND','startTime':'2026-01-16T00:00:00Z','generation':5},{'fuelType':'GAS','startTime':'2026-01-16T00:00:00Z','generation':7}]
    assert len(normalize(rows,True))==1

def test_empty(): assert calculate([])['mae'] is None
