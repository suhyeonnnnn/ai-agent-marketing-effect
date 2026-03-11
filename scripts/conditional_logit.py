"""
Conditional Logit Analysis — Study 1 (Fixed)

Key design choices for equalized products:
1. Drop rating/reviews (near-zero variance → perfect separation)
2. Keep brand dummies (capture unobserved brand preference)
3. Keep display_position (randomized, captures primacy/recency)  
4. For price_anchoring: use original price, let has_price_anchor capture the effect
   (avoid double-counting with effective price)
5. Marketing dummies are alternative-specific: only =1 for the target product 
   in treatment conditions

Usage:
    cd ~/Downloads/b2a-experiment
    pip install pandas numpy pylogit scipy
    python scripts/conditional_logit.py
"""

import json, os
from collections import OrderedDict
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

try:
    import pylogit
    HAS_PYLOGIT = True
except ImportError:
    HAS_PYLOGIT = False
    print("⚠ pylogit not installed. Install with: pip install pylogit")
    import sys; sys.exit(1)

from scipy import stats

# ═══════════════════════════════════════════════
#  Load Data
# ═══════════════════════════════════════════════

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSONL_PATH = os.path.join(ROOT, "results/study1/experiment_2026-03-05T13-07-47.jsonl")
if not os.path.exists(JSONL_PATH):
    JSONL_PATH = os.path.join(ROOT, "results/study1/experiment_2026-03-05T11-20-04.jsonl")

print(f"Loading: {os.path.basename(JSONL_PATH)}")
with open(JSONL_PATH) as f:
    raw = [json.loads(line) for line in f if line.strip()]
print(f"Loaded {len(raw)} trials")

# ═══════════════════════════════════════════════
#  Product Data (original prices — NOT effective)
# ═══════════════════════════════════════════════

PRODUCTS = {
    1: {"brand": "Vitality Extracts", "price": 16.50, "rating": 4.5, "reviews": 1020},
    2: {"brand": "The Crème Shop",    "price": 16.80, "rating": 4.6, "reviews": 980},
    3: {"brand": "OZ Naturals",       "price": 16.20, "rating": 4.5, "reviews": 1050},
    4: {"brand": "Drunk Elephant",    "price": 15.90, "rating": 4.6, "reviews": 1040},
    5: {"brand": "New York Biology",  "price": 16.90, "rating": 4.5, "reviews": 960},
    6: {"brand": "Hotmir",            "price": 16.40, "rating": 4.6, "reviews": 990},
    7: {"brand": "HoneyLab",          "price": 16.70, "rating": 4.5, "reviews": 1010},
    8: {"brand": "No7",               "price": 16.60, "rating": 4.6, "reviews": 970},
}

# ═══════════════════════════════════════════════
#  Build Long-Format Data
# ═══════════════════════════════════════════════

print("\nBuilding long-format choice data...")

rows = []
obs_id = 0
for t in raw:
    obs_id += 1
    condition = t["condition"]
    agency = t["agency"]
    input_mode = t["inputMode"]
    target_id = t["targetProductId"]
    chosen_id = t["chosenProductId"]
    position_order = t["positionOrder"]

    # Skip parse errors
    if chosen_id == 0:
        obs_id -= 1
        continue

    for display_pos, prod_id in enumerate(position_order, 1):
        p = PRODUCTS[prod_id]
        is_target = int(prod_id == target_id)
        is_chosen = int(prod_id == chosen_id)

        # Marketing dummies: only on target product in treatment trials
        has_scarcity = int(is_target and condition == "scarcity")
        has_social = int(is_target and condition == "social_proof")
        has_urgency = int(is_target and condition == "urgency")
        has_authority = int(is_target and condition == "authority")
        has_price_anchor = int(is_target and condition == "price_anchoring")
        has_any_marketing = int(is_target and condition != "control")

        rows.append({
            "obs_id": obs_id,
            "alt_id": prod_id,
            "chosen": is_chosen,
            # Product-level (alternative-specific)
            "display_position": display_pos,
            # Brand dummies (reference = OZ Naturals)
            "brand_vitality": int(prod_id == 1),
            "brand_creme": int(prod_id == 2),
            "brand_drunk": int(prod_id == 4),
            "brand_nyb": int(prod_id == 5),
            "brand_hotmir": int(prod_id == 6),
            "brand_honeylab": int(prod_id == 7),
            "brand_no7": int(prod_id == 8),
            # Marketing (alternative-specific — only target gets 1)
            "has_any_marketing": has_any_marketing,
            "has_scarcity": has_scarcity,
            "has_social": has_social,
            "has_urgency": has_urgency,
            "has_authority": has_authority,
            "has_price_anchor": has_price_anchor,
            # Trial-level (for interaction models)
            "condition": condition,
            "agency": agency,
            "inputMode": input_mode,
            # Agency dummies
            "agency_moderate": int(agency == "moderate"),
            "agency_specific": int(agency == "specific"),
        })

