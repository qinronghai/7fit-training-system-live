const fs=require('fs'),assert=require('assert');

const css=fs.readFileSync('assets/app.css','utf8');

assert(
  /\n}\n\/\* Favorites \*\//.test(css),
  'the auxiliary mobile media query must close before later desktop styles'
);
assert(
  /\.post-cardio-field\{display:grid;gap:6px;/.test(css),
  'post-cardio fields must keep a readable label-to-control gap'
);
assert(
  /\.post-cardio-field select\{[^}]*border-radius:10px;[^}]*padding:10px 11px;/.test(css),
  'post-cardio selects must match the shared form-control spacing'
);
assert(
  /\.post-cardio-field select:focus-visible\{[^}]*outline:2px solid var\(--purple-dark\);/.test(css),
  'post-cardio selects must expose the shared purple keyboard focus'
);

console.log('post cardio styles: PASS');
