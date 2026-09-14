#!/usr/bin/env python3
"""Resolve A/H company names to codes from a live snapshot."""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher


_NORMALIZE_RE = re.compile(r"[\s\W_]+", re.UNICODE)


def normalize(value) -> str:
    return _NORMALIZE_RE.sub("", str(value or "")).casefold()


@dataclass(frozen=True)
class Match:
    company: str
    a_code: str
    h_code: str
    score: float
    reason: str


def _best_text_score(query: str, candidate: str) -> float:
    if not query or not candidate:
        return 0.0
    if query == candidate:
        return 1.0
    if query in candidate or candidate in query:
        return 0.98
    return SequenceMatcher(None, query, candidate).ratio()


def score_row(query, row, company_key="名称", a_code_key="A股代码", h_code_key="H股代码") -> Match:
    q = normalize(query)
    company = str(row.get(company_key, "") or "")
    a_code = str(row.get(a_code_key, "") or "")
    h_code = str(row.get(h_code_key, "") or "")
    company_n = normalize(company)
    a_code_n = normalize(a_code)
    h_code_n = normalize(h_code)

    reason = "company"
    score = _best_text_score(q, company_n)
    code_score = _best_text_score(q, a_code_n)
    if code_score > score:
        score = code_score
        reason = "a_code"
    code_score = _best_text_score(q, h_code_n)
    if code_score > score:
        score = code_score
        reason = "h_code"
    return Match(company=company, a_code=a_code, h_code=h_code, score=score, reason=reason)


def rank_rows(query, rows, company_key="名称", a_code_key="A股代码", h_code_key="H股代码", limit=5):
    matches = [
        score_row(query, row, company_key=company_key, a_code_key=a_code_key, h_code_key=h_code_key)
        for row in rows
    ]
    matches.sort(key=lambda m: (-m.score, normalize(m.company), normalize(m.a_code), normalize(m.h_code)))
    return matches[:limit]


def resolve_best_match(query, rows, company_key="名称", a_code_key="A股代码", h_code_key="H股代码", limit=5, min_score=0.72):
    matches = rank_rows(
        query,
        rows,
        company_key=company_key,
        a_code_key=a_code_key,
        h_code_key=h_code_key,
        limit=limit,
    )
    if not matches or matches[0].score < min_score:
        raise ValueError("no confident A/H match found")
    if len(matches) > 1 and matches[1].score >= matches[0].score - 0.03 and matches[0].score < 0.999:
        raise ValueError("ambiguous A/H company name")
    return matches[0], matches


def format_candidates(matches):
    return [
        {
            "company": m.company,
            "a_code": m.a_code,
            "h_code": m.h_code,
            "score": round(m.score, 4),
            "reason": m.reason,
        }
        for m in matches
    ]
