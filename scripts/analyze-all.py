"""
Full Analysis — Marketing Messages on AI Shopping Agents
Study 1 (N=30) + Study 2 (multi-step agent)

Usage:
  1. node scripts/extract-all-summaries.mjs   (extract slim CSVs)
  2. pip install pandas statsmodels scipy matplotlib seaborn
  3. python scripts/analyze-all.py
"""

import pandas as pd
import numpy as np
import statsmodels.formula.api as smf
from scipy import stats
from statsmodels.stats.multitest import multipletests
import warnings, os, sys
warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ═══════════════════════════════════════════════
#  Load Data
# ═══════════════════════════════════════════════

def load_csv(relpath):
    p = os.path.join(ROOT, relpath)
    if not os.path.exists(p):
        print(f"  ⚠ Not found: {relpath}")
        return None
    df = pd.read_csv(p)
    df["choseTarget"] = df["choseTarget"].map({"true": True, "false": False, True: True, False: False}).astype(int)
    return df

print("Loading data...")
s1 = load_csv("results/study1/experiment_2026-03-05T13-07-47_slim.csv")
s2 = load_csv("results/study2/study2_all_slim.csv")

# ═══════════════════════════════════════════════
#  Study 1 Analysis
# ═══════════════════════════════════════════════

def analyze_study1(df):
    print("\n" + "=" * 70)
    print("  STUDY 1: SINGLE-TURN SELECTION")
    print("=" * 70)
    print(f"\nTotal: {len(df)} trials | Hits: {df.choseTarget.sum()}/{len(df)} ({df.choseTarget.mean()*100:.1f}%)")
    print(f"Baseline (1/8): 12.5%")

    # ── By Condition ──
    print("\n── Selection Rate by Condition ──")
    conds = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"]
    for c in conds:
        sub = df[df.condition == c]
        print(f"  {c:20s} {sub.choseTarget.mean()*100:5.1f}% ({sub.choseTarget.sum()}/{len(sub)})")

    # ── By Agency ──
    print("\n── Selection Rate by Agency ──")
    for a in ["vague", "moderate", "specific"]:
        sub = df[df.agency == a]
        print(f"  {a:20s} {sub.choseTarget.mean()*100:5.1f}% ({sub.choseTarget.sum()}/{len(sub)})")

    # ── By Input Mode ──
    print("\n── Selection Rate by Input Mode ──")
    for m in df.inputMode.unique():
        sub = df[df.inputMode == m]
        print(f"  {m:20s} {sub.choseTarget.mean()*100:5.1f}% ({sub.choseTarget.sum()}/{len(sub)})")

    # ── Condition × Agency ──
    print("\n── Condition × Agency (%) ──")
    ct = pd.crosstab(df.condition, df.agency, values=df.choseTarget, aggfunc="mean")
    ct = (ct * 100).round(1).reindex(conds)
    print(ct.to_string())

    # ── Condition × Input Mode ──
    print("\n── Condition × Input Mode (%) ──")
    ct2 = pd.crosstab(df.condition, df.inputMode, values=df.choseTarget, aggfunc="mean")
    ct2 = (ct2 * 100).round(1).reindex(conds)
    print(ct2.to_string())

    # ── Logistic Regression ──
    print("\n── Logistic Regression: Main Effect ──")
    formula = "choseTarget ~ C(condition, Treatment(reference='control')) + C(agency) + C(inputMode) + targetPosition"
    try:
        model = smf.logit(formula, data=df).fit(disp=0)
        print(f"Pseudo R²: {model.prsquared:.4f} | AIC: {model.aic:.1f} | N: {model.nobs:.0f}")
        
        print("\nOdds Ratios vs Control:")
        for p in model.params.index:
            if "condition" in p:
                name = p.split("T.")[1].rstrip("]") if "T." in p else p
                or_val = np.exp(model.params[p])
                ci = np.exp(model.conf_int().loc[p])
                sig = "***" if model.pvalues[p]<0.001 else "**" if model.pvalues[p]<0.01 else "*" if model.pvalues[p]<0.05 else "†" if model.pvalues[p]<0.1 else ""
                print(f"  {name:20s} OR={or_val:6.2f} [{ci[0]:.2f}, {ci[1]:.2f}]  p={model.pvalues[p]:.4f} {sig}")
        
        print("\nControl Variables:")
        for p in model.params.index:
            if "condition" not in p and p != "Intercept":
                name = p.split("T.")[1].rstrip("]") if "T." in p else p
                or_val = np.exp(model.params[p])
                sig = "*" if model.pvalues[p]<0.05 else ""
                print(f"  {name:35s} OR={or_val:6.2f}  p={model.pvalues[p]:.4f} {sig}")
    except Exception as e:
        print(f"  Error: {e}")

    # ── Agency Interaction ──
    print("\n── Agency × Condition Interaction ──")
    try:
        m_full = smf.logit("choseTarget ~ C(condition, Treatment(reference='control')) * C(agency)", data=df).fit(disp=0)
        m_base = smf.logit("choseTarget ~ C(condition, Treatment(reference='control')) + C(agency)", data=df).fit(disp=0)
        lr = 2 * (m_full.llf - m_base.llf)
        df_diff = m_full.df_model - m_base.df_model
        p_val = stats.chi2.sf(lr, df_diff)
        print(f"  LR test: χ²={lr:.2f}, df={df_diff:.0f}, p={p_val:.4f} {'*' if p_val<0.05 else ''}")
    except Exception as e:
        print(f"  Error: {e}")

    # ── Input Mode Interaction ──
    print("\n── Input Mode × Condition Interaction ──")
    try:
        m_full = smf.logit("choseTarget ~ C(condition, Treatment(reference='control')) * C(inputMode)", data=df).fit(disp=0)
        m_base = smf.logit("choseTarget ~ C(condition, Treatment(reference='control')) + C(inputMode)", data=df).fit(disp=0)
        lr = 2 * (m_full.llf - m_base.llf)
        df_diff = m_full.df_model - m_base.df_model
        p_val = stats.chi2.sf(lr, df_diff)
        print(f"  LR test: χ²={lr:.2f}, df={df_diff:.0f}, p={p_val:.4f} {'*' if p_val<0.05 else ''}")
    except Exception as e:
        print(f"  Error: {e}")

    # ── Pairwise (Bonferroni) ──
    print("\n── Pairwise: Each Condition vs Control (Bonferroni) ──")
    ctrl = df[df.condition == "control"].choseTarget
    pvals = []
    rows = []
    for c in ["scarcity", "social_proof", "urgency", "authority", "price_anchoring"]:
        t = df[df.condition == c].choseTarget
        p1, p2 = ctrl.mean(), t.mean()
        pp = (ctrl.sum() + t.sum()) / (len(ctrl) + len(t))
        se = np.sqrt(pp*(1-pp)*(1/len(ctrl)+1/len(t))) if 0 < pp < 1 else 1
        z = (p2-p1)/se if se > 0 else 0
        p_raw = 2*stats.norm.sf(abs(z))
        h = 2*np.arcsin(np.sqrt(p2)) - 2*np.arcsin(np.sqrt(p1))
        rows.append((c, len(ctrl), len(t), p1, p2, p2-p1, h, z, p_raw))
        pvals.append(p_raw)
    
    _, p_corr, _, _ = multipletests(pvals, method="bonferroni")
    print(f"  {'Condition':20s} {'n_ctrl':>6s} {'n_trt':>6s} {'ctrl%':>6s} {'trt%':>6s} {'diff':>7s} {'h':>6s} {'z':>7s} {'p_raw':>7s} {'p_bonf':>7s} {'sig':>4s}")
    for i, (c, n1, n2, p1, p2, d, h, z, pr) in enumerate(rows):
        sig = "***" if p_corr[i]<0.001 else "**" if p_corr[i]<0.01 else "*" if p_corr[i]<0.05 else ""
        print(f"  {c:20s} {n1:6d} {n2:6d} {p1*100:5.1f}% {p2*100:5.1f}% {d*100:+6.1f}% {h:6.3f} {z:7.3f} {pr:7.4f} {p_corr[i]:7.4f} {sig:>4s}")

    # ── Position Bias ──
    print("\n── Position Bias ──")
    pos = df.groupby("targetPosition").choseTarget.agg(["mean", "count"])
    print(pos.round(3).to_string())
    try:
        pm = smf.logit("choseTarget ~ targetPosition", data=df).fit(disp=0)
        print(f"  Position coeff: {pm.params['targetPosition']:.4f}, p={pm.pvalues['targetPosition']:.4f}")
    except: pass

    # ── Reasoning Keywords ──
    print("\n── Reasoning: Marketing Keyword Mentions ──")
    kws = {
        "scarcity": ["stock", "left", "remaining", "limited", "sold out"],
        "social_proof": ["best seller", "popular", "viewing", "trending", "bestseller"],
        "urgency": ["deal ends", "limited time", "countdown", "limited-time"],
        "authority": ["dermatologist", "clinically", "certified", "recommended", "proven"],
        "price_anchoring": ["save", "discount", "special price", "$14.49", "was $"],
    }
    for c, words in kws.items():
        sub = df[df.condition == c]
        m = sub.reasoning.fillna("").apply(lambda r: any(w in r.lower() for w in words))
        print(f"  {c:20s} {m.mean()*100:5.1f}% ({m.sum()}/{len(sub)})")

    # ── Brand Preference ──
    print("\n── Brand Selection Frequency ──")
    bc = df.chosenBrand.value_counts()
    for brand, cnt in bc.items():
        print(f"  {brand:25s} {cnt:4d} ({cnt/len(df)*100:.1f}%)")


