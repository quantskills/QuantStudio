# Runtime and source baseline

QuantStudio integrates DeepSeek Harness 0.1.2-alpha.2 (upstream tag dsh-v0.1.2-alpha.2, commit 0a53fb55bea101816fa226bb964ae2bed71c343b) as an exact dependency. Its application packages, UI and launcher are shipped together. Other DSH versions require separate compatibility verification.

The independent QuantStudio repository starts from a verified application snapshot. Internal package identifiers remain stable for existing profiles and persisted events. Checked-in lib/ files are the installable build output.

Upstream source provenance and applicable licenses are retained in THIRD_PARTY_NOTICES.md and LICENSES/.
