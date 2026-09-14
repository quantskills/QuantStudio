# Methodology

## 1. Premium definition

For the default 1:1 economic share ratio:

```text
h_equivalent_cny = h_price_hkd * fx_hkd_cny
premium = a_price_cny / h_equivalent_cny - 1
```

If `share_ratio = r` represents H-share economic units per one A-share unit:

```text
h_equivalent_cny = h_price_hkd * fx_hkd_cny * r
```

Do not change the ratio merely to make the premium look smaller.

## 2. Date alignment

Historical A and H prices must share the same calendar date. Do not forward-fill A or H closes. FX may be carried from the latest fixing only when the source date is no more than three calendar days old; record the staleness.

## 3. Windows

Calculate trailing statistics on the latest 20, 60, and 250 valid overlapping observations. Report a window only when at least half of its nominal observations are available, but prefer the largest available window for the state label.

## 4. Z-scores

Standard:

```text
z = (current - mean) / sample_std
```

Robust:

```text
robust_z = 0.67448975 * (current - median) / MAD
```

MAD is median absolute deviation. Robust z is preferred for state classification when available because A/H premium histories can contain corporate-action jumps and episodic outliers.

## 5. Percentile

Empirical percentile is the share of trailing observations less than or equal to the current premium.

## 6. Dislocation score

Use the largest valid window. Let `z_ref` be robust z when available, else standard z.

```text
z_component = 70 * min(abs(z_ref) / 3, 1)
percentile_component = 30 * abs(percentile - 0.5) * 2
dislocation_score = min(100, z_component + percentile_component)
```

This score measures historical extremity, not expected return.

## 7. State labels

Based on `z_ref`:

- `>= +2`: extreme-a-premium
- `[+1, +2)`: elevated-a-premium
- `(-1, +1)`: balanced
- `(-2, -1]`: elevated-a-discount
- `<= -2`: extreme-a-discount

If no valid z-score exists, use percentile only when at least 20 observations exist and label confidence low.

## 8. Rapid widening/compression

Measure current premium minus the value five observations earlier. Compare the absolute move with twice the 60-observation standard deviation of one-observation premium changes times `sqrt(5)`. Flag only when enough change observations exist.

## 9. Lead-lag proxy

Using overlapping daily closes, calculate log returns and:

```text
corr_same = corr(A_t, H_t)
corr_h_to_a = corr(H_t, A_t+1)
corr_a_to_h = corr(A_t, H_t+1)
lead_score = corr_h_to_a - corr_a_to_h
```

Require at least 40 paired return observations. Label:

- `lead_score >= 0.08`: h-leads-a
- `lead_score <= -0.08`: a-leads-h
- otherwise: balanced

This is only a daily timing proxy. Hong Kong normally closes after mainland China, so a positive H-to-next-A relation can partly reflect market-hour asymmetry rather than superior information.
