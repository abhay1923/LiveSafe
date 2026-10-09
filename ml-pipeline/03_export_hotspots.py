import re
import json
import pickle
import numpy as np
import pandas as pd
from lib_geo import STATE_CAPITAL_COORDS

master = pd.read_csv('master_districts_latest.csv')

with open('model.pkl', 'rb') as f:
    obj = pickle.load(f)
model, model_cols = obj['model'], obj['feature_cols']

feature_cols = [
    'children', 'cyber', 'ipc', 'sll', 'women',
    'ipc_log', 'ipc_state_pct', 'sll_log', 'sll_state_pct',
    'women_log', 'women_state_pct', 'children_log', 'children_state_pct',
    'cyber_log', 'cyber_state_pct',
    'ipc_prev', 'ipc_growth', 'ipc_gap_years',
    'women_prev', 'women_growth', 'women_gap_years',
    'children_prev', 'children_growth', 'children_gap_years',
    'cyber_prev', 'cyber_growth', 'cyber_gap_years',
    'severity', 'year',
]
state_dummies = pd.get_dummies(master['s_key'], prefix='state')
X = pd.concat([master[feature_cols].fillna(0), state_dummies], axis=1).reindex(columns=model_cols, fill_value=0)
master['pred_next_severity'] = np.clip(model.predict(X), 0, 1)

RISK_BINS = [-0.001, 0.4, 0.7, 0.88, 1.001]
RISK_LABELS = ['low', 'medium', 'high', 'critical']
master['pred_next_risk_class'] = pd.cut(master['pred_next_severity'], bins=RISK_BINS, labels=RISK_LABELS).astype(str)

CATS = ['ipc', 'sll', 'women', 'children', 'cyber']
CAT_LABEL = {
    'ipc': 'IPC crimes (general penal code offences)',
    'sll': 'Special & Local Laws offences',
    'women': 'crimes against women',
    'children': 'crimes against children',
    'cyber': 'cyber crimes',
}


def top_categories(row, n=2):
    pcts = [(c, row[f'{c}_state_pct']) for c in CATS if pd.notna(row[f'{c}_state_pct']) and row[c] > 0]
    pcts.sort(key=lambda t: -t[1])
    return [c for c, _ in pcts[:n]]


def warning_text(row, risk_class, top_cats):
    if not top_cats:
        return f"{risk_class.upper()} — insufficient recent category data for {row['district_norm'].title()}."
    label = CAT_LABEL[top_cats[0]]
    pct = row[f'{top_cats[0]}_state_pct'] * 100
    return (f"{risk_class.upper()} RISK: {row['district_norm'].title()} ranks in the top "
            f"{100 - pct:.0f}% of districts in {row['state_norm'].title()} for {label} "
            f"(NCRB {int(row['year'])} data).")


records = []
for _, row in master.iterrows():
    if row['is_reporting_unit'] or pd.isna(row['lat']):
        continue  # only real, geocoded physical districts go on the map
    risk_class = row['risk_class']
    top_cats = top_categories(row)
    total_crimes = sum(row[c] for c in CATS if pd.notna(row[c]))
    pop = row['census_2011_population']
    crime_rate_per_lakh = round(total_crimes / pop * 100000, 1) if pd.notna(pop) and pop > 0 else None
    trend = 'rising' if row['ipc_growth'] and row['ipc_growth'] > 0.03 else (
        'falling' if row['ipc_growth'] and row['ipc_growth'] < -0.03 else 'stable')
    # data completeness (0-100): how much of the 5-category picture we actually have for this district-year
    reported = sum(1 for c in CATS if pd.notna(row[c]))
    recency = 1.0 if row['year'] >= 2022 else (0.85 if row['year'] >= 2020 else 0.65)
    data_completeness = round(min(100, (reported / len(CATS)) * 100 * recency), 1)

    records.append({
        'id': 'd_' + re.sub(r'[^a-z0-9]+', '_', (str(row['s_key']) + '_' + str(row['district_norm'])).lower()).strip('_')[:80],
        'district': row['district_norm'].title(),
        'state': row['state_norm'].title(),
        'lat': round(float(row['lat']), 4),
        'lon': round(float(row['lon']), 4),
        'risk_level': risk_class,
        'risk_score': round(float(row['severity']) * 100, 1),
        'data_completeness': data_completeness,
        'total_crimes_reported': int(total_crimes),
        'crime_rate_per_lakh': crime_rate_per_lakh,
        'reported_categories': top_cats,
        'primary_warning': warning_text(row, risk_class, top_cats),
        'trend': trend,
        'population_lakh': round(pop / 100000, 2) if pd.notna(pop) else None,
        'radius_meters': int(min(2200, max(600, 600 + (pop / 100000 if pd.notna(pop) else 1) * 40))),
        'data_year': int(row['year']),
        'geo_source': row['geo_match_type'],
        'predicted_next_year_severity': round(float(row['pred_next_severity']) * 100, 1),
        'predicted_next_year_risk_level': row['pred_next_risk_class'],
    })

records.sort(key=lambda r: -r['risk_score'])
_ids = [r['id'] for r in records]
assert len(_ids) == len(set(_ids)), 'duplicate hotspot ids would overwrite real rows'
print(f"exported {len(records)} real, geocoded district hotspots "
      f"(risk_level counts: {pd.Series([r['risk_level'] for r in records]).value_counts().to_dict()})")

with open('hotspots_real.json', 'w') as f:
    json.dump(records, f, indent=2)

# ---- state-level rollup (covers ALL 39 states/UTs, no geocoding needed) ----
state_rollup = (
    master.groupby(['state_norm', 's_key'])
    .agg(mean_severity=('severity', 'mean'),
         districts_reported=('district_norm', 'count'),
         max_severity=('severity', 'max'),
         critical_districts=('risk_class', lambda s: (s == 'critical').sum()),
         high_districts=('risk_class', lambda s: (s == 'high').sum()))
    .reset_index()
)
state_records = []
for _, row in state_rollup.iterrows():
    coords = STATE_CAPITAL_COORDS.get(row['s_key'])
    state_records.append({
        'state': row['state_norm'].title(),
        'lat': coords[0] if coords else None,
        'lon': coords[1] if coords else None,
        'mean_severity': round(float(row['mean_severity']) * 100, 1),
        'max_district_severity': round(float(row['max_severity']) * 100, 1),
        'districts_reported': int(row['districts_reported']),
        'critical_districts': int(row['critical_districts']),
        'high_districts': int(row['high_districts']),
    })
state_records.sort(key=lambda r: -r['mean_severity'])
with open('state_summary_real.json', 'w') as f:
    json.dump(state_records, f, indent=2)

print(f"exported state rollup for {len(state_records)} states/UTs (full national coverage)")
