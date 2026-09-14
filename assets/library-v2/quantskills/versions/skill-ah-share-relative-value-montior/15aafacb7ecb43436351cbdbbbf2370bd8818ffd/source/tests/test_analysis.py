import csv, math, tempfile, unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from analyze_pair import analyze
from scan_snapshot import scan

class TestAHRelativeValue(unittest.TestCase):
    def test_identity_from_csv_metadata(self):
        src=ROOT/'examples/sample_pair_history.csv'
        with src.open(newline='',encoding='utf-8') as f:
            rows=list(csv.DictReader(f)); fields=['company','a_code','h_code']+list(rows[0].keys())
        for row in rows:
            row['company']='Synthetic Dual List Co'
            row['a_code']='DEMOA'
            row['h_code']='DEMOH'
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/'meta.csv'
            with out.open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
            r=analyze(out)
        self.assertEqual(r['identity']['company'],'Synthetic Dual List Co')
        self.assertEqual(r['identity']['a_code'],'DEMOA')
        self.assertEqual(r['identity']['h_code'],'DEMOH')

    def test_extreme_premium(self):
        r=analyze(ROOT/'examples/sample_pair_history.csv',company='Demo',a_code='DEMOA',h_code='DEMOH')
        self.assertEqual(r['relative_value_state'],'extreme-a-premium')
        self.assertGreater(r['dislocation_score'],70)
        self.assertGreater(r['windows']['250']['percentile'],0.95)

    def test_extreme_discount(self):
        import csv, tempfile
        src=ROOT/'examples/sample_pair_history.csv'
        with src.open(newline='',encoding='utf-8') as f:
            rows=list(csv.DictReader(f)); fields=list(rows[0].keys())
        for i in range(len(rows)-12,len(rows)):
            h=float(rows[i]['h_price_hkd']); fx=float(rows[i]['fx_hkd_cny']); premium=0.22-(i-(len(rows)-13))*0.008
            rows[i]['a_price_cny']=f'{h*fx*(1+premium):.4f}'
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/'discount.csv'
            with out.open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
            r=analyze(out)
        self.assertEqual(r['relative_value_state'],'extreme-a-discount')
        self.assertGreater(r['dislocation_score'],70)

    def test_snapshot_formula(self):
        r=scan(ROOT/'examples/sample_snapshot.csv',top=3)
        self.assertEqual(r['valid_pairs'],6)
        first=r['highest_premiums'][0]
        expected=(first['a_price_cny']/(first['h_price_hkd']*first['fx_hkd_cny'])-1)*100
        self.assertAlmostEqual(first['premium_pct'],expected,places=9)

if __name__=='__main__': unittest.main()
