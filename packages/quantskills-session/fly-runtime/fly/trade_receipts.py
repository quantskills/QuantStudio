"""Match actual fills and retain their billed fees, never order cost estimates."""
import math


def commission(receipt):
    for key in ('commission', 'Commission', 'cost'):
        raw = receipt.get(key)
        if raw is None or isinstance(raw, bool): continue
        try: value = float(raw)
        except (ValueError, TypeError): continue
        if math.isfinite(value) and value >= 0: return value
    return None


def receipt_key(receipt):
    symbol = str(receipt.get('symbol') or receipt.get('instrument_id') or receipt.get('contractCode') or '').split('.')[0].lower()
    return (symbol, str(receipt.get('trade_id') or receipt.get('tradeId') or '').strip(),
            str(receipt.get('order_id') or receipt.get('orderId') or receipt.get('order') or '').strip())


def receipt_index(receipts):
    return {receipt_key(r): r for r in receipts if all(receipt_key(r))}


def matched_receipt(index, fill):
    key = receipt_key(fill)
    receipt = index.get(key, {}) if all(key) else {}
    # An order/trade identifier alone must never attach another fill's fee.
    for field in ('price', 'volume'):
        if field in receipt and receipt[field] != fill.get(field): return {}
    return receipt
