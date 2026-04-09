-- FIX PATCH: keep all visible/reportable buildings active
-- and make sure every community-reportable building exists in locations

create extension if not exists pgcrypto;

-- =========================
-- 1) coordinates columns
-- =========================
alter table locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists idx_locations_lat_lng
  on locations (latitude, longitude);

-- =========================
-- 2) refresh community summary view
-- =========================
drop view if exists recent_user_report_summary;

create view recent_user_report_summary as
select
  location_id,
  round(avg(crowdedness))::int as avg_crowdedness,
  round(avg(seats_available))::int as avg_seats_available,
  round(avg(quietness))::int as avg_quietness,
  bool_or(coalesce(is_open, false)) as any_open_report,
  count(*)::int as report_count,
  max(submitted_at) as last_reported_at
from user_reports
where submitted_at >= now() - interval '2 hours'
group by location_id;

-- =========================
-- 3) normalize a couple legacy building codes
-- keep ids the same, only update building_code so coordinates work
-- =========================
update locations
set
  building_code = case upper(building_code)
    when 'REN' then 'RUC'
    when 'STJ' then 'UTD'
    when 'SJU' then 'UTD'
    else upper(building_code)
  end,
  updated_at = now()
where building_code is not null;

-- =========================
-- 4) upsert every building you want to keep visible/reportable
-- DO NOT deactivate extras in this patch
-- =========================
insert into locations (
  id,
  name,
  building_code,
  category,
  source,
  waitz_name,
  description,
  campus,
  is_active,
  latitude,
  longitude
) values
  (
    'davis-library',
    'Davis Library',
    'DC',
    'library',
    'waitz',
    'Davis Library',
    'Library in Davis Centre with individual and group study space',
    'waterloo',
    true,
    43.472434,
    -80.542005
  ),
  (
    'dana-porter-library',
    'Dana Porter Library',
    'LIB',
    'library',
    'waitz',
    'Dana Porter Library',
    'Library with individual study carrels and group study areas',
    'waterloo',
    true,
    43.469694,
    -80.542298
  ),
  (
    'musagetes-architecture-library',
    'Musagetes Architecture Library',
    'ARC',
    'library',
    'waitz',
    'Musagetes Architecture Library',
    'Architecture library with study carrels and bookable study space',
    'waterloo',
    true,
    null,
    null
  ),
  (
    'milton-good-library',
    'Milton Good Library',
    'CGR',
    'library',
    'community',
    null,
    'Conrad Grebel library with individual and group study rooms',
    'waterloo',
    true,
    null,
    null
  ),
  (
    'lusi-wong-library',
    'Lusi Wong Library',
    'RUC',
    'library',
    'community',
    null,
    'Library study space',
    'waterloo',
    true,
    43.469004,
    -80.547260
  ),
  (
    'st-jeromes-university-library',
    'St. Jerome''s Library',
    'UTD',
    'library',
    'community',
    null,
    'Library study space',
    'waterloo',
    true,
    43.468704,
    -80.545892
  ),
  (
    'pharmacy-library',
    'Pharmacy Library',
    'PHR',
    'library',
    'community',
    null,
    'Pharmacy library with study rooms and individual study carrels',
    'waterloo',
    true,
    null,
    null
  ),
  (
    'the-centre-needles-hall',
    'The Centre, Needles Hall',
    'NH',
    'study_space',
    'community',
    null,
    'First-floor study rooms in Needles Hall',
    'waterloo',
    true,
    null,
    null
  ),
  (
    'student-life-centre',
    'Student Life Centre',
    'SLC',
    'study_space',
    'community',
    null,
    'Study rooms and quiet study space in SLC',
    'waterloo',
    true,
    43.471617,
    -80.545281
  ),
  (
    'tatham-centre',
    'William M. Tatham Centre',
    'TC',
    'study_space',
    'community',
    null,
    'Interview rooms that can be used as study rooms outside interview use',
    'waterloo',
    true,
    null,
    null
  ),
  (
    'engineering-2',
    'Engineering 2',
    'E2',
    'classroom_space',
    'community',
    null,
    'Classroom space that may be available for study',
    'waterloo',
    true,
    43.470822,
    -80.540483
  ),
  (
    'carl-a-pollock-hall',
    'Carl A. Pollock Hall',
    'CPH',
    'study_space',
    'community',
    null,
    'Includes POETS lounge and classroom space',
    'waterloo',
    true,
    43.470942,
    -80.539248
  ),
  (
    'physics-building',
    'Physics Building',
    'PHY',
    'classroom_space',
    'community',
    null,
    'Classroom space that may be available for study',
    'waterloo',
    true,
    43.470849,
    -80.541556
  ),
  (
    'modern-languages',
    'Modern Languages',
    'ML',
    'study_space',
    'community',
    null,
    'Classroom and cafeteria study space',
    'waterloo',
    true,
    43.468931,
    -80.542738
  ),
  (
    'hagey-hall-hub',
    'Hagey Hall Hub',
    'HH',
    'study_space',
    'community',
    null,
    'Includes Project Cube, mezzanine workspace, and Study Deck',
    'waterloo',
    true,
    43.468036,
    -80.541740
  ),
  (
    'science-teaching-complex',
    'Science Teaching Complex',
    'STC',
    'study_space',
    'community',
    null,
    'Lounge and single/double study spaces',
    'waterloo',
    true,
    43.470568,
    -80.543466
  ),
  (
    'quantum-nano-centre',
    'Quantum Nano Centre',
    'QNC',
    'study_space',
    'community',
    null,
    'Single and double study spaces',
    'waterloo',
    true,
    43.471360,
    -80.544322
  ),
  (
    'engineering-5',
    'Engineering 5',
    'E5',
    'study_space',
    'community',
    null,
    'Group study tables, lounge, and computer study spaces',
    'waterloo',
    true,
    43.472862,
    -80.540058
  ),
  (
    'environment-3',
    'Environment 3',
    'EV3',
    'study_space',
    'community',
    null,
    'Williams Fresh Cafe and study space',
    'waterloo',
    true,
    43.467996,
    -80.543254
  ),
  (
    'environment-1',
    'Environment 1',
    'EV1',
    'casual_space',
    'community',
    null,
    'Courtyard seating and casual study',
    'waterloo',
    true,
    43.468361,
    -80.542342
  ),
  (
    'davis-centre-cafeteria',
    'Davis Centre Cafeteria',
    'DC',
    'casual_space',
    'community',
    null,
    'Casual seating and tables in DC',
    'waterloo',
    true,
    43.472434,
    -80.542005
  ),
  (
    'math-coffee-donut-shop',
    'Math Coffee and Donut Shop',
    'MC',
    'casual_space',
    'community',
    null,
    'Third-floor casual study and seating',
    'waterloo',
    true,
    43.472121,
    -80.543933
  ),
  (
    'poets-lounge',
    'POETS Lounge',
    'CPH',
    'casual_space',
    'community',
    null,
    'Lounge space in Carl A. Pollock Hall',
    'waterloo',
    true,
    43.470942,
    -80.539248
  ),
  (
    'project-cube',
    'Project Cube',
    'HH',
    'study_space',
    'community',
    null,
    'Bookable glass-walled room in Hagey Hall Hub',
    'waterloo',
    true,
    43.468036,
    -80.541740
  ),
  (
    'study-deck',
    'Study Deck',
    'HH',
    'quiet_study',
    'community',
    null,
    'Quiet study room in Hagey Hall Hub',
    'waterloo',
    true,
    43.468036,
    -80.541740
  ),
  (
    'environment-2',
    'Environment 2',
    'EV2',
    'study_space',
    'community',
    null,
    'Reportable building entry for Environment 2',
    'waterloo',
    true,
    43.468263,
    -80.542704
  ),
  (
    'earth-sciences-chemistry',
    'Earth Sciences & Chemistry',
    'ESC',
    'study_space',
    'community',
    null,
    'Reportable building entry for Earth Sciences & Chemistry',
    'waterloo',
    true,
    43.471371,
    -80.542753
  ),
  (
    'mathematics-3',
    'Mathematics 3',
    'M3',
    'study_space',
    'community',
    null,
    'Reportable building entry for Mathematics 3',
    'waterloo',
    true,
    43.473189,
    -80.544075
  ),
  (
    'douglas-wright-engineering-building',
    'Douglas Wright Engineering Building',
    'DWE',
    'study_space',
    'community',
    null,
    'Reportable building entry for Douglas Wright Engineering Building',
    'waterloo',
    true,
    43.470081,
    -80.539708
  ),
  (
    'engineering-3',
    'Engineering 3',
    'E3',
    'study_space',
    'community',
    null,
    'Reportable building entry for Engineering 3',
    'waterloo',
    true,
    43.470807,
    -80.543704
  ),
  (
    'engineering-6',
    'Engineering 6',
    'E6',
    'study_space',
    'community',
    null,
    'Reportable building entry for Engineering 6',
    'waterloo',
    true,
    43.473006,
    -80.538707
  ),
  (
    'jr-coutts-engineering-lecture-hall',
    'J.R. Coutts Engineering Lecture Hall',
    'RCH',
    'study_space',
    'community',
    null,
    'Reportable building entry for RCH',
    'waterloo',
    true,
    43.470280,
    -80.540718
  ),
  (
    'biology-1',
    'Biology 1',
    'B1',
    'study_space',
    'community',
    null,
    'Reportable building entry for Biology 1',
    'waterloo',
    true,
    43.470816,
    -80.543716
  ),
  (
    'biology-2',
    'Biology 2',
    'B2',
    'study_space',
    'community',
    null,
    'Reportable building entry for Biology 2',
    'waterloo',
    true,
    43.470807,
    -80.543704
  ),
  (
    'chemistry-2',
    'Chemistry 2',
    'C2',
    'study_space',
    'community',
    null,
    'Reportable building entry for Chemistry 2',
    'waterloo',
    true,
    43.472627,
    -80.542973
  ),
  (
    'psychology-anthropology-sociology',
    'Psychology, Anthropology, Sociology',
    'PAS',
    'study_space',
    'community',
    null,
    'Reportable building entry for PAS',
    'waterloo',
    true,
    43.467152,
    -80.542283
  ),
  (
    'arts-lecture-hall',
    'Arts Lecture Hall',
    'AL',
    'study_space',
    'community',
    null,
    'Reportable building entry for Arts Lecture Hall',
    'waterloo',
    true,
    43.468891,
    -80.541783
  ),
  (
    'applied-health-sciences-expansion-building',
    'Applied Health Sciences Expansion Building',
    'HLTH',
    'study_space',
    'community',
    null,
    'Reportable building entry for Applied Health Sciences Expansion Building',
    'waterloo',
    true,
    43.473564,
    -80.546250
  ),
  (
    'school-of-optometry-and-vision-science',
    'School of Optometry and Vision Science',
    'OPT',
    'study_space',
    'community',
    null,
    'Reportable building entry for OPT',
    'waterloo',
    true,
    43.475882,
    -80.545504
  )

