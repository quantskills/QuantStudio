import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from fly.models import CATALOG, Instrument, Settings
from fly.history import session_key, timestamp, missing_minutes
from fly.store import Store
from fly.analytics import record_account_sample

class ProductTests(unittest.TestCase):
    def test_all_products_and_more_than_seven(self):
        items=[]
        for p in CATALOG:
            product=p['product']
            symbol=product[:-2]+'2610F' if product.endswith('_f') else product+('701' if p['exchange']=='CZC' else '2701')
            items.append(Instrument(product=product,symbol=symbol,exchange=p['exchange']))
        self.assertEqual(len(Settings(instruments=items).instruments),len(CATALOG))

    def test_custom_and_invalid_bindings(self):
        self.assertEqual(Instrument(product='XYZ',symbol='xyz2701',exchange='GFE').product,'xyz')
        for item in [dict(product='ma',symbol='MA701',exchange='SHF'),dict(product='l',symbol='l2610F',exchange='DCE')]:
            with self.assertRaises(ValueError):Instrument(**item)
        with self.assertRaises(ValueError):
            Settings(instruments=[dict(product=p,symbol='IF2612',exchange='CFE') for p in ('IF','if')])

    def test_extended_and_day_only_sessions(self):
        def key(t,p):return session_key(timestamp('2026-09-23T'+t+'+08:00'),p)
        self.assertIsNotNone(key('15:10:00','TL'))
        self.assertIsNone(key('15:10:00','IC'))
        self.assertIsNone(key('09:15:00','IH'))
        self.assertIsNotNone(key('00:30:00','cu'))
        self.assertIsNone(key('01:05:00','cu'))
        self.assertIsNotNone(key('22:30:00','l_f'))
        self.assertIsNone(key('21:30:00','lc'))
        self.assertIsNone(key('21:30:00','ec'))
        bars=[{'datetime':'2026-09-22T23:59:00+08:00'},{'datetime':'2026-09-23T00:01:00+08:00'}]
        self.assertEqual(missing_minutes(bars,'cu'),1)

    def test_statistics_preserve_multiplier_for_custom_product(self):
        with tempfile.TemporaryDirectory() as d:
            store=Store(Path(d))
            store.put('settings',{'instruments':[{'product':'xyz','symbol':'xyz2701','exchange':'GFE'}]})
            store.put('feed:xyz',{'symbol':'xyz2701','multiplier':20})
            record_account_sample(store,{},'test')
            self.assertEqual(store.get('analytics_contracts')['xyz2701']['allocation']['multiplier'],20)

if __name__=='__main__':unittest.main()