df = pd.DataFrame(rows)
n_obs = df.obs_id.nunique()
print(f"Long-format: {len(df)} rows ({n_obs} trials × 8 alternatives)")
print(f"Choices check: {df.chosen.sum()} (should be {n_obs})")

# ═══════════════════════════════════════════════
#  Helper: Fit pylogit model and print results
# ═══════════════════════════════════════════════

def fit_mnl(spec_cols, label):
    spec = OrderedDict([(col, "all_same") for col in spec_cols])
    names = OrderedDict([(k, k) for k in spec])
    m = pylogit.create_choice_model(
        data=df, alt_id_col="alt_id", obs_id_col="obs_id",
        choice_col="chosen", specification=spec, names=names,
        model_type="MNL"
    )
    m.fit_mle(np.zeros(len(spec)), method="BFGS")
    print(m.get_statsmodels_summary())
    return m

def print_ors(model, vars_labels):
    """Print odds ratios with CIs from pylogit model."""
    params = model.params
    # pylogit conf_int returns ndarray
    raw_ci = model.conf_int()
    if isinstance(raw_ci, np.ndarray):
        ci_df = pd.DataFrame(raw_ci, index=params.index, columns=["lower", "upper"])
    else:
        ci_df = raw_ci.copy()
        ci_df.columns = ["lower", "upper"]

    print(f"\n  {'Variable':25s} {'Coef':>8s} {'OR':>8s} {'95% CI':>20s} {'p':>10s} {'Sig':>4s}")
    print("  " + "-" * 80)
    for var, label in vars_labels:
        if var not in params.index:
            continue
        coef = params[var]
        or_val = np.exp(coef)
        ci_lo = np.exp(ci_df.loc[var, "lower"])
        ci_hi = np.exp(ci_df.loc[var, "upper"])
        p = model.pvalues[var]
        sig = "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "†" if p < 0.1 else ""
        print(f"  {label:25s} {coef:8.3f} {or_val:8.3f} [{ci_lo:7.3f}, {ci_hi:7.3f}] {p:10.6f} {sig:>4s}")

# ═══════════════════════════════════════════════
#  MODEL 1: Brand + Position Only (baseline)
#  
#  Note: We EXCLUDE price/rating/reviews because 
#  they are equalized by design (near-zero variance).
#  Brand dummies absorb any residual preference.
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 1: Brand + Position (baseline, no marketing)")
print("  NOTE: price/rating/reviews excluded — equalized by design")
print("=" * 70)

M1_COLS = ["display_position",
           "brand_vitality", "brand_creme", "brand_drunk",
           "brand_nyb", "brand_hotmir", "brand_honeylab", "brand_no7"]

m1 = fit_mnl(M1_COLS, "M1")
print_ors(m1, [
    ("display_position", "Display Position"),
    ("brand_drunk", "Drunk Elephant"),
    ("brand_hotmir", "Hotmir"),
    ("brand_honeylab", "HoneyLab"),
    ("brand_vitality", "Vitality Extracts"),
    ("brand_no7", "No7"),
    ("brand_creme", "The Crème Shop"),
    ("brand_nyb", "New York Biology"),
])

# ═══════════════════════════════════════════════
#  MODEL 2: + Pooled Marketing Effect
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 2: + Marketing (pooled)")
print("=" * 70)

M2_COLS = M1_COLS + ["has_any_marketing"]
m2 = fit_mnl(M2_COLS, "M2")
print_ors(m2, [
    ("display_position", "Display Position"),
    ("has_any_marketing", "★ Any Marketing Message"),
])

# ═══════════════════════════════════════════════
#  MODEL 3: Condition-Specific Marketing
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 3: Condition-Specific Marketing Effects")
print("=" * 70)

M3_COLS = M1_COLS + ["has_scarcity", "has_social", "has_urgency",
                      "has_authority", "has_price_anchor"]
m3 = fit_mnl(M3_COLS, "M3")
print_ors(m3, [
    ("display_position", "Display Position"),
    ("has_scarcity", "★ Scarcity"),
    ("has_social", "★ Social Proof"),
    ("has_urgency", "★ Urgency"),
    ("has_authority", "★ Authority"),
    ("has_price_anchor", "★ Price Anchoring"),
])

# ═══════════════════════════════════════════════
#  MODEL 4: Marketing × Agency Interaction
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 4: Marketing × Agency Interaction")
print("=" * 70)