# ═══════════════════════════════════════════════
#  Study 2 Analysis
# ═══════════════════════════════════════════════

def analyze_study2(df):
    print("\n" + "=" * 70)
    print("  STUDY 2: MULTI-STEP AGENT")
    print("=" * 70)
    print(f"\nTotal: {len(df)} trials | Hits: {df.choseTarget.sum()}/{len(df)} ({df.choseTarget.mean()*100:.1f}%)")
    
    if "totalSteps" in df.columns:
        print(f"Mean steps: {df.totalSteps.mean():.1f} (SD={df.totalSteps.std():.1f})")

    conds = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"]

    # ── By Condition ──
    print("\n── Selection Rate by Condition ──")
    for c in conds:
        sub = df[df.condition == c]
        if len(sub) == 0: continue
        print(f"  {c:20s} {sub.choseTarget.mean()*100:5.1f}% ({sub.choseTarget.sum()}/{len(sub)})")

    # ── By Input Mode ──
    if "inputMode" in df.columns and df.inputMode.nunique() > 1:
        print("\n── Selection Rate by Input Mode ──")
        for m in df.inputMode.unique():
            sub = df[df.inputMode == m]
            if len(sub) == 0: continue
            print(f"  {str(m):20s} {sub.choseTarget.mean()*100:5.1f}% ({sub.choseTarget.sum()}/{len(sub)})")

        print("\n── Condition × Input Mode (%) ──")
        ct = pd.crosstab(df.condition, df.inputMode, values=df.choseTarget, aggfunc="mean")
        ct = (ct * 100).round(1)
        print(ct.to_string())

    # ── Logistic Regression ──
    print("\n── Logistic Regression ──")
    formula = "choseTarget ~ C(condition, Treatment(reference='control'))"
    if "totalSteps" in df.columns:
        formula += " + totalSteps"
    if "inputMode" in df.columns and df.inputMode.nunique() > 1:
        formula += " + C(inputMode)"
    
    try:
        model = smf.logit(formula, data=df).fit(disp=0)
        print(f"Formula: {formula}")
        print(f"Pseudo R²: {model.prsquared:.4f} | AIC: {model.aic:.1f}")
        
        print("\nOdds Ratios:")
        for p in model.params.index:
            if "condition" in p:
                name = p.split("T.")[1].rstrip("]") if "T." in p else p
                or_val = np.exp(model.params[p])
                ci = np.exp(model.conf_int().loc[p])
                sig = "***" if model.pvalues[p]<0.001 else "**" if model.pvalues[p]<0.01 else "*" if model.pvalues[p]<0.05 else ""
                print(f"  {name:20s} OR={or_val:6.2f} [{ci[0]:.2f}, {ci[1]:.2f}]  p={model.pvalues[p]:.4f} {sig}")
    except Exception as e:
        print(f"  Error: {e}")

    # ── Pairwise ──
    print("\n── Pairwise vs Control (Bonferroni) ──")
    ctrl = df[df.condition == "control"].choseTarget
    pvals, rows = [], []
    for c in ["scarcity", "social_proof", "urgency", "authority", "price_anchoring"]:
        t = df[df.condition == c].choseTarget
        if len(t) == 0: continue
        p1, p2 = ctrl.mean(), t.mean()
        pp = (ctrl.sum()+t.sum())/(len(ctrl)+len(t))
        se = np.sqrt(pp*(1-pp)*(1/len(ctrl)+1/len(t))) if 0<pp<1 else 1
        z = (p2-p1)/se if se>0 else 0
        pr = 2*stats.norm.sf(abs(z))
        h = 2*np.arcsin(np.sqrt(p2))-2*np.arcsin(np.sqrt(p1))
        rows.append((c, p1, p2, p2-p1, h, z, pr))
        pvals.append(pr)
    
    if pvals:
        _, p_corr, _, _ = multipletests(pvals, method="bonferroni")
        for i, (c, p1, p2, d, h, z, pr) in enumerate(rows):
            sig = "***" if p_corr[i]<0.001 else "**" if p_corr[i]<0.01 else "*" if p_corr[i]<0.05 else ""
            print(f"  {c:20s} {p1*100:5.1f}→{p2*100:5.1f}% (Δ={d*100:+5.1f}%) h={h:.3f} p_bonf={p_corr[i]:.4f} {sig}")

    # ── Process DVs ──
    if "totalSteps" in df.columns:
        print("\n── Behavioral Metrics by Condition ──")
        print(f"  {'Condition':20s} {'Steps':>7s} {'Viewed':>7s} {'Reviews':>8s} {'1stView':>8s}")
        for c in conds:
            sub = df[df.condition == c]
            if len(sub) == 0: continue
            steps = sub.totalSteps.mean()
            viewed = sub.uniqueProductsViewed.mean() if "uniqueProductsViewed" in sub else 0
            reviews = sub.uniqueReviewsRead.mean() if "uniqueReviewsRead" in sub else 0
            fvr = sub.firstViewRankTarget.replace("", np.nan).astype(float).mean() if "firstViewRankTarget" in sub else np.nan
            print(f"  {c:20s} {steps:7.1f} {viewed:7.1f} {reviews:8.1f} {fvr:8.1f}")

        # Kruskal-Wallis for process DVs
        print("\n── Process DV Tests (Kruskal-Wallis) ──")
        for var, label in [("totalSteps","Steps"), ("uniqueProductsViewed","Products Viewed"), ("uniqueReviewsRead","Reviews Read")]:
            if var not in df.columns: continue
            groups = [g[var].dropna().values for _, g in df.groupby("condition")]
            groups = [g for g in groups if len(g) > 0]
            if len(groups) >= 2:
                h_stat, p = stats.kruskal(*groups)
                print(f"  {label:25s} H={h_stat:.2f}, p={p:.4f} {'*' if p<0.05 else ''}")

        # First view rank: control vs others
        if "firstViewRankTarget" in df.columns:
            print("\n── First View Rank: Mann-Whitney vs Control ──")
            ctrl_fvr = df[df.condition == "control"].firstViewRankTarget.replace("", np.nan).astype(float).dropna()
            for c in ["scarcity", "social_proof", "urgency", "authority", "price_anchoring"]:
                t_fvr = df[df.condition == c].firstViewRankTarget.replace("", np.nan).astype(float).dropna()
                if len(t_fvr) == 0 or len(ctrl_fvr) == 0: continue
                u, p = stats.mannwhitneyu(ctrl_fvr, t_fvr, alternative="two-sided")
                diff = t_fvr.mean() - ctrl_fvr.mean()
                print(f"  {c:20s} ctrl={ctrl_fvr.mean():.1f} vs {t_fvr.mean():.1f} (Δ={diff:+.1f}) U={u:.0f} p={p:.4f} {'*' if p<0.05 else ''}")


