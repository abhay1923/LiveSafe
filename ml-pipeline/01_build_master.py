import pandas as pd
from lib_geo import norm, STATE_MAP, is_reporting_unit, build_geo_lookup, match_district

ncrb = pd.read_csv('ncrb_district_year_features.csv')
ncrb['d_key'] = ncrb['district_norm'].apply(norm)
ncrb['s_key'] = ncrb['state_norm'].apply(norm).replace(STATE_MAP)

# latest available year per district
latest = (
    ncrb.sort_values('year')
    .groupby(['s_key', 'd_key'], as_index=False)
    .tail(1)
    .reset_index(drop=True)
)

lookup, by_state = build_geo_lookup('cities_geo.csv')

rows = []
for r in latest.itertuples():
    reporting_unit = is_reporting_unit(r.d_key)
    lat = lon = anchor_city = anchor_pop = match_type = None
    if not reporting_unit:
        lat, lon, anchor_city, anchor_pop, match_type = match_district(r.s_key, r.d_key, lookup, by_state)
    rows.append({
        'state_norm': r.state_norm, 'district_norm': r.district_norm,
        's_key': r.s_key, 'd_key': r.d_key,
        'is_reporting_unit': reporting_unit,
        'lat': lat, 'lon': lon, 'anchor_city': anchor_city,
        'anchor_city_pop': anchor_pop, 'geo_match_type': match_type,
    })
geo_df = pd.DataFrame(rows)

master = latest.merge(geo_df, on=['state_norm', 'district_norm', 's_key', 'd_key'])

# real Census 2011 population, matched on the same keys, for genuine per-capita rates
census = pd.read_csv('census2011.csv')
census['d_key'] = census['District name'].apply(norm)
census['s_key'] = census['State name'].apply(norm).replace(STATE_MAP)
census_best = census.sort_values('Population', ascending=False).drop_duplicates(subset=['s_key', 'd_key'])
master = master.merge(
    census_best[['s_key', 'd_key', 'Population']].rename(columns={'Population': 'census_2011_population'}),
    on=['s_key', 'd_key'], how='left'
)

n = len(master)
geocoded = master['lat'].notna().sum()
reporting = master['is_reporting_unit'].sum()
census_matched = master['census_2011_population'].notna().sum()
print(f"districts total={n}  geocoded={geocoded} ({geocoded/n:.0%})  "
      f"reporting_units_excluded_from_map={reporting}  census_pop_matched={census_matched} ({census_matched/n:.0%})")

master.to_csv('master_districts_latest.csv', index=False)

# also keep the full year-by-year table (with keys) for model training
ncrb.to_csv('features_with_keys.csv', index=False)
print("wrote master_districts_latest.csv and features_with_keys.csv")
