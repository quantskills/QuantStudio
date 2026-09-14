# Factor Decay Analysis

Load SKILL.md and references/decay-models.md into the agent context before use.

This skill analyzes how a factor's predictive power decays over holding periods.
Input: factor signal [date × symbol] + multi-horizon forward returns.
Output: DecayReport with IC decay curve, half-life, and rebalancing recommendation.