# ═══════════════════════════════════════════════
#  Cross-Study Comparison
# ═══════════════════════════════════════════════

def cross_study(s1, s2):
    print("\n" + "=" * 70)
    print("  CROSS-STUDY COMPARISON")
    print("=" * 70)

    # Filter Study 1 to moderate agency for comparability
    s1m = s1[s1.agency == "moderate"].copy()
    s1m["study"] = "Study 1"
    s2c = s2.copy()
    s2c["study"] = "Study 2"

    print(f"\nStudy 1 (moderate): {len(s1m)} trials, {s1m.choseTarget.mean()*100:.1f}%")
    print(f"Study 2:            {len(s2c)} trials, {s2c.choseTarget.mean()*100:.1f}%")

    conds = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"]
    print(f"\n  {'Condition':20s} {'Study1':>8s} {'Study2':>8s} {'Δ':>8s}")
    for c in conds:
        r1 = s1m[s1m.condition == c].choseTarget.mean() * 100
        r2 = s2c[s2c.condition == c].choseTarget.mean() * 100 if len(s2c[s2c.condition == c]) > 0 else float('nan')
        d = r2 - r1 if not np.isnan(r2) else float('nan')
        print(f"  {c:20s} {r1:7.1f}% {r2:7.1f}% {d:+7.1f}%")

    # Interaction test
    combined = pd.concat([s1m[["condition", "choseTarget", "study"]], s2c[["condition", "choseTarget", "study"]]])
    combined["is_treated"] = (combined.condition != "control").astype(int)
    combined["is_study2"] = (combined.study == "Study 2").astype(int)
    
    try:
        m = smf.logit("choseTarget ~ is_treated * is_study2", data=combined).fit(disp=0)
        ip = m.pvalues.get("is_treated:is_study2", np.nan)
        print(f"\nInteraction (treated × study): coef={m.params.get('is_treated:is_study2',0):.3f}, p={ip:.4f}")
        if ip < 0.05:
            print("→ Marketing effect significantly differs between studies.")
        else:
            print("→ No significant difference in marketing effect between studies.")
    except Exception as e:
        print(f"  Error: {e}")