# Interaction terms
df["mkt_x_moderate"] = df["has_any_marketing"] * df["agency_moderate"]
df["mkt_x_specific"] = df["has_any_marketing"] * df["agency_specific"]

M4_COLS = M1_COLS + ["has_any_marketing", "mkt_x_moderate", "mkt_x_specific"]
m4 = fit_mnl(M4_COLS, "M4")

print("\n── Agency Interaction ──")
b_mkt = m4.params.get("has_any_marketing", 0)
b_mod = m4.params.get("mkt_x_moderate", 0)
b_spc = m4.params.get("mkt_x_specific", 0)
print(f"  Vague (ref):    β={b_mkt:.3f}  OR={np.exp(b_mkt):.3f}")
print(f"  Moderate:       β={b_mkt+b_mod:.3f}  OR={np.exp(b_mkt+b_mod):.3f}  (interaction p={m4.pvalues.get('mkt_x_moderate', np.nan):.4f})")
print(f"  Specific:       β={b_mkt+b_spc:.3f}  OR={np.exp(b_mkt+b_spc):.3f}  (interaction p={m4.pvalues.get('mkt_x_specific', np.nan):.4f})")

# ═══════════════════════════════════════════════
#  MODEL 5: Marketing × Input Mode
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 5: Marketing × Input Mode Interaction")
print("=" * 70)

df["mode_flat"] = (df.inputMode == "text_flat").astype(int)
df["mode_html"] = (df.inputMode == "html").astype(int)
df["mode_screenshot"] = (df.inputMode == "screenshot").astype(int)
df["mkt_x_flat"] = df["has_any_marketing"] * df["mode_flat"]
df["mkt_x_html"] = df["has_any_marketing"] * df["mode_html"]
df["mkt_x_screenshot"] = df["has_any_marketing"] * df["mode_screenshot"]

M5_COLS = M1_COLS + ["has_any_marketing", "mkt_x_flat", "mkt_x_html", "mkt_x_screenshot"]
m5 = fit_mnl(M5_COLS, "M5")

print("\n── Input Mode Interaction ──")
b_mkt = m5.params.get("has_any_marketing", 0)
b_flat = m5.params.get("mkt_x_flat", 0)
b_html = m5.params.get("mkt_x_html", 0)
b_ss = m5.params.get("mkt_x_screenshot", 0)
print(f"  text_json (ref): β={b_mkt:.3f}  OR={np.exp(b_mkt):.3f}")
print(f"  text_flat:       β={b_mkt+b_flat:.3f}  OR={np.exp(b_mkt+b_flat):.3f}  (interaction p={m5.pvalues.get('mkt_x_flat', np.nan):.4f})")
print(f"  html:            β={b_mkt+b_html:.3f}  OR={np.exp(b_mkt+b_html):.3f}  (interaction p={m5.pvalues.get('mkt_x_html', np.nan):.4f})")
print(f"  screenshot:      β={b_mkt+b_ss:.3f}  OR={np.exp(b_mkt+b_ss):.3f}  (interaction p={m5.pvalues.get('mkt_x_screenshot', np.nan):.4f})")

# ═══════════════════════════════════════════════
#  MODEL 6: Full — Condition-Specific × Agency
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL 6: Condition-Specific × Agency")
print("=" * 70)

for cond_var in ["scarcity", "social", "urgency", "authority", "price_anchor"]:
    for ag in ["moderate", "specific"]:
        df[f"{cond_var}_x_{ag}"] = df[f"has_{cond_var}"] * df[f"agency_{ag}"]

M6_COLS = M1_COLS + [
    "has_scarcity", "has_social", "has_urgency", "has_authority", "has_price_anchor",
    "scarcity_x_moderate", "scarcity_x_specific",
    "social_x_moderate", "social_x_specific",
    "urgency_x_moderate", "urgency_x_specific",
    "authority_x_moderate", "authority_x_specific",
    "price_anchor_x_moderate", "price_anchor_x_specific",
]

m6 = fit_mnl(M6_COLS, "M6")

print("\n── Marketing OR by Condition × Agency ──")
print(f"  {'Condition':20s} {'Vague':>10s} {'Moderate':>10s} {'Specific':>10s}")
for label, var in [("Scarcity","scarcity"), ("Social Proof","social"),
                   ("Urgency","urgency"), ("Authority","authority"),
                   ("Price Anchoring","price_anchor")]:
    b = m6.params.get(f"has_{var}", 0)
    b_m = m6.params.get(f"{var}_x_moderate", 0)
    b_s = m6.params.get(f"{var}_x_specific", 0)
    print(f"  {label:20s} {np.exp(b):10.2f} {np.exp(b+b_m):10.2f} {np.exp(b+b_s):10.2f}")