on conflict (id) do update
set
  name = excluded.name,
  building_code = excluded.building_code,
  category = excluded.category,
  source = excluded.source,
  waitz_name = excluded.waitz_name,
  description = excluded.description,
  campus = excluded.campus,
  is_active = true,
  latitude = coalesce(excluded.latitude, locations.latitude),
  longitude = coalesce(excluded.longitude, locations.longitude),
  updated_at = now();

-- =========================
-- 5) explicitly re-activate every building you want visible
-- this undoes the bad "deactivate non-canonical" migration
-- =========================
update locations
set
  is_active = true,
  updated_at = now()
where id in (
  'davis-library',
  'dana-porter-library',
  'musagetes-architecture-library',
  'milton-good-library',
  'lusi-wong-library',
  'st-jeromes-university-library',
  'pharmacy-library',
  'the-centre-needles-hall',
  'student-life-centre',
  'tatham-centre',
  'engineering-2',
  'carl-a-pollock-hall',
  'physics-building',
  'modern-languages',
  'hagey-hall-hub',
  'science-teaching-complex',
  'quantum-nano-centre',
  'engineering-5',
  'environment-3',
  'environment-1',
  'davis-centre-cafeteria',
  'math-coffee-donut-shop',
  'poets-lounge',
  'project-cube',
  'study-deck',
  'environment-2',
  'earth-sciences-chemistry',
  'mathematics-3',
  'douglas-wright-engineering-building',
  'engineering-3',
  'engineering-6',
  'jr-coutts-engineering-lecture-hall',
  'biology-1',
  'biology-2',
  'chemistry-2',
  'psychology-anthropology-sociology',
  'arts-lecture-hall',
  'applied-health-sciences-expansion-building',
  'school-of-optometry-and-vision-science'
);