# ═══════════════════════════════════════════════
#  Summary Table for Paper
# ═══════════════════════════════════════════════

def paper_summary(s1, s2):
    print("\n" + "=" * 70)
    print("  PAPER-READY SUMMARY TABLE")
    print("=" * 70)
    
    conds = ["control", "scarcity", "social_proof", "urgency", "authority", "price_anchoring"]
    
    print(f"\n{'':30s} | {'Study 1':^30s} | {'Study 2':^15s}")
    print(f"{'Condition':30s} | {'Vague':>8s} {'Moderate':>9s} {'Specific':>9s} {'Overall':>9s} | {'Overall':>9s}")
    print("-" * 90)
    
    for c in conds:
        vals = []
        for a in ["vague", "moderate", "specific"]:
            sub = s1[(s1.condition == c) & (s1.agency == a)]
            vals.append(f"{sub.choseTarget.mean()*100:.1f}%" if len(sub) > 0 else "N/A")
        overall1 = s1[s1.condition == c].choseTarget.mean() * 100
        
        s2sub = s2[s2.condition == c] if s2 is not None else pd.DataFrame()
        overall2 = f"{s2sub.choseTarget.mean()*100:.1f}%" if len(s2sub) > 0 else "N/A"
        
        print(f"  {c:28s} | {vals[0]:>8s} {vals[1]:>9s} {vals[2]:>9s} {overall1:8.1f}% | {overall2:>9s}")


# ═══════════════════════════════════════════════
#  Run All
# ═══════════════════════════════════════════════

if s1 is not None:
    analyze_study1(s1)

if s2 is not None:
    analyze_study2(s2)

if s1 is not None and s2 is not None:
    cross_study(s1, s2)

if s1 is not None:
    paper_summary(s1, s2)

print("\n\n✅ All analyses complete.")