# ═══════════════════════════════════════════════
#  Model Comparison
# ═══════════════════════════════════════════════

print("\n" + "=" * 70)
print("  MODEL COMPARISON")
print("=" * 70)

all_models = [("M1 (brand+pos)", m1), ("M2 (+marketing)", m2),
              ("M3 (+cond-specific)", m3), ("M4 (×agency)", m4),
              ("M5 (×mode)", m5), ("M6 (cond×agency)", m6)]

print(f"  {'Model':30s} {'LL':>10s} {'k':>4s} {'AIC':>10s} {'BIC':>10s} {'R²':>8s}")
print("  " + "-" * 72)
for name, m in all_models:
    if m is None: continue
    ll = m.llf
    k = len(m.params)
    aic = -2*ll + 2*k
    bic = -2*ll + k*np.log(n_obs)
    r2 = 1 - ll / m.null_log_likelihood
    print(f"  {name:30s} {ll:10.1f} {k:4d} {aic:10.1f} {bic:10.1f} {r2:8.4f}")

# LR tests
print("\n── Likelihood Ratio Tests ──")
pairs = [("M2 vs M1", m2, m1), ("M3 vs M1", m3, m1), ("M4 vs M2", m4, m2), ("M5 vs M2", m5, m2)]
for label, mfull, mbase in pairs:
    if mfull is None or mbase is None: continue
    lr = 2 * (mfull.llf - mbase.llf)
    df_diff = len(mfull.params) - len(mbase.params)
    if df_diff <= 0: continue
    p = stats.chi2.sf(lr, df_diff)
    sig = "***" if p<0.001 else "**" if p<0.01 else "*" if p<0.05 else ""
    print(f"  {label:20s} LR={lr:8.2f}  df={df_diff}  p={p:.6f} {sig}")

# ═══════════════════════════════════════════════
#  Save Results
# ═══════════════════════════════════════════════

out_dir = os.path.join(ROOT, "results", "analysis")
os.makedirs(out_dir, exist_ok=True)

# Save all model summaries to text file
import io, contextlib

buf = io.StringIO()
for name, m in all_models:
    if m is None: continue
    buf.write(f"\n{'='*70}\n  {name}\n{'='*70}\n")
    buf.write(m.get_statsmodels_summary().as_text() if hasattr(m, 'get_statsmodels_summary') else str(m.summary()))
    buf.write("\n")

txt_path = os.path.join(out_dir, "conditional_logit_results.txt")
with open(txt_path, "w") as f:
    f.write(buf.getvalue())
print(f"\n📁 Model summaries saved: {txt_path}")

# Save key results as CSV
result_rows = []
for var, label in [("has_scarcity","Scarcity"),("has_social","Social Proof"),
                    ("has_urgency","Urgency"),("has_authority","Authority"),
                    ("has_price_anchor","Price Anchoring")]:
    if m3 is not None and var in m3.params.index:
        coef = m3.params[var]
        raw_ci3 = m3.conf_int()
        if isinstance(raw_ci3, np.ndarray):
            ci3 = pd.DataFrame(raw_ci3, index=m3.params.index, columns=['lower','upper'])
        else:
            ci3 = raw_ci3.copy(); ci3.columns = ['lower','upper']
        result_rows.append({
            'condition': label, 'coef': coef, 'OR': np.exp(coef),
            'CI_lower': np.exp(ci3.loc[var,'lower']),
            'CI_upper': np.exp(ci3.loc[var,'upper']),
            'p_value': m3.pvalues[var],
            'sig': '***' if m3.pvalues[var]<0.001 else '**' if m3.pvalues[var]<0.01 else '*' if m3.pvalues[var]<0.05 else ''
        })

if result_rows:
    res_df = pd.DataFrame(result_rows)
    csv_path = os.path.join(out_dir, "conditional_logit_ORs.csv")
    res_df.to_csv(csv_path, index=False)
    print(f"📁 Odds ratios saved: {csv_path}")

# Save model comparison
comp_rows = []
for name, m in all_models:
    if m is None: continue
    ll = m.llf; k = len(m.params)
    comp_rows.append({'model': name, 'LL': ll, 'k': k,
                      'AIC': -2*ll+2*k, 'BIC': -2*ll+k*np.log(n_obs),
                      'R2': 1-ll/m.null_log_likelihood})
comp_df = pd.DataFrame(comp_rows)
comp_path = os.path.join(out_dir, "model_comparison.csv")
comp_df.to_csv(comp_path, index=False)
print(f"📁 Model comparison saved: {comp_path}")

print("\n✅ Conditional logit analysis complete.")
