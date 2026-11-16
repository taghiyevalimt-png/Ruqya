# ESLint triage (evidence/stage2/eslint.txt, 321 messages) — read by the auditor, 2026-11-16
| Rule | Count | Verdict | Reason |
|---|---|---|---|
| security/detect-object-injection | 176 | not a defect | `obj[key]` with keys from the app's own constants/ids (state maps, dictionary); no user-controlled prototype keys reach writes (`__proto__` cannot come from data: ids are UUIDs, keys built by code) |
| no-unused-vars | 77 | not a defect (maintenance) | unused helpers/params; no behaviour impact; recorded as code-quality note |
| no-undef | 35 | false positive | Promise, Uint8Array, Intl are ES2015 builtins (config is ES5); LANG, applyTheme are defined in the first inline script of the same page |
| security/detect-non-literal-fs-filename | 15 | not a defect | tools/*.js read files named by the operator on the command line |
| no-redeclare | 6 | low (maintenance) | `var` declared twice inside one click handler (ca, mm, xs, ex); ES5 function scope, same variable, no bug |
| no-misleading-character-class | 5 | not a defect | EMOJI detection regex intentionally lists surrogate halves and joiners |
| security/detect-unsafe-regex | 3 | not a defect | `/^\d+(\.\d{1,2})?$/`, `/^#(d|new)=(\d{4}-\d{2}-\d{2})?$/`, sbom purl regex: anchored, no nested quantifiers over overlapping classes; linear time |
| no-useless-escape | 2 | not a defect | style |
| no-prototype-builtins | 1 | not a defect | `RUD.hasOwnProperty(s)` on the app's own dictionary object |
| security/detect-non-literal-regexp | 1 | not a defect | `new RegExp(EMOJI.source,"g")` from a constant |
Real defects found by static analysis: 0. Maintenance notes: unused variables and double `var` (no fix needed for behaviour).