-- =========================
-- 6) backfill coordinates by building code
-- =========================
update locations
set
  latitude = case upper(building_code)
    when 'LIB' then 43.469694
    when 'DC' then 43.472434
    when 'EV1' then 43.468361
    when 'EV2' then 43.468263
    when 'EV3' then 43.467996
    when 'MC' then 43.472121
    when 'M3' then 43.473189
    when 'ESC' then 43.471371
    when 'SLC' then 43.471617
    when 'STC' then 43.470568
    when 'CPH' then 43.470942
    when 'DWE' then 43.470081
    when 'E2' then 43.470822
    when 'E3' then 43.470807
    when 'E5' then 43.472862
    when 'E6' then 43.473006
    when 'RCH' then 43.470280
    when 'QNC' then 43.471360
    when 'PHY' then 43.470849
    when 'B1' then 43.470816
    when 'B2' then 43.470807
    when 'C2' then 43.472627
    when 'PAS' then 43.467152
    when 'HH' then 43.468036
    when 'AL' then 43.468891
    when 'ML' then 43.468931
    when 'HLTH' then 43.473564
    when 'OPT' then 43.475882
    when 'RUC' then 43.469004
    when 'UTD' then 43.468704
    else latitude
  end,
  longitude = case upper(building_code)
    when 'LIB' then -80.542298
    when 'DC' then -80.542005
    when 'EV1' then -80.542342
    when 'EV2' then -80.542704
    when 'EV3' then -80.543254
    when 'MC' then -80.543933
    when 'M3' then -80.544075
    when 'ESC' then -80.542753
    when 'SLC' then -80.545281
    when 'STC' then -80.543466
    when 'CPH' then -80.539248
    when 'DWE' then -80.539708
    when 'E2' then -80.540483
    when 'E3' then -80.543704
    when 'E5' then -80.540058
    when 'E6' then -80.538707
    when 'RCH' then -80.540718
    when 'QNC' then -80.544322
    when 'PHY' then -80.541556
    when 'B1' then -80.543716
    when 'B2' then -80.543704
    when 'C2' then -80.542973
    when 'PAS' then -80.542283
    when 'HH' then -80.541740
    when 'AL' then -80.541783
    when 'ML' then -80.542738
    when 'HLTH' then -80.546250
    when 'OPT' then -80.545504
    when 'RUC' then -80.547260
    when 'UTD' then -80.545892
    else longitude
  end,
  updated_at = now()
where building_code is not null;

update occupancy_readings
set
  location_id = 'davis-library',
  location_name = 'Davis Library'
where lower(location_name) = 'davis library'
  and location_id <> 'davis-library';