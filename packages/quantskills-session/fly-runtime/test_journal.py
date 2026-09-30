import tempfile
import unittest
from types import SimpleNamespace

from fly.store import Store
from server import dispatch


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.manager = SimpleNamespace(get=lambda owner: SimpleNamespace(store=self.store))

    def seed(self, count=45):
        return [self.store.event('decision', {'n': n}, actor='fly' if n % 2 else 'system',
                                 decision_id=f'd{n}', dedupe=f'event{n}') for n in range(count)]

    def test_twenty_rows_all_history_and_stable_snapshot(self):
        seqs = self.seed()
        first = dispatch(self.manager, 'journal?page=1')
        self.assertEqual((first['total'], first['pages'], len(first['events'])), (45, 3, 20))
        self.assertEqual([e['seq'] for e in first['events']], seqs[-20:][::-1])
        new = self.store.event('decision', {}, actor='fly')
        second = dispatch(self.manager, f"journal?page=2&snapshot={first['snapshot']}")
        self.assertEqual([e['seq'] for e in second['events']], seqs[5:25][::-1])
        self.assertTrue(second['has_new'])
        last = self.store.journal_page(page=999, snapshot=first['snapshot'])
        self.assertEqual((last['page'], len(last['events'])), (3, 5))
        self.assertEqual(self.store.journal_page()['events'][0]['seq'], new)

    def test_delete_persists_and_does_not_change_execution_evidence(self):
        seqs = self.seed(2)
        fill = self.store.event('trade', {'volume': 2, 'price': 123, 'commission': 4},
                                actor='counter', decision_id='d1', dedupe='fill')
        self.store.put('control', {'trading': True})
        fills = self.store.fills_since(0)
        decision = self.store.decision('d1')
        result = dispatch(self.manager, 'journal/delete', {'confirm': True, 'actor': 'all',
                          'snapshot': fill, 'seqs': [fill, seqs[1]]})
        self.assertEqual(result, {'deleted': 2})
        store = Store(self.tmp.name)
        self.assertEqual([e['seq'] for e in store.journal_page()['events']], [seqs[0]])
        self.assertEqual(store.fills_since(0), fills)
        self.assertEqual(store.filled_volume('d1'), 2)
        self.assertEqual(store.decision('d1'), decision)
        self.assertEqual(store.get('control'), {'trading': True})
        self.assertIsNone(store.event('trade', {'volume': 2}, dedupe='fill'))
        self.assertEqual(store.journal_page()['total'], 1)

    def test_filtered_clear_preserves_other_sources_and_new_events(self):
        self.seed()
        page = self.store.journal_page('fly')
        self.assertEqual(page['total'], 22)
        new = self.store.event('decision', {}, actor='fly')
        result = self.store.delete_journal({'confirm': True, 'actor': 'fly',
                   'snapshot': page['snapshot'], 'all_matching': True})
        self.assertEqual(result['deleted'], 22)
        self.assertEqual(self.store.journal_page('system')['total'], 23)
        self.assertEqual([e['seq'] for e in self.store.journal_page('fly')['events']], [new])
        self.assertEqual(self.store.journal_page('fly', snapshot=page['snapshot'])['total'], 0)

    def test_delete_last_page_clamps_page_and_all_clear_is_empty(self):
        seqs = self.seed(21)
        self.store.delete_journal({'confirm': True, 'actor': 'all', 'snapshot': seqs[-1], 'seqs': [seqs[0]]})
        result = self.store.journal_page(page=2)
        self.assertEqual((result['page'], result['pages'], result['total']), (1, 1, 20))
        self.store.delete_journal({'confirm': True, 'actor': 'all', 'snapshot': seqs[-1], 'all_matching': True})
        self.assertEqual(self.store.journal_page()['events'], [])
        self.assertEqual(Store(self.tmp.name).journal_page()['total'], 0)
        self.assertEqual(len(self.store.events()), 21)

    def test_migrates_existing_events_only_once(self):
        self.seed(3)
        with self.store.connect() as db:
            db.executescript('DROP TRIGGER append_journal_entry; DROP TABLE journal_entries; DROP TABLE journal_metadata;')
        store = Store(self.tmp.name)
        self.assertEqual(store.journal_page()['total'], 3)
        store.delete_journal({'confirm': True, 'actor': 'all', 'snapshot': 3, 'all_matching': True})
        self.assertEqual(Store(self.tmp.name).journal_page()['total'], 0)
        store.event('decision', {}, actor='fly')
        self.assertEqual(store.journal_page()['total'], 1)

    def test_invalid_requests_never_clear_records(self):
        self.seed(3)
        base = {'confirm': True, 'actor': 'all', 'snapshot': 3, 'seqs': [1]}
        for change in [{'confirm': False}, {'snapshot': None}, {'snapshot': True}, {'snapshot': -1},
                       {'actor': None}, {'seqs': []}, {'seqs': [True]}, {'seqs': list(range(1, 22))},
                       {'all_matching': True}, {'seqs': ['1) OR 1=1']}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.store.delete_journal({**base, **change})
        self.assertEqual(self.store.journal_page()['total'], 3)
        # IDs outside the chosen source/range cannot broaden deletion.
        self.assertEqual(self.store.delete_journal({**base, 'actor': 'fly'})['deleted'], 0)
        for page in [0, -1, True, '1']:
            with self.assertRaises(ValueError): self.store.journal_page(page=page)


if __name__ == '__main__':
    unittest.main()
